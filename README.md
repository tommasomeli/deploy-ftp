# deploy-ftp

🚀 Simple FTP deployment tool with hash-based change detection and execution time tracking.

## Features

- ✅ **Hash-based incremental deployment** - Only uploads changed files
- ✅ **FTPS/TLS support** - Secure connections
- ✅ **Clean mode** - Remove orphaned files from server
- ✅ **Preserve paths** - Protect specific files/directories
- ✅ **Dry run mode** - Preview changes without uploading
- ✅ **Execution time tracking** - Monitor deployment performance
- ✅ **CLI & Programmatic API** - Use from command line or Node.js
- ✅ **TypeScript support** - Full type definitions included

## Installation

### Global Installation (for CLI usage)

```bash
npm install -g git+https://github.com/tommasomeli/deploy-ftp.git
```

### Local Installation (for programmatic usage)

```bash
npm install git+https://github.com/tommasomeli/deploy-ftp.git
```

## Quick Start

### CLI Usage

```bash
# Basic deployment
deploy-ftp --host your-server.com --user username --password password \
           --local-dir ./dist --remote-dir /public_html

# With FTPS and clean mode
deploy-ftp --host your-server.com --user username --password password \
           --local-dir ./dist --remote-dir /public_html --secure --clean

# Dry run to preview changes
deploy-ftp --host your-server.com --user username --password password \
           --local-dir ./dist --remote-dir /public_html --dry-run

# Using a config file
deploy-ftp --config deploy-ftp.json
```

### Programmatic Usage

```typescript
import { FtpDeploy } from 'deploy-ftp';
import path from 'path';

const deployer = new FtpDeploy({
    host: 'your-ftp-server.com',
    user: 'your-username',
    password: 'your-password',
    secure: true,
    secureOptions: { rejectUnauthorized: false },
    port: 21,
    local_dir: path.join(process.cwd(), 'build'),
    remote_dir: '/public_html',
    preserve: ['public/uploads'],
    clean_remote_files: true,
    clear_destination: false,
    dry_run: true
});

const stats = await deployer.deploy();
console.log(`✨ Deployment completed!`);
console.log(`📤 Uploaded: ${stats.uploaded.length} files`);
console.log(`🗑️  Removed: ${stats.removed.length} files`);
console.log(`✅ Unchanged: ${stats.unchanged.length} files`);
console.log(`❌ Errors: ${stats.errors.length} files`);
```

#### Simple Example

```typescript
import { FtpDeploy } from 'deploy-ftp';

const deployer = new FtpDeploy({
    host: 'your-ftp-server.com',
    user: 'username',
    password: 'password',
    secure: true, // Use FTPS
    local_dir: './dist',
    remote_dir: '/public_html',
    clean_remote_files: true,
    dry_run: false
});

const stats = await deployer.deploy();
console.log(`Deployed ${stats.uploaded.length} files in total`);
```

## CLI Options

### Required Options

- `--host <host>` - FTP server hostname
- `--user <user>` - FTP username
- `--password <password>` - FTP password
- `--local-dir <path>` - Local directory to deploy
- `--remote-dir <path>` - Remote directory path

### Optional Options

- `--secure` - Use FTPS/TLS (default: false)
- `--port <port>` - FTP port (default: 21)
- `--clean` - Remove orphaned files from remote (default: false)
- `--clear-destination` - Clear entire remote directory before deployment (default: false)
- `--dry-run` - Preview changes without actually deploying (default: false)
- `--preserve <paths>` - Comma-separated paths to preserve from deletion
- `--config <file>` - Load configuration from JSON file
- `--reject-unauthorized` - Reject unauthorized SSL certificates (default: true)

### Configuration File

Create a `deploy-ftp.json` file:

```json
{
    "host": "your-server.com",
    "user": "username",
    "password": "password",
    "secure": true,
    "port": 21,
    "local_dir": "./dist",
    "remote_dir": "/public_html",
    "clean_remote_files": true,
    "dry_run": false,
    "preserve": ["uploads/", "cache/"],
    "secureOptions": {
        "rejectUnauthorized": false
    }
}
```

Then run: `deploy-ftp --config deploy-ftp.json`

**Example configuration file:**
Copy `deploy-ftp.example.json` to `deploy-ftp.json` and customize with your settings.

## Programmatic Configuration

### Required Options

- `host` - FTP server hostname
- `user` - FTP username
- `password` - FTP password
- `local_dir` - Local directory to deploy
- `remote_dir` - Remote directory path

### Optional Options

- `secure` - Use FTPS (default: false)
- `port` - FTP port (default: 21)
- `clean_remote_files` - Remove orphaned files (default: false)
- `clear_destination` - Clear entire remote directory (default: false)
- `dry_run` - Preview mode, no actual changes (default: false)
- `preserve` - Array of paths to preserve from deletion
- `reconnect` - Enable automatic reconnection on connection errors (default: true)
- `max_retries` - Maximum number of retry attempts (default: 3)
- `retry_delay` - Delay between retry attempts in milliseconds (default: 1000)

### Connection Error Handling

The library automatically handles common FTP connection errors (ECONNRESET, ETIMEDOUT, etc.) with built-in retry logic:

- **Automatic Reconnection**: Enabled by default, reconnects on connection failures
- **Smart Retry**: Only retries on connection-related errors, not logical errors
- **Configurable Delays**: Customizable retry delays to avoid overwhelming the server
- **Operation-Specific**: Each FTP operation (upload, download, delete) is individually retried

```javascript
const deployer = new FtpDeploy({
    // ... other config
    reconnect: true,      // Enable auto-reconnection (default: true)
    max_retries: 5,       // Try up to 5 times (default: 3)
    retry_delay: 2000     // Wait 2 seconds between attempts (default: 1000ms)
});
```

## Example Output

```
🔌 Connecting to FTPS server...
✅ Connected to FTPS server.

📥 Reading remote hash file...
✅ Found remote hash file with 245 entries

📂 Scanning local files...
✅ Found 187 local files

============================================================
📊 DEPLOY ANALYSIS
============================================================

🏠 Local directory: ./dist
🌐 Remote directory: /public_html
🧹 Clean mode: ✅ ENABLED
🔍 Dry run: ❌ DISABLED
🔄 Auto reconnect: ✅ ENABLED
🔁 Max retries: 3, Retry delay: 1000ms

📁 Total local files: 187
📁 Total remote files: 245

📤 FILES TO UPLOAD (3):
   ↗️  index.html
   ↗️  assets/main.js
   ↗️  assets/style.css

🗑️  FILES TO REMOVE (1):
   ❌ old-file.txt

============================================================

🚀 Starting deployment process...

📤 Uploaded: index.html
📤 Uploaded: assets/main.js
📤 Uploaded: assets/style.css
🗑️ Removed: old-file.txt

✨ DEPLOY COMPLETED ✨
📤 Uploaded: 3 files
🗑️  Removed: 1 files
✅ Unchanged: 184 files
❌ Errors: 0 files
⏱️  Total execution time: 12.34s
```

## Advanced Usage

### Preserve Specific Paths

```typescript
const deployer = new FtpDeploy({
    host: 'your-ftp-server.com',
    user: 'username',
    password: 'password',
    local_dir: './dist',
    remote_dir: '/public_html',
    preserve: ['uploads/', 'cache/', 'config.json'],
    clean_remote_files: true
});
```

### Clear Entire Destination

```typescript
const deployer = new FtpDeploy({
    host: 'your-ftp-server.com',
    user: 'username',
    password: 'password',
    local_dir: './dist',
    remote_dir: '/public_html',
    clear_destination: true // Removes ALL remote files first
});
```

## API Reference

### `FtpDeploy`

Main deployment class.

#### `constructor(config: FtpDeployConfig)`

Creates a new FTP deployer instance.

#### `deploy(): Promise<DeployStats>`

Executes the deployment and returns statistics.

### `FtpDeployConfig`

Configuration interface extending basic-ftp's `AccessOptions`.

### `DeployStats`

Deployment result statistics:

```typescript
interface DeployStats {
    uploaded: string[];   // Files uploaded
    removed: string[];    // Files removed
    unchanged: string[];  // Files unchanged
    errors: string[];     // Error messages
}
```

## License

MIT

## Dependencies

- [basic-ftp](https://www.npmjs.com/package/basic-ftp) - FTP client library
