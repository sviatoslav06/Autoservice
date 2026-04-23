import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../config/db';
import { RegisterDto, LoginDto, AuthResponse } from './auth.types';
import { config } from '../../config/env';

export class AuthService {
  private generateToken(payload: object): string {
    return jwt.sign(
      payload,
      config.jwtSecret,
      { expiresIn: config.jwtExpiresIn } as jwt.SignOptions
    );
  }

  async register(data: RegisterDto): Promise<AuthResponse> {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    });

    if (existingUser) {
      throw new Error('Користувач з таким email вже існує');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        passwordHash,
        phone: data.phone,
        role: 'Client',
      },
    });

    // Client profile
    await prisma.client.create({
      data: {
        userId: user.id,
      },
    });

    const token = this.generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    };
  }


  async login(data: LoginDto): Promise<AuthResponse> {
    const user = await prisma.user.findUnique({ where: { email: data.email } });
    if (!user) throw new Error('Невірний email або пароль');

    const isValid = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValid) throw new Error('Невірний email або пароль');

    const token = this.generateToken({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    };
  }

  async getCurrentUser(userId: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        phone: true,
        role: true,
      },
    });

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  }

  private async ensureUniqueProfileFields(
    email: string,
    phone: string | undefined,
    excludeUserId: number
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

  async updateCurrentUser(
    userId: number,
    data: Partial<{ username: string; phone?: string }>
  ) {
    const existingUser = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!existingUser) {
      throw new Error('User not found');
    }

    const nextPhone = data.phone ?? existingUser.phone ?? undefined;

    await this.ensureUniqueProfileFields(existingUser.email, nextPhone, userId);

    await prisma.user.update({
      where: { id: userId },
      data: {
        username: data.username,
        phone: data.phone
      }
    });

    return this.getCurrentUser(userId);
  }
}
