import { Router } from 'express';
import { PartFieldController } from './part-field.controller';
import { authenticateJWT, authorizeRoles } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createFieldSchema, updateFieldSchema } from './part-field.validation';

const router = Router();
const controller = new PartFieldController();

router.get('/:categoryId', authenticateJWT, controller.getByCategory);

router.post(
  '/',
  authenticateJWT,
  authorizeRoles('Admin', 'Manager'),
  validate(createFieldSchema),
  controller.create
);

router.put(
  '/:id',
  authenticateJWT,
  authorizeRoles('Admin', 'Manager'),
  validate(updateFieldSchema),
  controller.update
);

router.delete(
  '/:id',
  authenticateJWT,
  authorizeRoles('Admin', 'Manager'),
  controller.delete
);

export default router;
