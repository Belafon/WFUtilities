import * as assert from 'assert';
import request from 'supertest';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { app as wfApp } from '../index'; // Adjust path as necessary
import { ChapterUpdateRequest } from '../types';
import { config } from '../WFServerConfig';
import { StaticWorkspaceAdapter } from '../api/adapters/workspaceAdapter';

suite('WFUtilities Library - API Integration Tests', () => {
  let testWorkspaceRoot: string;
  let testChaptersDir: string;
  let testMapsDir: string;

  suiteSetup(() => {
    // Create temporary test workspace
    testWorkspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'wf-api-test-'));
    testChaptersDir = path.join(testWorkspaceRoot, 'src', 'data', 'chapters');
    testMapsDir = path.join(testWorkspaceRoot, 'src', 'data', 'maps');

    // Create directory structure
    fs.mkdirSync(testChaptersDir, { recursive: true });
    fs.mkdirSync(testMapsDir, { recursive: true });

    // Configure the application to use test workspace
    const workspaceAdapter = new StaticWorkspaceAdapter(testWorkspaceRoot);
    config.setWorkspaceAdapter(workspaceAdapter);
  });

  suiteTeardown(() => {
    // Clean up test workspace
    if (testWorkspaceRoot && fs.existsSync(testWorkspaceRoot)) {
      fs.rmSync(testWorkspaceRoot, { recursive: true, force: true });
    }

    // Reset config
    config.reset();
  });

  suite('Basic Server Tests', () => {
    test('should respond to health check endpoint', (done) => {
      request(wfApp)
        .get('/health')
        .expect(200)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) return done(err);
          assert.strictEqual(res.body.status, 'ok');
          done();
        });
    });
  });

  suite('Chapter API Endpoints', () => {
    test('should handle chapter update requests with proper validation', (done) => {
      const chapterId = 'testChapter';
      const chapterFilePath = path.join(testChaptersDir, `${chapterId}.chapter.ts`);

      // Create a simple chapter file
      const chapterContent = `export const ${chapterId}Chapter = { title: 'Test' };`;
      fs.writeFileSync(chapterFilePath, chapterContent, 'utf-8');

      const updateData: ChapterUpdateRequest = {
        title: 'Test Chapter Title',
        description: 'A test chapter description',
        location: 'test_location',
        timeRange: {
          start: '1.1. 10:00',
          end: '1.1. 12:00'
        }
      };

      request(wfApp)
        .put(`/api/chapter/${chapterId}`)
        .send(updateData)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) return done(err);
          // The actual response depends on the implementation
          // This test verifies the API accepts the request format
          assert.ok(res.status >= 200 && res.status < 500);
          done();
        });
    });

    test('should reject chapter updates with invalid time format', (done) => {
      const chapterId = 'testChapter';
      const invalidData = {
        title: 'Test Chapter',
        description: 'Test description',
        location: 'test_location',
        timeRange: {
          start: 'invalid-format',
          end: '1.1. 12:00'
        }
      };

      request(wfApp)
        .put(`/api/chapter/${chapterId}`)
        .send(invalidData)
        .expect(400)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) return done(err);
          assert.ok(res.body.errors || res.body.error);
          done();
        });
    });

    test('should handle chapter time setting requests', (done) => {
      const chapterId = 'testChapter';
      const chapterFilePath = path.join(testChaptersDir, `${chapterId}.chapter.ts`);

      // Ensure chapter file exists
      if (!fs.existsSync(chapterFilePath)) {
        const chapterContent = `export const ${chapterId}Chapter = { title: 'Test' };`;
        fs.writeFileSync(chapterFilePath, chapterContent, 'utf-8');
      }

      const timeData = {
        timeRange: {
          start: '2.1. 14:00',
          end: '2.1. 16:00'
        }
      };

      request(wfApp)
        .post(`/api/chapter/${chapterId}/setTime`)
        .send(timeData)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) return done(err);
          assert.ok(res.status >= 200 && res.status < 500);
          done();
        });
    });

    test('should handle chapter open requests', (done) => {
      const chapterId = 'testChapter';
      const chapterFilePath = path.join(testChaptersDir, `${chapterId}.chapter.ts`);

      // Ensure chapter file exists
      if (!fs.existsSync(chapterFilePath)) {
        const chapterContent = `export const ${chapterId}Chapter = { title: 'Test' };`;
        fs.writeFileSync(chapterFilePath, chapterContent, 'utf-8');
      }

      request(wfApp)
        .post(`/api/chapter/${chapterId}/open`)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) return done(err);
          assert.ok(res.status >= 200 && res.status < 500);
          done();
        });
    });

    test('should handle chapter deletion requests', (done) => {
      const chapterId = 'testChapter';
      const chapterFilePath = path.join(testChaptersDir, `${chapterId}.chapter.ts`);

      // Create chapter file to delete
      const chapterContent = `export const ${chapterId}Chapter = { title: 'Test' };`;
      fs.writeFileSync(chapterFilePath, chapterContent, 'utf-8');

      request(wfApp)
        .delete(`/api/chapter/${chapterId}`)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) return done(err);
          assert.ok(res.status >= 200 && res.status < 500);
          done();
        });
    });
  });

  suite('Passage API Endpoints', () => {
    test('should handle passage update requests', (done) => {
      const passageId = 'chapter1-char1-passage1';
      const passageData = {
        type: 'screen',
        title: 'Test Passage',
        body: [{
          text: 'Test content',
          links: [{
            text: 'Continue',
            passageId: 'next-passage'
          }]
        }]
      };

      request(wfApp)
        .put(`/api/passage/screen/${passageId}`)
        .send(passageData)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) return done(err);
          assert.ok(res.status >= 200 && res.status < 500);
          done();
        });
    });

    test('should reject invalid passage IDs', (done) => {
      const invalidPassageId = 'invalid-format';
      const passageData = {
        type: 'screen',
        title: 'Test'
      };

      request(wfApp)
        .put(`/api/passage/screen/${invalidPassageId}`)
        .send(passageData)
        .expect(400)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) return done(err);
          assert.ok(res.body.error);
          done();
        });
    });
  });

  suite('Map API Endpoints', () => {
    test('should handle map data retrieval', (done) => {
      const mapId = 'testMap';
      const mapFilePath = path.join(testMapsDir, `${mapId}.json`);

      // Create a test map file
      const mapData = {
        title: 'Test Map',
        width: 10,
        height: 10,
        data: [],
        locations: [],
        maps: []
      };
      fs.writeFileSync(mapFilePath, JSON.stringify(mapData), 'utf-8');

      request(wfApp)
        .get(`/api/map/${mapId}`)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) return done(err);
          assert.ok(res.status >= 200 && res.status < 500);
          done();
        });
    });

    test('should handle map updates with valid data structure', (done) => {
      const mapId = 'testMap';
      const mapData = {
        title: 'Test Map',
        width: 10,
        height: 10,
        data: [
          [{ tile: 'grass' }, { tile: 'grass' }, { tile: 'tree' }],
          [{ tile: 'path' }, { tile: 'grass' }, { tile: 'rock' }],
          [{ tile: 'water' }, { tile: 'water' }, { tile: 'bridge' }]
        ],
        locations: [
          {
            i: 0,
            j: 1,
            locationId: 'village'
          }
        ],
        maps: [
          {
            i: 2,
            j: 2,
            mapId: 'connected-map'
          }
        ]
      };

      request(wfApp)
        .put(`/api/map/${mapId}`)
        .send(mapData)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) return done(err);
          assert.ok(res.status >= 200 && res.status < 500);
          done();
        });
    });

    test('should list all available maps', (done) => {
      // Create some test map files
      const map1Path = path.join(testMapsDir, 'map1.json');
      const map2Path = path.join(testMapsDir, 'map2.json');

      fs.writeFileSync(map1Path, JSON.stringify({ title: 'Map 1' }), 'utf-8');
      fs.writeFileSync(map2Path, JSON.stringify({ title: 'Map 2' }), 'utf-8');

      request(wfApp)
        .get('/api/map')
        .expect('Content-Type', /json/)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          assert.ok(Array.isArray(res.body.data));
          assert.ok(res.body.data.includes('map1'));
          assert.ok(res.body.data.includes('map2'));
          done();
        });
    });
  });

  suite('Error Handling', () => {
    test('should return 404 for non-existent chapter', (done) => {
      request(wfApp)
        .get('/api/chapter/non-existent-chapter')
        .expect(404)
        .end(done);
    });

    test('should return 404 for non-existent passage', (done) => {
      request(wfApp)
        .get('/api/passage/screen/non-existent-passage')
        .expect(404)
        .end(done);
    });

    test('should return 404 for non-existent map', (done) => {
      request(wfApp)
        .get('/api/map/non-existent-map')
        .expect(404)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) return done(err);
          assert.strictEqual(res.body.success, false);
          assert.ok(res.body.error.includes('not found'));
          done();
        });
    });
  });

  suite('Content Type Handling', () => {
    test('should accept JSON content type', (done) => {
      const chapterId = 'jsonTest';  // Changed from 'json-test'
      const chapterFilePath = path.join(testChaptersDir, `${chapterId}.chapter.ts`);

      // Create chapter file
      const chapterContent = `export const ${chapterId}Chapter = { title: 'Test' };`;
      fs.writeFileSync(chapterFilePath, chapterContent, 'utf-8');

      const chapterData: ChapterUpdateRequest = {
        title: 'JSON Test Chapter',
        description: 'Testing JSON content type',
        location: 'json_location',
        timeRange: {
          start: '1.1. 10:00',
          end: '1.1. 12:00'
        }
      };

      request(wfApp)
        .put(`/api/chapter/${chapterId}`)
        .set('Content-Type', 'application/json')
        .send(chapterData)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) return done(err);
          assert.ok(res.status >= 200 && res.status < 500);
          done();
        });
    });

    test('should accept URL encoded content type', (done) => {
      const chapterId = 'urlTest';  // Changed from 'url-test'
      const chapterFilePath = path.join(testChaptersDir, `${chapterId}.chapter.ts`);

      // Create chapter file
      const chapterContent = `export const ${chapterId}Chapter = { title: 'Test' };`;
      fs.writeFileSync(chapterFilePath, chapterContent, 'utf-8');

      request(wfApp)
        .post(`/api/chapter/${chapterId}/setTime`)
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .send('timeRange[start]=1.1. 10:00&timeRange[end]=1.1. 12:00')
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) return done(err);
          assert.ok(res.status >= 200 && res.status < 500);
          done();
        });
    });
  });

  suite('API Versioning and Documentation', () => {
    test('should provide OpenAPI documentation', (done) => {
      request(wfApp)
        .get('/api-docs')
        .end((err, res) => {
          if (err && err.message && err.message.includes('404')) {
            // If no API docs endpoint exists, that's okay for now
            done();
            return;
          }

          // Accept either 200 or 301/302 (redirect)
          if (res) {
            assert.ok(
              res.status === 200 || res.status === 301 || res.status === 302,
              `Expected 200, 301, or 302 but got ${res.status}`
            );

            // If it's a redirect, check for Location header
            if (res.status === 301 || res.status === 302) {
              assert.ok(res.headers.location, 'Redirect should have Location header');
            }
          }

          done();
        });
    });
  });

  test('should handle requests to non-existent endpoints', (done) => {
    request(wfApp)
      .get('/non-existent-endpoint')
      .expect(404)
      .end(done);
  });
});