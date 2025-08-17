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

// Test workspace setup
let testWorkspaceRoot: string;
let testChaptersDir: string;

// Helper function to get the correct chapter file path with new directory structure
const getTestChapterFilePath = (chapterId: string): string => {
    const chapterSubDir = path.join(testChaptersDir, chapterId);
    return path.join(chapterSubDir, `${chapterId}.chapter.ts`);
};

// Helper function to ensure chapter directory exists
const ensureChapterDirExists = (chapterId: string): void => {
    const chapterSubDir = path.join(testChaptersDir, chapterId);
    if (!fs.existsSync(chapterSubDir)) {
        fs.mkdirSync(chapterSubDir, { recursive: true });
    }
};

// Create realistic test chapter file content
const createTestChapterFileContent = (chapterId: string, options: {
    title?: string;
    description?: string;
    location?: string;
    timeStart?: string;
    timeEnd?: string;
} = {}) => {
    const {
        title = 'Test Chapter Title',
        description = 'Test chapter description',
        location = 'test_location',
        timeStart = '1.1. 10:00',
        timeEnd = '1.1. 12:00'
    } = options;

    return `import { TChapter } from 'types/TChapter';
import { Time } from 'time/Time';

export const ${chapterId}Chapter: TChapter<'${chapterId}'> = {
    chapterId: '${chapterId}',
    title: _('${title}'),
    description: _('${description}'),
    timeRange: {
        start: Time.fromString('${timeStart}'),
        end: Time.fromString('${timeEnd}'),
    },
    location: '${location}',
    
    children: [],
    
    triggers: [],
    
    init: {
        testData: {
            value: 0,
            status: 'active',
        },
    },
};

export type T${chapterId.charAt(0).toUpperCase() + chapterId.slice(1)}ChapterData = {
    testData: {
        value: number;
        status: string;
    };
};
`;
}

suite('ChapterManager Integration Tests', () => {
    let editorAdapter: DefaultEditorAdapter;
    let openFileStub: sinon.SinonStub;

    suiteSetup(() => {
        // Create temporary test workspace
        testWorkspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-chapter-test-'));
        testChaptersDir = path.join(testWorkspaceRoot, 'src', 'data', 'chapters');

        // Create directory structure
        fs.mkdirSync(testChaptersDir, { recursive: true });

        // Configure the application to use test workspace
        const workspaceAdapter = new StaticWorkspaceAdapter(testWorkspaceRoot);
        config.setWorkspaceAdapter(workspaceAdapter);
        config.setFileSystem(new NodeFileSystemAdapter());

        // Set up editor adapter with stubbed openFile method
        editorAdapter = new DefaultEditorAdapter();
        openFileStub = sinon.stub(editorAdapter, 'openFile').resolves();
        config.setEditorAdapter(editorAdapter);
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

    setup(() => {
        // Clean chapters directory before each test
        if (fs.existsSync(testChaptersDir)) {
            const items = fs.readdirSync(testChaptersDir);
            items.forEach(item => {
                const itemPath = path.join(testChaptersDir, item);
                const stat = fs.statSync(itemPath);
                if (stat.isDirectory()) {
                    fs.rmSync(itemPath, { recursive: true, force: true });
                } else {
                    fs.unlinkSync(itemPath);
                }
            });
        }

        // Reset stub call history and behavior
        openFileStub.resetHistory();
        openFileStub.resolves(); // Reset to default successful behavior
    });

    suite('PUT /api/chapter/:chapterId - Update Chapter', () => {
        test('should successfully update an existing chapter', async () => {
            const chapterId = 'test_kingdom';
            const chapterFilePath = getTestChapterFilePath(chapterId);

            // Ensure chapter directory exists
            ensureChapterDirExists(chapterId);

            // Create initial chapter file
            const initialContent = createTestChapterFileContent(chapterId, {
                title: 'Original Kingdom Chapter',
                description: 'Original description',
                location: 'original_location',
                timeStart: '1.1. 8:00',
                timeEnd: '1.1. 10:00'
            });
            fs.writeFileSync(chapterFilePath, initialContent, 'utf-8');

            // Update data
            const updateData = {
                title: 'Updated Kingdom Chapter',
                description: 'Updated kingdom chapter description',
                location: 'updated_location',
                timeRange: {
                    start: '2.2. 14:00',
                    end: '2.2. 18:00'
                }
            };

            // Make HTTP request
            const response = await request(app)
                .put(`/api/chapter/${chapterId}`)
                .send(updateData)
                .expect(200);

            // Verify response
            assert.strictEqual(response.body.success, true);
            assert.ok(response.body.message.includes('updated successfully'));

            // Verify file was updated
            assert.ok(fs.existsSync(chapterFilePath), 'Chapter file should still exist');
            const updatedContent = fs.readFileSync(chapterFilePath, 'utf-8');

            // Check that the content was properly updated
            assert.ok(updatedContent.includes("title: _('Updated Kingdom Chapter')"), 'Title should be updated');
            assert.ok(updatedContent.includes("description: _('Updated kingdom chapter description')"), 'Description should be updated');
            assert.ok(updatedContent.includes("location: 'updated_location'"), 'Location should be updated');
            assert.ok(updatedContent.includes("start: Time.fromString('2.2. 14:00')"), 'Start time should be updated');
            assert.ok(updatedContent.includes("end: Time.fromString('2.2. 18:00')"), 'End time should be updated');
        });

        test('should handle partial updates correctly', async () => {
            const chapterId = 'test_village';
            const chapterFilePath = getTestChapterFilePath(chapterId);

            // Ensure chapter directory exists
            ensureChapterDirExists(chapterId);

            // Create initial chapter file
            const initialContent = createTestChapterFileContent(chapterId, {
                title: 'Village Chapter',
                description: 'Village description',
                location: 'village_square',
                timeStart: '3.3. 9:00',
                timeEnd: '3.3. 11:00'
            });
            fs.writeFileSync(chapterFilePath, initialContent, 'utf-8');

            // Update only title and timeRange
            const partialUpdateData = {
                title: 'New Village Festival',
                timeRange: {
                    start: '4.4. 16:00',
                    end: '4.4. 20:00'
                }
            };

            const response = await request(app)
                .put(`/api/chapter/${chapterId}`)
                .send(partialUpdateData)
                .expect(200);

            assert.strictEqual(response.body.success, true);

            // Verify file content
            const updatedContent = fs.readFileSync(chapterFilePath, 'utf-8');

            // Updated fields
            assert.ok(updatedContent.includes("title: _('New Village Festival')"), 'Title should be updated');
            assert.ok(updatedContent.includes("start: Time.fromString('4.4. 16:00')"), 'Start time should be updated');
            assert.ok(updatedContent.includes("end: Time.fromString('4.4. 20:00')"), 'End time should be updated');

            // Preserved fields
            assert.ok(updatedContent.includes("description: _('Village description')"), 'Description should be preserved');
            assert.ok(updatedContent.includes("location: 'village_square'"), 'Location should be preserved');
        });

        test('should return 404 for non-existent chapter', async () => {
            const response = await request(app)
                .put('/api/chapter/nonexistent')
                .send({
                    title: 'Test',
                    description: 'Test',
                    location: 'test',
                    timeRange: { start: '1.1. 10:00', end: '1.1. 12:00' }
                })
                .expect(404);

            assert.strictEqual(response.body.success, false);
            assert.ok(response.body.error.includes('not found'));
        });

        test('should handle title with special characters correctly', async () => {
            const chapterId = 'special_chars';
            const chapterFilePath = getTestChapterFilePath(chapterId);

            // Ensure chapter directory exists
            ensureChapterDirExists(chapterId);

            const initialContent = createTestChapterFileContent(chapterId);
            fs.writeFileSync(chapterFilePath, initialContent, 'utf-8');

            const updateData = {
                title: "Chapter with 'quotes' and \"double quotes\"",
                description: 'Simple description',
                location: 'test_location',
                timeRange: {
                    start: '1.1. 10:00',
                    end: '1.1. 12:00'
                }
            };

            const response = await request(app)
                .put(`/api/chapter/${chapterId}`)
                .send(updateData)
                .expect(200);

            assert.strictEqual(response.body.success, true);

            const updatedContent = fs.readFileSync(chapterFilePath, 'utf-8');
            assert.ok(updatedContent.includes("title: _('Chapter with \\'quotes\\' and \"double quotes\"')"), 'Special characters should be properly escaped');
        });
    });

    suite('DELETE /api/chapter/:chapterId - Delete Chapter', () => {
        test('should successfully delete an existing chapter', async () => {
            const chapterId = 'delete_test';
            const chapterFilePath = getTestChapterFilePath(chapterId);

            // Ensure chapter directory exists
            ensureChapterDirExists(chapterId);

            // Create chapter file to delete
            const chapterContent = createTestChapterFileContent(chapterId);
            fs.writeFileSync(chapterFilePath, chapterContent, 'utf-8');

            // Verify file exists before deletion
            assert.ok(fs.existsSync(chapterFilePath), 'Chapter file should exist before deletion');

            // Make delete request
            const response = await request(app)
                .delete(`/api/chapter/${chapterId}`)
                .expect(200);

            // Verify response
            assert.strictEqual(response.body.success, true);
            assert.ok(response.body.message.includes('deleted successfully'));

            // Verify file was deleted
            assert.ok(!fs.existsSync(chapterFilePath), 'Chapter file should be deleted');
        });

        test('should return 404 when trying to delete non-existent chapter', async () => {
            const response = await request(app)
                .delete('/api/chapter/nonexistent')
                .expect(404);

            assert.strictEqual(response.body.success, false);
            assert.ok(response.body.error.includes('not found'));
        });

        test('should handle multiple deletions gracefully', async () => {
            const chapterIds = ['multi_delete_1', 'multi_delete_2', 'multi_delete_3'];

            // Create multiple chapter files
            chapterIds.forEach(chapterId => {
                const chapterFilePath = getTestChapterFilePath(chapterId);
                ensureChapterDirExists(chapterId);
                const chapterContent = createTestChapterFileContent(chapterId);
                fs.writeFileSync(chapterFilePath, chapterContent, 'utf-8');
            });

            // Delete each chapter
            for (const chapterId of chapterIds) {
                const response = await request(app)
                    .delete(`/api/chapter/${chapterId}`)
                    .expect(200);

                assert.strictEqual(response.body.success, true);

                // Verify file is deleted
                const chapterFilePath = getTestChapterFilePath(chapterId);
                assert.ok(!fs.existsSync(chapterFilePath), `Chapter file ${chapterId} should be deleted`);
            }
        });
    });

    suite('POST /api/chapter/:chapterId/open - Open Chapter', () => {
        test('should successfully open an existing chapter file', async () => {
            const chapterId = 'open_test';
            const chapterFilePath = getTestChapterFilePath(chapterId);

            // Ensure chapter directory exists
            ensureChapterDirExists(chapterId);

            // Create chapter file
            const chapterContent = createTestChapterFileContent(chapterId);
            fs.writeFileSync(chapterFilePath, chapterContent, 'utf-8');

            // Make open request
            const response = await request(app)
                .post(`/api/chapter/${chapterId}/open`)
                .expect(200);

            // Verify response
            assert.strictEqual(response.body.success, true);
            assert.ok(response.body.message.includes('opened in VS Code'));

            // Verify openFile was called with correct path
            assert.ok(openFileStub.calledOnce, 'openFile should be called once');
            assert.strictEqual(openFileStub.firstCall.args[0], chapterFilePath, 'openFile should be called with correct file path');
        });

        test('should return 404 when trying to open non-existent chapter', async () => {
            const response = await request(app)
                .post('/api/chapter/nonexistent/open')
                .expect(404);

            assert.strictEqual(response.body.success, false);
            assert.ok(response.body.error.includes('not found'));

            // Verify openFile was not called
            assert.ok(openFileStub.notCalled, 'openFile should not be called for non-existent file');
        });

        test('should handle editor failures gracefully', async () => {
            const chapterId = 'open_fail_test';
            const chapterFilePath = getTestChapterFilePath(chapterId);

            // Ensure chapter directory exists
            ensureChapterDirExists(chapterId);

            // Create chapter file
            const chapterContent = createTestChapterFileContent(chapterId);
            fs.writeFileSync(chapterFilePath, chapterContent, 'utf-8');

            // Make openFile throw an error with an empty message.
            // This will cause the controller to use its fallback error message.
            openFileStub.rejects(new Error('')); // MODIFIED: Error message is now empty

            const response = await request(app)
                .post(`/api/chapter/${chapterId}/open`)
                .expect(500); // Expecting a 500 server error

            // Verify that the success field is false
            assert.strictEqual(response.body.success, false); // CORRECTED/CONFIRMED

            // Verify that the error message includes the expected fallback string
            // The original assertion was assert.ok(response.body.error.includes('Failed to open chapter'));
            // Making it more specific since we now expect the exact fallback:
            assert.strictEqual(response.body.error, 'Failed to open chapter');

            // Reset stub for other tests
            openFileStub.resolves();
        });
    });

    suite('POST /api/chapter/:chapterId/setTime - Set Chapter Time', () => {
        test('should successfully set time range for existing chapter', async () => {
            const chapterId = 'time_test';
            const chapterFilePath = getTestChapterFilePath(chapterId);

            // Ensure chapter directory exists
            ensureChapterDirExists(chapterId);

            // Create initial chapter file
            const initialContent = createTestChapterFileContent(chapterId, {
                timeStart: '1.1. 8:00',
                timeEnd: '1.1. 10:00'
            });
            fs.writeFileSync(chapterFilePath, initialContent, 'utf-8');

            // New time range
            const newTimeRange = {
                timeRange: {
                    start: '15.12. 19:30',
                    end: '15.12. 23:45'
                }
            };

            // Make setTime request
            const response = await request(app)
                .post(`/api/chapter/${chapterId}/setTime`)
                .send(newTimeRange)
                .expect(200);

            // Verify response
            assert.strictEqual(response.body.success, true);
            assert.ok(response.body.message.includes('set successfully'));

            // Verify file was updated with new time range
            const updatedContent = fs.readFileSync(chapterFilePath, 'utf-8');
            assert.ok(updatedContent.includes("start: Time.fromString('15.12. 19:30')"), 'Start time should be updated');
            assert.ok(updatedContent.includes("end: Time.fromString('15.12. 23:45')"), 'End time should be updated');

            // Verify other fields were preserved
            assert.ok(updatedContent.includes("title: _('Test Chapter Title')"), 'Title should be preserved');
            assert.ok(updatedContent.includes("description: _('Test chapter description')"), 'Description should be preserved');
        });

        test('should return 400 for invalid time range data', async () => {
            const chapterId = 'invalid_time_test';
            const chapterFilePath = getTestChapterFilePath(chapterId);

            // Ensure chapter directory exists
            ensureChapterDirExists(chapterId);

            // Create chapter file
            const chapterContent = createTestChapterFileContent(chapterId);
            fs.writeFileSync(chapterFilePath, chapterContent, 'utf-8');

            // Invalid time range (missing end)
            const invalidTimeRange = {
                timeRange: {
                    start: '1.1. 10:00'
                    // missing end
                }
            };

            const response = await request(app)
                .post(`/api/chapter/${chapterId}/setTime`)
                .send(invalidTimeRange)
                .expect(400); // Change from 500 to 400

            assert.strictEqual(response.body.success, false);
            // Update the assertion to check for validation error message
            assert.ok(response.body.errors || response.body.error.includes('validation'));
        });

        test('should return 404 for non-existent chapter', async () => {
            const timeRange = {
                timeRange: {
                    start: '1.1. 10:00',
                    end: '1.1. 12:00'
                }
            };

            const response = await request(app)
                .post('/api/chapter/nonexistent/setTime')
                .send(timeRange)
                .expect(404);

            assert.strictEqual(response.body.success, false);
            assert.ok(response.body.error.includes('not found'));
        });
    });

    suite('Complex Integration Scenarios', () => {
        test('should handle complete chapter lifecycle', async () => {
            const chapterId = 'lifecycle_test';
            const chapterFilePath = getTestChapterFilePath(chapterId);

            // Ensure chapter directory exists
            ensureChapterDirExists(chapterId);

            // 1. Create initial chapter file
            const initialContent = createTestChapterFileContent(chapterId, {
                title: 'Lifecycle Chapter',
                description: 'Initial description',
                location: 'initial_location'
            });
            fs.writeFileSync(chapterFilePath, initialContent, 'utf-8');

            // 2. Update the chapter
            const updateData = {
                title: 'Updated Lifecycle Chapter',
                description: 'Updated description',
                location: 'updated_location',
                timeRange: {
                    start: '10.10. 15:00',
                    end: '10.10. 18:00'
                }
            };

            let response = await request(app)
                .put(`/api/chapter/${chapterId}`)
                .send(updateData)
                .expect(200);

            assert.strictEqual(response.body.success, true);

            // 3. Set new time range
            const newTimeRange = {
                timeRange: {
                    start: '11.11. 20:00',
                    end: '11.11. 22:30'
                }
            };

            response = await request(app)
                .post(`/api/chapter/${chapterId}/setTime`)
                .send(newTimeRange)
                .expect(200);

            assert.strictEqual(response.body.success, true);

            // 4. Open the chapter
            response = await request(app)
                .post(`/api/chapter/${chapterId}/open`)
                .expect(200);

            assert.strictEqual(response.body.success, true);
            assert.ok(openFileStub.calledOnce, 'openFile should be called');

            // 5. Verify final file state
            const finalContent = fs.readFileSync(chapterFilePath, 'utf-8');
            assert.ok(finalContent.includes("title: _('Updated Lifecycle Chapter')"), 'Final title should be correct');
            assert.ok(finalContent.includes("description: _('Updated description')"), 'Final description should be correct');
            assert.ok(finalContent.includes("location: 'updated_location'"), 'Final location should be correct');
            assert.ok(finalContent.includes("start: Time.fromString('11.11. 20:00')"), 'Final start time should be correct');
            assert.ok(finalContent.includes("end: Time.fromString('11.11. 22:30')"), 'Final end time should be correct');

            // 6. Delete the chapter
            response = await request(app)
                .delete(`/api/chapter/${chapterId}`)
                .expect(200);

            assert.strictEqual(response.body.success, true);
            assert.ok(!fs.existsSync(chapterFilePath), 'Chapter file should be deleted');
        });

        test('should handle concurrent operations safely', async () => {
            const chapterId = 'concurrent_test';
            const chapterFilePath = getTestChapterFilePath(chapterId);

            // Create initial chapter file
            ensureChapterDirExists(chapterId);
            const initialContent = createTestChapterFileContent(chapterId);
            fs.writeFileSync(chapterFilePath, initialContent, 'utf-8');

            // Multiple concurrent update operations
            const updatePromises = [];

            for (let i = 0; i < 5; i++) {
                const updateData = {
                    title: `Concurrent Update ${i}`,
                    description: `Description ${i}`,
                    location: `location_${i}`,
                    timeRange: {
                        start: `${i + 1}.${i + 1}. 10:00`,
                        end: `${i + 1}.${i + 1}. 12:00`
                    }
                };

                updatePromises.push(
                    request(app)
                        .put(`/api/chapter/${chapterId}`)
                        .send(updateData)
                );
            }

            // Wait for all updates to complete
            const responses = await Promise.all(updatePromises);

            // All should succeed
            responses.forEach(response => {
                assert.strictEqual(response.status, 200);
                assert.strictEqual(response.body.success, true);
            });

            // File should still exist and be valid
            assert.ok(fs.existsSync(chapterFilePath), 'Chapter file should still exist');
            const finalContent = fs.readFileSync(chapterFilePath, 'utf-8');
            assert.ok(finalContent.includes(`export const ${chapterId}Chapter`), 'Chapter structure should be preserved');
        });
    });

    suite('Demo Mode', () => {
        test('should return demo responses when demo flag is set via query parameter', async () => {
            // All operations should return success in demo mode, even for non-existent chapters
            let response = await request(app)
                .put('/api/chapter/nonexistent?demo=true')
                .send({
                    title: 'Test',
                    description: 'Test',
                    location: 'test',
                    timeRange: { start: '1.1. 10:00', end: '1.1. 12:00' }
                })
                .expect(200);

            assert.strictEqual(response.body.success, true);
            assert.ok(response.body.message.includes('demo mode'));

            response = await request(app)
                .delete('/api/chapter/nonexistent?demo=true')
                .expect(200);

            assert.strictEqual(response.body.success, true);
            assert.ok(response.body.message.includes('demo mode'));

            response = await request(app)
                .post('/api/chapter/nonexistent/open?demo=true')
                .expect(200);

            assert.strictEqual(response.body.success, true);
            assert.ok(response.body.message.includes('demo mode'));

            response = await request(app)
                .post('/api/chapter/nonexistent/setTime?demo=true')
                .send({
                    timeRange: {
                        start: '1.1. 10:00',
                        end: '1.1. 12:00'
                    }
                })
                .expect(200);

            assert.strictEqual(response.body.success, true);
            assert.ok(response.body.message.includes('demo mode'));
        });

        test('should return demo responses when demo flag is set via header', async () => {
            // All operations should return success in demo mode, even for non-existent chapters
            let response = await request(app)
                .put('/api/chapter/nonexistent')
                .set('x-demo-mode', 'true')
                .send({
                    title: 'Test',
                    description: 'Test',
                    location: 'test',
                    timeRange: { start: '1.1. 10:00', end: '1.1. 12:00' }
                })
                .expect(200);

            assert.strictEqual(response.body.success, true);
            assert.ok(response.body.message.includes('demo mode'));

            response = await request(app)
                .delete('/api/chapter/nonexistent')
                .set('x-demo-mode', 'true')
                .expect(200);

            assert.strictEqual(response.body.success, true);
            assert.ok(response.body.message.includes('demo mode'));

            response = await request(app)
                .post('/api/chapter/nonexistent/open')
                .set('x-demo-mode', 'true')
                .expect(200);

            assert.strictEqual(response.body.success, true);
            assert.ok(response.body.message.includes('demo mode'));

            response = await request(app)
                .post('/api/chapter/nonexistent/setTime')
                .set('x-demo-mode', 'true')
                .send({
                    timeRange: {
                        start: '1.1. 10:00',
                        end: '1.1. 12:00'
                    }
                })
                .expect(200);

            assert.strictEqual(response.body.success, true);
            assert.ok(response.body.message.includes('demo mode'));
        });
    });
});