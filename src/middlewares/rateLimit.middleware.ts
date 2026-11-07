import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { apiError } from '../shared/api-error.js';

// Limite générale
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  /**
  * Erreur HTTP 429 au format commun ImmoService.
  * Le nombre maximal de requêtes reste inchangé.
  */
  handler: (_req, res) => {
    res.status(429).json(
      apiError(
        "RATE_LIMIT_EXCEEDED",
        "Trop de requêtes, réessayez dans 15 minutes"
      )
    );
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Limite stricte pour login (anti brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // 5 tentatives max
  /**
   * Protection contre les tentatives répétées de connexion.
   * Les erreurs utilisent le même contrat que le reste de l'API.
   */
  handler: (_req, res) => {
    res.status(429).json(
      apiError(
        "RATE_LIMIT_EXCEEDED",
        "Trop de tentatives de connexion"
      )
    );
  }, skipSuccessfulRequests: true,
});

// Ralentissement progressif
const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000,
  delayAfter: 50,
  delayMs: (hits) => hits * 50, // +50ms par requête après le seuil
});


// Inscription : compter aussi les créations réussies.
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json(
      apiError("RATE_LIMIT_EXCEEDED", "Trop de tentatives d'inscription")
    );
  },
});

// Questions : limiter les créations répétées.
const questionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json(
      apiError("RATE_LIMIT_EXCEEDED", "Trop de questions envoyées")
    );
  },
});

export default {
  generalLimiter,
  authLimiter,
  speedLimiter,
  registerLimiter,
  questionLimiter,
};
