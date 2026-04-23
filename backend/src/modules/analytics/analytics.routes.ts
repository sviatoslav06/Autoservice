import { Router } from 'express';
import { AnalyticsController } from './analytics.controller';
import { authenticateJWT, authorizeRoles } from '../../middleware/auth.middleware';

const router = Router();
const controller = new AnalyticsController();

router.get(
  '/dashboard',
  authenticateJWT,
  authorizeRoles('Admin', 'Manager', 'Accountant'),
  controller.getDashboard
);

router.get(
  '/forecast',
  authenticateJWT,
  authorizeRoles('Admin', 'Manager', 'Accountant'),
  controller.getForecast
);

export default router;
