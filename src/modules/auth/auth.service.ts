import * as argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { LoginInput } from './auth.schema.js';
import { AppError, prisma } from '../user/user.service.js';

export const authService = {
  async login(data: LoginInput) {
    // 1. On cherche l'utilisateur par son email
    const user = await prisma.user.findUnique({
      where: { email: data.body.email },
    });

    if (!user) {
      throw new AppError( "INVALID_CREDENTIALS", "Email ou mot de passe incorrect.");
    }
    console.log(user.passwordHash)
    // 2. Vérifier le mot de passe avec Argon2
    const isPasswordValid = await argon2.verify(user.passwordHash, data.body.password);

    if (!isPasswordValid) {
      throw new AppError( "INVALID_CREDENTIALS", "Email ou mot de passe incorrect.");
    }

    // 3. Générer le Token JWT (expire en 1 jour par exemple)
    const jwtSecret = process.env.JWT_SECRET || 'fallback_secret';
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