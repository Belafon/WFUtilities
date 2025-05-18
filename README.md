# WFNodeServer

A TypeScript library for running the WorldsFactory server components.

## Installation

```bash
yarn add wfnodeserver
```

## Usage

### Basic Server

```typescript
import { createServer } from 'wfnodeserver';

// Start the server on port 3000
const server = createServer(3000);
```

### Using Components

```typescript
import { app, EventController, MapController } from 'wfnodeserver';
import express from 'express';

// Create your own Express app
const myApp = express();

// Use the WFNodeServer app as middleware
myApp.use('/wf-api', app);

// Or use specific controllers
const eventController = new EventController();
myApp.get('/custom-events', eventController.getAllEvents);
```

## API Documentation

When running the server, Swagger documentation is available at `/api-docs`.

## Development

```bash
# Install dependencies
yarn install

# Run in development mode
yarn dev

# Run tests
yarn test

# Build the library
yarn build
```
