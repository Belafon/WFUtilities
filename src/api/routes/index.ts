import { Router } from 'express';
import eventRoutes from './event.routes';
import passageRoutes from './passage.routes';
import mapRoutes from './map.routes';

const router = Router();

router.use('/event', eventRoutes);
router.use('/passage/screen', passageRoutes);
router.use('/map', mapRoutes);
// Add more routes here as your API grows

export default router;
