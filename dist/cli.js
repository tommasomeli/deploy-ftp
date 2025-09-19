#!/usr/bin/env node
"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const index_1 = require("./index");
const program = new commander_1.Command();
// Load configuration from file
function loadConfigFile(configPath) {
    try {
        const resolvedPath = path_1.default.resolve(configPath);
        if (!fs_1.default.existsSync(resolvedPath)) {
            throw new Error(`Configuration file not found: ${configPath}`);
        }
        const content = fs_1.default.readFileSync(resolvedPath, 'utf8');
        return JSON.parse(content);
    }
    catch (error) {
        console.error(`❌ Error loading config file: ${error}`);
        process.exit(1);
    }
}
program
    .name('deploy-ftp')
    .description('Fast and efficient FTP deployment tool with hash-based change detection')
    .version('1.0.0')
    .option('-h, --host <host>', 'FTP server hostname')
    .option('-u, --user <user>', 'FTP username')
    .option('-p, --password <password>', 'FTP password')
    .option('--port <port>', 'FTP port (default: 21)', parseInt)
    .option('-s, --secure', 'Use FTPS/TLS (default: false)', false)
    .option('--local-dir <path>', 'Local directory to deploy')
    .option('--remote-dir <path>', 'Remote directory path')
    .option('--clean', 'Remove orphaned files from remote (default: false)', false)
    .option('--clear-destination', 'Clear entire remote directory before deployment (default: false)', false)
    .option('--dry-run', 'Preview changes without actually deploying (default: false)', false)
    .option('--preserve <paths>', 'Comma-separated paths to preserve from deletion', '')
    .option('--reconnect', 'Enable automatic reconnection on connection errors (default: true)', true)
    .option('--max-retries <number>', 'Maximum number of retry attempts (default: 3)', parseInt)
    .option('--retry-delay <ms>', 'Delay between retry attempts in milliseconds (default: 1000)', parseInt)
    .option('-c, --config <file>', 'Load configuration from JSON file')
    .option('--reject-unauthorized', 'Reject unauthorized SSL certificates (default: true)', true)
    .action(async (options) => {
    try {
        let config = {};
        // Load config file if specified
        if (options.config) {
            config = loadConfigFile(options.config);
        }
        // Override config file values with CLI arguments
        const finalConfig = {
            ...config,
            ...(options.host && { host: options.host }),
            ...(options.user && { user: options.user }),
            ...(options.password && { password: options.password }),
            ...(options.port && { port: options.port }),
            ...(options.secure !== undefined && { secure: options.secure }),
            ...(options.localDir && { local_dir: path_1.default.resolve(options.localDir) }),
            ...(options.remoteDir && { remote_dir: options.remoteDir }),
            ...(options.clean !== undefined && { clean_remote_files: options.clean }),
            ...(options.clearDestination !== undefined && { clear_destination: options.clearDestination }),
            ...(options.dryRun !== undefined && { dry_run: options.dryRun }),
            ...(options.preserve && { preserve: options.preserve.split(',').map((p) => p.trim()) }),
            ...(options.reconnect !== undefined && { reconnect: options.reconnect }),
            ...(options.maxRetries && { max_retries: options.maxRetries }),
            ...(options.retryDelay && { retry_delay: options.retryDelay }),
            secureOptions: {
                rejectUnauthorized: options.rejectUnauthorized,
                ...config.secureOptions
            }
        };
        // Validate required parameters
        if (!finalConfig.host) {
            console.error('❌ Error: --host is required');
            process.exit(1);
        }
        if (!finalConfig.user) {
            console.error('❌ Error: --user is required');
            process.exit(1);
        }
        if (!finalConfig.password) {
            console.error('❌ Error: --password is required');
            process.exit(1);
        }
        if (!finalConfig.local_dir) {
            console.error('❌ Error: --local-dir is required');
            process.exit(1);
        }
        if (!finalConfig.remote_dir) {
            console.error('❌ Error: --remote-dir is required');
            process.exit(1);
        }
        // Check if local directory exists
        if (!fs_1.default.existsSync(finalConfig.local_dir)) {
            console.error(`❌ Error: Local directory does not exist: ${finalConfig.local_dir}`);
            process.exit(1);
        }
        console.log('🚀 Starting FTP deployment...\n');
        console.log(`📁 Local: ${finalConfig.local_dir}`);
        console.log(`🌐 Remote: ${finalConfig.remote_dir}`);
        console.log(`🔒 Secure: ${finalConfig.secure ? 'Yes' : 'No'}`);
        console.log(`🧹 Clean: ${finalConfig.clean_remote_files ? 'Yes' : 'No'}`);
        console.log(`🚨 Clear destination: ${finalConfig.clear_destination ? 'Yes' : 'No'}`);
        console.log(`🔍 Dry run: ${finalConfig.dry_run ? 'Yes' : 'No'}\n`);
        const deployer = new index_1.FtpDeploy(finalConfig);
        const stats = await deployer.deploy();
        // Exit with appropriate code
        if (stats.errors.length > 0) {
            console.log(`\n💥 Deployment completed with ${stats.errors.length} errors`);
            process.exit(1);
        }
        else {
            console.log('\n✅ Deployment completed successfully');
            process.exit(0);
        }
    }
    catch (error) {
        console.error(`💥 Fatal error: ${error}`);
        process.exit(1);
    }
});
program.parse();
//# sourceMappingURL=cli.js.map