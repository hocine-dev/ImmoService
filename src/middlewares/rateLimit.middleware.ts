import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { apiError } from '../shared/api-error.js';

const disabled = () =>
    process.env.RATE_LIMIT_DISABLED === "true" &&
    process.env.NODE_ENV !== "production";
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
  skip: disabled,
});

// Limite stricte pour login (anti brute-force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 14, // La 15e tentative échouée retourne 429.
  skip: disabled,
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
  skip: disabled,
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
  skip: disabled,
});

// Questions : limiter les créations répétées.
const questionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: disabled,
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
