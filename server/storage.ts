import { 
  users, 
  otpCodes, 
  httpLogs, 
  errorLogs, 
  sessions,
  type User, 
  type InsertUser,
  type InsertFarmer,
  type InsertBuyer,
  type OtpCode,
  type InsertOtpCode,
  type HttpLog,
  type InsertHttpLog,
  type ErrorLog,
  type InsertErrorLog,
  type Session,
  type InsertSession
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, count, gte, lt } from "drizzle-orm";
import bcrypt from "bcryptjs";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPhone(phone: string): Promise<User | undefined>;
  getUserByIdentifier(identifier: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createFarmer(farmer: InsertFarmer): Promise<User>;
  createBuyer(buyer: InsertBuyer): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  
  // OTP methods
  createOtpCode(otp: InsertOtpCode): Promise<OtpCode>;
  getValidOtpCode(userId: string, code: string, type: string): Promise<OtpCode | undefined>;
  markOtpAsUsed(id: string): Promise<void>;
  cleanupExpiredOtps(): Promise<void>;
  
  // Session methods
  createSession(session: InsertSession): Promise<Session>;
  getSessionByToken(token: string): Promise<Session | undefined>;
  deleteSession(token: string): Promise<void>;
  deleteUserSessions(userId: string): Promise<void>;
  
  // Logging methods
  createHttpLog(log: InsertHttpLog): Promise<HttpLog>;
  createErrorLog(log: InsertErrorLog): Promise<ErrorLog>;
  getHttpLogs(limit?: number, offset?: number): Promise<HttpLog[]>;
  getErrorLogs(limit?: number, offset?: number): Promise<ErrorLog[]>;
  
  // Dashboard stats
  getDashboardStats(): Promise<{
    totalUsers: number;
    activeSessions: number;
    otpSentToday: number;
    apiErrorsToday: number;
  }>;
  
  getRecentActivity(limit?: number): Promise<HttpLog[]>;
  
  // Health check
  testConnection(): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }


  async getUserByEmail(email: string): Promise<User | undefined> {
    if (!email) return undefined;
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByPhone(phone: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.phone, phone));
    return user || undefined;
  }

  async getUserByIdentifier(identifier: string): Promise<User | undefined> {
    // Check if identifier is email or phone
    const isEmail = identifier.includes('@');
    
    if (isEmail) {
      return this.getUserByEmail(identifier);
    } else {
      return this.getUserByPhone(identifier);
    }
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, 12);
    const [user] = await db
      .insert(users)
      .values({ ...insertUser, password: hashedPassword })
      .returning();
    return user;
  }

  async createFarmer(insertFarmer: InsertFarmer): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertFarmer.password, 12);
    const [user] = await db
      .insert(users)
      .values({ ...insertFarmer, password: hashedPassword })
      .returning();
    return user;
  }

  async createBuyer(insertBuyer: InsertBuyer): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertBuyer.password, 12);
    const [user] = await db
      .insert(users)
      .values({ ...insertBuyer, password: hashedPassword })
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async createOtpCode(otp: InsertOtpCode): Promise<OtpCode> {
    const [otpCode] = await db
      .insert(otpCodes)
      .values(otp)
      .returning();
    return otpCode;
  }

  async getValidOtpCode(userId: string, code: string, type: string): Promise<OtpCode | undefined> {
    const [otpCode] = await db
      .select()
      .from(otpCodes)
      .where(
        and(
          eq(otpCodes.userId, userId),
          eq(otpCodes.code, code),
          eq(otpCodes.type, type),
          eq(otpCodes.isUsed, false),
          gte(otpCodes.expiresAt, new Date())
        )
      );
    return otpCode || undefined;
  }

  async markOtpAsUsed(id: string): Promise<void> {
    await db
      .update(otpCodes)
      .set({ isUsed: true })
      .where(eq(otpCodes.id, id));
  }

  async cleanupExpiredOtps(): Promise<void> {
    const now = new Date();
    await db
      .delete(otpCodes)
      .where(lt(otpCodes.expiresAt, now));
  }

  async createSession(session: InsertSession): Promise<Session> {
    const [newSession] = await db
      .insert(sessions)
      .values(session)
      .returning();
    return newSession;
  }

  async getSessionByToken(token: string): Promise<Session | undefined> {
    const [session] = await db
      .select()
      .from(sessions)
      .where(and(
        eq(sessions.token, token),
        gte(sessions.expiresAt, new Date())
      ));
    return session || undefined;
  }

  async deleteSession(token: string): Promise<void> {
    await db
      .delete(sessions)
      .where(eq(sessions.token, token));
  }

  async deleteUserSessions(userId: string): Promise<void> {
    await db
      .delete(sessions)
      .where(eq(sessions.userId, userId));
  }

  async createHttpLog(log: InsertHttpLog): Promise<HttpLog> {
    const [httpLog] = await db
      .insert(httpLogs)
      .values(log)
      .returning();
    return httpLog;
  }

  async createErrorLog(log: InsertErrorLog): Promise<ErrorLog> {
    const [errorLog] = await db
      .insert(errorLogs)
      .values(log)
      .returning();
    return errorLog;
  }

  async getHttpLogs(limit = 50, offset = 0): Promise<HttpLog[]> {
    return await db
      .select()
      .from(httpLogs)
      .orderBy(desc(httpLogs.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getErrorLogs(limit = 50, offset = 0): Promise<ErrorLog[]> {
    return await db
      .select()
      .from(errorLogs)
      .orderBy(desc(errorLogs.createdAt))
      .limit(limit)
      .offset(offset);
  }

  async getDashboardStats(): Promise<{
    totalUsers: number;
    activeSessions: number;
    otpSentToday: number;
    apiErrorsToday: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalUsersResult] = await db.select({ count: count() }).from(users);
    const [activeSessionsResult] = await db
      .select({ count: count() })
      .from(sessions)
      .where(gte(sessions.expiresAt, new Date()));
    
    const [otpSentTodayResult] = await db
      .select({ count: count() })
      .from(otpCodes)
      .where(gte(otpCodes.createdAt, today));
    
    const [apiErrorsTodayResult] = await db
      .select({ count: count() })
      .from(errorLogs)
      .where(gte(errorLogs.createdAt, today));

    return {
      totalUsers: totalUsersResult.count,
      activeSessions: activeSessionsResult.count,
      otpSentToday: otpSentTodayResult.count,
      apiErrorsToday: apiErrorsTodayResult.count,
    };
  }

  async getRecentActivity(limit = 10): Promise<HttpLog[]> {
    return await db
      .select()
      .from(httpLogs)
      .orderBy(desc(httpLogs.createdAt))
      .limit(limit);
  }

  async testConnection(): Promise<boolean> {
    try {
      // Simple query to test database connectivity
      await db.select().from(users).limit(1);
      return true;
    } catch (error) {
      console.error('Database connection test failed:', error);
      return false;
    }
  }
}

export const storage = new DatabaseStorage();
