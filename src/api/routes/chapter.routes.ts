import { Router } from 'express';
import {
  updateChapter,
  deleteChapter,
  openChapter,
  setChapterTime
} from '../controllers/chapter.controller';
import {
  validateChapterUpdate,
  validateSetTime,
  handleValidationErrors
} from '../middlewares/validation';

const router = Router();

router.put('/:chapterId', validateChapterUpdate, handleValidationErrors, updateChapter);
router.delete('/:chapterId', deleteChapter);
router.post('/:chapterId/open', openChapter);
router.post('/:chapterId/setTime', validateSetTime, handleValidationErrors, setChapterTime);

export default router;