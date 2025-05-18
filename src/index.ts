/**
 * WFNodeServer - A Node.js server library for WorldsFactory
 * @module wfnodeserver
 */

// Import and export server application 
import app from './app';
export { app };

// Export API components
export * from './api/controllers/event.controller';
export * from './api/controllers/map.controller';
export * from './api/controllers/passage.controller';
export * from './api/services/event.manager';
export * from './api/services/map.manager';
export * from './api/services/passage.manager';

// Export adapters
export * from './api/adapters/editorAdapter';
export * from './api/adapters/fileSystem';

// Export utilities
export * from './utils/logger';
export * from './utils/objectToStringConverter';

// Export TypeScript Object Parser
export * from './typescriptObjectParser/ObjectParser';

// Export type definitions
export * from './types';

// Re-export Express for convenience
import express from 'express';
export { express };

/**
 * Function to create and start a server instance
 * @param port - The port number to listen on
 * @returns A Promise that resolves with the server instance
 */
export function createServer(port: number = 3000) {
  const server = app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
  
  return server;
}