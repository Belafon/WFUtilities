import * as fs from 'fs';
import { logger } from '../../utils/logger';
import * as prettier from 'prettier';

export interface IFileSystem {
  existsSync(path: string): boolean;
  readFileSync(path: string, encoding: string): string;
  writeFileSync(path: string, data: string, encoding: string): void;
  unlinkSync(path: string): void;
  readdirSync(path: string): string[];
  mkdirSync(path: string, options?: { recursive?: boolean }): void;
}

export class NodeFileSystemAdapter implements IFileSystem {
  public existsSync(path: string): boolean {
    logger.warn(`[NodeFileSystemAdapter] Default FileSystemAdapter is being used.`);
    logger.warn(`[NodeFileSystemAdapter] EXISTS PATH?: ${path}`);
    return fs.existsSync(path);
  }

  public readFileSync(path: string, encoding: string): string {
    logger.warn(`[NodeFileSystemAdapter] Default FileSystemAdapter is being used.`);
    logger.warn(`[NodeFileSystemAdapter] READ FILE PATH: ${path}`);
    return fs.readFileSync(path, encoding as BufferEncoding);
  }

  public writeFileSync(path: string, data: string, encoding: string): void {
    logger.warn(`[NodeFileSystemAdapter] Default FileSystemAdapter is being used.`);
    logger.warn(`[NodeFileSystemAdapter] WRITE FILE, PATH: ${path}`);

    if (path.endsWith('.ts') || path.endsWith('.tsx')) {
      try {
        // Use a synchronous approach with Prettier v3
        // We'll use a workaround to make it synchronous
        const formattedData = this.formatTypeScriptSync(data);

        logger.info(`[TypeScriptFormattingFileSystemAdapter] Formatted TypeScript file: ${path}`);
        fs.writeFileSync(path, formattedData, encoding as BufferEncoding);
        return;
      } catch (error) {
        logger.error(`[TypeScriptFormattingFileSystemAdapter] Failed to format TypeScript file: ${path}`, error);
      }
    }

    // Fallback: write the file without formatting
    fs.writeFileSync(path, data, encoding as BufferEncoding);
  }

  public unlinkSync(path: string): void {
    logger.warn(`[NodeFileSystemAdapter] Default FileSystemAdapter is being used.`);
    logger.warn(`[NodeFileSystemAdapter] UNLINK FILE, PATH: ${path}`);
    fs.unlinkSync(path);
  }

  public readdirSync(path: string): string[] {
    logger.warn(`[NodeFileSystemAdapter] Default FileSystemAdapter is being used.`);
    logger.warn(`[NodeFileSystemAdapter] READ DIR, PATH: ${path}`);
    return fs.readdirSync(path);
  }

  public mkdirSync(path: string, options?: { recursive?: boolean }): void {
    logger.warn(`[NodeFileSystemAdapter] Default FileSystemAdapter is being used.`);
    logger.warn(`[NodeFileSystemAdapter] MKDIR, PATH: ${path}, OPTIONS: ${JSON.stringify(options)}`);
    fs.mkdirSync(path, options);
  }

  private formatTypeScriptSync(code: string): string {
    // Use a synchronous approach with eval to bypass async/await
    try {
      const { execSync } = require('child_process');
      const os = require('os');
      const path = require('path');

      // Create a temporary file using built-in modules
      const tempDir = os.tmpdir();
      const tempFileName = `prettier-temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.ts`;
      const tempFilePath = path.join(tempDir, tempFileName);

      // Write code to temporary file
      require('fs').writeFileSync(tempFilePath, code, 'utf8');

      // Execute prettier synchronously
      const formattedCode = execSync(
        `npx prettier --parser typescript ${tempFilePath}`,
        { encoding: 'utf8' }
      );

      // Clean up the temporary file
      require('fs').unlinkSync(tempFilePath);

      return formattedCode;
    } catch (error) {
      logger.error(`[TypeScriptFormattingFileSystemAdapter] Synchronous formatting failed: ${error}`);
      // Return the original code if formatting fails
      return code;
    }
  }
}