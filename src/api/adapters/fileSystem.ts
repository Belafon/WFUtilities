import * as fs from 'fs';

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
    return fs.existsSync(path);
  }

  public readFileSync(path: string, encoding: string): string {
    return fs.readFileSync(path, encoding as BufferEncoding);
  }

  public writeFileSync(path: string, data: string, encoding: string): void {
    fs.writeFileSync(path, data, encoding as BufferEncoding);
  }

  public unlinkSync(path: string): void {
    fs.unlinkSync(path);
  }
  
  public readdirSync(path: string): string[] {
    return fs.readdirSync(path);
  }
  
  public mkdirSync(path: string, options?: { recursive?: boolean }): void {
    fs.mkdirSync(path, options);
  }
}