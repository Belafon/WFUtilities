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
import { PassageUpdateRequest } from '../types';

// Test workspace setup
let testWorkspaceRoot: string;
let testEventsDir: string;

// Create realistic test passage file content
const createTestPassageFileContent = (passagePartId: string, options: {
    type?: 'screen' | 'linear' | 'transition';
    title?: string;
    description?: string;
    image?: string;
    nextPassageId?: string;
} = {}) => {
    const {
        type = 'screen',
        title = 'Test Passage Title',
        description = 'Test passage description',
        image = 'test.jpg',
        nextPassageId = 'kingdom-annie-palace'
    } = options;

    if (type === 'screen') {
        return `import { DeltaTime } from 'time/Time';
import { TPassage } from 'types/TPassage';

export const ${passagePartId}Passage = (s: TWorldState, e: Engine): TPassage<'kingdom', 'annie', TKingdomAnniePassageId> => {
    void s;
    void e;

    return {
        eventId: 'kingdom',
        characterId: 'annie',
        id: '${passagePartId}',
        
        type: 'screen',
        title: _('${title}'),
        image: '${image}',
        
        body: [
            {
                text: _('Welcome to the passage'),
                links: [
                    {
                        text: _('Continue'),
                        passageId: 'kingdom-annie-next',
                        cost: DeltaTime.fromMin(10),
                    },
                ],
            },
        ],
    };
};`;
    } else if (type === 'linear') {
        return `export const ${passagePartId}Passage = {
    eventId: 'kingdom',
    characterId: 'annie',
    id: '${passagePartId}',
    
    type: 'linear',
    description: _('${description}'),
    nextPassageId: '${nextPassageId}',
};`;
    } else { // transition
        return `export const ${passagePartId}Passage = {
    eventId: 'kingdom',
    characterId: 'annie',
    id: '${passagePartId}',
    
    type: 'transition',
    nextPassageId: '${nextPassageId}',
};`;
    }
};

suite('PassageManager Integration Tests', () => {
    let editorAdapter: DefaultEditorAdapter;
    let openFileStub: sinon.SinonStub;

    suiteSetup(() => {
        // Create temporary test workspace
        testWorkspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-passage-test-'));
        testEventsDir = path.join(testWorkspaceRoot, 'src', 'data', 'events');

        // Create directory structure
        fs.mkdirSync(testEventsDir, { recursive: true });

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
        // Clean events directory before each test
        if (fs.existsSync(testEventsDir)) {
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
            cleanDir(testEventsDir);
        }

        // Reset stub call history
        openFileStub.resetHistory();
        openFileStub.resolves();
    });

    suite('PUT /api/passage/:passageId - Update Passage', () => {
        test('should successfully update a screen passage', async () => {
            const passageId = 'kingdom-annie-intro';
            const [eventId, characterId, passagePartId] = passageId.split('-');
            
            // Create passage directory and file
            const passageDir = path.join(testEventsDir, eventId, `${characterId}.passages`);
            fs.mkdirSync(passageDir, { recursive: true });
            const passageFilePath = path.join(passageDir, `${passagePartId}.ts`);
            
            // Create initial passage file
            const initialContent = createTestPassageFileContent(passagePartId, {
                type: 'screen',
                title: 'Original Title',
                image: 'original.jpg'
            });
            fs.writeFileSync(passageFilePath, initialContent, 'utf-8');

            // Update data
            const updateData: PassageUpdateRequest = {
                type: 'screen',
                title: 'Updated Passage Title',
                image: 'updated.jpg',
                body: [
                    {
                        text: 'Updated passage text',
                        links: [
                            {
                                text: 'Go to palace',
                                passageId: 'kingdom-annie-palace',
                                cost: {
                                    value: 30,
                                    unit: 'min'
                                }
                            }
                        ]
                    }
                ]
            };

            // Make HTTP request
            const response = await request(app)
                .put(`/api/passage/${passageId}`)
                .send(updateData)
                .expect(200);

            // Verify response
            assert.strictEqual(response.body.success, true);
            assert.ok(response.body.message.includes('updated successfully'));

            // Verify file was updated
            assert.ok(fs.existsSync(passageFilePath), 'Passage file should still exist');
            const updatedContent = fs.readFileSync(passageFilePath, 'utf-8');

            // Check that the content was properly updated
            assert.ok(updatedContent.includes("title: _('Updated Passage Title')"), 'Title should be updated');
            assert.ok(updatedContent.includes("image: 'updated.jpg'"), 'Image should be updated');
            assert.ok(updatedContent.includes("text: _('Updated passage text')"), 'Body text should be updated');
            assert.ok(updatedContent.includes("text: _('Go to palace')"), 'Link text should be updated');
            assert.ok(updatedContent.includes("passageId: 'kingdom-annie-palace'"), 'Passage ID should be updated');
            assert.ok(updatedContent.includes("DeltaTime.fromMin(30)"), 'Cost should be updated with DeltaTime helper');
        });

        test('should successfully update a linear passage', async () => {
            const passageId = 'kingdom-annie-journey';
            const [eventId, characterId, passagePartId] = passageId.split('-');
            
            // Create passage directory and file
            const passageDir = path.join(testEventsDir, eventId, `${characterId}.passages`);
            fs.mkdirSync(passageDir, { recursive: true });
            const passageFilePath = path.join(passageDir, `${passagePartId}.ts`);
            
            // Create initial linear passage file
            const initialContent = createTestPassageFileContent(passagePartId, {
                type: 'linear',
                description: 'Original journey description',
                nextPassageId: 'kingdom-annie-arrival'
            });
            fs.writeFileSync(passageFilePath, initialContent, 'utf-8');

            // Update data
            const updateData: PassageUpdateRequest = {
                type: 'linear',
                description: 'Updated journey through the forest',
                nextPassageId: 'kingdom-annie-forest-end'
            };

            const response = await request(app)
                .put(`/api/passage/${passageId}`)
                .send(updateData)
                .expect(200);

            assert.strictEqual(response.body.success, true);

            // Verify file content
            const updatedContent = fs.readFileSync(passageFilePath, 'utf-8');
            assert.ok(updatedContent.includes("description: _('Updated journey through the forest')"), 'Description should be updated');
            assert.ok(updatedContent.includes("nextPassageId: 'kingdom-annie-forest-end'"), 'Next passage ID should be updated');
        });

        test('should successfully update a transition passage', async () => {
            const passageId = 'kingdom-annie-cutscene';
            const [eventId, characterId, passagePartId] = passageId.split('-');
            
            // Create passage directory and file
            const passageDir = path.join(testEventsDir, eventId, `${characterId}.passages`);
            fs.mkdirSync(passageDir, { recursive: true });
            const passageFilePath = path.join(passageDir, `${passagePartId}.ts`);
            
            // Create initial transition passage file
            const initialContent = createTestPassageFileContent(passagePartId, {
                type: 'transition',
                nextPassageId: 'kingdom-annie-oldnext'
            });
            fs.writeFileSync(passageFilePath, initialContent, 'utf-8');

            // Update data
            const updateData: PassageUpdateRequest = {
                type: 'transition',
                nextPassageId: 'kingdom-annie-newnext'
            };

            const response = await request(app)
                .put(`/api/passage/${passageId}`)
                .send(updateData)
                .expect(200);

            assert.strictEqual(response.body.success, true);

            // Verify file content
            const updatedContent = fs.readFileSync(passageFilePath, 'utf-8');
            assert.ok(updatedContent.includes("nextPassageId: 'kingdom-annie-newnext'"), 'Next passage ID should be updated');
        });

        test('should handle complex cost objects in links', async () => {
            const passageId = 'kingdom-annie-shop';
            const [eventId, characterId, passagePartId] = passageId.split('-');
            
            const passageDir = path.join(testEventsDir, eventId, `${characterId}.passages`);
            fs.mkdirSync(passageDir, { recursive: true });
            const passageFilePath = path.join(passageDir, `${passagePartId}.ts`);
            
            const initialContent = createTestPassageFileContent(passagePartId, { type: 'screen' });
            fs.writeFileSync(passageFilePath, initialContent, 'utf-8');

            const updateData: PassageUpdateRequest = {
                type: 'screen',
                body: [
                    {
                        text: 'Shop inventory',
                        links: [
                            {
                                text: 'Buy sword',
                                passageId: 'kingdom-annie-bought',
                                cost: {
                                    time: { value: 5, unit: 'min' },
                                    items: [
                                        { id: 'gold', amount: 100 }
                                    ],
                                    tools: ['merchant_pass']
                                }
                            }
                        ]
                    }
                ]
            };

            const response = await request(app)
                .put(`/api/passage/${passageId}`)
                .send(updateData)
                .expect(200);

            assert.strictEqual(response.body.success, true);

            const updatedContent = fs.readFileSync(passageFilePath, 'utf-8');
            assert.ok(updatedContent.includes('cost: {'), 'Cost should be an object');
            assert.ok(updatedContent.includes('time: DeltaTime.fromMin(5)'), 'Time cost should use DeltaTime helper');
            assert.ok(updatedContent.includes("items: [ { id: 'gold', amount: 100 } ]"), 'Items cost should be included');
            assert.ok(updatedContent.includes("tools: [ 'merchant_pass' ]"), 'Tools requirement should be included');
        });

        test('should handle alternate passage file location', async () => {
            const passageId = 'kingdom-thomas-visit';
            const [eventId, characterId, passagePartId] = passageId.split('-');
            
            // Use alternate location: eventId/characterId/passages/
            const passageDir = path.join(testEventsDir, eventId, characterId, 'passages');
            fs.mkdirSync(passageDir, { recursive: true });
            const passageFilePath = path.join(passageDir, `${passagePartId}.ts`);
            
            const initialContent = createTestPassageFileContent(passagePartId);
            fs.writeFileSync(passageFilePath, initialContent, 'utf-8');

            const updateData: PassageUpdateRequest = {
                type: 'screen',
                title: 'Visit Thomas - Alternate Location'
            };

            const response = await request(app)
                .put(`/api/passage/${passageId}`)
                .send(updateData)
                .expect(200);

            assert.strictEqual(response.body.success, true);

            const updatedContent = fs.readFileSync(passageFilePath, 'utf-8');
            assert.ok(updatedContent.includes("title: _('Visit Thomas - Alternate Location')"), 'Title should be updated in alternate location');
        });

        test('should return 400 for invalid passage ID format', async () => {
            const response = await request(app)
                .put('/api/passage/invalid-format')
                .send({
                    type: 'screen',
                    title: 'Test'
                })
                .expect(400);

            assert.strictEqual(response.body.success, false);
            assert.ok(response.body.error.includes('Invalid passageId format'));
        });

        test('should return 400 when characterId is "id"', async () => {
            const response = await request(app)
                .put('/api/passage/kingdom-id-test')
                .send({
                    type: 'screen',
                    title: 'Test'
                })
                .expect(400);

            assert.strictEqual(response.body.success, false);
            assert.ok(response.body.error.includes('Invalid passageId format'));
            assert.ok(response.body.error.includes('cannot be \'id\''));
        });

        test('should return 404 for non-existent passage', async () => {
            const response = await request(app)
                .put('/api/passage/kingdom-annie-nonexistent')
                .send({
                    type: 'screen',
                    title: 'Test'
                })
                .expect(404);

            assert.strictEqual(response.body.success, false);
            assert.ok(response.body.error.includes('not found'));
        });

        test('should handle passages with conditions and redirects', async () => {
            const passageId = 'kingdom-annie-conditional';
            const [eventId, characterId, passagePartId] = passageId.split('-');
            
            const passageDir = path.join(testEventsDir, eventId, `${characterId}.passages`);
            fs.mkdirSync(passageDir, { recursive: true });
            const passageFilePath = path.join(passageDir, `${passagePartId}.ts`);
            
            const initialContent = createTestPassageFileContent(passagePartId);
            fs.writeFileSync(passageFilePath, initialContent, 'utf-8');

            const updateData: PassageUpdateRequest = {
                type: 'screen',
                body: [
                    {
                        condition: true,
                        redirect: 'kingdom-annie-redirected'
                    },
                    {
                        text: 'Fallback text',
                        links: [
                            {
                                text: 'Continue',
                                passageId: 'kingdom-annie-next'
                            }
                        ]
                    }
                ]
            };

            const response = await request(app)
                .put(`/api/passage/${passageId}`)
                .send(updateData)
                .expect(200);

            assert.strictEqual(response.body.success, true);

            const updatedContent = fs.readFileSync(passageFilePath, 'utf-8');
            assert.ok(updatedContent.includes('condition: true'), 'Condition should be included');
            assert.ok(updatedContent.includes("redirect: 'kingdom-annie-redirected'"), 'Redirect should be included');
        });

        test('should preserve special characters in text fields', async () => {
            const passageId = 'kingdom-annie-special';
            const [eventId, characterId, passagePartId] = passageId.split('-');
            
            const passageDir = path.join(testEventsDir, eventId, `${characterId}.passages`);
            fs.mkdirSync(passageDir, { recursive: true });
            const passageFilePath = path.join(passageDir, `${passagePartId}.ts`);
            
            const initialContent = createTestPassageFileContent(passagePartId);
            fs.writeFileSync(passageFilePath, initialContent, 'utf-8');

            const updateData: PassageUpdateRequest = {
                type: 'screen',
                title: "Annie's \"Special\" Passage",
                body: [
                    {
                        text: "Text with 'quotes' and \"double quotes\"",
                        links: [
                            {
                                text: "Link with apostrophe's",
                                passageId: 'kingdom-annie-next'
                            }
                        ]
                    }
                ]
            };

            const response = await request(app)
                .put(`/api/passage/${passageId}`)
                .send(updateData)
                .expect(200);

            assert.strictEqual(response.body.success, true);

            const updatedContent = fs.readFileSync(passageFilePath, 'utf-8');
            assert.ok(updatedContent.includes("title: _('Annie\\'s \"Special\" Passage')"), 'Title with special characters should be properly escaped');
            assert.ok(updatedContent.includes("text: _('Text with \\'quotes\\' and \"double quotes\"')"), 'Text with quotes should be properly escaped');
            assert.ok(updatedContent.includes("text: _('Link with apostrophe\\'s')"), 'Link text with apostrophe should be properly escaped');
        });
    });

    suite('DELETE /api/passage/:passageId - Delete Passage', () => {
        test('should successfully delete an existing passage', async () => {
            const passageId = 'kingdom-annie-delete';
            const [eventId, characterId, passagePartId] = passageId.split('-');
            
            // Create passage file to delete
            const passageDir = path.join(testEventsDir, eventId, `${characterId}.passages`);
            fs.mkdirSync(passageDir, { recursive: true });
            const passageFilePath = path.join(passageDir, `${passagePartId}.ts`);
            
            const content = createTestPassageFileContent(passagePartId);
            fs.writeFileSync(passageFilePath, content, 'utf-8');

            // Verify file exists before deletion
            assert.ok(fs.existsSync(passageFilePath), 'Passage file should exist before deletion');

            // Make delete request
            const response = await request(app)
                .delete(`/api/passage/${passageId}`)
                .expect(200);

            // Verify response
            assert.strictEqual(response.body.success, true);
            assert.ok(response.body.message.includes('deleted successfully'));

            // Verify file was deleted
            assert.ok(!fs.existsSync(passageFilePath), 'Passage file should be deleted');
        });

        test('should delete passage from alternate location', async () => {
            const passageId = 'kingdom-thomas-altdelete';
            const [eventId, characterId, passagePartId] = passageId.split('-');
            
            // Use alternate location
            const passageDir = path.join(testEventsDir, eventId, characterId, 'passages');
            fs.mkdirSync(passageDir, { recursive: true });
            const passageFilePath = path.join(passageDir, `${passagePartId}.ts`);
            
            const content = createTestPassageFileContent(passagePartId);
            fs.writeFileSync(passageFilePath, content, 'utf-8');

            assert.ok(fs.existsSync(passageFilePath), 'Passage file should exist before deletion');

            const response = await request(app)
                .delete(`/api/passage/${passageId}`)
                .expect(200);

            assert.strictEqual(response.body.success, true);
            assert.ok(!fs.existsSync(passageFilePath), 'Passage file should be deleted from alternate location');
        });

        test('should return error for non-existent passage', async () => {
            const response = await request(app)
                .delete('/api/passage/kingdom-annie-nonexistent')
                .expect(500);

            assert.strictEqual(response.body.success, false);
            assert.ok(response.body.error.includes('not found'));
        });

        test('should return error for invalid passage ID format', async () => {
            const response = await request(app)
                .delete('/api/passage/invalid-id')
                .expect(500);

            assert.strictEqual(response.body.success, false);
            assert.ok(response.body.error.includes('Invalid passageId format'));
        });
    });

    suite('POST /api/passage/:passageId/open - Open Passage', () => {
        test('should successfully open an existing passage file', async () => {
            const passageId = 'kingdom-annie-open';
            const [eventId, characterId, passagePartId] = passageId.split('-');
            
            const passageDir = path.join(testEventsDir, eventId, `${characterId}.passages`);
            fs.mkdirSync(passageDir, { recursive: true });
            const passageFilePath = path.join(passageDir, `${passagePartId}.ts`);
            
            const content = createTestPassageFileContent(passagePartId);
            fs.writeFileSync(passageFilePath, content, 'utf-8');

            const response = await request(app)
                .post(`/api/passage/${passageId}/open`)
                .expect(200);

            assert.strictEqual(response.body.success, true);
            assert.ok(response.body.message.includes('opened in VS Code'));

            // Verify openFile was called with correct path
            assert.ok(openFileStub.calledOnce, 'openFile should be called once');
            assert.strictEqual(openFileStub.firstCall.args[0], passageFilePath, 'openFile should be called with correct file path');
        });

        test('should open passage from alternate location', async () => {
            const passageId = 'kingdom-thomas-altopen';
            const [eventId, characterId, passagePartId] = passageId.split('-');
            
            const passageDir = path.join(testEventsDir, eventId, characterId, 'passages');
            fs.mkdirSync(passageDir, { recursive: true });
            const passageFilePath = path.join(passageDir, `${passagePartId}.ts`);
            
            const content = createTestPassageFileContent(passagePartId);
            fs.writeFileSync(passageFilePath, content, 'utf-8');

            const response = await request(app)
                .post(`/api/passage/${passageId}/open`)
                .expect(200);

            assert.strictEqual(response.body.success, true);
            assert.ok(openFileStub.calledOnce, 'openFile should be called once');
            assert.strictEqual(openFileStub.firstCall.args[0], passageFilePath, 'openFile should be called with alternate path');
        });

        test('should return error for non-existent passage', async () => {
            const response = await request(app)
                .post('/api/passage/kingdom-annie-nonexistent/open')
                .expect(500);

            assert.strictEqual(response.body.success, false);
            assert.ok(response.body.error.includes('not found'));

            assert.ok(openFileStub.notCalled, 'openFile should not be called for non-existent file');
        });

        test('should handle editor failures gracefully', async () => {
            const passageId = 'kingdom-annie-openfail';
            const [eventId, characterId, passagePartId] = passageId.split('-');
            
            const passageDir = path.join(testEventsDir, eventId, `${characterId}.passages`);
            fs.mkdirSync(passageDir, { recursive: true });
            const passageFilePath = path.join(passageDir, `${passagePartId}.ts`);
            
            const content = createTestPassageFileContent(passagePartId);
            fs.writeFileSync(passageFilePath, content, 'utf-8');

            // Make openFile throw an error
            openFileStub.rejects(new Error('VS Code not running'));

            const response = await request(app)
                .post(`/api/passage/${passageId}/open`)
                .expect(500);

            assert.strictEqual(response.body.success, false);
            assert.ok(response.body.error.includes('VS Code not running'));

            // Reset stub for other tests
            openFileStub.resolves();
        });
    });

    suite('Complex Integration Scenarios', () => {
        test('should handle complete passage lifecycle', async () => {
            const passageId = 'kingdom-annie-lifecycle';
            const [eventId, characterId, passagePartId] = passageId.split('-');
            
            const passageDir = path.join(testEventsDir, eventId, `${characterId}.passages`);
            fs.mkdirSync(passageDir, { recursive: true });
            const passageFilePath = path.join(passageDir, `${passagePartId}.ts`);

            // 1. Create initial passage file
            const initialContent = createTestPassageFileContent(passagePartId, {
                type: 'screen',
                title: 'Initial Title',
                image: 'initial.jpg'
            });
            fs.writeFileSync(passageFilePath, initialContent, 'utf-8');

            // 2. Update the passage
            const updateData: PassageUpdateRequest = {
                type: 'screen',
                title: 'Updated Title',
                image: 'updated.jpg',
                body: [
                    {
                        text: 'Updated content',
                        links: [
                            {
                                text: 'New link',
                                passageId: 'kingdom-annie-next',
                                cost: { value: 15, unit: 'min' }
                            }
                        ]
                    }
                ]
            };

            let response = await request(app)
                .put(`/api/passage/${passageId}`)
                .send(updateData)
                .expect(200);

            assert.strictEqual(response.body.success, true);

            // 3. Open the passage
            response = await request(app)
                .post(`/api/passage/${passageId}/open`)
                .expect(200);

            assert.strictEqual(response.body.success, true);
            assert.ok(openFileStub.calledOnce, 'openFile should be called');

            // 4. Verify final file state
            const finalContent = fs.readFileSync(passageFilePath, 'utf-8');
            assert.ok(finalContent.includes("title: _('Updated Title')"), 'Final title should be correct');
            assert.ok(finalContent.includes("image: 'updated.jpg'"), 'Final image should be correct');
            assert.ok(finalContent.includes("text: _('Updated content')"), 'Final body text should be correct');
            assert.ok(finalContent.includes("DeltaTime.fromMin(15)"), 'Final cost should be correct');

            // 5. Delete the passage
            response = await request(app)
                .delete(`/api/passage/${passageId}`)
                .expect(200);

            assert.strictEqual(response.body.success, true);
            assert.ok(!fs.existsSync(passageFilePath), 'Passage file should be deleted');
        });

        test('should handle multiple passage types in same event', async () => {
            const eventId = 'kingdom';
            const characterId = 'annie';
            
            // Create multiple passages of different types
            const passages = [
                { id: 'screen1', type: 'screen' as const },
                { id: 'linear1', type: 'linear' as const },
                { id: 'transition1', type: 'transition' as const }
            ];

            const passageDir = path.join(testEventsDir, eventId, `${characterId}.passages`);
            fs.mkdirSync(passageDir, { recursive: true });

            // Create all passage files
            for (const passage of passages) {
                const filePath = path.join(passageDir, `${passage.id}.ts`);
                const content = createTestPassageFileContent(passage.id, { type: passage.type });
                fs.writeFileSync(filePath, content, 'utf-8');
            }

            // Update each with type-specific data
            const screenUpdate: PassageUpdateRequest = {
                type: 'screen',
                title: 'Updated Screen',
                body: [{ text: 'Screen content' }]
            };

            const linearUpdate: PassageUpdateRequest = {
                type: 'linear',
                description: 'Updated linear description',
                nextPassageId: 'kingdom-annie-next'
            };

            const transitionUpdate: PassageUpdateRequest = {
                type: 'transition',
                nextPassageId: 'kingdom-annie-transitioned'
            };

            // Update screen passage
            let response = await request(app)
                .put(`/api/passage/${eventId}-${characterId}-screen1`)
                .send(screenUpdate)
                .expect(200);
            assert.strictEqual(response.body.success, true);

            // Update linear passage
            response = await request(app)
                .put(`/api/passage/${eventId}-${characterId}-linear1`)
                .send(linearUpdate)
                .expect(200);
            assert.strictEqual(response.body.success, true);

            // Update transition passage
            response = await request(app)
                .put(`/api/passage/${eventId}-${characterId}-transition1`)
                .send(transitionUpdate)
                .expect(200);
            assert.strictEqual(response.body.success, true);

            // Verify all files were updated correctly
            const screenContent = fs.readFileSync(path.join(passageDir, 'screen1.ts'), 'utf-8');
            assert.ok(screenContent.includes("title: _('Updated Screen')"), 'Screen title should be updated');

            const linearContent = fs.readFileSync(path.join(passageDir, 'linear1.ts'), 'utf-8');
            assert.ok(linearContent.includes("description: _('Updated linear description')"), 'Linear description should be updated');

            const transitionContent = fs.readFileSync(path.join(passageDir, 'transition1.ts'), 'utf-8');
            assert.ok(transitionContent.includes("nextPassageId: 'kingdom-annie-transitioned'"), 'Transition next passage should be updated');
        });
    });

    suite('Demo Mode', () => {
        test('should return demo responses when demo flag is set', async () => {
            // Update operation in demo mode
            let response = await request(app)
                .put('/api/passage/kingdom-annie-demo?demo=true')
                .send({
                    type: 'screen',
                    title: 'Demo Title'
                })
                .expect(200);

            assert.strictEqual(response.body.success, true);
            assert.ok(response.body.message.includes('demo mode'));

            // Verify no actual file operations occurred
            const passageDir = path.join(testEventsDir, 'kingdom', 'annie.passages');
            assert.ok(!fs.existsSync(passageDir), 'No directories should be created in demo mode');
        });
    });

    suite('Edge Cases and Error Handling', () => {
        test('should handle passage ID with empty parts', async () => {
            const response = await request(app)
                .put('/api/passage/kingdom--intro')
                .send({
                    type: 'screen',
                    title: 'Test'
                })
                .expect(400);

            assert.strictEqual(response.body.success, false);
            assert.ok(response.body.error.includes('Invalid passageId format'));
        });

        test('should handle very long passage IDs gracefully', async () => {
            const longId = 'a'.repeat(100);
            const passageId = `kingdom-annie-${longId}`;

            const response = await request(app)
                .put(`/api/passage/${passageId}`)
                .send({
                    type: 'screen',
                    title: 'Test'
                })
                .expect(404);

            assert.strictEqual(response.body.success, false);
            assert.ok(response.body.error.includes('not found'));
        });

        test('should handle passage files with malformed TypeScript', async () => {
            const passageId = 'kingdom-annie-malformed';
            const [eventId, characterId, passagePartId] = passageId.split('-');
            
            const passageDir = path.join(testEventsDir, eventId, `${characterId}.passages`);
            fs.mkdirSync(passageDir, { recursive: true });
            const passageFilePath = path.join(passageDir, `${passagePartId}.ts`);
            
            // Create malformed content
            const malformedContent = `export const ${passagePartId}Passage = { // Missing closing brace`;
            fs.writeFileSync(passageFilePath, malformedContent, 'utf-8');

            const updateData: PassageUpdateRequest = {
                type: 'screen',
                title: 'Test Update'
            };

            const response = await request(app)
                .put(`/api/passage/${passageId}`)
                .send(updateData)
                .expect(500);

            assert.strictEqual(response.body.success, false);
            // The error handling might vary based on the parser implementation
        });

        test('should handle concurrent updates to same passage', async () => {
            const passageId = 'kingdom-annie-concurrent';
            const [eventId, characterId, passagePartId] = passageId.split('-');
            
            const passageDir = path.join(testEventsDir, eventId, `${characterId}.passages`);
            fs.mkdirSync(passageDir, { recursive: true });
            const passageFilePath = path.join(passageDir, `${passagePartId}.ts`);
            
            const initialContent = createTestPassageFileContent(passagePartId);
            fs.writeFileSync(passageFilePath, initialContent, 'utf-8');

            // Multiple concurrent update operations
            const updatePromises = [];

            for (let i = 0; i < 5; i++) {
                const updateData: PassageUpdateRequest = {
                    type: 'screen',
                    title: `Concurrent Update ${i}`
                };

                updatePromises.push(
                    request(app)
                        .put(`/api/passage/${passageId}`)
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
            assert.ok(fs.existsSync(passageFilePath), 'Passage file should still exist');
            const finalContent = fs.readFileSync(passageFilePath, 'utf-8');
            assert.ok(finalContent.includes(`export const ${passagePartId}Passage`), 'Passage structure should be preserved');
        });
    });
});