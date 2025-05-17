import path from 'path';
import { EditorAdapter, DefaultEditorAdapter } from '../adapters/editorAdapter';
import { IFileSystem, fileSystem as defaultFileSystem } from '../adapters/fileSystem';
import { mapsDir, mapFileExtension } from '../../Paths'; // Adjust path as necessary
import { MapData, MapUpdateRequest } from '../../types'; // Adjust path as necessary

export class MapManager {
  private editorAdapter: EditorAdapter;
  private fs: IFileSystem;

  constructor(
    editorAdapter: EditorAdapter = new DefaultEditorAdapter(),
    fsInstance: IFileSystem = defaultFileSystem // Inject IFileSystem for testability
  ) {
    this.editorAdapter = editorAdapter;
    this.fs = fsInstance;
  }

  private getMapFilePath(mapId: string): string {
    return path.join(mapsDir(), `${mapId}${mapFileExtension}`);
  }

  public async updateMap(mapId: string, mapData: MapUpdateRequest): Promise<void> {
    if (!mapId || mapId.trim() === '') {
      const errorMessage = 'Map ID cannot be empty.';
      this.editorAdapter.showErrorNotification(errorMessage);
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    const dir = mapsDir();
    if (!this.fs.existsSync(dir)) {
        try {
            this.fs.mkdirSync(dir, { recursive: true });
            console.log(`Created maps directory: ${dir}`);
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            const errorMessage = `Failed to create maps directory ${dir}: ${err.message}`;
            this.editorAdapter.showErrorNotification(errorMessage);
            console.error(errorMessage, err);
            throw err; // Re-throw original or wrapped error
        }
    }

    const filePath = this.getMapFilePath(mapId);

    try {
      const jsonData = JSON.stringify(mapData, null, 2); // Pretty print JSON
      this.fs.writeFileSync(filePath, jsonData, 'utf-8');
      const successMessage = `Map '${mapId}' updated successfully at ${filePath}`;
      this.editorAdapter.showInformationNotification(successMessage);
      console.log(successMessage);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const errorMessage = `Failed to update map '${mapId}' at ${filePath}: ${err.message}`;
      this.editorAdapter.showErrorNotification(errorMessage);
      console.error(errorMessage, err);
      throw err;
    }
  }

  public async getMap(mapId: string): Promise<MapData | null> {
    // Validation for mapId emptiness is handled by the controller
    const filePath = this.getMapFilePath(mapId);

    if (!this.fs.existsSync(filePath)) {
      console.log(`Map file not found: ${filePath}`);
      return null;
    }

    try {
      const fileContent = this.fs.readFileSync(filePath, 'utf-8');
      const mapData: MapData = JSON.parse(fileContent);
      console.log(`Map '${mapId}' retrieved successfully from ${filePath}`);
      return mapData;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const errorMessage = `Failed to read or parse map '${mapId}' from ${filePath}: ${err.message}`;
      this.editorAdapter.showErrorNotification(errorMessage);
      console.error(errorMessage, err);
      throw err;
    }
  }

  public async listMaps(): Promise<string[]> {
    const dir = mapsDir();
    if (!this.fs.existsSync(dir)) {
      console.log(`Maps directory not found: ${dir}. Returning empty list.`);
      return [];
    }

    try {
      const files = this.fs.readdirSync(dir);
      const mapIds = files
        .filter(file => file.endsWith(mapFileExtension))
        .map(file => file.slice(0, -mapFileExtension.length));
      
      console.log(`Found maps: [${mapIds.join(', ')}] in ${dir}`);
      return mapIds;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const errorMessage = `Failed to list maps in directory ${dir}: ${err.message}`;
      this.editorAdapter.showErrorNotification(errorMessage);
      console.error(errorMessage, err);
      throw err;
    }
  }
}

export const mapManager = new MapManager();
