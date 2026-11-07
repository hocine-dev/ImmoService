import * as argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { LoginInput } from './auth.schema.js';
import type { PrismaClient } from "../../generated/prisma/client.js";

export function createAuthService(prisma: PrismaClient) {
  return {
  async login(data: LoginInput) {
    // 1. On cherche l'utilisateur par son email
    const user = await prisma.user.findUnique({
      where: { email: data.body.email },
    });


    /**
 * Gestion des identifiants invalides :
 * Le Service retourne null si l'email ou le mot de passe
 * est incorrect. Le Controller sera responsable de
 * renvoyer HTTP 401 avec le format apiError() commun.
 * On conserve le même message pour les deux cas afin
 * de ne pas révéler si un email existe dans la base !.
 */

    if (!user) {
      return null
    }
    /**
 * Sécurité des identifiants :
 * Les empreintes des mots de passe ne doivent jamais être
 * affichées dans les logs, même si elles sont hachées.
 */
    // 2. Vérifier le mot de passe avec Argon2
    const isPasswordValid = await argon2.verify(user.passwordHash, data.body.password);

    if (!isPasswordValid) {
      return null
    }

    /**
 * Sécurité JWT :
 * Le token doit être signé uniquement avec le secret défini
 * dans les variables d'environnement.
 * Un secret de secours connu permettrait de fabriquer
 * de faux JWT et d'usurper les rôles ADMIN ou AGENT.
 */
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret) {
      throw new Error(
        "JWT_SECRET manquant dans les variables d'environnement"
      );
    }
    const token = jwt.sign(
      { id: user.id, role: user.role },
      jwtSecret,
      { expiresIn: '1d' }
    );

    // 4. Retourner le token et les infos utilisateur (sans le mot de passe)
    const { passwordHash: _, ...userWithoutPassword } = user;

    return {
      token,
      user: userWithoutPassword,
    };
  },
  };
}
