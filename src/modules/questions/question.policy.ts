
import type { Role } from "../user/user.service.js";

type Utilisateur = {
    id: string;
    role: Role;
};

type Annonce = {
    auteurId: string;
    statut: string;
};

/**
 * Vérifie qui peut consulter les questions.
 *
 * Annonce publiée : accès public.
 * Brouillon : uniquement ADMIN ou AGENT propriétaire.
 */
export function canViewQuestions(
    annonce: Annonce,
    user?: Utilisateur
): boolean {
    if (annonce.statut === "PUBLIE") {
        return true;
    }

    if (annonce.statut !== "BROUILLON" || !user) {
        return false;
    }

    return user.role === "ADMIN" ||
        (user.role === "AGENT" && user.id === annonce.auteurId);
}

/**
 * Seul un utilisateur authentifié peut poser
 * une question sur une annonce publiée.
 */
export function canAskQuestion(
    annonce: Annonce,
    user?: Utilisateur
): boolean {
    return annonce.statut === "PUBLIE" && !!user;
}

/**
 * Seuls l'ADMIN et l'AGENT propriétaire
 * peuvent répondre aux questions d'une annonce.
 */
export function canAnswerQuestion(
    annonce: Annonce,
    user?: Utilisateur
): boolean {
    if (!user) {
        return false;
    }

    return user.role === "ADMIN" ||
        (user.role === "AGENT" && user.id === annonce.auteurId);
}
