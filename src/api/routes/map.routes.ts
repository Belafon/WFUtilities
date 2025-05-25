import { Router } from 'express';
import {
  updateMapController,
  getMapController,
  listMapsController
} from '../controllers/map.controller';
import type { RequestHandler } from 'express';

const router = Router();

// Debug route to test parameter handling
router.all('/debug/:mapId', (req, res) => {
  console.log('Debug route - mapId:', JSON.stringify(req.params.mapId), 'length:', req.params.mapId?.length);
  res.json({
    mapId: req.params.mapId,
    length: req.params.mapId?.length,
    trimmed: req.params.mapId?.trim(),
    trimmedLength: req.params.mapId?.trim()?.length
  });
});

// Define type with correct params shape
type MapRequestHandler = RequestHandler<{mapId: string}>;

// Middleware to handle whitespace-only mapIds
const validateMapId: RequestHandler<{mapId: string}> = (req, res, next) => {
  const { mapId } = req.params;
  console.log('validateMapId middleware - received mapId:', JSON.stringify(mapId), 'length:', mapId?.length, 'trimmed:', JSON.stringify(mapId?.trim()));
  if (!mapId || mapId.trim() === '') {
    res.status(400).json({ success: false, error: 'Map ID cannot be empty.' });
    return;
  }
  next();
};

router.put('/:mapId', validateMapId, updateMapController as MapRequestHandler);
router.get('/:mapId', validateMapId, getMapController as MapRequestHandler);
router.get('/', listMapsController);

export default router;
