import { Request, Response, NextFunction } from 'express';
import { VehicleService } from './vehicle.service';
import { AuthRequest } from '../../middleware/auth.middleware';

const service = new VehicleService();

export class VehicleController {

  async create(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const result = await service.createVehicle(req.user!, req.body);
      res.status(201).json(result);
    } catch (e) {
      next(e);
    }
  }

  async getMy(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json(await service.getMyVehicles(req.user!.id));
    } catch (e) {
      next(e);
    }
  }

  async getById(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json(await service.getVehicleById(req.user!, Number(req.params.id)));
    } catch (e) {
      next(e);
    }
  }

  async update(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json(await service.updateVehicle(req.user!, Number(req.params.id), req.body));
    } catch (e) {
      next(e);
    }
  }

  async delete(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json(await service.deleteVehicle(req.user!, Number(req.params.id)));
    } catch (e) {
      next(e);
    }
  }

  async getByClient(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      res.json(await service.getVehiclesByClientId(Number(req.params.clientId)));
    } catch (e) {
      next(e);
    }
  }
}
