import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import swaggerJsDoc from 'swagger-jsdoc';
import path from 'path';

import { errorHandler } from './api/middlewares/errorHandler';
import routes from './api/routes';

// Initialize express app
const app = express();

// Basic middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
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
      '/api/passage/{passageId}': {
        put: {
          summary: 'Update passage details',
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

// Error handling middleware
app.use(errorHandler);

export default app;
