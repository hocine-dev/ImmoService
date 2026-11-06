import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as argon2 from 'argon2';
import { PrismaClient } from '../../generated/prisma/client.js';
// Créez un pool de connexion standard
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

// Passez l'adaptateur au constructeur de PrismaClient
const adapter = new PrismaPg(pool);
export const prisma = new PrismaClient({ adapter });

export enum Role {
  USER = "USER",
  AGENT = "AGENT",
  ADMIN = "ADMIN"
}

export type DataType = {
    name: string;
    email: string;
    password: string;
    role?: Role;
}

// Classe d'erreur personnalisée pour l'API
export class AppError extends Error {
  status: number;
  code: "VALIDATION_ERROR" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "RATE_LIMIT_EXCEEDED" | "INTERNAL_ERROR" | "NOT_IMPLEMENTED" | "INVALID_CREDENTIALS";
  details: Record<string, string[]>;

  constructor(
    status: number, 
    code: "VALIDATION_ERROR" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "RATE_LIMIT_EXCEEDED" | "INTERNAL_ERROR" | "NOT_IMPLEMENTED" | "INVALID_CREDENTIALS", 
    message: string, 
    details: Record<string, string[]> = {}
  ) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const userService = {
  // GET : Récupérer tous les utilisateurs
  async getAllUsers(currentUserRole:Role) {
    if (currentUserRole !== Role.ADMIN) {
      throw new AppError(403, "FORBIDDEN", "Action non autorisée sur ce profil.");
    }
    return await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });
  },

  // GET : Récupérer un utilisateur par son ID
  async getUserById(id: string,currentUserId:string,currentUserRole:Role) {
    if ( currentUserRole !== Role.ADMIN && currentUserId !== id) {
      throw new AppError(403, "FORBIDDEN", "Action non autorisée sur ce profil.");
    }
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        annonces: true,
        favoris: true,
      },
    });

    if (!user) {
      throw new AppError(404, "NOT_FOUND", "Utilisateur introuvable");
    }

    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  },

  // CREATE : Créer un utilisateur (Inscription)
  async createUser(data: DataType) {
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email },
    });

    if (existingUser) {
      throw new AppError(409, "CONFLICT", "Cet email est déjà utilisé", {
        email: ["Cet email est déjà associé à un autre compte."]
      });
    }

    const passwordHash = await argon2.hash(data.password);

    const newUser = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash,
        role: Role.USER,
      },
    });

    const { passwordHash: _, ...userCreated } = newUser;
    return userCreated;
  },

  // UPDATE : Mettre à jour un utilisateur avec protection IDOR
  async updateUser(targetId: string, currentUserId: string, currentUserRole: Role, data: DataType) {
    // SÉCURITÉ IDOR : Seul un ADMIN ou le propriétaire du compte peut modifier ce profil
    if (currentUserRole !== Role.ADMIN && currentUserId !== targetId) {
      throw new AppError(403, "FORBIDDEN", "Action non autorisée sur ce profil.");
    }

    // Vérifier l'existence de l'utilisateur ciblé
    await this.getUserById(targetId,currentUserId,currentUserRole);

    const updatedUser = await prisma.user.update({
      where: { id: targetId },
      data: {
        name: data.name,
        email: data.email,
        // Seul un ADMIN peut modifier les rôles (empêche un USER de s'auto-promouvoir ADMIN)
        role: currentUserRole === Role.ADMIN ? data.role : undefined,
      },
    });

    const { passwordHash: _, ...userUpdated } = updatedUser;
    return userUpdated;
  },

  // DELETE : Supprimer un utilisateur avec protection IDOR
  async deleteUser(targetId: string, currentUserId: string, currentUserRole: Role) {
    //  SÉCURITÉ IDOR : Seul un ADMIN ou le propriétaire peut supprimer le compte
    if (currentUserRole !== Role.ADMIN && currentUserId !== targetId) {
      throw new AppError(403, "FORBIDDEN", "Action non autorisée.");
    }

    // Vérifier l'existence
    await this.getUserById(targetId,currentUserId,currentUserRole);
    
    return await prisma.user.delete({
      where: { id: targetId },
    });
  },
};