import { Router } from 'express';
import { AuthController } from './auth.controller';
import { validate } from '../../middleware/validate.middleware';
import { loginSchema, registerSchema, updateProfileSchema } from './auth.validation';
import { authenticateJWT } from '../../middleware/auth.middleware';

const router = Router();
const controller = new AuthController();

router.post('/register', validate(registerSchema), controller.register);
router.post('/login', validate(loginSchema), controller.login);
router.get('/me', authenticateJWT, controller.me);
router.put('/me', authenticateJWT, validate(updateProfileSchema), controller.updateMe);

export default router;
