import * as fs from 'fs';
import { logger } from '../../utils/logger';

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
    logger.error(`[NodeFileSystemAdapter] Default FileSystemAdapter is being used.`);
    return fs.existsSync(path);
  }

  public readFileSync(path: string, encoding: string): string {
    logger.error(`[NodeFileSystemAdapter] Default FileSystemAdapter is being used.`);
    return fs.readFileSync(path, encoding as BufferEncoding);
  }

  public writeFileSync(path: string, data: string, encoding: string): void {
    logger.error(`[NodeFileSystemAdapter] Default FileSystemAdapter is being used.`);
    fs.writeFileSync(path, data, encoding as BufferEncoding);
  }

  public unlinkSync(path: string): void {
    logger.error(`[NodeFileSystemAdapter] Default FileSystemAdapter is being used.`);
    fs.unlinkSync(path);
  }

  public readdirSync(path: string): string[] {
    logger.error(`[NodeFileSystemAdapter] Default FileSystemAdapter is being used.`);
    return fs.readdirSync(path);
  }

  public mkdirSync(path: string, options?: { recursive?: boolean }): void {
    logger.error(`[NodeFileSystemAdapter] Default FileSystemAdapter is being used.`);
    fs.mkdirSync(path, options);
  }
}

