/**
 * Interface for editor operations
 * Implementations will handle specific editor integrations (VS Code, etc.)
 */
export interface EditorAdapter {
  /**
   * Opens a file in the editor
   * @param filePath Absolute file path to open
   */
  openFile(filePath: string): Promise<void>;
  
  /**
   * Shows an information notification
   * @param message The message to display
   */
  showInformationNotification(message: string): void;
  
  /**
   * Shows a warning notification
   * @param message The message to display
   */
  showWarningNotification(message: string): void;
  
  /**
   * Shows an error notification
   * @param message The message to display
   */
  showErrorNotification(message: string): void;
}

/**
 * Default implementation of EditorAdapter
 * This is a placeholder that logs operations but doesn't actually open files
 * Replace with specific editor implementations as needed
 */
export class DefaultEditorAdapter implements EditorAdapter {
  async openFile(filePath: string): Promise<void> {
    console.log(`[DefaultEditorAdapter] Would open file: ${filePath}`);
    console.log(`This is a placeholder. Implement editor integration later.`);
  }

  showInformationNotification(message: string): void {
    console.log(`[DefaultEditorAdapter] Information: ${message}`);
  }

  showWarningNotification(message: string): void {
    console.log(`[DefaultEditorAdapter] Warning: ${message}`);
  }

  showErrorNotification(message: string): void {
    console.log(`[DefaultEditorAdapter] Error: ${message}`);
  }
}