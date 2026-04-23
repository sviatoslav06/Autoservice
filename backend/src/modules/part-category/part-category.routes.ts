import { Router } from 'express';
import { PartCategoryController } from './part-category.controller';
import { authenticateJWT, authorizeRoles } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createCategorySchema, updateCategorySchema } from './part-category.validation';

const router = Router();
const controller = new PartCategoryController();

router.get('/', authenticateJWT, controller.getAll);

router.post(
  '/',
  authenticateJWT,
  authorizeRoles('Admin', 'Manager'),
  validate(createCategorySchema),
  controller.create
);

router.put(
  '/:id',
  authenticateJWT,
  authorizeRoles('Admin', 'Manager'),
  validate(updateCategorySchema),
  controller.update
);

router.delete(
  '/:id',
  authenticateJWT,
  authorizeRoles('Admin', 'Manager'),
  controller.delete
);

export default router;
