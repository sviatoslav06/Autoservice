import { Request, Response, NextFunction } from 'express';

export const validate = (schema: any) => {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      schema.parse(req.body);
      next();
    } catch (error: any) {
      const message =
        error?.issues?.[0]?.message ||
        error?.errors?.[0]?.message ||
        error?.message ||
        'Validation error';

      return res.status(400).json({
        message,
      });
    }
  };
};
