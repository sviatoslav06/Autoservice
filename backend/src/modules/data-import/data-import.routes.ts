import { Router } from 'express';
import { authenticateJWT, authorizeRoles } from '../../middleware/auth.middleware';
import { DataImportController } from './data-import.controller';

const router = Router();
const controller = new DataImportController();

router.post(
  '/external-data/import',
  authenticateJWT,
  authorizeRoles('Admin'),
  controller.runExternalImport
);

export default router;
