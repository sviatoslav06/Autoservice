import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/db';
import { CreateClientByManagerDto, CreateUserDto } from './user.dto';

const WORKER_ROLES = new Set(['Mechanic', 'Manager']);

export class UserService {
  private createGeneratedClientEmail(phone?: string) {
    const normalizedPhone = phone?.replace(/\D/g, '') || Date.now().toString();
    return `client-${normalizedPhone}-${crypto.randomInt(1000, 9999)}@autoservice.local`;
  }

  private normalizeUsername(value: string) {
    const normalized = value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9._-]/g, '');

    return normalized || `client-${Date.now()}`;
  }

  private async createUniqueUsername(baseUsername: string) {
    const base = this.normalizeUsername(baseUsername);

    for (let attempt = 0; attempt < 25; attempt += 1) {
      const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
      const existing = await prisma.user.findUnique({
        where: { username: candidate }
      });

      if (!existing) {
        return candidate;
      }
    }

    return `${base}-${crypto.randomInt(1000, 9999)}`;
  }

  private async ensureUniqueUserFields(
    email: string,
    phone: string | undefined,
    excludeUserId?: number
  ) {
    const [emailOwner, phoneOwner] = await Promise.all([
      prisma.user.findUnique({ where: { email } }),
      phone ? prisma.user.findUnique({ where: { phone } }) : Promise.resolve(null)
    ]);

    if (emailOwner && emailOwner.id !== excludeUserId) {
      throw new Error('User with this email already exists');
    }

    if (phoneOwner && phoneOwner.id !== excludeUserId) {
      throw new Error('User with this phone already exists');
    }
  }

  private async syncRoleProfile(
    tx: Prisma.TransactionClient,
    userId: number,
    role: string,
    hourlyRate?: number
  ) {
    const [client, worker] = await Promise.all([
      tx.client.findUnique({ where: { userId } }),
      tx.worker.findUnique({ where: { userId } })
    ]);

    if (role === 'Client') {
      if (!client) {
        await tx.client.create({ data: { userId } });
      }

      if (worker) {
        const assignmentsCount = await tx.orderService.count({
          where: { workerId: worker.id }
        });

        if (assignmentsCount > 0) {
          throw new Error('Cannot convert worker with assigned order services to client');
        }

        await tx.worker.delete({ where: { userId } });
      }

      return;
    }

    if (client) {
      const [vehiclesCount, ordersCount] = await Promise.all([
        tx.vehicle.count({ where: { clientId: client.id } }),
        tx.order.count({ where: { clientId: client.id } })
      ]);

      if (vehiclesCount > 0 || ordersCount > 0) {
        throw new Error('Cannot change client role while vehicles or orders still exist');
      }

      await tx.client.delete({ where: { userId } });
    }

    if (WORKER_ROLES.has(role)) {
      const workerHourlyRate = new Prisma.Decimal(hourlyRate ?? 0);

      if (worker) {
        await tx.worker.update({
          where: { userId },
          data: { position: role, hourlyRate: workerHourlyRate }
        });
      } else {
        await tx.worker.create({
          data: {
            userId,
            position: role,
            hourlyRate: workerHourlyRate
          }
        });
      }
      return;
    }

    if (worker) {
      const assignmentsCount = await tx.orderService.count({
        where: { workerId: worker.id }
      });

      if (assignmentsCount > 0) {
        throw new Error('Cannot remove worker profile while order assignments still exist');
      }

      await tx.worker.delete({ where: { userId } });
    }
  }

  async createUser(data: CreateUserDto) {
    await this.ensureUniqueUserFields(data.email, data.phone);

    const passwordHash = await bcrypt.hash(data.password, 12);

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username: data.username,
          email: data.email,
          passwordHash,
          phone: data.phone,
          role: data.role
        }
      });

      await this.syncRoleProfile(tx, user.id, data.role, data.hourlyRate);
      return user;
    });
  }

  async getUsers() {
    return prisma.user.findMany({
      include: {
        client: true,
        worker: true
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getUserById(id: number) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        client: true,
        worker: true
      }
    });
  }

  async updateUser(id: number, data: Partial<CreateUserDto>) {
    const existingUser = await prisma.user.findUnique({
      where: { id }
    });

    if (!existingUser) {
      throw new Error('User not found');
    }

    const nextEmail = data.email ?? existingUser.email;
    const nextPhone = data.phone ?? existingUser.phone ?? undefined;
    await this.ensureUniqueUserFields(nextEmail, nextPhone, id);

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: {
          username: data.username,
          email: data.email,
          phone: data.phone,
          role: data.role
        }
      });

      if (data.role && data.role !== existingUser.role) {
        await this.syncRoleProfile(tx, id, data.role, data.hourlyRate);
      } else if (data.role && WORKER_ROLES.has(data.role) && typeof data.hourlyRate === 'number') {
        await tx.worker.updateMany({
          where: { userId: id },
          data: { hourlyRate: new Prisma.Decimal(data.hourlyRate) }
        });
      }

      return tx.user.findUnique({
        where: { id },
        include: {
          client: true,
          worker: true
        }
      });
    });
  }

  async deleteUser(id: number) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        client: true,
        worker: true
      }
    });

    if (!user) {
      throw new Error('User not found');
    }

    if (user.client) {
      const [vehiclesCount, ordersCount] = await Promise.all([
        prisma.vehicle.count({ where: { clientId: user.client.id } }),
        prisma.order.count({ where: { clientId: user.client.id } })
      ]);

      if (vehiclesCount > 0 || ordersCount > 0) {
        throw new Error('Cannot delete client with linked vehicles or orders');
      }
    }

    if (user.worker) {
      const assignmentsCount = await prisma.orderService.count({
        where: { workerId: user.worker.id }
      });

      if (assignmentsCount > 0) {
        throw new Error('Cannot delete worker with linked order assignments');
      }
    }

    await prisma.user.delete({
      where: { id }
    });

    return { message: 'User deleted' };
  }

  async createClientByManager(data: CreateClientByManagerDto) {
    const email = data.email ?? this.createGeneratedClientEmail(data.phone);
    await this.ensureUniqueUserFields(email, data.phone);
    const username = await this.createUniqueUsername(data.username);

    const temporaryPassword = crypto.randomBytes(8).toString('hex');
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username,
          email,
          passwordHash,
          phone: data.phone,
          role: 'Client'
        }
      });

      const client = await tx.client.create({
        data: { userId: user.id }
      });

      return {
        id: user.id,
        clientId: client.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        role: user.role,
        temporaryPassword
      };
    });
  }

  async getClients(phone?: string) {
    return prisma.user.findMany({
      where: {
        role: 'Client',
        ...(phone ? { phone } : {})
      },
      include: {
        client: {
          include: {
            vehicles: true,
            orders: {
              select: {
                id: true,
                status: true,
                orderDate: true,
                totalAmount: true
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getClientById(id: number) {
    const user = await prisma.user.findFirst({
      where: {
        id,
        role: 'Client'
      },
      include: {
        client: {
          include: {
            vehicles: true,
            orders: {
              include: {
                vehicle: true,
                box: true,
                payments: true
              },
              orderBy: { createdAt: 'desc' }
            }
          }
        }
      }
    });

    if (!user) {
      throw new Error('Client not found');
    }

    return user;
  }
}
