import { Options } from 'swagger-jsdoc';
import path from 'path';

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

const swaggerOptions: Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'WorldsFactory API',
      version: '1.0.0',
      description: 'API for WorldsFactory VS Code Extension',
    },
    servers: [
      {
        url: `http://${HOST}:${PORT}`,
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
        }
      }
    }
  },
  apis: [
    path.resolve(__dirname, '../routes/*.ts'),
    path.resolve(__dirname, '../controllers/*.ts')
  ]
};

export default swaggerOptions;
