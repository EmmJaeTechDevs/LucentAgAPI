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
  userNotificationPreferences,
  farmerCrops,
  cropOrders,
  cropNotifications,
  deliveryLocations,
  deliveryUnits,
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
  type InsertFarmerAnswer,
  type UserNotificationPreferences,
  type InsertUserNotificationPreferences,
  type FarmerCrop,
  type InsertFarmerCrop,
  type CropOrder,
  type InsertCropOrder,
  type CropNotification,
  type InsertCropNotification,
  type DeliveryLocation,
  type InsertDeliveryLocation,
  type DeliveryUnit,
  type InsertDeliveryUnit,
  type CropSearchParams
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, count, gte, lt, asc, lte, sql, or, ilike } from "drizzle-orm";
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
  
  // User notification preferences methods
  getUserNotificationPreferences(userId: string): Promise<UserNotificationPreferences | undefined>;
  createOrUpdateUserNotificationPreferences(preferences: InsertUserNotificationPreferences): Promise<UserNotificationPreferences>;

  // E-commerce: Farmer Crop methods
  createFarmerCrop(farmerId: string, crop: InsertFarmerCrop): Promise<FarmerCrop>;
  updateFarmerCrop(cropId: string, farmerId: string, updates: Partial<FarmerCrop>): Promise<FarmerCrop | undefined>;
  deleteFarmerCrop(cropId: string, farmerId: string): Promise<boolean>;
  getFarmerCrops(farmerId: string, page?: number, limit?: number): Promise<{ crops: (FarmerCrop & { plant: Plant })[]; total: number; page: number; totalPages: number }>;
  getFarmerCrop(cropId: string, farmerId?: string): Promise<(FarmerCrop & { plant: Plant }) | undefined>;
  
  // E-commerce: Order methods
  createCropOrder(buyerId: string, order: InsertCropOrder): Promise<CropOrder>;
  getFarmerOrders(farmerId: string, status?: string, page?: number, limit?: number): Promise<{ orders: (CropOrder & { crop: FarmerCrop & { plant: Plant }; buyer: User })[]; total: number; page: number; totalPages: number }>;
  getFarmerOrder(orderId: string, farmerId: string): Promise<(CropOrder & { crop: FarmerCrop & { plant: Plant }; buyer: User }) | undefined>;
  getBuyerOrders(buyerId: string, status?: string, page?: number, limit?: number): Promise<{ orders: (CropOrder & { crop: FarmerCrop & { plant: Plant }; farmer: User })[]; total: number; page: number; totalPages: number }>;
  markOrderAsDelivered(orderId: string, farmerId: string): Promise<CropOrder | undefined>;

  // E-commerce: Search and browse methods
  searchAvailableCrops(params: CropSearchParams): Promise<{ crops: (FarmerCrop & { plant: Plant; farmer: User })[]; total: number; page: number; totalPages: number }>;
  getAvailableCropsByCategory(plantCategory?: string, page?: number, limit?: number): Promise<{ crops: (FarmerCrop & { plant: Plant; farmer: User })[]; total: number; page: number; totalPages: number }>;
  getSoonToBeHarvestedCrops(plantCategory?: string, page?: number, limit?: number): Promise<{ crops: (FarmerCrop & { plant: Plant; farmer: User })[]; total: number; page: number; totalPages: number }>;

  // E-commerce: Notification methods
  createCropNotification(notification: InsertCropNotification): Promise<CropNotification>;
  notifyBuyersAboutCrop(cropId: string, farmerId: string, message: string, notificationType: string): Promise<void>;
  getBuyerNotifications(buyerId: string, page?: number, limit?: number): Promise<{ notifications: (CropNotification & { crop: FarmerCrop & { plant: Plant }; farmer: User })[]; total: number; page: number; totalPages: number }>;
  markNotificationAsRead(notificationId: string, buyerId: string): Promise<boolean>;

  // E-commerce: Delivery location methods
  createDeliveryLocation(userId: string, location: InsertDeliveryLocation): Promise<DeliveryLocation>;
  getUserDeliveryLocations(userId: string): Promise<DeliveryLocation[]>;
  updateDeliveryLocation(locationId: string, userId: string, updates: Partial<DeliveryLocation>): Promise<DeliveryLocation | undefined>;
  deleteDeliveryLocation(locationId: string, userId: string): Promise<boolean>;
  setDefaultDeliveryLocation(locationId: string, userId: string): Promise<boolean>;

  // E-commerce: Delivery unit methods
  getAllDeliveryUnits(): Promise<DeliveryUnit[]>;
  getActiveDeliveryUnits(): Promise<DeliveryUnit[]>;
  createDeliveryUnit(unit: InsertDeliveryUnit): Promise<DeliveryUnit>;
  updateDeliveryUnit(unitId: string, updates: Partial<DeliveryUnit>): Promise<DeliveryUnit | undefined>;
  deleteDeliveryUnit(unitId: string): Promise<boolean>;
  getDeliveryUnitByName(name: string): Promise<DeliveryUnit | undefined>;
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

  // User notification preferences methods
  async getUserNotificationPreferences(userId: string): Promise<UserNotificationPreferences | undefined> {
    const [preferences] = await db
      .select()
      .from(userNotificationPreferences)
      .where(eq(userNotificationPreferences.userId, userId));
    return preferences || undefined;
  }

  async createOrUpdateUserNotificationPreferences(preferences: InsertUserNotificationPreferences): Promise<UserNotificationPreferences> {
    // Check if preferences already exist for this user
    const existingPreferences = await this.getUserNotificationPreferences(preferences.userId);
    
    if (existingPreferences) {
      // Update existing preferences - only update provided fields
      const updateSet: Partial<UserNotificationPreferences> = { updatedAt: new Date() };
      if (preferences.smsEnabled !== undefined) updateSet.smsEnabled = preferences.smsEnabled;
      if (preferences.emailEnabled !== undefined) updateSet.emailEnabled = preferences.emailEnabled;
      if (preferences.whatsappEnabled !== undefined) updateSet.whatsappEnabled = preferences.whatsappEnabled;
      if (preferences.inAppEnabled !== undefined) updateSet.inAppEnabled = preferences.inAppEnabled;
      
      const [updatedPreferences] = await db
        .update(userNotificationPreferences)
        .set(updateSet)
        .where(eq(userNotificationPreferences.userId, preferences.userId))
        .returning();
      return updatedPreferences;
    } else {
      // Create new preferences with defaults for undefined values
      const createData: InsertUserNotificationPreferences = {
        userId: preferences.userId,
        smsEnabled: preferences.smsEnabled ?? true,
        emailEnabled: preferences.emailEnabled ?? true,
        whatsappEnabled: preferences.whatsappEnabled ?? false,
        inAppEnabled: preferences.inAppEnabled ?? true,
      };
      
      const [newPreferences] = await db
        .insert(userNotificationPreferences)
        .values(createData)
        .returning();
      return newPreferences;
    }
  }

  // E-commerce: Farmer Crop methods
  async createFarmerCrop(farmerId: string, crop: InsertFarmerCrop): Promise<FarmerCrop> {
    const [farmerCrop] = await db
      .insert(farmerCrops)
      .values({
        ...crop,
        farmerId,
        availableQuantity: crop.totalQuantity, // Initially all quantity is available
      })
      .returning();
    return farmerCrop;
  }

  async updateFarmerCrop(cropId: string, farmerId: string, updates: Partial<FarmerCrop>): Promise<FarmerCrop | undefined> {
    // Ensure farmer can only update their own crops
    const [farmerCrop] = await db
      .update(farmerCrops)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(farmerCrops.id, cropId), eq(farmerCrops.farmerId, farmerId)))
      .returning();
    return farmerCrop || undefined;
  }

  async deleteFarmerCrop(cropId: string, farmerId: string): Promise<boolean> {
    // Soft delete by setting isActive to false
    const result = await db
      .update(farmerCrops)
      .set({ isActive: false, updatedAt: new Date() })
      .where(and(eq(farmerCrops.id, cropId), eq(farmerCrops.farmerId, farmerId)))
      .returning();
    return result.length > 0;
  }

  async getFarmerCrops(farmerId: string, page = 1, limit = 20): Promise<{ crops: (FarmerCrop & { plant: Plant })[]; total: number; page: number; totalPages: number }> {
    const offset = (page - 1) * limit;
    
    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(farmerCrops)
      .where(and(eq(farmerCrops.farmerId, farmerId), eq(farmerCrops.isActive, true)));

    // Get crops with plants
    const crops = await db
      .select({
        crop: farmerCrops,
        plant: plants,
      })
      .from(farmerCrops)
      .innerJoin(plants, eq(farmerCrops.plantId, plants.id))
      .where(and(eq(farmerCrops.farmerId, farmerId), eq(farmerCrops.isActive, true)))
      .orderBy(desc(farmerCrops.createdAt))
      .limit(limit)
      .offset(offset);

    const total = totalResult.count;
    const totalPages = Math.ceil(total / limit);

    return {
      crops: crops.map(row => ({
        ...row.crop,
        plant: row.plant,
      })),
      total,
      page,
      totalPages,
    };
  }

  async getFarmerCrop(cropId: string, farmerId?: string): Promise<(FarmerCrop & { plant: Plant }) | undefined> {
    const conditions = [eq(farmerCrops.id, cropId), eq(farmerCrops.isActive, true)];
    if (farmerId) {
      conditions.push(eq(farmerCrops.farmerId, farmerId));
    }

    const [result] = await db
      .select({
        crop: farmerCrops,
        plant: plants,
      })
      .from(farmerCrops)
      .innerJoin(plants, eq(farmerCrops.plantId, plants.id))
      .where(and(...conditions));

    if (!result) return undefined;

    return {
      ...result.crop,
      plant: result.plant,
    };
  }

  // E-commerce: Order methods
  async createCropOrder(buyerId: string, order: InsertCropOrder): Promise<CropOrder> {
    // Get crop details for price and farmer info
    const crop = await this.getFarmerCrop(order.cropId);
    if (!crop) {
      throw new Error("Crop not found");
    }

    // Calculate pricing
    const pricePerUnit = crop.pricePerUnit;
    const subtotal = order.quantityOrdered * pricePerUnit;
    const total = subtotal + order.deliveryFee;

    const [cropOrder] = await db
      .insert(cropOrders)
      .values({
        ...order,
        buyerId,
        farmerId: crop.farmerId,
        pricePerUnit,
        subtotal,
        total,
      })
      .returning();

    // Update available quantity in crop
    await db
      .update(farmerCrops)
      .set({ 
        availableQuantity: sql`${farmerCrops.availableQuantity} - ${order.quantityOrdered}`,
        updatedAt: new Date()
      })
      .where(eq(farmerCrops.id, order.cropId));

    return cropOrder;
  }

  async getFarmerOrders(farmerId: string, status?: string, page = 1, limit = 20): Promise<{ orders: (CropOrder & { crop: FarmerCrop & { plant: Plant }; buyer: User })[]; total: number; page: number; totalPages: number }> {
    const offset = (page - 1) * limit;
    
    const conditions = [eq(cropOrders.farmerId, farmerId)];
    if (status) {
      conditions.push(eq(cropOrders.status, status));
    }

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(cropOrders)
      .where(and(...conditions));

    // Get orders with crop and buyer details
    const orders = await db
      .select({
        order: cropOrders,
        crop: farmerCrops,
        plant: plants,
        buyer: users,
      })
      .from(cropOrders)
      .innerJoin(farmerCrops, eq(cropOrders.cropId, farmerCrops.id))
      .innerJoin(plants, eq(farmerCrops.plantId, plants.id))
      .innerJoin(users, eq(cropOrders.buyerId, users.id))
      .where(and(...conditions))
      .orderBy(desc(cropOrders.createdAt))
      .limit(limit)
      .offset(offset);

    const total = totalResult.count;
    const totalPages = Math.ceil(total / limit);

    return {
      orders: orders.map(row => ({
        ...row.order,
        crop: { ...row.crop, plant: row.plant },
        buyer: row.buyer,
      })),
      total,
      page,
      totalPages,
    };
  }

  async getFarmerOrder(orderId: string, farmerId: string): Promise<(CropOrder & { crop: FarmerCrop & { plant: Plant }; buyer: User }) | undefined> {
    const [result] = await db
      .select({
        order: cropOrders,
        crop: farmerCrops,
        plant: plants,
        buyer: users,
      })
      .from(cropOrders)
      .innerJoin(farmerCrops, eq(cropOrders.cropId, farmerCrops.id))
      .innerJoin(plants, eq(farmerCrops.plantId, plants.id))
      .innerJoin(users, eq(cropOrders.buyerId, users.id))
      .where(and(eq(cropOrders.id, orderId), eq(cropOrders.farmerId, farmerId)));

    if (!result) return undefined;

    return {
      ...result.order,
      crop: { ...result.crop, plant: result.plant },
      buyer: result.buyer,
    };
  }

  async getBuyerOrders(buyerId: string, status?: string, page = 1, limit = 20): Promise<{ orders: (CropOrder & { crop: FarmerCrop & { plant: Plant }; farmer: User })[]; total: number; page: number; totalPages: number }> {
    const offset = (page - 1) * limit;
    
    const conditions = [eq(cropOrders.buyerId, buyerId)];
    if (status) {
      conditions.push(eq(cropOrders.status, status));
    }

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(cropOrders)
      .where(and(...conditions));

    // Get orders with crop and farmer details
    const orders = await db
      .select({
        order: cropOrders,
        crop: farmerCrops,
        plant: plants,
        farmer: users,
      })
      .from(cropOrders)
      .innerJoin(farmerCrops, eq(cropOrders.cropId, farmerCrops.id))
      .innerJoin(plants, eq(farmerCrops.plantId, plants.id))
      .innerJoin(users, eq(cropOrders.farmerId, users.id))
      .where(and(...conditions))
      .orderBy(desc(cropOrders.createdAt))
      .limit(limit)
      .offset(offset);

    const total = totalResult.count;
    const totalPages = Math.ceil(total / limit);

    return {
      orders: orders.map(row => ({
        ...row.order,
        crop: { ...row.crop, plant: row.plant },
        farmer: row.farmer,
      })),
      total,
      page,
      totalPages,
    };
  }

  async markOrderAsDelivered(orderId: string, farmerId: string): Promise<CropOrder | undefined> {
    const [order] = await db
      .update(cropOrders)
      .set({ 
        status: 'delivered',
        deliveredAt: new Date(),
        updatedAt: new Date()
      })
      .where(and(eq(cropOrders.id, orderId), eq(cropOrders.farmerId, farmerId)))
      .returning();
    return order || undefined;
  }

  // E-commerce: Search and browse methods
  async searchAvailableCrops(params: CropSearchParams): Promise<{ crops: (FarmerCrop & { plant: Plant; farmer: User })[]; total: number; page: number; totalPages: number }> {
    const { query, plantCategory, state, lga, minPrice, maxPrice, unit, page = 1, limit = 20 } = params;
    const offset = (page - 1) * limit;
    
    const conditions = [
      eq(farmerCrops.isActive, true),
      lte(farmerCrops.harvestDate, new Date()), // Already harvested
      sql`${farmerCrops.availableQuantity} > 0`, // Has stock
    ];

    if (query) {
      conditions.push(
        or(
          ilike(plants.name, `%${query}%`),
          ilike(farmerCrops.description, `%${query}%`)
        )!
      );
    }

    if (plantCategory) {
      conditions.push(eq(plants.id, plantCategory));
    }

    if (state) {
      conditions.push(eq(farmerCrops.state, state));
    }

    if (lga) {
      conditions.push(eq(farmerCrops.lga, lga));
    }

    if (unit) {
      conditions.push(eq(farmerCrops.unit, unit));
    }

    if (minPrice !== undefined) {
      conditions.push(gte(farmerCrops.pricePerUnit, minPrice));
    }

    if (maxPrice !== undefined) {
      conditions.push(lte(farmerCrops.pricePerUnit, maxPrice));
    }

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(farmerCrops)
      .innerJoin(plants, eq(farmerCrops.plantId, plants.id))
      .where(and(...conditions));

    // Get crops
    const crops = await db
      .select({
        crop: farmerCrops,
        plant: plants,
        farmer: users,
      })
      .from(farmerCrops)
      .innerJoin(plants, eq(farmerCrops.plantId, plants.id))
      .innerJoin(users, eq(farmerCrops.farmerId, users.id))
      .where(and(...conditions))
      .orderBy(desc(farmerCrops.createdAt))
      .limit(limit)
      .offset(offset);

    const total = totalResult.count;
    const totalPages = Math.ceil(total / limit);

    return {
      crops: crops.map(row => ({
        ...row.crop,
        plant: {
          ...row.plant,
          imageUrl: row.plant.imageUrl || ""
        },
        farmer: row.farmer,
      })),
      total,
      page,
      totalPages,
    };
  }

  async getAvailableCropsByCategory(plantCategory?: string, page = 1, limit = 20): Promise<{ crops: (FarmerCrop & { plant: Plant; farmer: User })[]; total: number; page: number; totalPages: number }> {
    return this.searchAvailableCrops({
      plantCategory,
      page,
      limit,
    });
  }

  async getSoonToBeHarvestedCrops(plantCategory?: string, page = 1, limit = 20): Promise<{ crops: (FarmerCrop & { plant: Plant; farmer: User })[]; total: number; page: number; totalPages: number }> {
    const offset = (page - 1) * limit;
    
    const conditions = [
      eq(farmerCrops.isActive, true),
      gte(farmerCrops.harvestDate, new Date()), // Not yet harvested
      sql`${farmerCrops.availableQuantity} > 0`, // Has stock
    ];

    if (plantCategory) {
      conditions.push(eq(plants.id, plantCategory));
    }

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(farmerCrops)
      .innerJoin(plants, eq(farmerCrops.plantId, plants.id))
      .where(and(...conditions));

    // Get crops
    const crops = await db
      .select({
        crop: farmerCrops,
        plant: plants,
        farmer: users,
      })
      .from(farmerCrops)
      .innerJoin(plants, eq(farmerCrops.plantId, plants.id))
      .innerJoin(users, eq(farmerCrops.farmerId, users.id))
      .where(and(...conditions))
      .orderBy(asc(farmerCrops.harvestDate)) // Sort by harvest date (earliest first)
      .limit(limit)
      .offset(offset);

    const total = totalResult.count;
    const totalPages = Math.ceil(total / limit);

    return {
      crops: crops.map(row => ({
        ...row.crop,
        plant: {
          ...row.plant,
          imageUrl: row.plant.imageUrl || ""
        },
        farmer: row.farmer,
      })),
      total,
      page,
      totalPages,
    };
  }

  // E-commerce: Notification methods
  async createCropNotification(notification: InsertCropNotification): Promise<CropNotification> {
    const [cropNotification] = await db
      .insert(cropNotifications)
      .values(notification as any)
      .returning();
    return cropNotification;
  }

  async notifyBuyersAboutCrop(cropId: string, farmerId: string, message: string, notificationType: string): Promise<void> {
    // Find all buyers who have previously ordered from this farmer or this crop
    const buyers = await db
      .selectDistinct({ buyerId: cropOrders.buyerId })
      .from(cropOrders)
      .where(or(eq(cropOrders.farmerId, farmerId), eq(cropOrders.cropId, cropId)));

    // Create notifications for all interested buyers
    const notifications = buyers.map(buyer => ({
      cropId,
      buyerId: buyer.buyerId,
      farmerId,
      message,
      notificationType,
    }));

    if (notifications.length > 0) {
      await db.insert(cropNotifications).values(notifications as any);
    }
  }

  async getBuyerNotifications(buyerId: string, page = 1, limit = 20): Promise<{ notifications: (CropNotification & { crop: FarmerCrop & { plant: Plant }; farmer: User })[]; total: number; page: number; totalPages: number }> {
    const offset = (page - 1) * limit;

    // Get total count
    const [totalResult] = await db
      .select({ count: count() })
      .from(cropNotifications)
      .where(eq(cropNotifications.buyerId, buyerId));

    // Get notifications with details
    const notifications = await db
      .select({
        notification: cropNotifications,
        crop: farmerCrops,
        plant: plants,
        farmer: users,
      })
      .from(cropNotifications)
      .innerJoin(farmerCrops, eq(cropNotifications.cropId, farmerCrops.id))
      .innerJoin(plants, eq(farmerCrops.plantId, plants.id))
      .innerJoin(users, eq(cropNotifications.farmerId, users.id))
      .where(eq(cropNotifications.buyerId, buyerId))
      .orderBy(desc(cropNotifications.createdAt))
      .limit(limit)
      .offset(offset);

    const total = totalResult.count;
    const totalPages = Math.ceil(total / limit);

    return {
      notifications: notifications.map(row => ({
        ...row.notification,
        crop: { ...row.crop, plant: row.plant },
        farmer: row.farmer,
      })),
      total,
      page,
      totalPages,
    };
  }

  async markNotificationAsRead(notificationId: string, buyerId: string): Promise<boolean> {
    const result = await db
      .update(cropNotifications)
      .set({ isRead: true })
      .where(and(eq(cropNotifications.id, notificationId), eq(cropNotifications.buyerId, buyerId)))
      .returning();
    return result.length > 0;
  }

  // E-commerce: Delivery location methods
  async createDeliveryLocation(userId: string, location: InsertDeliveryLocation): Promise<DeliveryLocation> {
    const [deliveryLocation] = await db
      .insert(deliveryLocations)
      .values({ ...location, userId })
      .returning();
    return deliveryLocation;
  }

  async getUserDeliveryLocations(userId: string): Promise<DeliveryLocation[]> {
    return await db
      .select()
      .from(deliveryLocations)
      .where(eq(deliveryLocations.userId, userId))
      .orderBy(desc(deliveryLocations.isDefault), desc(deliveryLocations.createdAt));
  }

  async updateDeliveryLocation(locationId: string, userId: string, updates: Partial<DeliveryLocation>): Promise<DeliveryLocation | undefined> {
    const [location] = await db
      .update(deliveryLocations)
      .set({ ...updates, updatedAt: new Date() })
      .where(and(eq(deliveryLocations.id, locationId), eq(deliveryLocations.userId, userId)))
      .returning();
    return location || undefined;
  }

  async deleteDeliveryLocation(locationId: string, userId: string): Promise<boolean> {
    const result = await db
      .delete(deliveryLocations)
      .where(and(eq(deliveryLocations.id, locationId), eq(deliveryLocations.userId, userId)))
      .returning();
    return result.length > 0;
  }

  async setDefaultDeliveryLocation(locationId: string, userId: string): Promise<boolean> {
    // First, unset all current defaults for this user
    await db
      .update(deliveryLocations)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(deliveryLocations.userId, userId));

    // Then set the new default
    const result = await db
      .update(deliveryLocations)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(and(eq(deliveryLocations.id, locationId), eq(deliveryLocations.userId, userId)))
      .returning();

    return result.length > 0;
  }

  // E-commerce: Delivery unit methods
  async getAllDeliveryUnits(): Promise<DeliveryUnit[]> {
    return await db
      .select()
      .from(deliveryUnits)
      .orderBy(asc(deliveryUnits.name));
  }

  async getActiveDeliveryUnits(): Promise<DeliveryUnit[]> {
    return await db
      .select()
      .from(deliveryUnits)
      .where(eq(deliveryUnits.isActive, true))
      .orderBy(asc(deliveryUnits.name));
  }

  async createDeliveryUnit(unit: InsertDeliveryUnit): Promise<DeliveryUnit> {
    const [deliveryUnit] = await db
      .insert(deliveryUnits)
      .values(unit)
      .returning();
    return deliveryUnit;
  }

  async updateDeliveryUnit(unitId: string, updates: Partial<DeliveryUnit>): Promise<DeliveryUnit | undefined> {
    const [unit] = await db
      .update(deliveryUnits)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(deliveryUnits.id, unitId))
      .returning();
    return unit || undefined;
  }

  async deleteDeliveryUnit(unitId: string): Promise<boolean> {
    const result = await db
      .delete(deliveryUnits)
      .where(eq(deliveryUnits.id, unitId))
      .returning();
    return result.length > 0;
  }

  async getDeliveryUnitByName(name: string): Promise<DeliveryUnit | undefined> {
    const [unit] = await db
      .select()
      .from(deliveryUnits)
      .where(eq(deliveryUnits.name, name));
    return unit || undefined;
  }
}

export const storage = new DatabaseStorage();
