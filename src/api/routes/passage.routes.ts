import { Router } from 'express';
import {
  updatePassage,
  deletePassage,
  openPassage
} from '../controllers/passage.controller';
import type { RequestHandler } from 'express';

const router = Router();

// Define type with correct params shape
type PassageRequestHandler = RequestHandler<{passageId: string}>;

router.put('/:passageId', updatePassage as PassageRequestHandler);
router.delete('/:passageId', deletePassage as PassageRequestHandler);
router.post('/:passageId/open', openPassage as PassageRequestHandler);

export default router;