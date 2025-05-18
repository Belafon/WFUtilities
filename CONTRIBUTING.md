# Contributing to WFNodeServer

Thank you for your interest in contributing to WFNodeServer! This document provides guidelines and instructions for contributing.

## Getting Started

### Prerequisites

- Node.js (LTS version recommended)
- Yarn package manager

### Setup

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/your-username/WFNodeServer.git
   cd WFNodeServer
   ```
3. Install dependencies:
   ```bash
   yarn install
   ```
4. Set up pre-commit hooks (if applicable):
   ```bash
   yarn husky install
   ```

## Development Workflow

### Local Development

1. Start the development server:
   ```bash
   yarn dev
   ```

2. For automatic reloading during development:
   ```bash
   yarn dev:watch
   ```

### Testing

1. Run all tests:
   ```bash
   yarn test
   ```

2. Run tests in watch mode during development:
   ```bash
   yarn test:watch
   ```

### Building

Build the project:
```bash
yarn build
```

## Contribution Guidelines

### Code Style

- Follow the existing code style
- Use TypeScript's strict mode
- Add JSDoc comments for public APIs
- Follow the principle of least privilege

### Commit Messages

Please follow the [Conventional Commits](https://www.conventionalcommits.org/) specification for commit messages:

- `feat: add new feature`
- `fix: correct bug`
- `docs: update documentation`
- `style: format code (no production code change)`
- `refactor: restructure code (no behavior change)`
- `test: add or modify tests`
- `chore: update build tasks, package manager configs, etc.`

### Pull Requests

1. Create a new branch for your changes:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes and commit them with descriptive commit messages

3. Push the changes to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

4. Open a pull request against the main repository

5. In your pull request description, explain the changes and the problem they solve

### API Documentation

If you're adding or modifying API endpoints, make sure to:

1. Update the Swagger/OpenAPI documentation
2. Add JSDoc comments to any exported functions, classes, or interfaces

## Project Structure

- `src/` - Source code
  - `api/` - API components (controllers, routes, services)
  - `tests/` - Test files
  - `types/` - TypeScript type definitions
  - `utils/` - Utility functions and helpers
- `examples/` - Example usage of the library
- `scripts/` - Utility scripts

## License

By contributing to this project, you agree that your contributions will be licensed under the project's license.