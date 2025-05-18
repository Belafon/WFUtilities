import * as assert from 'assert';
import path from 'path';
import sinon from 'sinon';
import { MapManager } from '../api/services/map.manager';
import { EditorAdapter, DefaultEditorAdapter } from '../api/adapters/editorAdapter';
import { IFileSystem } from '../api/adapters/fileSystem';
import * as ActualPaths from '../Paths';
import { MapUpdateRequest, MapData } from '../types';
import { config } from '../WFServerConfig'; // Import the config object

// --- Test Constants ---
const mockWorkspaceRoot = '/test-workspace-maps-feature';
const mockMapFileExt = '.json';

// --- Mock Configurations ---
const mockPathsConfiguration = {
  workspaceFolders: (): string => mockWorkspaceRoot,
  mapsDir: (): string => path.join(mockWorkspaceRoot, 'src', 'data', 'maps'),
  mapFileExtension: mockMapFileExt,
};

let mockFsStore: { [filePath: string]: string } = {};
let mockDirsCreated: string[] = []; // To track "created" directories

const mockFileSystemController: IFileSystem = {
  existsSync: (p: string): boolean => {
    // Check if it's a known file or a "created" directory
    return p in mockFsStore || mockDirsCreated.includes(p) || (p === mockPathsConfiguration.mapsDir() && mockDirsCreated.includes(p));
  },
  readFileSync: (p: string, _encoding: string): string => {
    if (p in mockFsStore) return mockFsStore[p];
    const error: NodeJS.ErrnoException = new Error(`ENOENT: no such file or directory, open '${p}'`);
    error.code = 'ENOENT';
    throw error;
  },
  writeFileSync: (p: string, data: string): void => {
    mockFsStore[p] = data;
  },
  unlinkSync: (p: string): void => {
    delete mockFsStore[p];
  },
  readdirSync: (p: string): string[] => {
    if (p === mockPathsConfiguration.mapsDir() && mockDirsCreated.includes(p)) {
      return Object.keys(mockFsStore)
        .filter(filePath => path.dirname(filePath) === p)
        .map(filePath => path.basename(filePath));
    }
    if (!mockDirsCreated.includes(p) && p === mockPathsConfiguration.mapsDir()) { // Dir doesn't "exist"
        const error: NodeJS.ErrnoException = new Error(`ENOENT: no such file or directory, scandir '${p}'`);
        error.code = 'ENOENT';
        throw error;
    }
    return []; // Default for other paths or if dir exists but is empty
  },
  mkdirSync: (p: string, options?: { recursive?: boolean }): void => {
    // In a real fs, mkdir would fail if parent doesn't exist without recursive:true
    // For this mock, we'll simplify: if it's the mapsDir, "create" it.
    if (p === mockPathsConfiguration.mapsDir() || options?.recursive) {
        if (!mockDirsCreated.includes(p)) {
            mockDirsCreated.push(p);
        }
    } else {
        // Simulate error if parent doesn't exist and not recursive
        const parentDir = path.dirname(p);
        if (!mockDirsCreated.includes(parentDir)) {
            const error: NodeJS.ErrnoException = new Error(`ENOENT: no such file or directory, mkdir '${p}'`);
            error.code = 'ENOENT';
            throw error;
        }
        if (!mockDirsCreated.includes(p)) {
            mockDirsCreated.push(p);
        }
    }
  },
};

function applyMapManagerGlobalMocks() {
  (ActualPaths as any).workspaceFolders = mockPathsConfiguration.workspaceFolders;
  (ActualPaths as any).mapsDir = mockPathsConfiguration.mapsDir;
  (ActualPaths as any).mapFileExtension = mockPathsConfiguration.mapFileExtension;
  
  // Set the mock file system in the config
  config.setFileSystem(mockFileSystemController);
}

suite('MapManager Tests', () => {
  let mapManager: MapManager;
  let mockEditorAdapter: EditorAdapter;
  let showErrorNotificationSpy: sinon.SinonSpy;
  let showInformationNotificationSpy: sinon.SinonSpy;
  let consoleErrorSpy: sinon.SinonSpy;
  let consoleLogSpy: sinon.SinonSpy;

  const getMapsDir = () => mockPathsConfiguration.mapsDir();
  const getMapFilePath = (mapId: string) => {
    return path.join(getMapsDir(), `${mapId}${mockPathsConfiguration.mapFileExtension}`);
  };

  const sampleMapData: MapUpdateRequest = {
    title: "Treasure Island",
    width: 20,
    height: 15,
    data: [[{ tile: "sand" }, {tile: "water"}]],
    locations: [{ i: 1, j: 1, locationId: "cave_entrance" }],
    maps: [{ i: 5, j: 5, mapId: "world_map" }],
  };

  setup(() => {
    mockFsStore = {};
    mockDirsCreated = [];
    applyMapManagerGlobalMocks();

    mockEditorAdapter = new DefaultEditorAdapter();
    showErrorNotificationSpy = sinon.spy(mockEditorAdapter, 'showErrorNotification');
    showInformationNotificationSpy = sinon.spy(mockEditorAdapter, 'showInformationNotification');
    
    // Set the mock editor adapter in the config
    config.setEditorAdapter(mockEditorAdapter);
    
    consoleErrorSpy = sinon.spy(console, 'error');
    consoleLogSpy = sinon.spy(console, 'log');

    // Create MapManager without constructor arguments - it will use config
    mapManager = new MapManager();
  });

  teardown(() => {
    sinon.restore();
    // Reset config to default values
    config.reset();
  });

  suite('updateMap', () => {
    const mapId = 'treasureMap';
    const filePath = getMapFilePath(mapId);

    test('should successfully update a map and create maps directory if not exists', async () => {
      await mapManager.updateMap(mapId, sampleMapData);

      assert.ok(mockDirsCreated.includes(getMapsDir()), 'Maps directory should have been "created".');
      assert.ok(filePath in mockFsStore, 'Map file was not written to mockFsStore.');
      assert.deepStrictEqual(JSON.parse(mockFsStore[filePath]), sampleMapData, 'Map data mismatch in storage.');
      assert.ok(showInformationNotificationSpy.calledOnceWith(`Map '${mapId}' updated successfully at ${filePath}`), 'Success notification incorrect.');
      assert.ok(consoleLogSpy.calledWith(`Map '${mapId}' updated successfully at ${filePath}`), 'Success log incorrect.');
    });

    test('should throw error if mapId is empty', async () => {
      await assert.rejects(
        mapManager.updateMap('', sampleMapData),
        /Map ID cannot be empty/
      );
      assert.ok(showErrorNotificationSpy.calledOnceWith('Map ID cannot be empty.'), 'Error notification for empty mapId incorrect.');
      assert.ok(consoleErrorSpy.calledWith('Map ID cannot be empty.'), 'Error log for empty mapId incorrect.');
    });
    
    test('should handle error during maps directory creation', async () => {
        const mkdirError = new Error('Permission denied for mkdir');
        const mkdirSyncStub = sinon.stub(config.fileSystem, 'mkdirSync').throws(mkdirError);
        
        const expectedNotificationMessage = `Failed to create maps directory ${getMapsDir()}: ${mkdirError.message}`;

        await assert.rejects(
          mapManager.updateMap(mapId, sampleMapData),
          // Assert that the thrown error has the message of the original mkdirError
          { message: mkdirError.message }
        );
        
        assert.ok(showErrorNotificationSpy.calledOnceWith(expectedNotificationMessage), 
            `Error notification message mismatch.\nExpected: "${expectedNotificationMessage}"\nActual:   "${showErrorNotificationSpy.firstCall?.args[0]}"`);
        
        // Check that console.error was called with the detailed message and the original error object
        assert.ok(consoleErrorSpy.calledOnceWith(expectedNotificationMessage, mkdirError), 
            `console.error call mismatch.\nExpected first arg: "${expectedNotificationMessage}"\nExpected second arg: (instanceof Error with message "${mkdirError.message}")\nActual first arg:   "${consoleErrorSpy.firstCall?.args[0]}"\nActual second arg:  ${consoleErrorSpy.firstCall?.args[1]?.message || JSON.stringify(consoleErrorSpy.firstCall?.args[1])}`);
        
        mkdirSyncStub.restore();
    });


    test('should handle error during file write', async () => {
      const writeError = new Error('Disk is full');
      const writeFileSyncStub = sinon.stub(config.fileSystem, 'writeFileSync').throws(writeError);
      mockDirsCreated.push(getMapsDir()); // Assume dir exists for this test
      
      const expectedNotificationMessage = `Failed to update map '${mapId}' at ${filePath}: ${writeError.message}`;

      await assert.rejects(
        mapManager.updateMap(mapId, sampleMapData),
        // Assert that the thrown error has the message of the original writeError
        { message: writeError.message }
      );
      
      assert.ok(showErrorNotificationSpy.calledOnceWith(expectedNotificationMessage), 
        `Error notification message mismatch.\nExpected: "${expectedNotificationMessage}"\nActual:   "${showErrorNotificationSpy.firstCall?.args[0]}"`);
      
      assert.ok(consoleErrorSpy.calledOnceWith(expectedNotificationMessage, writeError),
        `console.error call mismatch.\nExpected first arg: "${expectedNotificationMessage}"\nExpected second arg: (instanceof Error with message "${writeError.message}")\nActual first arg:   "${consoleErrorSpy.firstCall?.args[0]}"\nActual second arg:  ${consoleErrorSpy.firstCall?.args[1]?.message || JSON.stringify(consoleErrorSpy.firstCall?.args[1])}`);
      
      writeFileSyncStub.restore();
    });
  });

  suite('getMap', () => {
    const mapId = 'existingMap';
    const filePath = getMapFilePath(mapId);

    test('should successfully retrieve an existing map', async () => {
      mockFsStore[filePath] = JSON.stringify(sampleMapData);
      mockDirsCreated.push(getMapsDir()); // Ensure dir "exists"

      const result = await mapManager.getMap(mapId);

      assert.deepStrictEqual(result, sampleMapData, 'Retrieved map data does not match.');
      assert.ok(showErrorNotificationSpy.notCalled, 'Error notification should not have been shown.');
      assert.ok(consoleLogSpy.calledWith(`Map '${mapId}' retrieved successfully from ${filePath}`), 'Success log incorrect.');
    });

    test('should return null if map file not found', async () => {
      mockDirsCreated.push(getMapsDir()); // Ensure dir "exists"
      const result = await mapManager.getMap('nonExistentMap');
      assert.strictEqual(result, null, 'Should return null when map file is not found.');
      assert.ok(consoleLogSpy.calledWith(`Map file not found: ${getMapFilePath('nonExistentMap')}`), 'Log for not found incorrect.');
      assert.ok(showErrorNotificationSpy.notCalled);
    });

    test('should throw error if map file content is invalid JSON', async () => {
      mockFsStore[filePath] = "this is not valid json";
      mockDirsCreated.push(getMapsDir()); // Ensure dir "exists"

      // The error message is specifically about JSON parsing, not the prefixed manager message
      await assert.rejects(
        mapManager.getMap(mapId),
        { 
          message: /is not valid JSON/
        }
      );
      
      const expectedNotificationMessage = `Failed to read or parse map '${mapId}' from ${filePath}:`;
      assert.ok(showErrorNotificationSpy.calledOnce, 'Error notification for parse error not shown.');
      assert.ok(showErrorNotificationSpy.firstCall.args[0].includes(expectedNotificationMessage), 
        `Error notification message should contain: "${expectedNotificationMessage}"`);
      
      assert.ok(consoleErrorSpy.calledOnce, 'Console error for parse error not logged.');
      assert.ok(consoleErrorSpy.firstCall.args[0].includes(expectedNotificationMessage), 
        `Console error message should contain: "${expectedNotificationMessage}"`);
      assert.ok(consoleErrorSpy.firstCall.args[1] instanceof SyntaxError, 
        'Console error second argument should be a SyntaxError instance.');
    });
  });

  suite('listMaps', () => {
    const mapsDirPath = getMapsDir();

    test('should return an empty array if maps directory does not exist', async () => {
      // existsSync for mapsDirPath will return false as mockDirsCreated is empty
      const result = await mapManager.listMaps();
      assert.deepStrictEqual(result, [], 'Should return empty array if maps directory does not exist.');
      assert.ok(consoleLogSpy.calledWith(`Maps directory not found: ${mapsDirPath}. Returning empty list.`), 'Log for dir not found incorrect.');
    });
    
    test('should return an empty array if maps directory is empty', async () => {
      mockDirsCreated.push(mapsDirPath); // "Create" the directory
      const result = await mapManager.listMaps();
      assert.deepStrictEqual(result, [], 'Should return empty array for an empty maps directory.');
    });

    test('should return list of map IDs from files in maps directory', async () => {
      mockDirsCreated.push(mapsDirPath);
      mockFsStore[getMapFilePath('alphaMap')] = "{}";
      mockFsStore[getMapFilePath('betaMap')] = "{}";
      mockFsStore[path.join(mapsDirPath, 'config.ini')] = "settings"; // A non-map file

      const result = await mapManager.listMaps();
      assert.deepStrictEqual(result.sort(), ['alphaMap', 'betaMap'].sort(), 'List of map IDs is incorrect.');
    });

    test('should handle error during directory read for listMaps', async () => {
      mockDirsCreated.push(mapsDirPath);
      const readError = new Error('Cannot access directory');
      const readdirSyncStub = sinon.stub(config.fileSystem, 'readdirSync').throws(readError);
      
      const expectedNotificationMessage = `Failed to list maps in directory ${mapsDirPath}: ${readError.message}`;

      await assert.rejects(
        mapManager.listMaps(),
        // Assert that the thrown error has the message of the original readError
        { message: readError.message }
      );
      
      assert.ok(showErrorNotificationSpy.calledOnceWith(expectedNotificationMessage), 
        `Error notification message mismatch.\nExpected: "${expectedNotificationMessage}"\nActual:   "${showErrorNotificationSpy.firstCall?.args[0]}"`);
      
      assert.ok(consoleErrorSpy.calledOnceWith(expectedNotificationMessage, readError),
        `console.error call mismatch.\nExpected first arg: "${expectedNotificationMessage}"\nExpected second arg: (instanceof Error with message "${readError.message}")\nActual first arg:   "${consoleErrorSpy.firstCall?.args[0]}"\nActual second arg:  ${consoleErrorSpy.firstCall?.args[1]?.message || JSON.stringify(consoleErrorSpy.firstCall?.args[1])}`);
      
      readdirSyncStub.restore();
    });
  });
});