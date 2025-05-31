import { Request, Response, NextFunction } from 'express';
import { logger } from '../../utils/logger';

export const errorHandler = (err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error(err.message, { stack: err.stack });
  
  // Handle JSON parsing errors
  if (err instanceof SyntaxError && 'status' in err && err.status === 400 && 'body' in err) {
    res.status(400).json({
      success: false,
      error: 'Invalid JSON format',
    });
    return;
  }
  
  // Handle validation errors
  if (err.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      error: err.message,
    });
    return;
  }
  
  // Handle express-validator errors
  if (err.array && typeof err.array === 'function') {
    const errors = err.array();
    const errorMessage = errors.map((error: any) => 
      `${error.param}: ${error.msg}`
    ).join(', ');
    
    res.status(400).json({
      success: false,
      error: `Validation failed: ${errorMessage}`,
    });
    return;
  }
  
  // Handle specific HTTP errors
  if (err.status) {
    res.status(err.status).json({
      success: false,
      error: err.message,
    });
    return;
  }
  
  // Default error response
  const isProduction = process.env.NODE_ENV === 'production';
  res.status(500).json({
    success: false,
    error: isProduction ? 'Internal server error' : err.message,
    ...(isProduction ? {} : { stack: err.stack })
  });
};