import winston from 'winston';
import { LoggerAdapter, WinstonLoggerAdapter } from '../api/adapters/loggerAdapter';

const logFormat = winston.format.printf(({ level, message, timestamp, ...metadata }) => {
  return `${timestamp} [${level}]: ${message} ${Object.keys(metadata).length ? JSON.stringify(metadata) : ''}`;
});

export let logger: LoggerAdapter = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    logFormat
  ),
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        logFormat
      )
    }),
    new winston.transports.File({ filename: 'server.log' })
  ]
});

export function setLogger(newLogger: LoggerAdapter) {
  if (!newLogger) {
    throw new Error('Logger cannot be null or undefined');
  }
  logger = newLogger;
  logger.info('Logger instance has been set successfully');
}

/**
 * Create a winston logger adapter for use with the configuration system
 * @param winstonLogger Optional winston logger instance, defaults to the exported logger
 * @returns A LoggerAdapter wrapping the winston logger
 */
export function createWinstonLoggerAdapter(winstonLogger?: winston.Logger): WinstonLoggerAdapter {
  return new WinstonLoggerAdapter(winstonLogger || logger);
}
