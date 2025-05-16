import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import app from './app';

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// Create HTTP server
const server = http.createServer(app);

// Start the server
server.listen(PORT, () => {
  console.log(`Server running on http://${HOST}:${PORT}`);
  console.log(`Swagger documentation URL: http://${HOST}:${PORT}/api-docs`);
  console.log(`Health check URL: http://${HOST}:${PORT}/health`);
  console.log('Press Ctrl+C to stop the server');
});

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('Shutting down server...');
  server.close(() => {
    console.log('Server shut down successfully');
    process.exit(0);
  });
});

// Keep the process alive
process.stdin.resume();
