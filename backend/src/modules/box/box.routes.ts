import { Router } from 'express';
import { BoxController } from './box.controller';
import { authenticateJWT, authorizeRoles } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createBoxSchema, updateBoxSchema } from './box.validation';

const router = Router();
const controller = new BoxController();

router.get('/', authenticateJWT, controller.getAll);
router.get('/available', authenticateJWT, controller.getAvailable);
router.get('/:id', authenticateJWT, controller.getById);

router.post(
  '/',
  authenticateJWT,
  authorizeRoles('Admin', 'Manager'),
  validate(createBoxSchema),
  controller.create
);

router.put(
  '/:id',
  authenticateJWT,
  authorizeRoles('Admin', 'Manager'),
  validate(updateBoxSchema),
  controller.update
);

router.delete(
  '/:id',
  authenticateJWT,
  authorizeRoles('Admin', 'Manager'),
  controller.delete
);

export default router;
