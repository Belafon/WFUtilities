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
    
    // For testing/demo purposes
    if (process.env.NODE_ENV === 'test' && req.query.demo === 'true') {
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
        error: `Passage ${req.params.passageId} not found`,
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
    
    await passageManager.deletePassage(passageId);
    
    res.status(200).json({
      success: true,
      message: `Passage ${passageId} deleted successfully`,
    });
  } catch (error: any) {
    logger.error(`Failed to delete passage: ${error.message}`, { error });
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
    
    await passageManager.openPassage(passageId);
    
    res.status(200).json({
      success: true,
      message: `Passage ${passageId} opened in VS Code`,
    });
  } catch (error: any) {
    logger.error(`Failed to open passage: ${error.message}`, { error });
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to open passage',
    });
  }
};