import { prisma } from '../../config/db';

interface AuthUser {
  id: number;
  role: string;
}

export class VehicleService {

  async getClientId(userId: number) {
    const client = await prisma.client.findUnique({
      where: { userId }
    });

    if (!client) throw new Error('Client not found');

    return client.id;
  }

  private async ensureClientExists(clientId: number) {
    const client = await prisma.client.findUnique({
      where: { id: clientId }
    });

    if (!client) {
      throw new Error('Client not found');
    }

    return client;
  }

  async createVehicle(actor: AuthUser, data: any) {
    const clientId =
      actor.role === 'Client'
        ? await this.getClientId(actor.id)
        : data.clientId;

    if (!clientId) {
      throw new Error('Client id is required');
    }

    await this.ensureClientExists(clientId);

    return prisma.vehicle.create({
      data: {
        clientId,
        ...data,
      }
    });
  }

  async getMyVehicles(userId: number) {
    const clientId = await this.getClientId(userId);

    return prisma.vehicle.findMany({
      where: { clientId }
    });
  }

  async getVehiclesByClientId(clientId: number) {
    await this.ensureClientExists(clientId);

    return prisma.vehicle.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getVehicleById(actor: AuthUser, vehicleId: number) {
    if (actor.role === 'Manager' || actor.role === 'Admin') {
      const vehicle = await prisma.vehicle.findUnique({
        where: { id: vehicleId }
      });

      if (!vehicle) {
        throw new Error('Vehicle not found');
      }

      return vehicle;
    }

    const clientId = await this.getClientId(actor.id);

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        clientId
      }
    });

    if (!vehicle) {
      throw new Error('Vehicle not found or access denied');
    }

    return vehicle;
  }

  async updateVehicle(actor: AuthUser, vehicleId: number, data: any) {
    if (actor.role === 'Manager' || actor.role === 'Admin') {
      return prisma.vehicle.update({
        where: { id: vehicleId },
        data
      });
    }

    const clientId = await this.getClientId(actor.id);

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        clientId
      }
    });

    if (!vehicle) {
      throw new Error('Access denied');
    }

    return prisma.vehicle.update({
      where: { id: vehicleId },
      data
    });
  }

  async deleteVehicle(actor: AuthUser, vehicleId: number) {
    if (actor.role === 'Manager' || actor.role === 'Admin') {
      return prisma.vehicle.delete({
        where: { id: vehicleId }
      });
    }

    const clientId = await this.getClientId(actor.id);

    const vehicle = await prisma.vehicle.findFirst({
      where: {
        id: vehicleId,
        clientId
      }
    });

    if (!vehicle) {
      throw new Error('Access denied');
    }

    return prisma.vehicle.delete({
      where: { id: vehicleId }
    });
  }
}
