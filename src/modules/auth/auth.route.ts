import { Router } from 'express';
import validate from '../../middlewares/validate.middleware.js';
import { loginSchema } from './auth.schema.js';
import { createAuthController } from "./auth.controller.js";
import type { PrismaClient } from "../../generated/prisma/client.js";
import rateLimitMiddleware from '../../middlewares/rateLimit.middleware.js';

export function createAuthRouter(prisma: PrismaClient) {
  const routerAuth = Router();
  const authController = createAuthController(prisma);

// POST /api/auth/login
routerAuth.post(
  '/login',
  rateLimitMiddleware.authLimiter,     
  validate(loginSchema),                
  authController.login                  
);

return routerAuth;
}
