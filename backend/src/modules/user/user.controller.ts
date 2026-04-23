import { Request, Response, NextFunction } from 'express';
import { UserService } from './user.service';

const service = new UserService();

export class UserController {
  async createUser(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await service.createUser(req.body));
    } catch (e) {
      next(e);
    }
  }

  async getUsers(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await service.getUsers());
    } catch (e) {
      next(e);
    }
  }

  async getUserById(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await service.getUserById(Number(req.params.id)));
    } catch (e) {
      next(e);
    }
  }

  async updateUser(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await service.updateUser(Number(req.params.id), req.body));
    } catch (e) {
      next(e);
    }
  }

  async deleteUser(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await service.deleteUser(Number(req.params.id)));
    } catch (e) {
      next(e);
    }
  }

  async createClient(req: Request, res: Response, next: NextFunction) {
    try {
      res.status(201).json(await service.createClientByManager(req.body));
    } catch (e) {
      next(e);
    }
  }

  async getClients(req: Request, res: Response, next: NextFunction) {
    try {
      const phone = typeof req.query.phone === 'string' ? req.query.phone : undefined;
      res.json(await service.getClients(phone));
    } catch (e) {
      next(e);
    }
  }

  async getClientById(req: Request, res: Response, next: NextFunction) {
    try {
      res.json(await service.getClientById(Number(req.params.id)));
    } catch (e) {
      next(e);
    }
  }
}
