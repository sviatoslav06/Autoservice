import { Router } from 'express';
import { UserController } from './user.controller';
import { authenticateJWT, authorizeRoles } from '../../middleware/auth.middleware';

const router = Router();
const controller = new UserController();

router.post(
  '/admin/users',
  authenticateJWT,
  authorizeRoles('Admin'),
  controller.createUser
);

router.get(
  '/admin/users',
  authenticateJWT,
  authorizeRoles('Admin'),
  controller.getUsers
);

router.get(
  '/admin/users/:id',
  authenticateJWT,
  authorizeRoles('Admin'),
  controller.getUserById
);

router.put(
  '/admin/users/:id',
  authenticateJWT,
  authorizeRoles('Admin'),
  controller.updateUser
);

router.delete(
  '/admin/users/:id',
  authenticateJWT,
  authorizeRoles('Admin'),
  controller.deleteUser
);

router.post(
  '/clients',
  authenticateJWT,
  authorizeRoles('Admin', 'Manager'),
  controller.createClient
);

router.get(
  '/clients',
  authenticateJWT,
  authorizeRoles('Admin', 'Manager'),
  controller.getClients
);

router.get(
  '/clients/:id',
  authenticateJWT,
  authorizeRoles('Admin', 'Manager'),
  controller.getClientById
);

export default router;
