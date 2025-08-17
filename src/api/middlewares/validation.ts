import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { logger } from '../../utils/logger';

/**
 * Validation middleware for API requests
 */

/**
 * Validation rules for chapter updates
 */
export const validateChapterUpdate = [
  body('title').optional().notEmpty().withMessage('Title cannot be empty if provided'),
  body('description').optional(), 
  body('location').optional().notEmpty().withMessage('Location cannot be empty if provided'),
  body('timeRange.start')
    .optional()
    .notEmpty().withMessage('Start time cannot be empty if provided')
    .isISO8601().withMessage('Start time must be a valid ISO 8601 datetime'),
  body('timeRange.end')
    .optional()
    .notEmpty().withMessage('End time cannot be empty if provided')
    .isISO8601().withMessage('End time must be a valid ISO 8601 datetime'),
];

/**
 * Validation rules for chapter time setting requests
 */
export const validateSetTime = [
  body('timeRange.start')
    .notEmpty().withMessage('Start time is required')
    .isISO8601().withMessage('Start time must be a valid ISO 8601 datetime'),
  body('timeRange.end')
    .notEmpty().withMessage('End time is required')
    .isISO8601().withMessage('End time must be a valid ISO 8601 datetime'),
];


/**
 * Validation rules for passage update requests
 */
export const validatePassageUpdate = [
  body('type').isIn(['screen', 'linear', 'transition']).withMessage('Type must be screen, linear, or transition'),
];

/**
 * Middleware to handle validation errors
 */
export const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    // Log validation failure with details
    logger.error('Validation failed for request', {
      method: req.method,
      url: req.originalUrl,
      body: req.body,
      errors: errors.array(),
      ip: req.ip,
      userAgent: req.get('User-Agent')
    });

    res.status(400).json({
      success: false,
      errors: errors.array(),
      message: 'Validation failed'
    });
    return;
  }
  next();
};