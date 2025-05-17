import { Router } from 'express';
import {
  updateMapController,
  getMapController,
  listMapsController
} from '../controllers/map.controller';
import type { RequestHandler } from 'express';

const router = Router();

// Define type with correct params shape
type MapRequestHandler = RequestHandler<{mapId: string}>;

router.put('/:mapId', updateMapController as MapRequestHandler);
router.get('/:mapId', getMapController as MapRequestHandler);
router.get('/', listMapsController);

export default router;
