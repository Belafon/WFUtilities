import { Router } from 'express';
import {
  updateEvent,
  deleteEvent,
  openEvent,
  setEventTime
} from '../controllers/event.controller';
import type { RequestHandler } from 'express';

const router = Router();

// Define type with correct params shape
type EventRequestHandler = RequestHandler<{eventId: string}>;

router.put('/:eventId', updateEvent as EventRequestHandler);
router.delete('/:eventId', deleteEvent as EventRequestHandler);
router.post('/:eventId/open', openEvent as EventRequestHandler);
router.post('/:eventId/setTime', setEventTime as EventRequestHandler);

export default router;