import { Router } from 'express';
import chapterRoutes from './chapter.routes';
import passageRoutes from './passage.routes';
import mapRoutes from './map.routes';

const router = Router();

router.use('/chapter', chapterRoutes);
router.use('/passage/screen', passageRoutes);
router.use('/map', mapRoutes);
// Add more routes here as your API grows

export default router;
