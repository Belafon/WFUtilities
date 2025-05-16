import { Request, Response } from 'express';
import { EventUpdateRequest, SetTimeRequest } from '../../types';
import { eventManager } from '../services/event.manager';

/**
 * @desc    Update an event
 * @route   PUT /api/event/:eventId
 * @access  Public
 */
export const updateEvent = async (req: Request<{ eventId: string }>, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const eventData = req.body as EventUpdateRequest;
    
    await eventManager.updateEvent(eventId, eventData);
    
    res.status(200).json({
      success: true,
      message: `Event ${eventId} updated successfully`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update event',
    });
  }
};

/**
 * @desc    Delete an event
 * @route   DELETE /api/event/:eventId
 * @access  Public
 */
export const deleteEvent = async (req: Request<{ eventId: string }>, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    
    await eventManager.deleteEvent(eventId);
    
    res.status(200).json({
      success: true,
      message: `Event ${eventId} deleted successfully`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete event',
    });
  }
};

/**
 * @desc    Open an event in VS Code
 * @route   POST /api/event/:eventId/open
 * @access  Public
 */
export const openEvent = async (req: Request<{ eventId: string }>, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    
    await eventManager.openEvent(eventId);
    
    res.status(200).json({
      success: true,
      message: `Event ${eventId} opened in VS Code`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to open event',
    });
  }
};

/**
 * @desc    Set event time range
 * @route   POST /api/event/:eventId/setTime
 * @access  Public
 */
export const setEventTime = async (req: Request<{ eventId: string }>, res: Response): Promise<void> => {
  try {
    const { eventId } = req.params;
    const { timeRange } = req.body as SetTimeRequest;
    
    await eventManager.setEventTime(eventId, timeRange);
    
    res.status(200).json({
      success: true,
      message: `Time range for event ${eventId} set successfully`,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to set event time range',
    });
  }
};