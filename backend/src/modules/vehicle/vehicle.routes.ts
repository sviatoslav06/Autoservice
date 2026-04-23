import { Router } from 'express';
import { VehicleController } from './vehicle.controller';
import { authenticateJWT, authorizeRoles } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import {
  createVehicleSchema,
  updateVehicleSchema
} from './vehicle.validation';

const router = Router();
const controller = new VehicleController();

router.post(
  '/',
  authenticateJWT,
  authorizeRoles('Client', 'Manager', 'Admin'),
  validate(createVehicleSchema),
  controller.create
);

router.get(
  '/my',
  authenticateJWT,
  authorizeRoles('Client'),
  controller.getMy
);

router.get(
  '/client/:clientId',
  authenticateJWT,
  authorizeRoles('Manager', 'Admin'),
  controller.getByClient
);

router.get(
  '/:id',
  authenticateJWT,
  authorizeRoles('Client', 'Manager', 'Admin'),
  controller.getById
);

router.put(
  '/:id',
  authenticateJWT,
  authorizeRoles('Client', 'Manager', 'Admin'),
  validate(updateVehicleSchema),
  controller.update
);

router.delete(
  '/:id',
  authenticateJWT,
  authorizeRoles('Client', 'Manager', 'Admin'),
  controller.delete
);

export default router;
