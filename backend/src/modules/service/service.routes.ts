import { Router } from 'express';
import { ServiceController } from './service.controller';
import { authenticateJWT, authorizeRoles } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createServiceSchema, updateServiceSchema } from './service.validation';

const router = Router();
const controller = new ServiceController();

router.get('/', authenticateJWT, controller.getAll);
router.get('/:id', authenticateJWT, controller.getById);

router.post(
  '/',
  authenticateJWT,
  authorizeRoles('Admin', 'Manager'),
  validate(createServiceSchema),
  controller.create
);

router.put(
  '/:id',
  authenticateJWT,
  authorizeRoles('Admin', 'Manager'),
  validate(updateServiceSchema),
  controller.update
);

router.delete(
  '/:id',
  authenticateJWT,
  authorizeRoles('Admin', 'Manager'),
  controller.delete
);

export default router;
