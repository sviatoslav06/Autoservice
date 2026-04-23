import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import authRoutes from './modules/auth/auth.routes';
import userRoutes from './modules/user/user.routes';
import vehicleRoutes from './modules/vehicle/vehicle.routes';
import boxRoutes from './modules/box/box.routes';
import serviceRoutes from './modules/service/service.routes';
import partRoutes from './modules/part/part.routes';
import partCategoryRoutes from './modules/part-category/part-category.routes';
import partFieldRoutes from './modules/part-field/part-field.routes';
import orderRoutes from './modules/order/order.routes';
import paymentRoutes from './modules/payment/payment.routes';
import analyticsRoutes from './modules/analytics/analytics.routes';
import workerRoutes from './modules/worker/worker.routes';
import dataImportRoutes from './modules/data-import/data-import.routes';
import { errorMiddleware } from './middleware/error.middleware';
import { config } from './config/env';

dotenv.config();

const app = express();
const PORT = config.port;

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ 
    message: '✅ Автосервіс Backend працює!',
    status: 'ok'
  });
});

// Підключення роутів
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/vehicles', vehicleRoutes);
app.use('/api/boxes', boxRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/parts', partRoutes);
app.use('/api/part-categories', partCategoryRoutes);
app.use('/api/part-fields', partFieldRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/workers', workerRoutes);
app.use('/api/data-import', dataImportRoutes);
app.use(errorMiddleware);

app.listen(PORT, () => {
  console.log(`🚀 Сервер запущено на http://localhost:${PORT}`);
});
