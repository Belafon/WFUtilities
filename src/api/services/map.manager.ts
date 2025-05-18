import path from 'path';
import { EditorAdapter, DefaultEditorAdapter } from '../adapters/editorAdapter';
import { mapsDir, mapFileExtension } from '../../Paths'; // Adjust path as necessary
import { MapData, MapUpdateRequest } from '../../types'; // Adjust path as necessary
import { config } from '../../WFServerConfig';

export class MapManager {
  private getMapFilePath(mapId: string): string {
    return path.join(mapsDir(), `${mapId}${mapFileExtension}`);
  }

  public async updateMap(mapId: string, mapData: MapUpdateRequest): Promise<void> {
    if (!mapId || mapId.trim() === '') {
      const errorMessage = 'Map ID cannot be empty.';
      config.editorAdapter.showErrorNotification(errorMessage);
      console.error(errorMessage);
      throw new Error(errorMessage);
    }

    const dir = mapsDir();
    if (!config.fileSystem.existsSync(dir)) {
        try {
            config.fileSystem.mkdirSync(dir, { recursive: true });
            console.log(`Created maps directory: ${dir}`);
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            const errorMessage = `Failed to create maps directory ${dir}: ${err.message}`;
            config.editorAdapter.showErrorNotification(errorMessage);
            console.error(errorMessage, err);
            throw err; // Re-throw original or wrapped error
        }
    }

    const filePath = this.getMapFilePath(mapId);

    try {
      const jsonData = JSON.stringify(mapData, null, 2); // Pretty print JSON
      config.fileSystem.writeFileSync(filePath, jsonData, 'utf-8');
      const successMessage = `Map '${mapId}' updated successfully at ${filePath}`;
      config.editorAdapter.showInformationNotification(successMessage);
      console.log(successMessage);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const errorMessage = `Failed to update map '${mapId}' at ${filePath}: ${err.message}`;
      config.editorAdapter.showErrorNotification(errorMessage);
      console.error(errorMessage, err);
      throw err;
    }
  }

  public async getMap(mapId: string): Promise<MapData | null> {
    // Validation for mapId emptiness is handled by the controller
    const filePath = this.getMapFilePath(mapId);

    if (!config.fileSystem.existsSync(filePath)) {
      console.log(`Map file not found: ${filePath}`);
      return null;
    }

    try {
      const fileContent = config.fileSystem.readFileSync(filePath, 'utf-8');
      const mapData: MapData = JSON.parse(fileContent);
      console.log(`Map '${mapId}' retrieved successfully from ${filePath}`);
      return mapData;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const errorMessage = `Failed to read or parse map '${mapId}' from ${filePath}: ${err.message}`;
      config.editorAdapter.showErrorNotification(errorMessage);
      console.error(errorMessage, err);
      throw err;
    }
  }

  public async listMaps(): Promise<string[]> {
    const dir = mapsDir();
    if (!config.fileSystem.existsSync(dir)) {
      console.log(`Maps directory not found: ${dir}. Returning empty list.`);
      return [];
    }

    try {
      const files = config.fileSystem.readdirSync(dir);
      const mapIds = files
        .filter(file => file.endsWith(mapFileExtension))
        .map(file => file.slice(0, -mapFileExtension.length));
      
      console.log(`Found maps: [${mapIds.join(', ')}] in ${dir}`);
      return mapIds;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      const errorMessage = `Failed to list maps in directory ${dir}: ${err.message}`;
      config.editorAdapter.showErrorNotification(errorMessage);
      console.error(errorMessage, err);
      throw err;
    }
  }
}

export const mapManager = new MapManager();
