import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

// Limite générale
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { success: false, message: 'Trop de requêtes, réessayez dans 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limite stricte pour login (anti brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 tentatives max
  message: { success: false, message: 'Trop de tentatives de connexion' },
  skipSuccessfulRequests: true,
});

// Ralentissement progressif
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50,
  delayMs: (hits) => hits * 50, // +50ms par requête après le seuil
});

export default {
  generalLimiter,
  authLimiter,
  speedLimiter,
};