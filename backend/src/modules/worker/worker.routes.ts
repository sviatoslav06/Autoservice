import { Router } from 'express';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { WorkerController } from './worker.controller';

const router = Router();
const controller = new WorkerController();

router.get('/mechanics', authenticateJWT, controller.getMechanics);
router.get('/mechanics/available', authenticateJWT, controller.getAvailableMechanics);

export default router;
