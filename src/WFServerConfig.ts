import { EditorAdapter, DefaultEditorAdapter } from './api/adapters/editorAdapter';
import { IFileSystem, NodeFileSystemAdapter } from './api/adapters/fileSystem';
import { WorkspaceAdapter, DefaultWorkspaceAdapter } from './api/adapters/workspaceAdapter';
import { LoggerAdapter, DefaultLoggerAdapter } from './api/adapters/loggerAdapter';
import { logger, setLogger } from './utils/logger';

/**
 * Global configuration for the WFNodeServer library
 */
class WFServerConfig {
  private _editorAdapter: EditorAdapter = new DefaultEditorAdapter();
  private _fileSystem: IFileSystem = new NodeFileSystemAdapter();
  private _workspaceAdapter: WorkspaceAdapter = new DefaultWorkspaceAdapter();
  private _loggerAdapter: LoggerAdapter = new DefaultLoggerAdapter();

  /**
   * Get the current EditorAdapter implementation
   */
  public get editorAdapter(): EditorAdapter {
    return this._editorAdapter;
  }

  /**
   * Set a custom EditorAdapter implementation
   * @param adapter - Custom implementation of EditorAdapter
   */
  public setEditorAdapter(adapter: EditorAdapter): void {
    if (!adapter) {
      logger.error('Attempted to set EditorAdapter to null or undefined');
      throw new Error('EditorAdapter cannot be null or undefined');
    }
    logger.info('EditorAdapter implementation set');
    this._editorAdapter = adapter;
  }

  /**
   * Get the current FileSystem implementation
   */
  public get fileSystem(): IFileSystem {
    return this._fileSystem;
  }

  /**
   * Set a custom FileSystem implementation
   * @param fs - Custom implementation of IFileSystem
   */
  public setFileSystem(fs: IFileSystem): void {
    if (!fs) {
      logger.error('Attempted to set FileSystem implementation to null or undefined');
      throw new Error('FileSystem implementation cannot be null or undefined');
    }
    logger.info('FileSystem implementation set');
    this._fileSystem = fs;
  }

  /**
   * Get the current WorkspaceAdapter implementation
   */
  public get workspaceAdapter(): WorkspaceAdapter {
    return this._workspaceAdapter;
  }

  /**
   * Set a custom WorkspaceAdapter implementation
   * @param adapter - Custom implementation of WorkspaceAdapter
   */
  public setWorkspaceAdapter(adapter: WorkspaceAdapter): void {
    if (!adapter) {
      logger.error('Attempted to set WorkspaceAdapter to null or undefined');
      throw new Error('WorkspaceAdapter cannot be null or undefined');
    }
    logger.info('WorkspaceAdapter implementation set');
    this._workspaceAdapter = adapter;
  }

  /**
   * Get the current LoggerAdapter implementation
   */
  public get loggerAdapter(): LoggerAdapter {
    return this._loggerAdapter;
  }

  /**
   * Set a custom LoggerAdapter implementation
   * @param adapter - Custom implementation of LoggerAdapter
   */
  public setLoggerAdapter(adapter: LoggerAdapter): void {
    if (!adapter) {
      logger.error('Attempted to set LoggerAdapter to null or undefined');
      throw new Error('LoggerAdapter cannot be null or undefined');
    }
    logger.info('LoggerAdapter implementation set');
    this._loggerAdapter = adapter;
    setLogger(adapter);
  }

  /**
   * Reset all configurations to default values
   */
  public reset(): void {
    logger.info('WFServerConfig reset to default values');
    this._editorAdapter = new DefaultEditorAdapter();
    this._fileSystem = new NodeFileSystemAdapter();
    this._workspaceAdapter = new DefaultWorkspaceAdapter();
    this._loggerAdapter = new DefaultLoggerAdapter();
  }
}

// Create a singleton instance
export const config = new WFServerConfig();