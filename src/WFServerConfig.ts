import { EditorAdapter, DefaultEditorAdapter } from './api/adapters/editorAdapter';
import { IFileSystem, NodeFileSystemAdapter } from './api/adapters/fileSystem';
import { logger } from './utils/logger';

/**
 * Global configuration for the WFNodeServer library
 */
class WFServerConfig {
  private _editorAdapter: EditorAdapter = new DefaultEditorAdapter();
  private _fileSystem: IFileSystem = new NodeFileSystemAdapter();

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
   * Reset all configurations to default values
   */
  public reset(): void {
    logger.info('WFServerConfig reset to default values');
    this._editorAdapter = new DefaultEditorAdapter();
    this._fileSystem = new NodeFileSystemAdapter();
  }
}

// Create a singleton instance
export const config = new WFServerConfig();