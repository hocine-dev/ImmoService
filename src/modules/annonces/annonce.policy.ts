
/**
 * Politique d'autorisation indépendante d'Express et Prisma.
 * Elle peut être testée sans serveur ni base de données.
 */

export type AnnonceViewer = {
    id: string;
    role: string;
};

/**
 * Une annonce publiée est publique.
 * Un brouillon est visible uniquement par :
 * - son auteur, s'il est AGENT ;
 * - un administrateur.
 */
export function canReadAnnonce(
    annonce: { statut: string; auteurId: string },
    viewer?: AnnonceViewer
): boolean {
    if (annonce.statut === "PUBLIE") {
        return true;
    }

    if (annonce.statut !== "BROUILLON" || !viewer) {
        return false;
    }

    return viewer.role === "ADMIN" ||
        (viewer.role === "AGENT" &&
            viewer.id === annonce.auteurId);
}


/**
 * Politique pure pour les opérations d'écriture.
 *
 * ADMIN : peut gérer toutes les annonces.
 * AGENT : peut gérer uniquement ses annonces.
 * USER / visiteur : accès interdit.
 *
 * Retourne un filtre de propriétaire indépendant de Prisma.
 * null signifie que l'opération est interdite.
 */
export function getAnnonceWriteScope(
    user: AnnonceViewer | undefined
): { auteurId?: string } | null {

    if (!user?.id?.trim()) {
        return null;
    }

    if (user.role === "ADMIN") {
        return {};
    }

    if (user.role === "AGENT") {
        return { auteurId: user.id };
    }

    return null;
}
