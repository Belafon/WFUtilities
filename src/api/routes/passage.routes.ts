import { Router } from 'express';
import {
  updatePassage,
  deletePassage,
  openPassage
} from '../controllers/passage.controller';
import {
  validatePassageUpdate,
  handleValidationErrors
} from '../middlewares/validation';

const router = Router();

router.put('/:passageId', validatePassageUpdate, handleValidationErrors, updatePassage);
router.delete('/:passageId', deletePassage);
router.post('/:passageId/open', openPassage);

export default router;