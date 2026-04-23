import { NextFunction, Response } from 'express';
import { runExternalDataImport } from '../../tools/external-data-import/index';
import { AuthRequest } from '../../middleware/auth.middleware';

export class DataImportController {
  runExternalImport = async (_req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const report = await runExternalDataImport();
      res.json({
        message: 'Зовнішні дані успішно імпортовано',
        report
      });
    } catch (error) {
      next(error);
    }
  };
}
