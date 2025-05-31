import { Request, Response } from 'express';
import { ScreenPassageUpdateRequest } from '../../types';
import { passageManager } from '../services/passage.manager';
import { logger } from '../../utils/logger';

/**
 * @desc    Update a screen passage
 * @route   PUT /api/passage/screen/:passageId
 * @access  Public
 */
export const updateScreenPassage = async (req: Request<{ passageId: string }>, res: Response): Promise<void> => {
  try {
    const { passageId } = req.params;
    const passageData = req.body as ScreenPassageUpdateRequest;
    
    // Check for demo mode
    const isDemoMode = req.query.demo === 'true' || req.header('x-demo-mode') === 'true';
    
    if (isDemoMode) {
      res.status(200).json({
        success: true,
        message: `Screen passage ${passageId} updated successfully (demo mode)`,
      });
      return;
    }
    
    await passageManager.updatePassage(passageId, passageData);
    
    res.status(200).json({
      success: true,
      message: `Screen passage ${passageId} updated successfully`,
    });
  } catch (error: any) {
    logger.error(`Failed to update screen passage: ${error.message}`, { error });
    
    // Handle validation errors with 400 status
    if (error.message.includes('Invalid passageId format')) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
      return;
    }
    
    if (error.message.includes('not found') || error.message.includes('ENOENT')) {
      res.status(404).json({
        success: false,
        error: error.message,
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update screen passage',
    });
  }
};

/**
 * @desc    Delete a screen passage
 * @route   DELETE /api/passage/screen/:passageId
 * @access  Public
 */
export const deleteScreenPassage = async (req: Request<{ passageId: string }>, res: Response): Promise<void> => {
  try {
    const { passageId } = req.params;
    
    // Check for demo mode
    const isDemoMode = req.query.demo === 'true' || req.header('x-demo-mode') === 'true';
    
    if (isDemoMode) {
      res.status(200).json({
        success: true,
        message: `Screen passage ${passageId} deleted successfully (demo mode)`,
      });
      return;
    }
    
    await passageManager.deletePassage(passageId);
    
    res.status(200).json({
      success: true,
      message: `Screen passage ${passageId} deleted successfully`,
    });
  } catch (error: any) {
    logger.error(`Failed to delete screen passage: ${error.message}`, { error });
    
    // Handle validation errors with 400 status
    if (error.message.includes('Invalid passageId format')) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete screen passage',
    });
  }
};

/**
 * @desc    Open a screen passage in VS Code
 * @route   POST /api/passage/screen/:passageId/open
 * @access  Public
 */
export const openScreenPassage = async (req: Request<{ passageId: string }>, res: Response): Promise<void> => {
  try {
    const { passageId } = req.params;
    
    const isDemoMode = req.query.demo === 'true' || req.header('x-demo-mode') === 'true';
    
    if (isDemoMode) {
      res.status(200).json({
        success: true,
        message: `Screen passage ${passageId} opened in VS Code (demo mode)`,
      });
      return;
    }
    
    await passageManager.openScreenPassage(passageId);
    
    res.status(200).json({
      success: true,
      message: `Screen passage ${passageId} opened in VS Code`,
    });
  } catch (error: any) {
    logger.error(`Failed to open screen passage: ${error.message}`, { error });
    
    // Handle validation errors with 400 status
    if (error.message.includes('Invalid passageId format')) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
      return;
    }
    
    // Handle empty error message
    const errorMessage = error.message || 'Failed to open screen passage';
    
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
};

/**
 * @desc    Set time for a screen passage
 * @route   POST /api/passage/screen/:passageId/setTime
 * @access  Public
 */
export const setScreenPassageTime = async (req: Request<{ passageId: string }>, res: Response): Promise<void> => {
  try {
    const { passageId } = req.params;
    const { timeRange } = req.body;
    
    // Check for demo mode
    const isDemoMode = req.query.demo === 'true' || req.header('x-demo-mode') === 'true';
    
    if (isDemoMode) {
      res.status(200).json({
        success: true,
        message: `Screen passage ${passageId} time set successfully (demo mode)`,
      });
      return;
    }
    
    // Validate timeRange
    if (!timeRange || !timeRange.start || !timeRange.end) {
      res.status(400).json({
        success: false,
        error: 'Invalid time range data - missing start or end',
      });
      return;
    }
    
    // For now, just return success as the actual implementation would update the passage
    res.status(200).json({
      success: true,
      message: `Screen passage ${passageId} time set successfully`,
    });
  } catch (error: any) {
    logger.error(`Failed to set screen passage time: ${error.message}`, { error });
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to set screen passage time',
    });
  }
};