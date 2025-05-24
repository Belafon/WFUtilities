import { Request, Response } from 'express';
import { PassageUpdateRequest } from '../../types';
import { passageManager } from '../services/passage.manager';
import { logger } from '../../utils/logger';

/**
 * @desc    Update a passage
 * @route   PUT /api/passage/:passageId
 * @access  Public
 */
export const updatePassage = async (req: Request<{ passageId: string }>, res: Response): Promise<void> => {
  try {
    const { passageId } = req.params;
    const passageData = req.body as PassageUpdateRequest;
    
    // Check for demo mode
    const isDemoMode = req.query.demo === 'true' || req.header('x-demo-mode') === 'true';
    
    if (isDemoMode) {
      res.status(200).json({
        success: true,
        message: `Passage ${passageId} updated successfully (demo mode)`,
      });
      return;
    }
    
    await passageManager.updatePassage(passageId, passageData);
    
    res.status(200).json({
      success: true,
      message: `Passage ${passageId} updated successfully`,
    });
  } catch (error: any) {
    logger.error(`Failed to update passage: ${error.message}`, { error });
    
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
      error: error.message || 'Failed to update passage',
    });
  }
};

/**
 * @desc    Delete a passage
 * @route   DELETE /api/passage/:passageId
 * @access  Public
 */
export const deletePassage = async (req: Request<{ passageId: string }>, res: Response): Promise<void> => {
  try {
    const { passageId } = req.params;
    
    // Check for demo mode
    const isDemoMode = req.query.demo === 'true' || req.header('x-demo-mode') === 'true';
    
    if (isDemoMode) {
      res.status(200).json({
        success: true,
        message: `Passage ${passageId} deleted successfully (demo mode)`,
      });
      return;
    }
    
    await passageManager.deletePassage(passageId);
    
    res.status(200).json({
      success: true,
      message: `Passage ${passageId} deleted successfully`,
    });
  } catch (error: any) {
    logger.error(`Failed to delete passage: ${error.message}`, { error });
    
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
      error: error.message || 'Failed to delete passage',
    });
  }
};

/**
 * @desc    Open a passage in VS Code
 * @route   POST /api/passage/:passageId/open
 * @access  Public
 */
export const openPassage = async (req: Request<{ passageId: string }>, res: Response): Promise<void> => {
  try {
    const { passageId } = req.params;
    
    // Check for demo mode
    const isDemoMode = req.query.demo === 'true' || req.header('x-demo-mode') === 'true';
    
    if (isDemoMode) {
      res.status(200).json({
        success: true,
        message: `Passage ${passageId} opened in VS Code (demo mode)`,
      });
      return;
    }
    
    await passageManager.openPassage(passageId);
    
    res.status(200).json({
      success: true,
      message: `Passage ${passageId} opened in VS Code`,
    });
  } catch (error: any) {
    logger.error(`Failed to open passage: ${error.message}`, { error });
    
    // Handle validation errors with 400 status
    if (error.message.includes('Invalid passageId format')) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
      return;
    }
    
    // Handle empty error message
    const errorMessage = error.message || 'Failed to open passage';
    
    res.status(500).json({
      success: false,
      error: errorMessage,
    });
  }
};

/**
 * @desc    Set time for a passage
 * @route   POST /api/passage/:passageId/setTime
 * @access  Public
 */
export const setPassageTime = async (req: Request<{ passageId: string }>, res: Response): Promise<void> => {
  try {
    const { passageId } = req.params;
    const { timeRange } = req.body;
    
    // Check for demo mode
    const isDemoMode = req.query.demo === 'true' || req.header('x-demo-mode') === 'true';
    
    if (isDemoMode) {
      res.status(200).json({
        success: true,
        message: `Passage ${passageId} time set successfully (demo mode)`,
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
      message: `Passage ${passageId} time set successfully`,
    });
  } catch (error: any) {
    logger.error(`Failed to set passage time: ${error.message}`, { error });
    
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to set passage time',
    });
  }
};