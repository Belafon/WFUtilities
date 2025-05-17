import * as fs from 'fs';

export interface IFileSystem {
  existsSync(path: string): boolean;
  readFileSync(path: string, encoding: string): string;
  writeFileSync(path: string, data: string, encoding: string): void;
  unlinkSync(path: string): void;
  // If you later need readdirSync or other methods, add them here
  // readdirSync(path: string): string[]; 
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
}

export const fileSystem: IFileSystem = new NodeFileSystemAdapter();