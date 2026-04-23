import { Router } from 'express';
import { OrderController } from './order.controller';
import { authenticateJWT, authorizeRoles } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  addOrderPartSchema,
  addOrderServiceSchema,
  createOrderSchema,
  updateOrderSchema,
  updateOrderPartSchema,
  updateOrderServiceSchema,
  updateOrderStatusSchema
} from './order.validation';

const router = Router();
const controller = new OrderController();

router.post(
  '/',
  authenticateJWT,
  authorizeRoles('Client', 'Manager', 'Admin'),
  validate(createOrderSchema),
  controller.create
);

router.get(
  '/',
  authenticateJWT,
  authorizeRoles('Admin', 'Manager', 'Accountant'),
  controller.getAll
);

router.get(
  '/my',
  authenticateJWT,
  authorizeRoles('Client'),
  controller.getMy
);

router.get(
  '/assigned',
  authenticateJWT,
  authorizeRoles('Mechanic'),
  controller.getAssigned
);

router.get(
  '/:id',
  authenticateJWT,
  authorizeRoles('Client', 'Admin', 'Manager', 'Accountant', 'Mechanic'),
  controller.getById
);

router.put(
  '/:id',
  authenticateJWT,
  authorizeRoles('Manager', 'Admin'),
  validate(updateOrderSchema),
  controller.update
);

router.patch(
  '/:id/status',
  authenticateJWT,
  authorizeRoles('Mechanic', 'Manager', 'Accountant', 'Admin'),
  validate(updateOrderStatusSchema),
  controller.updateStatus
);

router.post(
  '/:id/parts',
  authenticateJWT,
  authorizeRoles('Mechanic', 'Manager', 'Admin'),
  validate(addOrderPartSchema),
  controller.addPart
);

router.patch(
  '/:id/parts/:partId',
  authenticateJWT,
  authorizeRoles('Mechanic', 'Manager', 'Admin'),
  validate(updateOrderPartSchema),
  controller.updatePart
);

router.delete(
  '/:id/parts/:partId',
  authenticateJWT,
  authorizeRoles('Mechanic', 'Manager', 'Admin'),
  controller.deletePart
);

router.post(
  '/:id/services',
  authenticateJWT,
  authorizeRoles('Mechanic', 'Manager', 'Admin'),
  validate(addOrderServiceSchema),
  controller.addService
);

router.patch(
  '/:id/services/:serviceId',
  authenticateJWT,
  authorizeRoles('Mechanic', 'Manager', 'Admin'),
  validate(updateOrderServiceSchema),
  controller.updateService
);

router.delete(
  '/:id/services/:serviceId',
  authenticateJWT,
  authorizeRoles('Mechanic', 'Manager', 'Admin'),
  controller.deleteService
);

router.post(
  '/:id/close',
  authenticateJWT,
  authorizeRoles('Mechanic', 'Manager', 'Accountant', 'Admin'),
  controller.close
);

router.delete(
  '/:id',
  authenticateJWT,
  authorizeRoles('Client', 'Manager', 'Admin'),
  controller.delete
);

router.post(
  '/:id/cancel',
  authenticateJWT,
  authorizeRoles('Client', 'Manager', 'Admin'),
  controller.cancel
);

export default router;
