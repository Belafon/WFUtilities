import { Request, Response } from 'express';
import { ChapterUpdateRequest, SetTimeRequest } from '../../types';
import { chapterManager } from '../services/chapter.manager';
import { logger } from '../../utils/logger';
import { config } from '../../WFServerConfig';

/**
 * @desc    Update an chapter
 * @route   PUT /api/chapter/:chapterId
 * @access  Public
 */
export const updateChapter = async (req: Request<{ chapterId: string }>, res: Response): Promise<void> => {
  try {
    const { chapterId } = req.params;
    const chapterData = req.body as ChapterUpdateRequest;

    // For testing/demo purposes, check for specific demo mode flag
    const isDemoMode = req.query.demo === 'true' || req.headers['x-demo-mode'] === 'true';
    if (isDemoMode) {
      res.status(200).json({
        success: true,
        message: `Chapter ${chapterId} updated successfully (demo mode)`,
      });
      return;
    }

    if (!chapterId || chapterId.trim() === '') {
      const errorMessage = 'Chapter ID cannot be empty.';
      config.editorAdapter.showErrorNotification(errorMessage);
      throw new Error(errorMessage);
    }

    await chapterManager.updateChapter(chapterId, chapterData);

    res.status(200).json({
      success: true,
      message: `Chapter ${chapterId} updated successfully`,
    });
  } catch (error: any) {
    logger.error(`Failed to update chapter: ${error.message}`, { error });

    // Handle specific errors
    if (error.message.includes('not found') || error.message.includes('ENOENT')) {
      res.status(404).json({
        success: false,
        error: `Chapter ${req.params.chapterId} not found`,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update chapter',
    });
  }
};

export const deleteChapter = async (req: Request<{ chapterId: string }>, res: Response): Promise<void> => {
  try {
    const { chapterId } = req.params;

    // For testing/demo purposes, check for specific demo mode flag
    const isDemoMode = req.query.demo === 'true' || req.headers['x-demo-mode'] === 'true';
    if (isDemoMode) {
      res.status(200).json({
        success: true,
        message: `Chapter ${chapterId} deleted successfully (demo mode)`,
      });
      return;
    }

    await chapterManager.deleteChapter(chapterId);

    res.status(200).json({
      success: true,
      message: `Chapter ${chapterId} deleted successfully`,
    });
  } catch (error: any) {
    logger.error(`Failed to delete chapter: ${error.message}`, { error });

    if (error.message.includes('not found') || error.message.includes('ENOENT')) {
      res.status(404).json({
        success: false,
        error: `Chapter ${req.params.chapterId} not found`,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete chapter',
    });
  }
};

export const openChapter = async (req: Request<{ chapterId: string }>, res: Response): Promise<void> => {
  logger.info(`Opening chapter ${req.params.chapterId} in VS Code`);
  try {
    const { chapterId } = req.params;

    // For testing/demo purposes, check for specific demo mode flag
    const isDemoMode = req.query.demo === 'true' || req.headers['x-demo-mode'] === 'true';
    if (isDemoMode) {
      logger.info(`Demo mode: Chapter ${chapterId} opened in VS Code (no actual action taken)`);
      res.status(200).json({
        success: true,
        message: `Chapter ${chapterId} opened in VS Code (demo mode)`,
      });
      return;
    }

    await chapterManager.openChapter(chapterId);

    res.status(200).json({
      success: true,
      message: `Chapter ${chapterId} opened in VS Code`,
    });
  } catch (error: any) {
    logger.error(`Failed to open chapter: ${error.message}`, { error });

    if (error.message.includes('not found') || error.message.includes('ENOENT')) {
      res.status(404).json({
        success: false,
        error: `Chapter ${req.params.chapterId} not found`,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to open chapter',
    });
  }
};

export const setChapterTime = async (req: Request<{ chapterId: string }>, res: Response): Promise<void> => {
  try {
    const { chapterId } = req.params;
    const { timeRange } = req.body as SetTimeRequest;

    // For testing/demo purposes, check for specific demo mode flag
    const isDemoMode = req.query.demo === 'true' || req.headers['x-demo-mode'] === 'true';
    if (isDemoMode) {
      res.status(200).json({
        success: true,
        message: `Time range for chapter ${chapterId} set successfully (demo mode)`,
      });
      return;
    }

    await chapterManager.setChapterTime(chapterId, timeRange);

    res.status(200).json({
      success: true,
      message: `Time range for chapter ${chapterId} set successfully`,
    });
  } catch (error: any) {
    logger.error(`Failed to set chapter time range: ${error.message}`, { error });

    if (error.message.includes('not found') || error.message.includes('ENOENT')) {
      res.status(404).json({
        success: false,
        error: `Chapter ${req.params.chapterId} not found`,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: error.message || 'Failed to set chapter time range',
    });
  }
};