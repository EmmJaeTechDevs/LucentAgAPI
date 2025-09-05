import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';
import { User } from '@shared/schema';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  generateJWT(payload: any): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  }

  verifyJWT(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return null;
    }
  }

  async createSession(userId: string): Promise<string> {
    const token = this.generateJWT({ userId });
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await storage.createSession({
      userId,
      token,
      expiresAt,
    });

    return token;
  }

  async validateSession(token: string): Promise<User | null> {
    const session = await storage.getSessionByToken(token);
    if (!session) return null;

    const user = await storage.getUser(session.userId);
    return user || null;
  }

  async logout(token: string): Promise<void> {
    await storage.deleteSession(token);
  }

  async logoutAllSessions(userId: string): Promise<void> {
    await storage.deleteUserSessions(userId);
  }

  async authenticateUser(identifier: string, password: string): Promise<User | null> {
    const user = await storage.getUserByIdentifier(identifier);
    if (!user) return null;

    const isValidPassword = await this.comparePassword(password, user.password);
    if (!isValidPassword) return null;

    return user;
  }

  async registerUser(userData: {
    firstName: string;
    lastName: string;
    email?: string;
    phone: string;
    password: string;
    userType: 'farmer' | 'buyer';
  }): Promise<User> {
    const hashedPassword = await this.hashPassword(userData.password);
    
    return storage.createUser({
      ...userData,
      password: hashedPassword,
    });
  }
}

export const authService = new AuthService();
