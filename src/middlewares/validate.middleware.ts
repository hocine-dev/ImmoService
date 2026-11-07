
import type { Request, Response, NextFunction } from "express";
import type { ZodSchema } from "zod";
import { apiError } from "../shared/api-error.js";

/**
 * Validation commune des requêtes avec Zod.
 * Utilise le même format d'erreur que le module annonces
 * pour garantir un contrat HTTP unique dans ImmoService.
 */
const validate = (schema: ZodSchema) =>
  (req: Request, res: Response, next: NextFunction) => {

    if (!schema) {
      return next(new Error("Schéma de validation manquant"));
    }

    const result = schema.safeParse({
      body: req.body ?? {},
      params: req.params ?? {},
      query: req.query ?? {}
    });

    if (!result.success) {
      const details: Record<string, string[]> = {};

      for (const issue of result.error.issues) {
        const field =
          issue.path.slice(1).join(".") ||
          issue.path.join(".");

        (details[field] ??= []).push(issue.message);
      }

      return res.status(400).json(
        apiError(
          "VALIDATION_ERROR",
          "Données invalides",
          details
        )
      );
    }

    req.validated = result.data;
    next();
  };

export default validate;
