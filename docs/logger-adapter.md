# Logger Adapter Configuration

The WF Utilities library provides a configurable logger adapter system that allows you to customize logging behavior from your application code.

## Overview

The logger adapter follows the same pattern as other adapters in the library:
- **LoggerAdapter interface**: Defines the contract for logging operations
- **DefaultLoggerAdapter**: Basic console-based implementation 
- **WinstonLoggerAdapter**: Adapter for winston logger integration
- **ConfigurableLogger**: Runtime-configurable logger that uses the adapter from config

## Usage Examples

### Basic Usage with Default Logger

```typescript
import { configurableLogger } from './utils/configurableLogger';

// Use the configurable logger - defaults to console logging
configurableLogger.info('Application started');
configurableLogger.warn('This is a warning message');
configurableLogger.error('An error occurred', { errorCode: 500 });
```

### Configure with Winston Logger

```typescript
import { config } from './WFServerConfig';
import { createWinstonLoggerAdapter } from './utils/logger';

// Use the built-in winston logger
const winstonAdapter = createWinstonLoggerAdapter();
config.setLoggerAdapter(winstonAdapter);

// Now all logging will use winston
import { configurableLogger } from './utils/configurableLogger';
configurableLogger.info('This will be logged through winston');
```

### Configure with Custom Winston Instance

```typescript
import winston from 'winston';
import { config } from './WFServerConfig';
import { WinstonLoggerAdapter } from './api/adapters/loggerAdapter';

// Create a custom winston logger
const customLogger = winston.createLogger({
  level: 'verbose',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'app.log' }),
    new winston.transports.Console({ format: winston.format.simple() })
  ]
});

// Create adapter and configure
const adapter = new WinstonLoggerAdapter(customLogger);
config.setLoggerAdapter(adapter);
```

### Configure with Custom Logger Implementation

```typescript
import { config } from './WFServerConfig';
import { LoggerAdapter } from './api/adapters/loggerAdapter';

// Create a custom logger adapter
class CustomLoggerAdapter implements LoggerAdapter {
  debug(message: string, metadata?: any): void {
    // Your custom debug implementation
    this.logToService('DEBUG', message, metadata);
  }

  info(message: string, metadata?: any): void {
    // Your custom info implementation
    this.logToService('INFO', message, metadata);
  }

  warn(message: string, metadata?: any): void {
    // Your custom warning implementation
    this.logToService('WARN', message, metadata);
  }

  error(message: string, metadata?: any): void {
    // Your custom error implementation
    this.logToService('ERROR', message, metadata);
  }

  log(options: { level: string; message: string; metadata?: any }): void {
    this.logToService(options.level, options.message, options.metadata);
  }

  private logToService(level: string, message: string, metadata?: any): void {
    // Send to your logging service (e.g., Splunk, ELK, etc.)
    console.log(`[${level}] ${message}`, metadata);
  }
}

// Configure the custom adapter
config.setLoggerAdapter(new CustomLoggerAdapter());
```

### Using in Library Services

The library services automatically use the configured logger:

```typescript
// In your application setup
import { config } from 'wf-utilities/WFServerConfig';
import { createWinstonLoggerAdapter } from 'wf-utilities/utils/logger';

// Configure winston logging
config.setLoggerAdapter(createWinstonLoggerAdapter());

// Now all internal library logging will use winston
import { passageManager } from 'wf-utilities/api/services/passage.manager';

// This will log using your configured adapter
await passageManager.updatePassage('chapter1-char1-passage1', passageData);
```

## Interface Reference

### LoggerAdapter

```typescript
interface LoggerAdapter {
  debug(message: string, metadata?: any): void;
  info(message: string, metadata?: any): void;
  warn(message: string, metadata?: any): void;
  error(message: string, metadata?: any): void;
  log(options: { level: string; message: string; metadata?: any }): void;
}
```

### Available Implementations

- **DefaultLoggerAdapter**: Console-based logging
- **WinstonLoggerAdapter**: Winston logger integration
- **Custom implementations**: Implement the LoggerAdapter interface

## Benefits

1. **Consistent Interface**: All logging uses the same interface regardless of implementation
2. **Runtime Configuration**: Change logging behavior without code changes
3. **Library Integration**: Internal library operations use your configured logger
4. **Flexibility**: Easy to integrate with any logging framework or service
5. **Testing**: Mock or capture logs easily in tests by providing a test adapter
