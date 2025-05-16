// A very minimal Express server for testing
const express = require('express');

// Create Express app
const app = express();

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Root endpoint
app.get('/', (req, res) => {
  res.send('Hello World! Server is working.');
});

// Start server
const PORT = 3001; // Using a different port
app.listen(PORT, () => {
  console.log(`Test server running on http://localhost:${PORT}`);
  console.log(`Try accessing: http://localhost:${PORT}/health`);
});