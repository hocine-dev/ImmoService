import { createAnnonceSchema } from "../../../src/modules/annonces/annonce.schema.js";

import { describe, it, expect } from "vitest";

import {
    annonceQuerySchema,
    annonceIdSchema
} from "../../../src/modules/annonces/annonce.schema.js";

describe("GET /annonces - Validation des paramètres", () => {

    /**
     * Vérifie que l'API utilise page=1 et limit=10
     * lorsque l'utilisateur ne fournit aucun paramètre.
     * Cela permet d'appeler GET /annonces directement.
     */
    it("utilise les valeurs par défaut", () => {
        const result = annonceQuerySchema.safeParse({});

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data.page).toBe(1);
            expect(result.data.limit).toBe(10);
        }
    });

    /**
     * Vérifie que les paramètres valides sont acceptés
     * et que les nombres reçus sous forme de chaînes
     * sont correctement convertis en nombres.
     */
    it("accepte des paramètres valides", () => {
        const result = annonceQuerySchema.safeParse({
            page: "2",
            limit: "20",
            ville: "Paris",
            type: "VENTE",
            prixMax: "200000"
        });

        expect(result.success).toBe(true);

        if (result.success) {
            expect(result.data.page).toBe(2);
            expect(result.data.limit).toBe(20);
            expect(result.data.prixMax).toBe(200000);
        }
    });

    /**
     * Vérifie qu'un utilisateur ne peut pas demander
     * un nombre excessif d'annonces dans une seule requête.
     * La limite maximale autorisée est de 100 annonces.
     */
    it("refuse une limite supérieure à 100", () => {
        const result = annonceQuerySchema.safeParse({
            limit: "1000000"
        });

        expect(result.success).toBe(false);
    });

    /**
     * Vérifie qu'un numéro de page négatif est refusé.
     * Les pages commencent obligatoirement à 1.
     */
    it("refuse un numéro de page invalide", () => {
        const result = annonceQuerySchema.safeParse({
            page: "-1"
        });

        expect(result.success).toBe(false);
    });

    /**
     * Vérifie que les valeurs de page extrêmement élevées
     * sont refusées avant d'atteindre PostgreSQL.
     * Cela évite les calculs de pagination excessifs.
     */
    it("refuse un numéro de page extrêmement grand", () => {
        const result = annonceQuerySchema.safeParse({
            page: "9007199254740991",
            limit: "100"
        });

        expect(result.success).toBe(false);
    });

    /**
     * Vérifie que le filtre type accepte uniquement
     * les valeurs prévues par le modèle Prisma :
     * VENTE ou LOCATION.
     *
     * APPARTEMENT est un type de propriété,
     * et non un type de transaction.
     */
    it("refuse un type de transaction inconnu", () => {
        const result = annonceQuerySchema.safeParse({
            type: "APPARTEMENT"
        });

        expect(result.success).toBe(false);
    });
});


describe("GET /annonces/:id - Validation de l'identifiant", () => {

        /**
         * Vérifie que Zod accepte un identifiant valide.
         * Les identifiants du projet ne sont pas obligatoirement des UUID.
         */
        it("accepte un identifiant valide", () => {
            const result = annonceIdSchema.safeParse({
                id: "demo-immo-annonce-12"
            });

            expect(result.success).toBe(true);
        });

        /**
         * Vérifie qu'un identifiant composé uniquement
         * d'espaces est refusé.
         */
        it("refuse un identifiant vide", () => {
            const result = annonceIdSchema.safeParse({
                id: "   "
            });

            expect(result.success).toBe(false);
        });

        /**
         * Vérifie que les espaces inutiles autour
         * de l'identifiant sont supprimés.
         */
        it("supprime les espaces autour de l'identifiant", () => {
            const result = annonceIdSchema.safeParse({
                id: "  demo-immo-annonce-12  "
            });

            expect(result.success).toBe(true);

            if (result.success) {
                expect(result.data.id).toBe("demo-immo-annonce-12");
            }
        });

});


/**
 * Données minimales représentant une annonce conforme au contrat de création.
 * Les tests suivants réutilisent cette base pour ne modifier qu'un champ à la fois.
 */
const postAnnonceValide = {
  titre: "Appartement T3",
  description: "Appartement avec balcon",
  type: "VENTE",
  typePropriete: "APPARTEMENT",
  prix: "185000.00",
  ville: "Le Havre",
  surface: 75,
  chambres: 2,
} as const;

describe("POST /annonces - validation", () => {
  /**
   * Vérifie que le schéma accepte une annonce complète
   * lorsque tous les champs respectent les règles métier.
   */
  it("accepte une annonce valide", () => {
    expect(createAnnonceSchema.safeParse(postAnnonceValide).success).toBe(true);
  });

  /**
   * Vérifie les bornes métier appliquées à la surface et au nombre de chambres.
   * Chaque variation doit être rejetée sans invalider les autres champs du test.
   */
  it("refuse les valeurs métier incohérentes", () => {
    for (const changement of [
      { surface: 8 },
      { surface: 2001 },
      { chambres: 21 },
    ]) {
      expect(createAnnonceSchema.safeParse({
        ...postAnnonceValide,
        ...changement
      }).success).toBe(false);
    }
  });

  /**
   * Vérifie qu'un prix négatif est refusé et que les champs gérés par le serveur
   * ne peuvent pas être imposés par le client lors de la création.
   */
  it("refuse un prix invalide et les champs protégés", () => {
    expect(createAnnonceSchema.safeParse({
      ...postAnnonceValide,
      prix: "-100"
    }).success).toBe(false);

    expect(createAnnonceSchema.safeParse({
      ...postAnnonceValide,
      auteurId: "autre-agent",
      statut: "PUBLIE"
    }).success).toBe(false);
  });
});
