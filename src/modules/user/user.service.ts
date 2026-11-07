import * as argon2 from 'argon2';
import type { PrismaClient } from '../../generated/prisma/client.js';

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

export function createUserService(prisma: PrismaClient) {
  return {
    // GET : Récupérer tous les utilisateurs
    async getAllUsers(role: Role, page: number, limit: number) {
      if (role !== Role.ADMIN) return null;

      const [total, users] = await Promise.all([
        prisma.user.count(),
        prisma.user.findMany({
          skip: (page - 1) * limit,
          take: limit,
          orderBy: { id: "asc" },
          select: {
            id: true, name: true, email: true,
            role: true, createdAt: true
          }
        })
      ]);

      return {
        data: users,
        pagination: {
          page, limit, total,
          pages: Math.ceil(total / limit)
        }
      };
    },


    // GET : Récupérer un utilisateur par son ID
    async getUserById(
      id: string,
      currentUserId: string,
      currentUserRole: Role,
      page = 1,
      limit = 10
    ) {
      if (currentUserRole !== Role.ADMIN && currentUserId !== id) {
        return { error: "FORBIDDEN" as const };
      }

      const user = await prisma.user.findUnique({
        where: { id },
        include: {
          annonces: {
            skip: (page - 1) * limit,
            take: limit,
          },
          favoris: {
            skip: (page - 1) * limit,
            take: limit,
          },
          _count: {
            select: {
              annonces: true,
              favoris: true
            }
          }
        }
      });

      if (!user) {
        return { error: "NOT_FOUND" as const };
      }

      const { passwordHash, _count, ...profile } = user;

      return {
        ...profile,
        pagination: {
          annonces: {
            page, limit,
            total: _count.annonces,
            pages: Math.ceil(_count.annonces / limit)
          },
          favoris: {
            page, limit,
            total: _count.favoris,
            pages: Math.ceil(_count.favoris / limit)
          }
        }
      };
    },

    // CREATE : Créer un utilisateur (Inscription)
    async createUser(data: DataType) {
      const existingUser = await prisma.user.findUnique({
        where: { email: data.email },
      });

      if (existingUser) {
        // L'email existe déjà : le Controller retournera HTTP 409.
        return {
          error: "CONFLICT" as const,
          details: {
            email: ["Cet email est déjà associé à un autre compte."]
          }
        };
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
        return { error: "FORBIDDEN" as const };
      }

      // Vérifier l'existence de l'utilisateur ciblé
      const user = await this.getUserById(
        targetId,
        currentUserId,
        currentUserRole
      );

      // Ne pas poursuivre si le profil est inaccessible ou inexistant.
      if ("error" in user) {
        return user;
      }

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
        return { error: "FORBIDDEN" as const };
      }

      // Vérifier l'existence
      const user = await this.getUserById(
        targetId,
        currentUserId,
        currentUserRole
      );

      // Ne pas poursuivre si le profil est inaccessible ou inexistant.
      if ("error" in user) {
        return user;
      }

      /**
    * Sécurité :
    * Ne jamais exposer passwordHash dans les réponses API.
    * On conserve les autres informations retournées
    * pour ne pas modifier le contrat existant.
    */
      const deletedUser = await prisma.user.delete({
        where: { id: targetId },
      });

      const { passwordHash: _, ...userWithoutPassword } = deletedUser;

      return userWithoutPassword;
    },
  };
}