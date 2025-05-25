import { Request, Response } from 'express';
import { EventUpdateRequest, SetTimeRequest } from '../../types';
import { eventManager } from '../services/event.manager';
import { logger } from '../../utils/logger';

/**
 * @desc    Update an event
 * @route   PUT /api/event/:eventId
 * @access  Public
 */
export const updateEvent = async (req: Request<{ eventId: string }>, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const eventData = req.body as EventUpdateRequest;

    // For testing/demo purposes, check for specific demo mode flag
    const isDemoMode = req.query.demo === 'true' || req.headers['x-demo-mode'] === 'true';
    if (isDemoMode) {
      res.status(200).json({
        success: true,
        message: `Event ${eventId} updated successfully (demo mode)`,
      });
      return;
    }

    await eventManager.updateEvent(eventId, eventData);

    res.status(200).json({
      success: true,
      message: `Event ${eventId} updated successfully`,
    });
  } catch (error: any) {
    logger.error(`Failed to update event: ${error.message}`, { error });

    // Handle specific errors
    if (error.message.includes('not found') || error.message.includes('ENOENT')) {
      res.status(404).json({
        success: false,
        error: `Event ${req.params.eventId} not found`,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update event',
    });
  }
};

export const deleteEvent = async (req: Request<{ eventId: string }>, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;

    // For testing/demo purposes, check for specific demo mode flag
    const isDemoMode = req.query.demo === 'true' || req.headers['x-demo-mode'] === 'true';
    if (isDemoMode) {
      res.status(200).json({
        success: true,
        message: `Event ${eventId} deleted successfully (demo mode)`,
      });
      return;
    }

    await eventManager.deleteEvent(eventId);

    res.status(200).json({
      success: true,
      message: `Event ${eventId} deleted successfully`,
    });
  } catch (error: any) {
    logger.error(`Failed to delete event: ${error.message}`, { error });

    if (error.message.includes('not found') || error.message.includes('ENOENT')) {
      res.status(404).json({
        success: false,
        error: `Event ${req.params.eventId} not found`,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete event',
    });
  }
};

export const openEvent = async (req: Request<{ eventId: string }>, res: Response): Promise<void> => {
  logger.info(`Opening event ${req.params.eventId} in VS Code`);
  try {
    const { eventId } = req.params;

    // For testing/demo purposes, check for specific demo mode flag
    const isDemoMode = req.query.demo === 'true' || req.headers['x-demo-mode'] === 'true';
    if (isDemoMode) {
      logger.info(`Demo mode: Event ${eventId} opened in VS Code (no actual action taken)`);
      res.status(200).json({
        success: true,
        message: `Event ${eventId} opened in VS Code (demo mode)`,
      });
      return;
    }

    await eventManager.openEvent(eventId);

    res.status(200).json({
      success: true,
      message: `Event ${eventId} opened in VS Code`,
    });
  } catch (error: any) {
    logger.error(`Failed to open event: ${error.message}`, { error });

    if (error.message.includes('not found') || error.message.includes('ENOENT')) {
      res.status(404).json({
        success: false,
        error: `Event ${req.params.eventId} not found`,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to open event',
    });
  }
};

export const setEventTime = async (req: Request<{ eventId: string }>, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const { timeRange } = req.body as SetTimeRequest;

    // For testing/demo purposes, check for specific demo mode flag
    const isDemoMode = req.query.demo === 'true' || req.headers['x-demo-mode'] === 'true';
    if (isDemoMode) {
      res.status(200).json({
        success: true,
        message: `Time range for event ${eventId} set successfully (demo mode)`,
      });
      return;
    }

    await eventManager.setEventTime(eventId, timeRange);

    res.status(200).json({
      success: true,
      message: `Time range for event ${eventId} set successfully`,
    });
  } catch (error: any) {
    logger.error(`Failed to set event time range: ${error.message}`, { error });

    if (error.message.includes('not found') || error.message.includes('ENOENT')) {
      res.status(404).json({
        success: false,
        error: `Event ${req.params.eventId} not found`,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to set event time range',
    });
  }
};