import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error(err.message, { stack: err.stack });
  
  // Handle JSON parsing errors
  if (err instanceof SyntaxError && 'status' in err && err.status === 400 && 'body' in err) {
    res.status(400).json({
      status: 'error',
      message: 'Invalid JSON format',
    });
    return;
  }
  
  // Handle validation errors
  if (err.name === 'ValidationError') {
    res.status(400).json({
      status: 'error',
      message: err.message,
    });
    return;
  }
  
  // Default error response
  res.status(500).json({
    status: 'error',
    message: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
    stack: process.env.NODE_ENV === 'production' ? undefined : err.stack,
  });
};
