/**
 * Interface for logger operations
 * Implementations will handle specific logging integrations (winston, console, etc.)
 */
export interface LoggerAdapter {
    /**
     * Logs a debug message
     * @param message The message to log
     * @param metadata Optional metadata to include with the log
     */
    debug(message: string, metadata?: any): void;

    /**
     * Logs an info message
     * @param message The message to log
     * @param metadata Optional metadata to include with the log
     */
    info(message: string, metadata?: any): void;

    /**
     * Logs a warning message
     * @param message The message to log
     * @param metadata Optional metadata to include with the log
     */
    warn(message: string, metadata?: any): void;

    /**
     * Logs an error message
     * @param message The message to log
     * @param metadata Optional metadata to include with the log
     */
    error(message: string, metadata?: any): void;

    /**
     * Logs a message with specified level
     * @param level The log level
     * @param message The message to log
     * @param metadata Optional metadata to include with the log
     */
    log(options: { level: string; message: string; metadata?: any }): void;
}

/**
 * Default implementation of LoggerAdapter
 * Uses console logging as fallback when no specific logger is configured
 */
export class DefaultLoggerAdapter implements LoggerAdapter {
    debug(message: string, metadata?: any): void {
        console.debug(`[DEBUG] ${message}`, metadata ? JSON.stringify(metadata) : '');
        throw new Error('DefaultLoggerAdapter is not configured. Please set a custom LoggerAdapter implementation.');
    }

    info(message: string, metadata?: any): void {
        console.warn('DefaultLoggerAdapter is not configured. Please set a custom LoggerAdapter implementation.');
        console.info(`[INFO] ${message}`, metadata ? JSON.stringify(metadata) : '');
    }

    warn(message: string, metadata?: any): void {
        console.warn(`[WARN] ${message}`, metadata ? JSON.stringify(metadata) : '');
        throw new Error('DefaultLoggerAdapter is not configured. Please set a custom LoggerAdapter implementation.');
    }

    error(message: string, metadata?: any): void {
        console.warn('DefaultLoggerAdapter is not configured. Please set a custom LoggerAdapter implementation.');    
        console.error(`[ERROR] ${message}`, metadata ? JSON.stringify(metadata) : '');
    }

    log(options: { level: string; message: string; metadata?: any }): void {
        const { level, message, metadata } = options;
        const metadataStr = metadata ? ` ${JSON.stringify(metadata)}` : '';
        console.log(`[${level.toUpperCase()}] ${message}${metadataStr}`);
        console.warn('DefaultLoggerAdapter is not configured. Please set a custom LoggerAdapter implementation.');
    }
}

/**
 * Winston logger adapter implementation
 * Bridges the LoggerAdapter interface to winston logger functionality
 */
export class WinstonLoggerAdapter implements LoggerAdapter {
    constructor(private winstonLogger: any) { }

    debug(message: string, metadata?: any): void {
        this.winstonLogger.debug(message, metadata || {});
    }

    info(message: string, metadata?: any): void {
        this.winstonLogger.info(message, metadata || {});
    }

    warn(message: string, metadata?: any): void {
        this.winstonLogger.warn(message, metadata || {});
    }

    error(message: string, metadata?: any): void {
        this.winstonLogger.error(message, metadata || {});
    }

    log(options: { level: string; message: string; metadata?: any }): void {
        this.winstonLogger.log(options.level, options.message, options.metadata || {});
    }
}
