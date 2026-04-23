import { Router } from 'express';
import { PaymentController } from './payment.controller';
import { authenticateJWT, authorizeRoles } from '../../middleware/auth.middleware';
import { validate } from '../../middleware/validate.middleware';
import { createPaymentSchema } from './payment.validation';

const router = Router();
const controller = new PaymentController();

router.post(
  '/orders/:orderId/pay',
  authenticateJWT,
  authorizeRoles('Admin', 'Manager', 'Accountant', 'Client'),
  validate(createPaymentSchema),
  controller.create
);

router.get(
  '/orders/:orderId/payments',
  authenticateJWT,
  authorizeRoles('Admin', 'Manager', 'Accountant', 'Client'),
  controller.getByOrder
);

router.get(
  '/payments',
  authenticateJWT,
  authorizeRoles('Admin', 'Accountant'),
  controller.getAll
);

router.get(
  '/finance/orders',
  authenticateJWT,
  authorizeRoles('Admin', 'Accountant'),
  controller.getFinancialOrders
);

router.get(
  '/stats',
  authenticateJWT,
  authorizeRoles('Admin', 'Accountant'),
  controller.getStats
);

export default router;
