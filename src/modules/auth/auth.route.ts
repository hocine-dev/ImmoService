import { Router } from 'express';
import validate from '../../middlewares/validate.middleware.js';
import { loginSchema } from './auth.schema.js';
import { authController } from './auth.controller.js';
import rateLimitMiddleware from '../../middlewares/rateLimit.middleware.js';

const routerAuth = Router();

// POST /api/auth/login
routerAuth.post(
  '/login',
  rateLimitMiddleware.authLimiter,     
  validate(loginSchema),                
  authController.login                  
);

export default routerAuth;