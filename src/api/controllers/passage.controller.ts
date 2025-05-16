import { Request, Response } from 'express';
import { PassageUpdateRequest } from '../../types';
import { passageManager } from '../services/passage.manager';

/**
 * @desc    Update a passage
 * @route   PUT /api/passage/:passageId
 * @access  Public
 */
export const updatePassage = async (req: Request<{ passageId: string }>, res: Response): Promise<void> => {
  try {
    const { passageId } = req.params;
    const passageData = req.body as PassageUpdateRequest;
    
    await passageManager.updatePassage(passageId, passageData);
    
    res.status(200).json({
      success: true,
      message: `Passage ${passageId} updated successfully`,
    });
  } catch (error: any) {
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
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to open passage',
    });
  }
};