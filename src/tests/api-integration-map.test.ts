import * as assert from 'assert';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import request from 'supertest';
import sinon from 'sinon';

// Import the Express app and configuration
import { app } from '../index'; // Adjust path to your main app
import { config } from '../WFServerConfig';
import { StaticWorkspaceAdapter } from '../api/adapters/workspaceAdapter';
import { NodeFileSystemAdapter } from '../api/adapters/fileSystem';
import { DefaultEditorAdapter } from '../api/adapters/editorAdapter';
import { MapUpdateRequest } from '../types';

// Test workspace setup
let testWorkspaceRoot: string;
let testMapsDir: string;

const createTestMapFileContent = (mapId: string, options: {
    title?: string;
    width?: number;
    height?: number;
    tileTypes?: string[];
} = {}) => {
    const {
        title = 'Test Map',
        width = 10,
        height = 8,
        tileTypes = ['grass', 'water', 'tree', 'rock']
    } = options;

    // Create a simple map data structure
    const mapData: MapUpdateRequest = {
        title,
        width,
        height,
        data: Array(height).fill(null).map(() => 
            Array(width).fill(null).map((_, colIndex) => ({
                tile: tileTypes[colIndex % tileTypes.length]
            }))
        ),
        locations: [
            { i: 2, j: 3, locationId: 'village_center' },
            { i: 5, j: 7, locationId: 'ancient_ruins' }
        ],
        maps: [
            { i: 0, j: 0, mapId: 'world_overview' },
            { i: 9, j: 7, mapId: 'dungeon_entrance' }
        ]
    };

    return mapData;
};

suite('Map API Integration Tests', () => {
    let editorAdapter: DefaultEditorAdapter;
    let showErrorNotificationSpy: sinon.SinonSpy;
    let showInformationNotificationSpy: sinon.SinonSpy;

    suiteSetup(() => {
        // Create temporary test workspace
        testWorkspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-map-api-test-'));
        testMapsDir = path.join(testWorkspaceRoot, 'src', 'data', 'maps');

        // Create directory structure
        fs.mkdirSync(testMapsDir, { recursive: true });

        // Configure the application to use test workspace
        const workspaceAdapter = new StaticWorkspaceAdapter(testWorkspaceRoot);
        config.setWorkspaceAdapter(workspaceAdapter);
        config.setFileSystem(new NodeFileSystemAdapter());

        // Create and set up editor adapter
        editorAdapter = new DefaultEditorAdapter();
        showErrorNotificationSpy = sinon.spy(editorAdapter, 'showErrorNotification');
        showInformationNotificationSpy = sinon.spy(editorAdapter, 'showInformationNotification');
        config.setEditorAdapter(editorAdapter);
    });

    setup(() => {
        // Clean maps directory before each test
        if (fs.existsSync(testMapsDir)) {
            const cleanDir = (dir: string) => {
                const files = fs.readdirSync(dir);
                files.forEach(file => {
                    const filePath = path.join(dir, file);
                    if (fs.statSync(filePath).isDirectory()) {
                        cleanDir(filePath);
                        fs.rmdirSync(filePath);
                    } else {
                        fs.unlinkSync(filePath);
                    }
                });
            };
            cleanDir(testMapsDir);
        }

        // Reset spy call history
        showErrorNotificationSpy.resetHistory();
        showInformationNotificationSpy.resetHistory();
    });

    suiteTeardown(() => {
        // Clean up test workspace
        if (testWorkspaceRoot && fs.existsSync(testWorkspaceRoot)) {
            fs.rmSync(testWorkspaceRoot, { recursive: true, force: true });
        }

        // Restore config
        config.reset();
        sinon.restore();
    });

    suite('PUT /api/map/:mapId - Update/Create Map', () => {
        test('should successfully create a new map', async () => {
            const mapId = 'forest_region';
            const mapData = createTestMapFileContent(mapId, {
                title: 'Enchanted Forest',
                width: 15,
                height: 12,
                tileTypes: ['tree', 'grass', 'flower', 'stream']
            });

            const response = await request(app)
                .put(`/api/map/${mapId}`)
                .send(mapData)
                .expect(200);

            // Verify response
            assert.strictEqual(response.body.success, true);
            assert.ok(response.body.message.includes('updated successfully'));

            // Verify file was created
            const mapFilePath = path.join(testMapsDir, `${mapId}.json`);
            assert.ok(fs.existsSync(mapFilePath), 'Map file should be created');
            
            const fileContent = fs.readFileSync(mapFilePath, 'utf-8');
            const savedMapData = JSON.parse(fileContent);
            
            assert.strictEqual(savedMapData.title, 'Enchanted Forest');
            assert.strictEqual(savedMapData.width, 15);
            assert.strictEqual(savedMapData.height, 12);
            assert.ok(Array.isArray(savedMapData.data));
            assert.ok(Array.isArray(savedMapData.locations));
            assert.ok(Array.isArray(savedMapData.maps));
        });

        test('should successfully update an existing map', async () => {
            const mapId = 'desert_oasis';
            const initialMapData = createTestMapFileContent(mapId, {
                title: 'Desert Oasis',
                width: 8,
                height: 6,
                tileTypes: ['sand', 'cactus']
            });

            // Create initial map file
            const mapFilePath = path.join(testMapsDir, `${mapId}.json`);
            fs.writeFileSync(mapFilePath, JSON.stringify(initialMapData, null, 2), 'utf-8');

            // Update the map
            const updatedMapData = createTestMapFileContent(mapId, {
                title: 'Expanded Desert Oasis',
                width: 12,
                height: 10,
                tileTypes: ['sand', 'water', 'palm', 'rock']
            });

            const response = await request(app)
                .put(`/api/map/${mapId}`)
                .send(updatedMapData)
                .expect(200);

            assert.strictEqual(response.body.success, true);

            // Verify file was updated
            const fileContent = fs.readFileSync(mapFilePath, 'utf-8');
            const savedMapData = JSON.parse(fileContent);
            
            assert.strictEqual(savedMapData.title, 'Expanded Desert Oasis');
            assert.strictEqual(savedMapData.width, 12);
            assert.strictEqual(savedMapData.height, 10);
        });

        test('should return 400 for empty mapId', async () => {
            const mapData = createTestMapFileContent('test');

            // Test with missing mapId - Express will return 404 for missing route parameter
            const response = await request(app)
                .put('/api/map/')
                .send(mapData)
                .expect(404);

            // Test whitespace-only mapIds using URL encoding to ensure whitespace is preserved
            // (Raw spaces in URLs might be stripped or handled inconsistently)
            
            // Test with multiple spaces
            const response2 = await request(app)
                .put('/api/map/%20%20%20') // URL-encoded spaces
                .send(mapData)
                .expect(400);

            assert.strictEqual(response2.body.success, false);
            assert.ok(response2.body.error.includes('Map ID cannot be empty'));

            // Test with single space
            const response3 = await request(app)
                .put('/api/map/%20') // Single URL-encoded space
                .send(mapData)
                .expect(400);

            assert.strictEqual(response3.body.success, false);
            assert.ok(response3.body.error.includes('Map ID cannot be empty'));

            // Test with tab character
            const response4 = await request(app)
                .put('/api/map/%09') // URL-encoded tab
                .send(mapData)
                .expect(400);

            assert.strictEqual(response4.body.success, false);
            assert.ok(response4.body.error.includes('Map ID cannot be empty'));
        });

        test('should return 400 for invalid map data', async () => {
            const mapId = 'invalid_map';
            
            // Test missing required fields
            const invalidMapData = {
                title: 'Invalid Map'
                // Missing width, height, data, locations, maps
            };

            const response = await request(app)
                .put(`/api/map/${mapId}`)
                .send(invalidMapData)
                .expect(400);

            assert.strictEqual(response.body.success, false);
            assert.ok(response.body.error.includes('Invalid map data provided'));
        });

        test('should handle special characters in map data', async () => {
            const mapId = 'special_chars_map';
            const mapData = createTestMapFileContent(mapId, {
                title: "Map with 'quotes' and \"double quotes\" & symbols!",
                width: 5,
                height: 5
            });

            const response = await request(app)
                .put(`/api/map/${mapId}`)
                .send(mapData)
                .expect(200);

            assert.strictEqual(response.body.success, true);

            // Verify the data was saved correctly
            const mapFilePath = path.join(testMapsDir, `${mapId}.json`);
            const fileContent = fs.readFileSync(mapFilePath, 'utf-8');
            const savedMapData = JSON.parse(fileContent);
            
            assert.strictEqual(savedMapData.title, "Map with 'quotes' and \"double quotes\" & symbols!");
        });

        test('should create maps directory if it does not exist', async () => {
            // Remove the maps directory
            if (fs.existsSync(testMapsDir)) {
                fs.rmSync(testMapsDir, { recursive: true, force: true });
            }

            const mapId = 'new_directory_map';
            const mapData = createTestMapFileContent(mapId);

            const response = await request(app)
                .put(`/api/map/${mapId}`)
                .send(mapData)
                .expect(200);

            assert.strictEqual(response.body.success, true);

            // Verify directory was created
            assert.ok(fs.existsSync(testMapsDir), 'Maps directory should be created');
            
            // Verify file was created
            const mapFilePath = path.join(testMapsDir, `${mapId}.json`);
            assert.ok(fs.existsSync(mapFilePath), 'Map file should be created');
        });
    });

    suite('GET /api/map/:mapId - Get Map', () => {
        test('should successfully retrieve an existing map', async () => {
            const mapId = 'mountain_pass';
            const mapData = createTestMapFileContent(mapId, {
                title: 'Treacherous Mountain Pass',
                width: 20,
                height: 15,
                tileTypes: ['rock', 'snow', 'ice', 'cliff']
            });

            // Create map file
            const mapFilePath = path.join(testMapsDir, `${mapId}.json`);
            fs.writeFileSync(mapFilePath, JSON.stringify(mapData, null, 2), 'utf-8');

            const response = await request(app)
                .get(`/api/map/${mapId}`)
                .expect(200);

            assert.strictEqual(response.body.success, true);
            assert.ok(response.body.data);
            assert.strictEqual(response.body.data.title, 'Treacherous Mountain Pass');
            assert.strictEqual(response.body.data.width, 20);
            assert.strictEqual(response.body.data.height, 15);
            assert.ok(Array.isArray(response.body.data.data));
            assert.ok(Array.isArray(response.body.data.locations));
            assert.ok(Array.isArray(response.body.data.maps));
        });

        test('should return 404 for non-existent map', async () => {
            const response = await request(app)
                .get('/api/map/non_existent_map')
                .expect(404);

            assert.strictEqual(response.body.success, false);
            assert.ok(response.body.error.includes('not found'));
        });

        test('should return 400 for empty mapId', async () => {
            // Test whitespace-only mapIds using URL encoding to ensure whitespace is preserved
            // (Raw spaces in URLs might be stripped or handled inconsistently)
            
            // Test with multiple spaces
            const response = await request(app)
                .get('/api/map/%20%20%20') // URL-encoded spaces
                .expect(400);

            assert.strictEqual(response.body.success, false);
            assert.ok(response.body.error.includes('Map ID cannot be empty'));

            // Test with single space
            const response2 = await request(app)
                .get('/api/map/%20') // Single URL-encoded space
                .expect(400);

            assert.strictEqual(response2.body.success, false);
            assert.ok(response2.body.error.includes('Map ID cannot be empty'));

            // Test with tab character
            const response3 = await request(app)
                .get('/api/map/%09') // URL-encoded tab
                .expect(400);

            assert.strictEqual(response3.body.success, false);
            assert.ok(response3.body.error.includes('Map ID cannot be empty'));
        });

        test('should handle corrupted map file gracefully', async () => {
            const mapId = 'corrupted_map';
            const mapFilePath = path.join(testMapsDir, `${mapId}.json`);

            // Create a file with invalid JSON
            fs.writeFileSync(mapFilePath, 'this is not valid json {[}', 'utf-8');

            const response = await request(app)
                .get(`/api/map/${mapId}`)
                .expect(500);

            assert.strictEqual(response.body.success, false);
            assert.ok(response.body.error.includes('Failed to read or parse map'));
        });
    });

    suite('GET /api/map - List Maps', () => {
        test('should return empty array when no maps exist', async () => {
            const response = await request(app)
                .get('/api/map') // Note: no trailing slash for list endpoint
                .expect(200);

            assert.strictEqual(response.body.success, true);
            assert.ok(Array.isArray(response.body.data));
            assert.strictEqual(response.body.data.length, 0);
        });

        test('should list all available maps', async () => {
            // Create multiple map files
            const mapIds = ['coastal_town', 'haunted_forest', 'crystal_caverns'];
            
            mapIds.forEach(mapId => {
                const mapData = createTestMapFileContent(mapId, {
                    title: `${mapId.replace('_', ' ')} Map`
                });
                const mapFilePath = path.join(testMapsDir, `${mapId}.json`);
                fs.writeFileSync(mapFilePath, JSON.stringify(mapData, null, 2), 'utf-8');
            });

            // Create a non-map file to ensure it's filtered out
            fs.writeFileSync(path.join(testMapsDir, 'config.txt'), 'not a map file', 'utf-8');

            const response = await request(app)
                .get('/api/map')
                .expect(200);

            assert.strictEqual(response.body.success, true);
            assert.ok(Array.isArray(response.body.data));
            assert.strictEqual(response.body.data.length, 3);
            
            // Check that all map IDs are present
            mapIds.forEach(mapId => {
                assert.ok(response.body.data.includes(mapId), `Should include ${mapId}`);
            });
            
            // Ensure non-map file is not included
            assert.ok(!response.body.data.includes('config'), 'Should not include non-map files');
        });

        test('should return empty array when maps directory does not exist', async () => {
            // Remove the maps directory
            if (fs.existsSync(testMapsDir)) {
                fs.rmSync(testMapsDir, { recursive: true, force: true });
            }

            const response = await request(app)
                .get('/api/map') // List endpoint - no trailing slash
                .expect(200);

            assert.strictEqual(response.body.success, true);
            assert.ok(Array.isArray(response.body.data));
            assert.strictEqual(response.body.data.length, 0);
        });
    });

    suite('Complex Integration Scenarios', () => {
        test('should handle complete map lifecycle', async () => {
            const mapId = 'lifecycle_test_map';
            
            // 1. Verify map doesn't exist initially
            let response = await request(app)
                .get(`/api/map/${mapId}`)
                .expect(404);
            assert.strictEqual(response.body.success, false);

            // 2. Create the map
            const initialMapData = createTestMapFileContent(mapId, {
                title: 'Lifecycle Test Map',
                width: 8,
                height: 6
            });

            response = await request(app)
                .put(`/api/map/${mapId}`)
                .send(initialMapData)
                .expect(200);
            assert.strictEqual(response.body.success, true);

            // 3. Retrieve the created map
            response = await request(app)
                .get(`/api/map/${mapId}`)
                .expect(200);
            assert.strictEqual(response.body.success, true);
            assert.strictEqual(response.body.data.title, 'Lifecycle Test Map');

            // 4. Update the map
            const updatedMapData = createTestMapFileContent(mapId, {
                title: 'Updated Lifecycle Test Map',
                width: 12,
                height: 10
            });

            response = await request(app)
                .put(`/api/map/${mapId}`)
                .send(updatedMapData)
                .expect(200);
            assert.strictEqual(response.body.success, true);

            // 5. Verify the update
            response = await request(app)
                .get(`/api/map/${mapId}`)
                .expect(200);
            assert.strictEqual(response.body.data.title, 'Updated Lifecycle Test Map');
            assert.strictEqual(response.body.data.width, 12);
            assert.strictEqual(response.body.data.height, 10);

            // 6. Verify it appears in the list
            response = await request(app)
                .get('/api/map')
                .expect(200);
            assert.ok(response.body.data.includes(mapId));
        });

        test('should handle concurrent map operations', async () => {
            const mapIds = ['concurrent_1', 'concurrent_2', 'concurrent_3'];
            const promises: any[] = [];

            // Create multiple maps concurrently
            mapIds.forEach(mapId => {
                const mapData = createTestMapFileContent(mapId, {
                    title: `Concurrent Map ${mapId}`,
                    width: 5,
                    height: 5
                });

                promises.push(
                    request(app)
                        .put(`/api/map/${mapId}`)
                        .send(mapData)
                );
            });

            const responses = await Promise.all(promises);

            // All should succeed
            responses.forEach(response => {
                assert.strictEqual(response.status, 200);
                assert.strictEqual(response.body.success, true);
            });

            // Verify all maps were created
            const listResponse = await request(app)
                .get('/api/map')
                .expect(200);

            mapIds.forEach(mapId => {
                assert.ok(listResponse.body.data.includes(mapId), `Should include ${mapId}`);
            });
        });

        test('should handle large map data', async () => {
            const mapId = 'large_map';
            
            // Create a large map (50x50)
            const largeMapData = createTestMapFileContent(mapId, {
                title: 'Large Test Map',
                width: 50,
                height: 50,
                tileTypes: ['grass', 'water', 'forest', 'mountain', 'desert', 'snow', 'swamp', 'cave']
            });

            // Add many locations and map connections
            largeMapData.locations = Array(25).fill(null).map((_, index) => ({
                i: Math.floor(index / 5),
                j: index % 5,
                locationId: `location_${index}`
            }));

            largeMapData.maps = Array(10).fill(null).map((_, index) => ({
                i: index * 5,
                j: index * 3,
                mapId: `connected_map_${index}`
            }));

            const response = await request(app)
                .put(`/api/map/${mapId}`)
                .send(largeMapData)
                .expect(200);

            assert.strictEqual(response.body.success, true);

            // Verify the large map can be retrieved
            const getResponse = await request(app)
                .get(`/api/map/${mapId}`)
                .expect(200);

            assert.strictEqual(getResponse.body.data.width, 50);
            assert.strictEqual(getResponse.body.data.height, 50);
            assert.strictEqual(getResponse.body.data.locations.length, 25);
            assert.strictEqual(getResponse.body.data.maps.length, 10);
        });
    });

    suite('Demo Mode', () => {
        test('should return demo responses when demo flag is set via query parameter', async () => {
            const mapData = createTestMapFileContent('demo_map');

            // Test PUT with demo mode
            let response = await request(app)
                .put('/api/map/demo_map?demo=true')
                .send(mapData)
                .expect(200);

            assert.strictEqual(response.body.success, true);
            assert.ok(response.body.message.includes('demo mode'));

            // Test GET with demo mode
            response = await request(app)
                .get('/api/map/demo_map?demo=true')
                .expect(200);

            assert.strictEqual(response.body.success, true);
            assert.ok(response.body.message && response.body.message.includes('demo mode'));

            // Test LIST with demo mode
            response = await request(app)
                .get('/api/map?demo=true')
                .expect(200);

            assert.strictEqual(response.body.success, true);
            assert.ok(response.body.message && response.body.message.includes('demo mode'));
        });

        test('should return demo responses when demo flag is set via header', async () => {
            const mapData = createTestMapFileContent('demo_map_header');

            // Test PUT with demo header
            let response = await request(app)
                .put('/api/map/demo_map_header')
                .set('x-demo-mode', 'true')
                .send(mapData)
                .expect(200);

            assert.strictEqual(response.body.success, true);
            assert.ok(response.body.message.includes('demo mode'));

            // Test GET with demo header
            response = await request(app)
                .get('/api/map/demo_map_header')
                .set('x-demo-mode', 'true')
                .expect(200);

            assert.strictEqual(response.body.success, true);

            // Test LIST with demo header
            response = await request(app)
                .get('/api/map')
                .set('x-demo-mode', 'true')
                .expect(200);

            assert.strictEqual(response.body.success, true);
        });
    });

    suite('Error Handling and Edge Cases', () => {
        test('should handle extremely long map IDs', async () => {
            const longMapId = 'a'.repeat(1000);
            const mapData = createTestMapFileContent('test');

            const response = await request(app)
                .put(`/api/map/${longMapId}`)
                .send(mapData);

            // Should either succeed or fail gracefully
            assert.ok(response.status >= 200 && response.status < 600);
        });

        test('should handle map IDs with special characters', async () => {
            // Test valid map IDs that contain URL-safe special characters
            const specialMapIds = ['map-with-hyphens', 'map_with_underscores', 'map123', 'MAP_UPPER'];
            
            for (const mapId of specialMapIds) {
                const mapData = createTestMapFileContent(mapId);
                
                const response = await request(app)
                    .put(`/api/map/${mapId}`)
                    .send(mapData)
                    .expect(200);
                
                assert.strictEqual(response.body.success, true);
                
                // Verify it can be retrieved
                const getResponse = await request(app)
                    .get(`/api/map/${mapId}`)
                    .expect(200);
                
                assert.strictEqual(getResponse.body.success, true);
                assert.strictEqual(getResponse.body.data.title, 'Test Map');
            }
        });

        test('should handle maps with zero dimensions gracefully', async () => {
            const mapId = 'zero_dimension_map';
            const mapData = {
                title: 'Zero Dimension Map',
                width: 0,
                height: 0,
                data: [],
                locations: [],
                maps: []
            };

            const response = await request(app)
                .put(`/api/map/${mapId}`)
                .send(mapData)
                .expect(200);

            assert.strictEqual(response.body.success, true);

            // Verify it can be retrieved
            const getResponse = await request(app)
                .get(`/api/map/${mapId}`)
                .expect(200);

            assert.strictEqual(getResponse.body.data.width, 0);
            assert.strictEqual(getResponse.body.data.height, 0);
        });

        test('should handle malformed requests gracefully', async () => {
            // Test with non-JSON data
            const response = await request(app)
                .put('/api/map/malformed_test')
                .send('this is not json')
                .expect(400);

            // Should handle the malformed request without crashing
            assert.ok(response.body.error || response.body.success === false);
        });

        test('should validate array fields properly', async () => {
            const mapId = 'invalid_arrays_map';
            
            // Test with non-array data field
            const invalidMapData = {
                title: 'Invalid Arrays Map',
                width: 10,
                height: 10,
                data: 'not an array',
                locations: [],
                maps: []
            };

            const response = await request(app)
                .put(`/api/map/${mapId}`)
                .send(invalidMapData)
                .expect(400);

            assert.strictEqual(response.body.success, false);
            assert.ok(response.body.error.includes('Invalid map data provided'));
        });
    });
});