import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { storage } from '../storage';
import { User } from '@shared/schema';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '3d'; // Default to 3 days, configurable via environment

// Rate limiting for login attempts (in-memory for now)
const loginAttempts = new Map<string, { attempts: number; lockUntil?: number }>();
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_TIME = 15 * 60 * 1000; // 15 minutes

export class AuthService {
  async hashPassword(password: string): Promise<string> {
    const saltRounds = 12;
    return bcrypt.hash(password, saltRounds);
  }

  async comparePassword(password: string, hashedPassword: string): Promise<boolean> {
    return bcrypt.compare(password, hashedPassword);
  }

  generateJWT(payload: any, expiresIn?: string): string {
    return jwt.sign(payload, JWT_SECRET as string, { expiresIn: expiresIn || JWT_EXPIRES_IN });
  }

  verifyJWT(token: string): any {
    try {
      return jwt.verify(token, JWT_SECRET);
    } catch (error) {
      return null;
    }
  }

  async createSession(userId: string, expiresIn?: string): Promise<string> {
    const token = this.generateJWT({ userId }, expiresIn);
    const expiresAt = new Date();
    
    // Parse expiration time (default to 3 days)
    const expiration = expiresIn || JWT_EXPIRES_IN;
    if (expiration.endsWith('d')) {
      expiresAt.setDate(expiresAt.getDate() + parseInt(expiration));
    } else if (expiration.endsWith('h')) {
      expiresAt.setHours(expiresAt.getHours() + parseInt(expiration));
    } else {
      expiresAt.setDate(expiresAt.getDate() + 3); // Default fallback
    }

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

  async authenticateUser(identifier: string, password: string): Promise<{ user: User | null; error?: string }> {
    // Check if identifier is locked due to too many failed attempts
    const attemptRecord = loginAttempts.get(identifier);
    if (attemptRecord?.lockUntil && Date.now() < attemptRecord.lockUntil) {
      const lockTimeRemaining = Math.ceil((attemptRecord.lockUntil - Date.now()) / 60000);
      return { user: null, error: `Too many failed attempts. Try again in ${lockTimeRemaining} minutes.` };
    }

    // Try to find user by email or phone
    let user: User | null = null;
    
    try {
      // Check if identifier is email format
      if (identifier.includes('@')) {
        const foundUser = await storage.getUserByEmail(identifier);
        user = foundUser || null;
      } else {
        const foundUser = await storage.getUserByPhone(identifier);
        user = foundUser || null;
      }
    } catch (error) {
      console.error('Error finding user:', error);
      return { user: null, error: 'Authentication service temporarily unavailable' };
    }

    if (!user) {
      this.recordFailedAttempt(identifier);
      return { user: null, error: 'Invalid credentials' };
    }

    const isValidPassword = await this.comparePassword(password, user.password);
    if (!isValidPassword) {
      this.recordFailedAttempt(identifier);
      return { user: null, error: 'Invalid credentials' };
    }

    // Clear failed attempts on successful login
    loginAttempts.delete(identifier);
    return { user };
  }

  private recordFailedAttempt(identifier: string): void {
    const current = loginAttempts.get(identifier) || { attempts: 0 };
    current.attempts += 1;

    if (current.attempts >= MAX_LOGIN_ATTEMPTS) {
      current.lockUntil = Date.now() + LOCK_TIME;
    }

    loginAttempts.set(identifier, current);
  }

  async loginUser(identifier: string, password: string): Promise<{
    success: boolean;
    token?: string;
    user?: {
      id: string;
      firstName: string;
      lastName: string;
      email?: string;
      phone: string;
      userType: string;
      isVerified: boolean;
    };
    error?: string;
  }> {
    const authResult = await this.authenticateUser(identifier, password);
    
    if (!authResult.user) {
      return { success: false, error: authResult.error || 'Authentication failed' };
    }

    const user = authResult.user;
    
    if (!user.isVerified) {
      return { 
        success: false, 
        error: 'Account not verified. Please verify your phone number.',
        user: {
          id: user.id,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email || undefined,
          phone: user.phone,
          userType: user.userType,
          isVerified: user.isVerified || false
        }
      };
    }

    const token = await this.createSession(user.id);
    
    return {
      success: true,
      token,
      user: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email || undefined,
        phone: user.phone,
        userType: user.userType,
        isVerified: user.isVerified || false
      }
    };
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
