import { Router } from 'express';
import eventRoutes from './event.routes';
import passageRoutes from './passage.routes';

const router = Router();

router.use('/event', eventRoutes);
router.use('/passage', passageRoutes);
// Add more routes here as your API grows

export default router;
