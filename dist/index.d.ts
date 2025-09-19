import { AccessOptions } from 'basic-ftp';
export interface FtpDeployConfig extends AccessOptions {
    local_dir: string;
    remote_dir: string;
    clean_remote_files?: boolean;
    clear_destination?: boolean;
    dry_run?: boolean;
    preserve?: string[];
    reconnect?: boolean;
    max_retries?: number;
    retry_delay?: number;
}
export interface DeployStats {
    uploaded: string[];
    removed: string[];
    unchanged: string[];
    errors: string[];
}
export declare class FtpDeploy {
    private static readonly HASH_FILE_NAME;
    private client;
    private config;
    private remoteHashFile;
    private stats;
    private startTime;
    constructor(config: FtpDeployConfig);
    private calcHash;
    private sleep;
    private reconnect;
    private executeWithRetry;
    private getLocalFiles;
    private remoteFileExists;
    private shouldPreserve;
    private removeEmptyDirectories;
    private getRemoteFiles;
    private clearDestination;
    private loadRemoteHashes;
    private saveRemoteHashes;
    private printAnalysis;
    private printSummary;
    deploy(): Promise<DeployStats>;
}
export default FtpDeploy;
//# sourceMappingURL=index.d.ts.map