/**
 * Interface for workspace operations
 * Implementations will handle workspace path resolution from different sources
 */
export interface WorkspaceAdapter {
  /**
   * Gets the root workspace folder path
   * @returns The absolute path to the workspace folder
   */
  getWorkspaceFolderPath(): string;
  
  /**
   * Checks if the workspace folder exists and is accessible
   * @returns true if workspace exists and is accessible
   */
  isWorkspaceValid(): boolean;
}

/**
 * Default implementation of WorkspaceAdapter
 * Requires workspace path to be specified via environment variables
 */
export class DefaultWorkspaceAdapter implements WorkspaceAdapter {
  getWorkspaceFolderPath(): string {
    throw new Error(
      'Workspace path not configured. Please set one of the following environment variables:\n' +
      '- WF_WORKSPACE_PATH: Path to your workspace folder\n' +
      '- VSCODE_WORKSPACE: VS Code workspace path\n' +
      'Or use config.setWorkspaceAdapter(new StaticWorkspaceAdapter("/your/path")) to set a custom path.'
    );
  }
  
  isWorkspaceValid(): boolean {
    try {
      const fs = require('fs');
      const workspacePath = this.getWorkspaceFolderPath();
      return fs.existsSync(workspacePath) && fs.statSync(workspacePath).isDirectory();
    } catch (error) {
      return false;
    }
  }
}

/**
 * Static workspace adapter for testing or when workspace path is known at compile time
 */
export class StaticWorkspaceAdapter implements WorkspaceAdapter {
  constructor(private readonly workspacePath: string) {}
  
  getWorkspaceFolderPath(): string {
    return this.workspacePath;
  }
  
  isWorkspaceValid(): boolean {
    try {
      const fs = require('fs');
      return fs.existsSync(this.workspacePath) && fs.statSync(this.workspacePath).isDirectory();
    } catch (error) {
      return false;
    }
  }
}