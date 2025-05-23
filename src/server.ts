import dotenv from 'dotenv';
dotenv.config();

import { app } from './index';
import { logger } from './utils/logger';

const PORT = Number(process.env.PORT) || 3149;
const HOST = process.env.HOST || 'localhost';

// Create HTTP server and start it
const server = app.listen(PORT, () => {
  logger.info(`Server running on http://${HOST}:${PORT}`);
  logger.info(`Swagger documentation URL: http://${HOST}:${PORT}/api-docs`);
  logger.info(`Health check URL: http://${HOST}:${PORT}/health`);
  logger.info('Press Ctrl+C to stop the server');
});

// Handle process termination gracefully
process.on('SIGINT', () => {
  logger.info('Shutting down server...');
  server.close(() => {
    logger.info('Server shut down successfully');
    process.exit(0);
  });
});

// Keep the process alive
process.stdin.resume();
