import { Router } from 'express';
import {
  updateScreenPassage,
  deleteScreenPassage,
  openScreenPassage,
  setScreenPassageTime
} from '../controllers/passage.controller';
import {
  validatePassageUpdate,
  handleValidationErrors
} from '../middlewares/validation';

const router = Router();

router.put('/:passageId', validatePassageUpdate, handleValidationErrors, updateScreenPassage);
router.delete('/:passageId', deleteScreenPassage);
router.post('/:passageId/open', openScreenPassage);
router.post('/:passageId/setTime', setScreenPassageTime);

export default router;