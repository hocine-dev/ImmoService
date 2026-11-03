
/**
 * Codes d'erreur communs à toute l'API ImmoService.
 */
export type ApiErrorCode =
    | "VALIDATION_ERROR"
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "NOT_FOUND"
    | "CONFLICT"
    | "RATE_LIMIT_EXCEEDED"
    | "INTERNAL_ERROR"
    | "NOT_IMPLEMENTED";

/**
 * Erreurs de validation regroupées par champ.
 */
export type ErrorDetails = Record<string, string[]>;

/**
 * Format unique des réponses d'erreur.
 */
export interface ApiErrorResponse {
    error: {
        code: ApiErrorCode;
        message: string;
        details: ErrorDetails;
    };
}

/**
 * Construit une réponse d'erreur standardisée.
 */
export function apiError(
    code: ApiErrorCode,
    message: string,
    details: ErrorDetails = {}
): ApiErrorResponse {
    return {
        error: {
            code,
            message,
            details
        }
    };
}
