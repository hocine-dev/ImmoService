
import { z } from "zod";

const MAX_LIMIT = 100;
// Garantit que (page - 1) * limit reste un entier sûr pour toute limite autorisée.
const MAX_PAGE = Math.floor(Number.MAX_SAFE_INTEGER / MAX_LIMIT) + 1;

// Les paramètres de requête arrivent toujours sous forme de chaînes de
// caractères. Ce schéma vérifie donc le format, convertit la valeur en nombre
// et s'assure qu'elle reste dans la plage sûre des entiers JavaScript.
const positiveInteger = z
  .string()
  .regex(/^[1-9]\d*$/, "Entier positif attendu")
  .transform(Number)
  .pipe(
    z.number()
      .int()
      .min(1)
      .max(Number.MAX_SAFE_INTEGER)
  );

// Valide les filtres et la pagination de GET /annonces avant leur utilisation
// par la couche métier. Les valeurs par défaut permettent à l'appelant de ne
// fournir aucun paramètre tout en obtenant une pagination prévisible.
export const annonceQuerySchema = z.object({
  page: positiveInteger
    .pipe(z.number().max(MAX_PAGE, "Numéro de page trop élevé"))
    .optional()
    // La première page est utilisée lorsqu'aucun numéro de page n'est fourni.
    .transform(value => value ?? 1),

  limit: positiveInteger
    // Une page ne peut pas contenir plus de 100 annonces afin de limiter le
    // volume de données retourné par une seule requête.
    .pipe(z.number().max(MAX_LIMIT))
    .optional()
    // Dix annonces par page constituent la taille utilisée par défaut.
    .transform(value => value ?? 10),

  // Les filtres textuels sont nettoyés avant comparaison et ne peuvent pas
  // être vides ni dépasser une taille raisonnable.
  ville: z.string()
    .trim()
    .min(1)
    .max(100)
    .optional(),

  type: z.enum(["VENTE", "LOCATION"]).optional(),

  // Le prix est reçu comme une chaîne, puis converti en nombre après avoir
  // refusé les formats ambigus (signe, notation scientifique ou valeur vide).
  prixMax: z.string()
    .regex(/^(0|[1-9]\d*)(\.\d{1,2})?$/)
    .transform(Number)
    .pipe(
      z.number()
        .finite()
        .nonnegative()
        .max(Number.MAX_SAFE_INTEGER)
    )
    .optional()
}).strict();


/**
 * Valide l'identifiant transmis dans l'URL.
 * Exemple : GET /annonces/demo-immo-annonce-12
 */
export const annonceIdSchema = z.object({
  id: z.string()
    .trim()
    .min(1, "Identifiant obligatoire")
    .max(100, "Identifiant trop long")
}).strict();



/**
 * Validation des données reçues lors de la création d'une annonce.
 * POST /annonces
 */
export const createAnnonceSchema = z.object({
  titre: z.string().trim().min(1),
  description: z.string().trim().min(1),

  type: z.enum(["VENTE", "LOCATION"]),

  typePropriete: z.enum([
    "APPARTEMENT",
    "MAISON",
    "VILLA",
    "STUDIO",
    "LOFT"
  ]),

  // Prix positif, avec 2 décimales maximum.
  // Une chaîne évite les imprécisions des nombres flottants.
  prix: z.string()
    .regex(
      /^(0|[1-9]\d{0,9})(\.\d{1,2})?$/,
      "Prix invalide (2 décimales maximum)"
    )
    .refine(prix => Number(prix) > 0, "Le prix doit être positif"),

  ville: z.string().trim().min(1).max(100),

  surface: z.number().int().min(9).max(2000),
  chambres: z.number().int().min(0).max(20),

  // Champs facultatifs avec valeurs par défaut dans Prisma.
  etat: z.enum(["DISPONIBLE", "LOUE", "VENDU"]).optional(),
  dateDisponibilite: z.string().datetime({ offset: true }).optional()

}).strict();


/**
 * Validation des données de modification d'une annonce.
 * PATCH /annonces/:id
 *
 * .partial() rend tous les champs facultatifs :
 * le client peut modifier uniquement le prix, par exemple.
 *
 * On réutilise les mêmes règles métier que pour POST :
 * surface, chambres, prix, types de propriétés, etc.
 */
export const updateAnnonceSchema = createAnnonceSchema
  .partial()
  .refine(
    data => Object.keys(data).length > 0,
    { message: "Au moins un champ doit être fourni" }
  );



/**
 * Schémas de validation des requêtes HTTP du module annonces.
 *
 * Le middleware commun attend un objet contenant :
 * - query  : paramètres de recherche ;
 * - params : paramètres présents dans l'URL ;
 * - body   : données JSON envoyées par le client.
 */

// GET /annonces
export const listAnnoncesRequestSchema = z.object({
  query: annonceQuerySchema
});

// GET /annonces/:id
export const detailAnnonceRequestSchema = z.object({
  params: annonceIdSchema
});

// POST /annonces
export const createAnnonceRequestSchema = z.object({
  body: createAnnonceSchema
});

// PATCH /annonces/:id
// L'identifiant et le corps sont validés ensemble.
export const updateAnnonceRequestSchema = z.object({
  params: annonceIdSchema,
  body: updateAnnonceSchema
});


/**
 * Validation du changement de statut d'une annonce.
 *
 * PATCH /annonces/:id/statut
 *
 * PUBLIE   : rend l'annonce visible publiquement.
 * BROUILLON : retire l'annonce de la liste publique.
 *
 * Aucun autre champ n'est accepté.
 */
export const changeStatutAnnonceRequestSchema = z.object({
  params: annonceIdSchema,

  body: z.object({
    statut: z.enum(["BROUILLON", "PUBLIE"])
  }).strict()
});


/**
 * Paramètres de GET /annonces/miennes.
 *
 * Réutilise les filtres de GET /annonces :
 * - page
 * - limit
 * - ville
 * - type
 * - prixMax
 *
 * Ajoute le filtre statut pour consulter
 * les brouillons ou les annonces publiées.
 */
export const mesAnnoncesQuerySchema = annonceQuerySchema.extend({
  statut: z.enum(["BROUILLON", "PUBLIE"]).optional()
});

/**
 * Validation complète de la requête HTTP.
 * Compatible avec le middleware commun validate().
 */
export const mesAnnoncesRequestSchema = z.object({
  query: mesAnnoncesQuerySchema
});

// Dérive le type TypeScript directement du schéma afin que le code métier
// reste synchronisé avec les données réellement validées.
export type AnnonceQuery = z.infer<typeof annonceQuerySchema>;

export type AnnonceIdParams = z.infer<typeof annonceIdSchema>;

export type CreateAnnonceInput = z.infer<typeof createAnnonceSchema>;

export type UpdateAnnonceInput = z.infer<typeof updateAnnonceSchema>;

export type ChangeStatutAnnonceRequest = z.infer<typeof changeStatutAnnonceRequestSchema>;

export type MesAnnoncesQuery = z.infer<typeof mesAnnoncesQuerySchema>;