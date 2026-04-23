import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: process.env.PORT || 5001,
  jwtSecret: process.env.JWT_SECRET || 'supersecretkeychangeinproduction2026',
  jwtExpiresIn: '24h',
};