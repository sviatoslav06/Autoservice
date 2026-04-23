import { NextFunction, Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './auth.types';
import { AuthRequest } from '../../middleware/auth.middleware';

const authService = new AuthService();

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const dto: RegisterDto = req.body;
      const result = await authService.register(dto);
      res.status(201).json(result);
    } catch (error: any) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const dto: LoginDto = req.body;
      const result = await authService.login(dto);
      res.json(result);
    } catch (error: any) {
      next(error);
    }
  }

  async me(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new Error('Unauthorized');
      }

      res.json(await authService.getCurrentUser(req.user.id));
    } catch (error) {
      next(error);
    }
  }

  async updateMe(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      if (!req.user) {
        throw new Error('Unauthorized');
      }

      res.json(await authService.updateCurrentUser(req.user.id, req.body));
    } catch (error) {
      next(error);
    }
  }
}
