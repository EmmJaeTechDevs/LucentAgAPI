import { 
  users, 
  otpCodes, 
  httpLogs, 
  errorLogs, 
  sessions,
  passwordResetTokens,
  plants,
  plantQuestions,
  farmerPlants,
  farmerAnswers,
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
  type InsertSession,
  type PasswordResetToken,
  type InsertPasswordResetToken,
  type Plant,
  type InsertPlant,
  type PlantQuestion,
  type InsertPlantQuestion,
  type FarmerPlant,
  type InsertFarmerPlant,
  type FarmerAnswer,
  type InsertFarmerAnswer
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
  
  // Password reset methods
  createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken>;
  getValidPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenAsUsed(id: string): Promise<void>;
  cleanupExpiredPasswordResetTokens(): Promise<void>;
  updateUserPassword(userId: string, newPassword: string): Promise<User | undefined>;
  
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
  
  // Plant management methods
  getPlants(): Promise<Plant[]>;
  getPlant(id: string): Promise<Plant | undefined>;
  createPlant(plant: InsertPlant): Promise<Plant>;
  updatePlant(id: string, updates: Partial<Plant>): Promise<Plant | undefined>;
  deletePlant(id: string): Promise<void>;
  
  // Plant questions methods
  getPlantQuestions(plantId: string): Promise<PlantQuestion[]>;
  createPlantQuestion(question: InsertPlantQuestion): Promise<PlantQuestion>;
  updatePlantQuestion(id: string, updates: Partial<PlantQuestion>): Promise<PlantQuestion | undefined>;
  deletePlantQuestion(id: string): Promise<void>;
  
  // Farmer plants methods
  getFarmerPlants(farmerId: string): Promise<(FarmerPlant & { plant: Plant })[]>;
  addFarmerPlant(farmerPlant: InsertFarmerPlant): Promise<FarmerPlant>;
  removeFarmerPlant(farmerId: string, plantId: string): Promise<void>;
  updateFarmerPlant(id: string, updates: Partial<FarmerPlant>): Promise<FarmerPlant | undefined>;
  
  // Farmer answers methods
  getFarmerAnswers(farmerId: string, plantId?: string): Promise<(FarmerAnswer & { question: PlantQuestion })[]>;
  createFarmerAnswer(answer: InsertFarmerAnswer): Promise<FarmerAnswer>;
  updateFarmerAnswer(id: string, updates: Partial<FarmerAnswer>): Promise<FarmerAnswer | undefined>;
  getFarmerAnswer(farmerId: string, questionId: string): Promise<FarmerAnswer | undefined>;
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

  async createPasswordResetToken(token: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const [resetToken] = await db
      .insert(passwordResetTokens)
      .values(token)
      .returning();
    return resetToken;
  }

  async getValidPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(
        and(
          eq(passwordResetTokens.token, token),
          eq(passwordResetTokens.isUsed, false),
          gte(passwordResetTokens.expiresAt, new Date())
        )
      );
    return resetToken || undefined;
  }

  async markPasswordResetTokenAsUsed(id: string): Promise<void> {
    await db
      .update(passwordResetTokens)
      .set({ isUsed: true })
      .where(eq(passwordResetTokens.id, id));
  }

  async cleanupExpiredPasswordResetTokens(): Promise<void> {
    const now = new Date();
    await db
      .delete(passwordResetTokens)
      .where(lt(passwordResetTokens.expiresAt, now));
  }

  async updateUserPassword(userId: string, newPassword: string): Promise<User | undefined> {
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    const [user] = await db
      .update(users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user || undefined;
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

  // Plant management methods
  async getPlants(): Promise<Plant[]> {
    return await db.select().from(plants).where(eq(plants.isActive, true)).orderBy(plants.name);
  }

  async getPlant(id: string): Promise<Plant | undefined> {
    const [plant] = await db.select().from(plants).where(eq(plants.id, id));
    return plant || undefined;
  }

  async createPlant(plant: InsertPlant): Promise<Plant> {
    const [newPlant] = await db.insert(plants).values(plant).returning();
    return newPlant;
  }

  async updatePlant(id: string, updates: Partial<Plant>): Promise<Plant | undefined> {
    const [plant] = await db
      .update(plants)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(plants.id, id))
      .returning();
    return plant || undefined;
  }

  async deletePlant(id: string): Promise<void> {
    await db.update(plants).set({ isActive: false }).where(eq(plants.id, id));
  }

  // Plant questions methods
  async getPlantQuestions(plantId: string): Promise<PlantQuestion[]> {
    return await db
      .select()
      .from(plantQuestions)
      .where(eq(plantQuestions.plantId, plantId))
      .orderBy(plantQuestions.orderIndex, plantQuestions.createdAt);
  }

  async createPlantQuestion(question: InsertPlantQuestion): Promise<PlantQuestion> {
    const [newQuestion] = await db.insert(plantQuestions).values(question).returning();
    return newQuestion;
  }

  async updatePlantQuestion(id: string, updates: Partial<PlantQuestion>): Promise<PlantQuestion | undefined> {
    const [question] = await db
      .update(plantQuestions)
      .set(updates)
      .where(eq(plantQuestions.id, id))
      .returning();
    return question || undefined;
  }

  async deletePlantQuestion(id: string): Promise<void> {
    await db.delete(plantQuestions).where(eq(plantQuestions.id, id));
  }

  // Farmer plants methods
  async getFarmerPlants(farmerId: string): Promise<(FarmerPlant & { plant: Plant })[]> {
    return await db
      .select({
        id: farmerPlants.id,
        farmerId: farmerPlants.farmerId,
        plantId: farmerPlants.plantId,
        landSize: farmerPlants.landSize,
        notes: farmerPlants.notes,
        createdAt: farmerPlants.createdAt,
        plant: plants,
      })
      .from(farmerPlants)
      .innerJoin(plants, eq(farmerPlants.plantId, plants.id))
      .where(and(eq(farmerPlants.farmerId, farmerId), eq(plants.isActive, true)))
      .orderBy(farmerPlants.createdAt);
  }

  async addFarmerPlant(farmerPlant: InsertFarmerPlant): Promise<FarmerPlant> {
    const [newFarmerPlant] = await db.insert(farmerPlants).values(farmerPlant).returning();
    return newFarmerPlant;
  }

  async removeFarmerPlant(farmerId: string, plantId: string): Promise<void> {
    await db
      .delete(farmerPlants)
      .where(and(eq(farmerPlants.farmerId, farmerId), eq(farmerPlants.plantId, plantId)));
  }

  async updateFarmerPlant(id: string, updates: Partial<FarmerPlant>): Promise<FarmerPlant | undefined> {
    const [farmerPlant] = await db
      .update(farmerPlants)
      .set(updates)
      .where(eq(farmerPlants.id, id))
      .returning();
    return farmerPlant || undefined;
  }

  // Farmer answers methods
  async getFarmerAnswers(farmerId: string, plantId?: string): Promise<(FarmerAnswer & { question: PlantQuestion })[]> {
    const conditions = [eq(farmerAnswers.farmerId, farmerId)];
    if (plantId) {
      conditions.push(eq(farmerAnswers.plantId, plantId));
    }

    return await db
      .select({
        id: farmerAnswers.id,
        farmerId: farmerAnswers.farmerId,
        plantId: farmerAnswers.plantId,
        questionId: farmerAnswers.questionId,
        answer: farmerAnswers.answer,
        customAnswer: farmerAnswers.customAnswer,
        createdAt: farmerAnswers.createdAt,
        updatedAt: farmerAnswers.updatedAt,
        question: plantQuestions,
      })
      .from(farmerAnswers)
      .innerJoin(plantQuestions, eq(farmerAnswers.questionId, plantQuestions.id))
      .where(and(...conditions))
      .orderBy(plantQuestions.orderIndex, plantQuestions.createdAt);
  }

  async createFarmerAnswer(answer: InsertFarmerAnswer): Promise<FarmerAnswer> {
    // Check if answer already exists for this farmer and question
    const existingAnswer = await this.getFarmerAnswer(answer.farmerId, answer.questionId);
    
    if (existingAnswer) {
      // Update existing answer
      const [updatedAnswer] = await db
        .update(farmerAnswers)
        .set({ 
          answer: answer.answer, 
          customAnswer: answer.customAnswer,
          updatedAt: new Date()
        })
        .where(eq(farmerAnswers.id, existingAnswer.id))
        .returning();
      return updatedAnswer;
    } else {
      // Create new answer
      const [newAnswer] = await db.insert(farmerAnswers).values(answer).returning();
      return newAnswer;
    }
  }

  async updateFarmerAnswer(id: string, updates: Partial<FarmerAnswer>): Promise<FarmerAnswer | undefined> {
    const [answer] = await db
      .update(farmerAnswers)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(farmerAnswers.id, id))
      .returning();
    return answer || undefined;
  }

  async getFarmerAnswer(farmerId: string, questionId: string): Promise<FarmerAnswer | undefined> {
    const [answer] = await db
      .select()
      .from(farmerAnswers)
      .where(and(eq(farmerAnswers.farmerId, farmerId), eq(farmerAnswers.questionId, questionId)));
    return answer || undefined;
  }
}

export const storage = new DatabaseStorage();
