import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';

/**
 * Validation middleware for API requests
 */

// Time range validation regex: matches format like "1.1. 10:00"
const timeFormatRegex = /^\d{1,2}\.\d{1,2}\.\s\d{1,2}:\d{2}$/;

/**
 * Validation rules for event update requests
 */
export const validateEventUpdate = [
  body('title').notEmpty().withMessage('Title is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('location').notEmpty().withMessage('Location is required'),
  body('timeRange.start')
    .notEmpty().withMessage('Start time is required')
    .matches(timeFormatRegex).withMessage('Start time must be in format "D.M. H:mm"'),
  body('timeRange.end')
    .notEmpty().withMessage('End time is required')
    .matches(timeFormatRegex).withMessage('End time must be in format "D.M. H:mm"'),
];

/**
 * Validation rules for event time setting requests
 */
export const validateSetTime = [
  body('timeRange.start')
    .notEmpty().withMessage('Start time is required')
    .matches(timeFormatRegex).withMessage('Start time must be in format "D.M. H:mm"'),
  body('timeRange.end')
    .notEmpty().withMessage('End time is required')
    .matches(timeFormatRegex).withMessage('End time must be in format "D.M. H:mm"'),
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
    res.status(400).json({
      success: false,
      errors: errors.array(),
      message: 'Validation failed'
    });
    return;
  }
  next();
};
