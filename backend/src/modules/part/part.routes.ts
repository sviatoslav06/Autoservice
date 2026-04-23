import { Router } from 'express';
import { PartController } from './part.controller';
import { authenticateJWT, authorizeRoles } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createPartSchema, updatePartSchema } from './part.validation';

const router = Router();
const controller = new PartController();

router.get('/', authenticateJWT, controller.getAll);
router.get('/:id', authenticateJWT, controller.getById);

router.post(
  '/',
  authenticateJWT,
  authorizeRoles('Admin', 'Manager'),
  validate(createPartSchema),
  controller.create
);

router.put(
  '/:id',
  authenticateJWT,
  authorizeRoles('Admin', 'Manager'),
  validate(updatePartSchema),
  controller.update
);

router.delete(
  '/:id',
  authenticateJWT,
  authorizeRoles('Admin', 'Manager'),
  controller.delete
);

export default router;
