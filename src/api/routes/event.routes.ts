import { Router } from 'express';
import {
  updateEvent,
  deleteEvent,
  openEvent,
  setEventTime
} from '../controllers/event.controller';
import {
  validateEventUpdate,
  validateSetTime,
  handleValidationErrors
} from '../middlewares/validation';

const router = Router();

router.put('/:eventId', validateEventUpdate, handleValidationErrors, updateEvent);
router.delete('/:eventId', deleteEvent);
router.post('/:eventId/open', openEvent);
router.post('/:eventId/setTime', validateSetTime, handleValidationErrors, setEventTime);

export default router;