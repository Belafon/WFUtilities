// Simple Express server using CommonJS syntax
const express = require('express');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');

// Initialize express app
const app = express();

// Basic middleware with increased body size limits for large map data
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cors());

// Basic Swagger document
const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'WorldsFactory API',
    version: '1.0.0',
    description: 'API for WorldsFactory VS Code Extension',
  },
  paths: {
    '/health': {
      get: {
        summary: 'Health check endpoint',
        responses: {
          '200': { 
            description: 'Server is healthy'
          }
        }
      }
    }
  }
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Root endpoint
app.get('/', (req, res) => {
  res.send('Server is running. Try /api-docs for Swagger UI or /health for health check.');
});

// Swagger UI
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', swaggerUi.setup(swaggerDocument));

// Simple error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

module.exports = app;