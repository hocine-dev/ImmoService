
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
    .regex(/^(0|[1-9]\d*)(\.\d+)?$/)
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



// Dérive le type TypeScript directement du schéma afin que le code métier
// reste synchronisé avec les données réellement validées.
export type AnnonceQuery = z.infer<typeof annonceQuerySchema>;

export type AnnonceIdParams = z.infer<typeof annonceIdSchema>;
