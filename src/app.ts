/**
 * Express application for WFNodeServer
 * 
 * This app can be used:
 * 1. As a standalone server (via createServer from index.ts)
 * 2. As middleware in another Express app (by mounting on a route)
 * 
 * Example of using as middleware:
 * ```
 * import express from 'express';
 * import { app as wfApp } from 'wfnodeserver';
 * 
 * const app = express();
 * app.use('/wf-api', wfApp);
 * ```
 */

import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import swaggerJsDoc from 'swagger-jsdoc';
import path from 'path';

import { errorHandler } from './api/middlewares/errorHandler';
import routes from './api/routes';
import { logger } from './utils/logger';

// Initialize express app
const app = express();

// HTTP request logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  const { method, url, ip } = req;
  const userAgent = req.get('User-Agent') || 'unknown';
  
  // Log the incoming request
  logger.info(`${method} ${url}`, {
    ip,
    userAgent,
    timestamp: new Date().toISOString()
  });
  
  // Override res.end to capture response details
  const originalEnd = res.end.bind(res);
  res.end = function(...args: any[]) {
    const duration = Date.now() - start;
    const { statusCode } = res;
    
    // Log the response
    logger.info(`${method} ${url} - ${statusCode}`, {
      ip,
      statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length') || 0,
      timestamp: new Date().toISOString()
    });
    
    // Call the original end method
    return originalEnd(...args);
  };
  
  next();
});

// Basic middleware with increased body size limits for large map data
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors());

// Add a root endpoint for debugging
app.get('/', (req, res) => {
  res.send(`
    <h1>WFUtilities API Server</h1>
    <p>The server is running successfully.</p>
    <ul>
      <li><a href="/health">Health Check</a></li>
      <li><a href="/api-docs">API Documentation (Swagger UI)</a></li>
    </ul>
  `);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Enhanced Swagger configuration with operations defined inline
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'WorldsFactory API',
      version: '1.0.0',
      description: 'API for WorldsFactory VS Code Extension',
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 3000}`,
        description: 'Development server'
      }
    ],
    components: {
      schemas: {
        TimeRange: {
          type: 'object',
          required: ['start', 'end'],
          properties: {
            start: {
              type: 'string',
              description: "Date and time in format 'D.M. H:mm'",
              example: '2.1. 8:00'
            },
            end: {
              type: 'string',
              description: "Date and time in format 'D.M. H:mm'",
              example: '5.1. 8:00'
            }
          }
        },
        EventUpdateRequest: {
          type: 'object',
          required: ['title', 'description', 'location', 'timeRange'],
          properties: {
            title: { type: 'string' },
            description: { type: 'string' },
            location: { type: 'string' },
            timeRange: { $ref: '#/components/schemas/TimeRange' }
          }
        },
        SetTimeRequest: {
          type: 'object',
          required: ['timeRange'],
          properties: {
            timeRange: { $ref: '#/components/schemas/TimeRange' }
          }
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            message: { type: 'string' }
          },
          required: ['success']
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            error: { type: 'string' }
          },
          required: ['success', 'error']
        }
      },
      responses: {
        Success: {
          description: 'Operation successful',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SuccessResponse' }
            }
          }
        },
        NotFound: {
          description: 'Resource not found',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/ErrorResponse' }
            }
          }
        }
      }
    },
    paths: {
      '/api/event/{eventId}': {
        put: {
          summary: 'Update event details',
          parameters: [
            {
              name: 'eventId',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/EventUpdateRequest' }
              }
            }
          },
          responses: {
            '200': { $ref: '#/components/responses/Success' },
            '404': { $ref: '#/components/responses/NotFound' }
          }
        },
        delete: {
          summary: 'Delete an event',
          parameters: [
            {
              name: 'eventId',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            '200': { $ref: '#/components/responses/Success' },
            '404': { $ref: '#/components/responses/NotFound' }
          }
        }
      },
      '/api/event/{eventId}/open': {
        post: {
          summary: 'Open an event in VS Code',
          parameters: [
            {
              name: 'eventId',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            '200': { $ref: '#/components/responses/Success' },
            '404': { $ref: '#/components/responses/NotFound' }
          }
        }
      },
      '/api/event/{eventId}/setTime': {
        post: {
          summary: 'Set event time range',
          parameters: [
            {
              name: 'eventId',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SetTimeRequest' }
              }
            }
          },
          responses: {
            '200': { $ref: '#/components/responses/Success' },
            '404': { $ref: '#/components/responses/NotFound' }
          }
        }
      },
      '/api/passage/screen/{passageId}': {
        put: {
          summary: 'Update screen passage details',
          parameters: [
            {
              name: 'passageId',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['type'],
                  properties: {
                    type: {
                      type: 'string',
                      enum: ['screen', 'linear', 'transition']
                    }
                  }
                }
              }
            }
          },
          responses: {
            '200': { $ref: '#/components/responses/Success' },
            '404': { $ref: '#/components/responses/NotFound' }
          }
        },
        delete: {
          summary: 'Delete a screen passage',
          parameters: [
            {
              name: 'passageId',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            '200': { $ref: '#/components/responses/Success' },
            '404': { $ref: '#/components/responses/NotFound' }
          }
        }
      },
      '/api/passage/screen/{passageId}/open': {
        post: {
          summary: 'Open a screen passage file in VS Code',
          parameters: [
            {
              name: 'passageId',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          responses: {
            '200': { $ref: '#/components/responses/Success' },
            '404': { $ref: '#/components/responses/NotFound' }
          }
        }
      },
      '/api/passage/screen/{passageId}/setTime': {
        post: {
          summary: 'Set time for a screen passage',
          parameters: [
            {
              name: 'passageId',
              in: 'path',
              required: true,
              schema: { type: 'string' }
            }
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SetTimeRequest' }
              }
            }
          },
          responses: {
            '200': { $ref: '#/components/responses/Success' },
            '404': { $ref: '#/components/responses/NotFound' }
          }
        }
      }
    }
  },
  apis: [
    path.resolve(__dirname, './api/routes/*.js'),
    path.resolve(__dirname, './api/controllers/*.js')
  ]
};

// Setup Swagger
const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(swaggerDocs));

// API routes
app.use('/api', routes);

// Also mount routes directly for backward compatibility
app.use('/', routes);

// Error handling middleware
app.use(errorHandler);

export default app;
