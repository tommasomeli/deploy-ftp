"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FtpDeploy = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = __importDefault(require("crypto"));
const basic_ftp_1 = require("basic-ftp");
class FtpDeploy {
    constructor(config) {
        this.startTime = 0;
        this.client = new basic_ftp_1.Client();
        this.client.ftp.verbose = false;
        this.config = {
            clean_remote_files: false,
            clear_destination: false,
            dry_run: false,
            preserve: [],
            reconnect: true,
            max_retries: 3,
            retry_delay: 1000,
            ...config
        };
        this.remoteHashFile = path_1.default.posix.join(this.config.remote_dir, FtpDeploy.HASH_FILE_NAME);
        this.stats = {
            uploaded: [],
            removed: [],
            unchanged: [],
            errors: []
        };
    }
    // Calculate MD5 hash of a file
    calcHash(filePath) {
        const data = fs_1.default.readFileSync(filePath);
        return crypto_1.default.createHash('md5').update(data).digest('hex');
    }
    // Sleep utility for retry delays
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    // Reconnect to FTP server
    async reconnect() {
        console.log('🔄 Reconnecting to FTP server...');
        try {
            this.client.close();
            this.client = new basic_ftp_1.Client();
            this.client.ftp.verbose = false;
            await this.client.access(this.config);
            console.log('✅ Reconnected successfully');
        }
        catch (err) {
            console.error('❌ Reconnection failed:', err);
            throw err;
        }
    }
    // Execute FTP operation with retry logic
    async executeWithRetry(operation, operationName, retries = this.config.max_retries || 3) {
        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                return await operation();
            }
            catch (err) {
                const isConnectionError = err.code === 'ECONNRESET' ||
                    err.code === 'ENOTFOUND' ||
                    err.code === 'ETIMEDOUT' ||
                    err.code === 'ECONNREFUSED' ||
                    err.message?.includes('connection');
                if (isConnectionError && this.config.reconnect && attempt < retries) {
                    console.log(`⚠️  ${operationName} failed (attempt ${attempt}/${retries}): ${err.message}`);
                    console.log(`🔄 Retrying in ${this.config.retry_delay}ms...`);
                    await this.sleep(this.config.retry_delay || 1000);
                    try {
                        await this.reconnect();
                    }
                    catch (reconnectErr) {
                        if (attempt === retries)
                            throw err;
                        continue;
                    }
                }
                else {
                    throw err;
                }
            }
        }
        throw new Error(`Operation failed after ${retries} attempts`);
    }
    // Recursively get all local files
    getLocalFiles(dir) {
        let results = [];
        const list = fs_1.default.readdirSync(dir);
        for (const file of list) {
            const fullPath = path_1.default.join(dir, file);
            const stats = fs_1.default.statSync(fullPath);
            if (stats.isDirectory())
                results = results.concat(this.getLocalFiles(fullPath));
            else
                results.push(fullPath);
        }
        return results;
    }
    // Check if remote file exists
    async remoteFileExists(remotePath) {
        try {
            await this.client.size(remotePath);
            return true;
        }
        catch {
            return false;
        }
    }
    // Check if a path should be preserved from deletion
    shouldPreserve(filePath) {
        if (!this.config.preserve || this.config.preserve.length === 0)
            return false;
        const result = this.config.preserve.some((preservePath) => {
            const normalizedFile = filePath.replace(/\\/g, '/');
            const normalizedPreserve = preservePath.replace(/\\/g, '/');
            const cleanPreservePath = normalizedPreserve.endsWith('/') ?
                normalizedPreserve.slice(0, -1) : normalizedPreserve;
            const matches = normalizedFile === cleanPreservePath ||
                normalizedFile.startsWith(cleanPreservePath + '/');
            if (matches && !this.config.dry_run) {
                console.log(`🛡️  Preserving: ${filePath} (matched by ${preservePath})`);
            }
            return matches;
        });
        return result;
    }
    // Remove empty directories recursively
    async removeEmptyDirectories(remoteDir, preserveRoot = true) {
        try {
            const list = await this.client.list(remoteDir);
            const directories = list.filter((item) => item.isDirectory && item.name !== '.' && item.name !== '..');
            for (const dir of directories) {
                const dirPath = path_1.default.posix.join(remoteDir, dir.name);
                const relativeDirPath = path_1.default.posix.relative(this.config.remote_dir, dirPath);
                if (this.shouldPreserve(relativeDirPath))
                    continue;
                await this.removeEmptyDirectories(dirPath, false);
            }
            const updatedList = await this.client.list(remoteDir);
            const hasContent = updatedList.some((item) => item.name !== '.' && item.name !== '..' && item.name !== FtpDeploy.HASH_FILE_NAME);
            if (!hasContent && !preserveRoot) {
                const relativeDirPath = path_1.default.posix.relative(this.config.remote_dir, remoteDir);
                if (!this.shouldPreserve(relativeDirPath)) {
                    if (this.config.dry_run)
                        console.log(`📁 Would remove empty directory: ${relativeDirPath}`);
                    else {
                        await this.client.removeDir(remoteDir);
                        console.log(`📁 Removed empty directory: ${relativeDirPath}`);
                    }
                }
            }
        }
        catch (err) {
            console.log(`⚠️ Could not process directory ${remoteDir}: ${err}`);
        }
    }
    // Recursively scan all remote files
    async getRemoteFiles(remoteDir) {
        const files = [];
        try {
            const list = await this.client.list(remoteDir);
            for (const item of list) {
                if (item.name === '.' || item.name === '..')
                    continue;
                const itemPath = path_1.default.posix.join(remoteDir, item.name);
                if (item.isDirectory) {
                    const subFiles = await this.getRemoteFiles(itemPath);
                    files.push(...subFiles);
                }
                else if (item.isFile && item.name !== FtpDeploy.HASH_FILE_NAME) {
                    const relativePath = path_1.default.posix.relative(this.config.remote_dir, itemPath);
                    files.push(relativePath);
                }
            }
        }
        catch (err) {
            console.log(`⚠️ Could not list directory ${remoteDir}: ${err}`);
        }
        return files;
    }
    // Clear entire remote destination
    async clearDestination() {
        const action = this.config.dry_run ? 'Would clear' : 'Clearing';
        console.log(`\n🧹 CLEAR_DESTINATION enabled - ${action.toLowerCase()} all remote files...`);
        const remoteFiles = await this.getRemoteFiles(this.config.remote_dir);
        for (const file of remoteFiles) {
            try {
                if (this.config.dry_run) {
                    console.log(`🗑️ ${action}: ${file}`);
                    this.stats.removed.push(file);
                }
                else {
                    const remoteFile = path_1.default.posix.join(this.config.remote_dir, file);
                    await this.client.remove(remoteFile);
                    console.log(`🗑️ Cleared: ${file}`);
                    this.stats.removed.push(file);
                }
            }
            catch (err) {
                const errorMsg = `Failed to clear ${file}: ${err}`;
                console.error(`❌ ${errorMsg}`);
                this.stats.errors.push(errorMsg);
            }
        }
        // Remove empty directories after clearing files
        console.log(`\n📁 ${action} empty directories...`);
        await this.removeEmptyDirectories(this.config.remote_dir);
    }
    // Load remote hash file
    async loadRemoteHashes() {
        const remoteHashes = {};
        const hashFileExists = await this.remoteFileExists(this.remoteHashFile);
        if (hashFileExists) {
            const tempHashFile = path_1.default.join(__dirname, FtpDeploy.HASH_FILE_NAME);
            try {
                await this.executeWithRetry(async () => {
                    await this.client.downloadTo(tempHashFile, this.remoteHashFile);
                }, 'Download hash file');
                const hashStr = fs_1.default.readFileSync(tempHashFile, 'utf8');
                if (hashStr) {
                    Object.assign(remoteHashes, JSON.parse(hashStr));
                    console.log(`✅ Found remote hash file with ${Object.keys(remoteHashes).length} entries`);
                }
            }
            catch (err) {
                console.log(`⚠️ Error reading remote hash file: ${err}`);
            }
            finally {
                try {
                    fs_1.default.unlinkSync(tempHashFile);
                }
                catch { }
            }
        }
        else
            console.log('⚠️  Remote hash file not found, creating a new one.');
        return remoteHashes;
    }
    // Save remote hash file
    async saveRemoteHashes(remoteHashes) {
        const tempHashFile = path_1.default.join(__dirname, FtpDeploy.HASH_FILE_NAME);
        try {
            fs_1.default.writeFileSync(tempHashFile, JSON.stringify(remoteHashes, null, 2));
            await this.executeWithRetry(async () => {
                await this.client.uploadFrom(tempHashFile, this.remoteHashFile);
            }, 'Upload hash file');
        }
        finally {
            try {
                fs_1.default.unlinkSync(tempHashFile);
            }
            catch { }
        }
    }
    // Print deployment analysis
    printAnalysis(localHashes, remoteHashes, remoteFiles) {
        console.log('\n' + '='.repeat(60));
        console.log('📊 DEPLOY ANALYSIS');
        console.log('='.repeat(60));
        console.log(`\n🏠 Local directory: ${this.config.local_dir}`);
        console.log(`🌐 Remote directory: ${this.config.remote_dir}`);
        console.log(`🧹 Clean mode: ${this.config.clean_remote_files ? '✅ ENABLED' : '❌ DISABLED'}`);
        console.log(`🚨 Clear destination: ${this.config.clear_destination ? '✅ ENABLED' : '❌ DISABLED'}`);
        console.log(`🔍 Dry run: ${this.config.dry_run ? '✅ ENABLED' : '❌ DISABLED'}`);
        console.log(`🔄 Auto reconnect: ${this.config.reconnect ? '✅ ENABLED' : '❌ DISABLED'}`);
        if (this.config.reconnect)
            console.log(`🔁 Max retries: ${this.config.max_retries}, Retry delay: ${this.config.retry_delay}ms`);
        if (this.config.preserve && this.config.preserve.length > 0)
            console.log(`🛡️  Preserve paths: ${this.config.preserve.join(', ')}`);
        console.log(`\n📁 Total local files: ${Object.keys(localHashes).length}`);
        if (remoteFiles)
            console.log(`📁 Total remote files: ${remoteFiles.length}`);
        else
            console.log(`📁 Total remote files (from hash): ${Object.keys(remoteHashes).length}`);
        const filesToUpload = Object.keys(localHashes).filter((localPath) => remoteHashes[localPath] !== localHashes[localPath]);
        if (filesToUpload.length > 0) {
            console.log(`\n📤 FILES TO UPLOAD (${filesToUpload.length}):`);
            filesToUpload.forEach((file) => console.log(`   ↗️  ${file}`));
        }
        if (this.config.clean_remote_files && remoteFiles && !this.config.clear_destination) {
            const filesToRemove = remoteFiles.filter((remotePath) => !localHashes[remotePath]);
            if (filesToRemove.length > 0) {
                console.log(`\n🗑️  FILES TO REMOVE (${filesToRemove.length}):`);
                filesToRemove.forEach((file) => console.log(`   ❌ ${file}`));
            }
        }
        console.log('\n' + '='.repeat(60));
    }
    // Print final summary
    printSummary() {
        const duration = Date.now() - this.startTime;
        const seconds = (duration / 1000).toFixed(2);
        console.log('✨ DEPLOY COMPLETED ✨');
        console.log(`📤 Uploaded: ${this.stats.uploaded.length} files`);
        console.log(`🗑️  Removed: ${this.stats.removed.length} files`);
        console.log(`✅ Unchanged: ${this.stats.unchanged.length} files`);
        console.log(`❌ Errors: ${this.stats.errors.length} files`);
        console.log(`⏱️  Total execution time: ${seconds}s`);
    }
    // Main deploy method
    async deploy() {
        this.startTime = Date.now();
        try {
            console.log('🔌 Connecting to FTPS server...');
            await this.client.access(this.config);
            console.log('✅ Connected to FTPS server.');
            // Clear destination if enabled (ignores clean_remote_files)
            if (this.config.clear_destination)
                await this.clearDestination();
            console.log('\n📥 Reading remote hash file...');
            const remoteHashes = await this.loadRemoteHashes();
            console.log('\n📂 Scanning local files...');
            const localFiles = this.getLocalFiles(this.config.local_dir);
            console.log(`✅ Found ${localFiles.length} local files`);
            // Create local hashes map
            const localHashes = {};
            for (const localFile of localFiles) {
                const relativePath = path_1.default.relative(this.config.local_dir, localFile).replace(/\\/g, '/');
                localHashes[relativePath] = this.calcHash(localFile);
            }
            // Scan remote files if clean mode is enabled (and not clearing destination)
            let remoteFiles;
            if (this.config.clean_remote_files && !this.config.clear_destination) {
                console.log('\n📂 Scanning remote files (clean mode enabled)...');
                remoteFiles = await this.getRemoteFiles(this.config.remote_dir);
                console.log(`✅ Found ${remoteFiles.length} remote files`);
            }
            // Show initial analysis
            this.printAnalysis(localHashes, remoteHashes, remoteFiles);
            console.log('\n🚀 Starting deployment process...\n');
            // Process local files
            for (const localFile of localFiles) {
                const relativePath = path_1.default.relative(this.config.local_dir, localFile).replace(/\\/g, '/');
                const remoteFile = path_1.default.posix.join(this.config.remote_dir, relativePath);
                const localHash = localHashes[relativePath];
                try {
                    if (remoteHashes[relativePath] === localHash) {
                        console.log(`⏸️  Unchanged: ${relativePath}`);
                        this.stats.unchanged.push(relativePath);
                        continue;
                    }
                    if (this.config.dry_run) {
                        console.log(`📤 Would upload: ${relativePath}`);
                        this.stats.uploaded.push(relativePath);
                        remoteHashes[relativePath] = localHash;
                    }
                    else {
                        // Create remote directories if needed
                        const remoteDir = path_1.default.posix.dirname(remoteFile);
                        await this.client.ensureDir(remoteDir);
                        // Upload file
                        await this.client.uploadFrom(localFile, remoteFile);
                        console.log(`📤 Uploaded: ${relativePath}`);
                        this.stats.uploaded.push(relativePath);
                        remoteHashes[relativePath] = localHash;
                    }
                }
                catch (err) {
                    const errorMsg = `Failed to upload ${relativePath}: ${err}`;
                    console.error(`❌ ${errorMsg}`);
                    this.stats.errors.push(errorMsg);
                }
            }
            // Clean remote files
            if (this.config.clean_remote_files && !this.config.clear_destination && remoteFiles) {
                const orphanedFiles = remoteFiles.filter((remotePath) => !localHashes[remotePath]);
                console.log(`\n🔍 Found ${orphanedFiles.length} orphaned remote files`);
                if (this.config.preserve && this.config.preserve.length > 0) {
                    console.log(`🛡️  Checking preserve patterns: ${this.config.preserve.join(', ')}`);
                }
                const filesToRemove = orphanedFiles.filter((remotePath) => !this.shouldPreserve(remotePath));
                // Preserve files should keep their hash entries
                const preservedFiles = orphanedFiles.filter((remotePath) => this.shouldPreserve(remotePath));
                if (preservedFiles.length > 0) {
                    console.log(`🛡️  Preserved ${preservedFiles.length} files from deletion`);
                    // Keep the hash entries for preserved files
                    preservedFiles.forEach(file => {
                        if (!remoteHashes[file]) {
                            // If we don't have a hash, create a placeholder to keep the file tracked
                            remoteHashes[file] = 'preserved';
                        }
                    });
                }
                if (filesToRemove.length > 0) {
                    const action = this.config.dry_run ? 'Would clean up' : 'Cleaning up';
                    console.log(`\n🧹 ${action} ${filesToRemove.length} orphaned remote files...`);
                    for (const fileToRemove of filesToRemove) {
                        try {
                            if (this.config.dry_run) {
                                console.log(`🗑️  Would remove: ${fileToRemove}`);
                                this.stats.removed.push(fileToRemove);
                                delete remoteHashes[fileToRemove];
                            }
                            else {
                                await this.executeWithRetry(async () => {
                                    const remoteFile = path_1.default.posix.join(this.config.remote_dir, fileToRemove);
                                    await this.client.remove(remoteFile);
                                }, `Remove ${fileToRemove}`);
                                console.log(`🗑️ Removed: ${fileToRemove}`);
                                this.stats.removed.push(fileToRemove);
                                delete remoteHashes[fileToRemove];
                            }
                        }
                        catch (err) {
                            const errorMsg = `Failed to remove ${fileToRemove}: ${err}`;
                            console.error(`❌ ${errorMsg}`);
                            this.stats.errors.push(errorMsg);
                        }
                    }
                }
                else
                    console.log('\n✅ No remote files need to be removed');
                // Remove empty directories after cleaning files
                if (filesToRemove.length > 0) {
                    const dirAction = this.config.dry_run ? 'Would remove' : 'Removing';
                    console.log(`\n📁 ${dirAction} empty directories...`);
                    await this.removeEmptyDirectories(this.config.remote_dir);
                }
            }
            // Update remote hash file
            if (this.config.dry_run) {
                console.log('\n💾 Would update remote hash file');
            }
            else {
                console.log('\n💾 Updating remote hash file...');
                await this.saveRemoteHashes(remoteHashes);
                console.log('✅ Remote hash file updated');
            }
            this.printSummary();
            return this.stats;
        }
        catch (err) {
            console.error('\n💥 Critical Error:', err);
            this.stats.errors.push(`Critical error: ${err}`);
            return this.stats;
        }
        finally {
            this.client.close();
            console.log('🔌 Connection closed.');
        }
    }
}
exports.FtpDeploy = FtpDeploy;
FtpDeploy.HASH_FILE_NAME = '.deploy_ftp_hash.json';
// Export default for convenience
exports.default = FtpDeploy;
//# sourceMappingURL=index.js.map