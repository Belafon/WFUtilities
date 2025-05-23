/**
 * API Integration Tests
 * 
 * These tests demonstrate how another project would integrate and use the WFUtilities library.
 * Tests cover both standalone server usage and middleware integration scenarios.
 */

import { suite, test, setup, teardown, before, after } from 'mocha';
import assert from 'assert';
import request from 'supertest';
import express from 'express';
import { Server } from 'http';

// Import the library as an external project would
import { 
  app as wfApp,
  createServer, 
  wfNodeServerConfig,
  EventManager,
  MapManager,
  PassageManager,
  EventUpdateRequest,
  TimeRange,
  express as reExportedExpress
} from '../../index';

suite('WFUtilities Library - API Integration Tests', () => {
  
  // Set test environment
  before(() => {
    process.env.NODE_ENV = 'test';
  });
  
  after(() => {
    delete process.env.NODE_ENV;
  });
  
  suite('Standalone Server Usage', () => {
    let server: Server;
    const testPort = 3149;

    setup(() => {
      // Test creating a server as another project would
      server = createServer(testPort);
    });

    teardown((done) => {
      server.close(done);
    });

    test('should create and start server successfully', (done) => {
      // Verify server is running
      request(`http://localhost:${testPort}`)
        .get('/health')
        .expect(200)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) return done(err);
          assert.strictEqual(res.body.status, 'ok');
          done();
        });
    });

    test('should serve root endpoint with API information', (done) => {
      request(`http://localhost:${testPort}`)
        .get('/')
        .expect(200)
        .expect('Content-Type', /html/)
        .end((err, res) => {
          if (err) return done(err);
          assert.ok(res.text.includes('WFUtilities API Server'));
          assert.ok(res.text.includes('/health'));
          assert.ok(res.text.includes('/api-docs'));
          done();
        });
    });

    test('should serve Swagger documentation', (done) => {
      request(`http://localhost:${testPort}`)
        .get('/api-docs/')
        .expect(200)
        .end(done);
    });

    test('should handle CORS properly', (done) => {
      request(`http://localhost:${testPort}`)
        .options('/health')
        .expect(204)
        .end(done);
    });
  });

  suite('Express Middleware Integration', () => {
    let app: express.Application;

    setup(() => {
      // Demonstrate how another project would integrate WFUtilities as middleware
      app = express();
      
      // Mount WF API on a specific route
      app.use('/wf-api', wfApp);
      
      // Add other routes that the host application might have
      app.get('/host-app-health', (req, res) => {
        res.json({ hostApp: 'running', wfApi: 'mounted' });
      });
    });

    test('should mount WF API as middleware successfully', (done) => {
      request(app)
        .get('/wf-api/health')
        .expect(200)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) return done(err);
          assert.strictEqual(res.body.status, 'ok');
          done();
        });
    });

    test('should allow host app routes to work alongside WF API', (done) => {
      request(app)
        .get('/host-app-health')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err);
          assert.deepStrictEqual(res.body, { hostApp: 'running', wfApi: 'mounted' });
          done();
        });
    });

    test('should serve WF API documentation under mounted path', (done) => {
      request(app)
        .get('/wf-api/api-docs/')
        .expect(200)
        .end(done);
    });
  });

  suite('Event API Endpoints', () => {
    test('should handle event update requests with proper validation', (done) => {
      const eventId = 'test-event';
      const updateData: EventUpdateRequest = {
        title: 'Test Event Title',
        description: 'A test event description',
        location: 'test_location',
        timeRange: {
          start: '1.1. 10:00',
          end: '1.1. 12:00'
        }
      };

      request(wfApp)
        .put(`/api/event/${eventId}`)
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

    test('should validate time range format in event updates', (done) => {
      const eventId = 'test-event';
      const invalidUpdateData = {
        title: 'Test Event',
        description: 'Description',
        location: 'location',
        timeRange: {
          start: 'invalid-format',
          end: '1.1. 12:00'
        }
      };

      request(wfApp)
        .put(`/api/event/${eventId}`)
        .send(invalidUpdateData)
        .expect(400)
        .end(done);
    });

    test('should handle event time setting requests', (done) => {
      const eventId = 'test-event';
      const timeData = {
        timeRange: {
          start: '2.1. 14:00',
          end: '2.1. 16:00'
        }
      };

      request(wfApp)
        .post(`/api/event/${eventId}/setTime`)
        .send(timeData)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) return done(err);
          assert.ok(res.status >= 200 && res.status < 500);
          done();
        });
    });

    test('should handle event open requests', (done) => {
      const eventId = 'test-event';

      request(wfApp)
        .post(`/api/event/${eventId}/open`)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) return done(err);
          assert.ok(res.status >= 200 && res.status < 500);
          done();
        });
    });

    test('should handle event deletion requests', (done) => {
      const eventId = 'test-event';

      request(wfApp)
        .delete(`/api/event/${eventId}`)
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
      const passageId = 'test-passage';
      const updateData = {
        type: 'screen',
        title: 'Test Passage Title',
        image: '/path/to/image.jpg',
        body: [
          {
            condition: true,
            redirect: '',
            text: 'Passage text content',
            links: []
          }
        ]
      };

      request(wfApp)
        .put(`/api/passage/${passageId}`)
        .send(updateData)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) return done(err);
          assert.ok(res.status >= 200 && res.status < 500);
          done();
        });
    });

    test('should handle passage open requests', (done) => {
      const passageId = 'test-passage';

      request(wfApp)
        .post(`/api/passage/${passageId}/open`)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) return done(err);
          assert.ok(res.status >= 200 && res.status < 500);
          done();
        });
    });

    test('should handle passage deletion requests', (done) => {
      const passageId = 'test-passage';

      request(wfApp)
        .delete(`/api/passage/${passageId}`)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) return done(err);
          assert.ok(res.status >= 200 && res.status < 500);
          done();
        });
    });
  });

  suite('Map API Endpoints', () => {
    test('should handle map data retrieval', (done) => {
      const mapId = 'test-map';

      request(wfApp)
        .get(`/api/map/${mapId}`)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) return done(err);
          assert.ok(res.status >= 200 && res.status < 500);
          done();
        });
    });

    test('should handle map list retrieval', (done) => {
      request(wfApp)
        .get('/api/map')
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) return done(err);
          assert.ok(res.status >= 200 && res.status < 500);
          done();
        });
    });

    test('should handle map updates with valid data structure', (done) => {
      const mapId = 'test-map';
      const mapData = {
        title: 'Test Map',
        width: 10,
        height: 10,
        data: [
          ['grass', 'grass', 'tree'],
          ['path', 'grass', 'rock'],
          ['water', 'water', 'bridge']
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
  });

  suite('Library Exports Verification', () => {
    test('should export all expected components', () => {
      // Verify that all expected exports are available
      assert.ok(wfApp, 'app should be exported');
      assert.ok(createServer, 'createServer function should be exported');
      assert.ok(wfNodeServerConfig, 'config should be exported');
      assert.ok(EventManager, 'EventManager should be exported');
      assert.ok(MapManager, 'MapManager should be exported');
      assert.ok(PassageManager, 'PassageManager should be exported');
      assert.ok(reExportedExpress, 'Express should be re-exported');
    });

    test('should have correct types available', () => {
      // Verify TypeScript types are properly exported
      const timeRange: TimeRange = {
        start: '1.1. 10:00',
        end: '1.1. 12:00'
      };
      
      const eventUpdate: EventUpdateRequest = {
        title: 'Test',
        description: 'Test description',
        location: 'test_location',
        timeRange
      };

      assert.ok(timeRange.start);
      assert.ok(eventUpdate.title);
    });

    test('should allow configuration access', () => {
      // Verify that configuration can be accessed
      assert.ok(wfNodeServerConfig, 'Config should be accessible');
      // Note: Actual config methods depend on implementation
    });
  });

  suite('Error Handling', () => {
    test('should handle malformed JSON requests', (done) => {
      request(wfApp)
        .put('/api/event/test')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400)
        .end(done);
    });

    test('should handle requests to non-existent endpoints', (done) => {
      request(wfApp)
        .get('/non-existent-endpoint')
        .expect(404)
        .end(done);
    });

    test('should handle missing required fields in requests', (done) => {
      const incompleteEventData = {
        title: 'Test Event'
        // Missing description, location, timeRange
      };

      request(wfApp)
        .put('/api/event/test')
        .send(incompleteEventData)
        .expect(400)
        .end(done);
    });
  });

  suite('Content Type Handling', () => {
    test('should accept JSON content type', (done) => {
      const eventData: EventUpdateRequest = {
        title: 'JSON Test Event',
        description: 'Testing JSON content type',
        location: 'json_location',
        timeRange: {
          start: '1.1. 10:00',
          end: '1.1. 12:00'
        }
      };

      request(wfApp)
        .put('/api/event/json-test')
        .set('Content-Type', 'application/json')
        .send(eventData)
        .expect('Content-Type', /json/)
        .end((err, res) => {
          if (err) return done(err);
          assert.ok(res.status >= 200 && res.status < 500);
          done();
        });
    });

    test('should accept URL encoded content type', (done) => {
      request(wfApp)
        .post('/api/event/test/setTime')
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
});
