import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username"), // Preserve existing column
  userType: text("user_type"), // 'farmer' or 'buyer' (optional to preserve existing data)
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone").notNull().unique(),
  email: text("email"), // Optional for farmers
  password: text("password").notNull(),
  
  // Home address fields (optional to preserve existing data)
  homeStreet: text("home_street"),
  homeHouseNumber: text("home_house_number"),
  homeAdditionalDesc: text("home_additional_desc"),
  homeBusStop: text("home_bus_stop"),
  homeLocalGov: text("home_local_gov"),
  homePostcode: text("home_postcode"),
  homeState: text("home_state"),
  homeCountry: text("home_country").default('Nigeria'),
  
  // Farm address fields (only for farmers)
  farmStreet: text("farm_street"),
  farmHouseNumber: text("farm_house_number"),
  farmAdditionalDesc: text("farm_additional_desc"),
  farmBusStop: text("farm_bus_stop"),
  farmLocalGov: text("farm_local_gov"),
  farmPostcode: text("farm_postcode"),
  farmState: text("farm_state"),
  farmCountry: text("farm_country").default('Nigeria'),
  
  isVerified: boolean("is_verified").default(false),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const otpCodes = pgTable("otp_codes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  type: text("type").notNull(), // 'sms' or 'email'
  purpose: text("purpose").notNull(), // 'verification', 'login', 'password_reset'
  expiresAt: timestamp("expires_at").notNull(),
  isUsed: boolean("is_used").default(false),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const httpLogs = pgTable("http_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  method: text("method").notNull(),
  url: text("url").notNull(),
  statusCode: integer("status_code").notNull(),
  responseTime: integer("response_time").notNull(), // in milliseconds
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  requestBody: jsonb("request_body"),
  responseBody: jsonb("response_body"),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const errorLogs = pgTable("error_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  message: text("message").notNull(),
  stack: text("stack"),
  route: text("route"),
  method: text("method"),
  statusCode: integer("status_code"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: varchar("user_id").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const sessions = pgTable("sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  isUsed: boolean("is_used").default(false),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Plant management tables
export const plants = pgTable("plants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  category: text("category"), // e.g., 'vegetables', 'fruits', 'grains', 'herbs'
  growthDuration: text("growth_duration"), // e.g., '3-4 months'
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const plantQuestions = pgTable("plant_questions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  plantId: varchar("plant_id").notNull().references(() => plants.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  questionType: text("question_type").notNull(), // 'multiple_choice', 'checkbox', 'text'
  options: jsonb("options"), // Array of option objects: [{value: 'option1', label: 'Option 1'}, {value: 'others', label: 'Others (please specify)'}]
  isRequired: boolean("is_required").default(true),
  category: text("category"), // e.g., 'processing', 'waste_management', 'cultivation'
  orderIndex: integer("order_index").default(0),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const farmerPlants = pgTable("farmer_plants", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  farmerId: varchar("farmer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  plantId: varchar("plant_id").notNull().references(() => plants.id, { onDelete: "cascade" }),
  landSize: text("land_size"), // Optional: size of land dedicated to this plant
  notes: text("notes"), // Optional: farmer's notes about growing this plant
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const farmerAnswers = pgTable("farmer_answers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  farmerId: varchar("farmer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  plantId: varchar("plant_id").notNull().references(() => plants.id, { onDelete: "cascade" }),
  questionId: varchar("question_id").notNull().references(() => plantQuestions.id, { onDelete: "cascade" }),
  answer: jsonb("answer").notNull(), // Can store string, array of strings for checkboxes, or object for complex answers
  customAnswer: text("custom_answer"), // For 'others' option or additional details
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  otpCodes: many(otpCodes),
  httpLogs: many(httpLogs),
  errorLogs: many(errorLogs),
  sessions: many(sessions),
  passwordResetTokens: many(passwordResetTokens),
  farmerPlants: many(farmerPlants),
  farmerAnswers: many(farmerAnswers),
}));

export const otpCodesRelations = relations(otpCodes, ({ one }) => ({
  user: one(users, {
    fields: [otpCodes.userId],
    references: [users.id],
  }),
}));

export const httpLogsRelations = relations(httpLogs, ({ one }) => ({
  user: one(users, {
    fields: [httpLogs.userId],
    references: [users.id],
  }),
}));

export const errorLogsRelations = relations(errorLogs, ({ one }) => ({
  user: one(users, {
    fields: [errorLogs.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const passwordResetTokensRelations = relations(passwordResetTokens, ({ one }) => ({
  user: one(users, {
    fields: [passwordResetTokens.userId],
    references: [users.id],
  }),
}));

export const plantsRelations = relations(plants, ({ many }) => ({
  questions: many(plantQuestions),
  farmerPlants: many(farmerPlants),
  farmerAnswers: many(farmerAnswers),
}));

export const plantQuestionsRelations = relations(plantQuestions, ({ one, many }) => ({
  plant: one(plants, {
    fields: [plantQuestions.plantId],
    references: [plants.id],
  }),
  farmerAnswers: many(farmerAnswers),
}));

export const farmerPlantsRelations = relations(farmerPlants, ({ one }) => ({
  farmer: one(users, {
    fields: [farmerPlants.farmerId],
    references: [users.id],
  }),
  plant: one(plants, {
    fields: [farmerPlants.plantId],
    references: [plants.id],
  }),
}));

export const farmerAnswersRelations = relations(farmerAnswers, ({ one }) => ({
  farmer: one(users, {
    fields: [farmerAnswers.farmerId],
    references: [users.id],
  }),
  plant: one(plants, {
    fields: [farmerAnswers.plantId],
    references: [plants.id],
  }),
  question: one(plantQuestions, {
    fields: [farmerAnswers.questionId],
    references: [plantQuestions.id],
  }),
}));

// Insert schemas for different user types
export const insertFarmerSchema = createInsertSchema(users).pick({
  userType: true,
  firstName: true,
  lastName: true,
  phone: true,
  email: true,
  password: true,
  homeStreet: true,
  homeHouseNumber: true,
  homeAdditionalDesc: true,
  homeBusStop: true,
  homeLocalGov: true,
  homePostcode: true,
  homeState: true,
  homeCountry: true,
  farmStreet: true,
  farmHouseNumber: true,
  farmAdditionalDesc: true,
  farmBusStop: true,
  farmLocalGov: true,
  farmPostcode: true,
  farmState: true,
  farmCountry: true,
}).extend({
  userType: z.literal('farmer'),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  email: z.union([
    z.string().email("Please enter a valid email address"),
    z.literal(""),
    z.undefined()
  ]).optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  homeStreet: z.string().min(1, "Home street is required"),
  homeHouseNumber: z.string().min(1, "Home house number is required"),
  homeBusStop: z.string().min(1, "Home bus stop is required"),
  homeLocalGov: z.string().min(1, "Home local government is required"),
  homeState: z.string().min(1, "Home state is required"),
  homeCountry: z.string().default('Nigeria'),
  farmStreet: z.string().min(1, "Farm street is required"),
  farmHouseNumber: z.string().min(1, "Farm house number is required"),
  farmBusStop: z.string().min(1, "Farm bus stop is required"),
  farmLocalGov: z.string().min(1, "Farm local government is required"),
  farmState: z.string().min(1, "Farm state is required"),
  farmCountry: z.string().default('Nigeria'),
});

export const insertBuyerSchema = createInsertSchema(users).pick({
  userType: true,
  firstName: true,
  lastName: true,
  phone: true,
  email: true,
  password: true,
  homeStreet: true,
  homeHouseNumber: true,
  homeAdditionalDesc: true,
  homeBusStop: true,
  homeLocalGov: true,
  homePostcode: true,
  homeState: true,
  homeCountry: true,
}).extend({
  userType: z.literal('buyer'),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  email: z.union([
    z.string().email("Please enter a valid email address"),
    z.literal(""),
    z.undefined()
  ]).optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  homeStreet: z.string().min(1, "Home street is required"),
  homeHouseNumber: z.string().min(1, "Home house number is required"),
  homeBusStop: z.string().min(1, "Home bus stop is required"),
  homeLocalGov: z.string().min(1, "Home local government is required"),
  homeState: z.string().min(1, "Home state is required"),
  homeCountry: z.string().default('Nigeria'),
});

// Keep the old schema for backward compatibility with existing endpoints
export const insertUserSchema = createInsertSchema(users).pick({
  firstName: true,
  lastName: true,
  email: true,
  phone: true,
  password: true,
  userType: true,
}).extend({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phone: z.string().min(10, "Valid phone number is required"),
  email: z.union([
    z.string().email("Please enter a valid email address"),
    z.literal(""),
    z.undefined()
  ]).optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  userType: z.enum(["farmer", "buyer"]).default("buyer"),
});

export const insertOtpCodeSchema = createInsertSchema(otpCodes).pick({
  userId: true,
  code: true,
  type: true,
  purpose: true,
  expiresAt: true,
});

export const insertHttpLogSchema = createInsertSchema(httpLogs).pick({
  method: true,
  url: true,
  statusCode: true,
  responseTime: true,
  ipAddress: true,
  userAgent: true,
  requestBody: true,
  responseBody: true,
  userId: true,
});

export const insertErrorLogSchema = createInsertSchema(errorLogs).pick({
  message: true,
  stack: true,
  route: true,
  method: true,
  statusCode: true,
  ipAddress: true,
  userAgent: true,
  userId: true,
});

export const insertSessionSchema = createInsertSchema(sessions).pick({
  userId: true,
  token: true,
  expiresAt: true,
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).pick({
  userId: true,
  token: true,
  expiresAt: true,
});

// Plant management insert schemas
export const insertPlantSchema = createInsertSchema(plants).pick({
  name: true,
  description: true,
  category: true,
  growthDuration: true,
  isActive: true,
}).extend({
  name: z.string().min(1, "Plant name is required"),
  description: z.string().optional(),
  category: z.string().optional(),
  growthDuration: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const insertPlantQuestionSchema = createInsertSchema(plantQuestions).pick({
  plantId: true,
  question: true,
  questionType: true,
  options: true,
  isRequired: true,
  category: true,
  orderIndex: true,
}).extend({
  plantId: z.string().min(1, "Plant ID is required"),
  question: z.string().min(1, "Question is required"),
  questionType: z.enum(["multiple_choice", "checkbox", "text"], {
    required_error: "Question type is required"
  }),
  options: z.array(z.object({
    value: z.string(),
    label: z.string(),
  })).optional(),
  isRequired: z.boolean().default(true),
  category: z.string().optional(),
  orderIndex: z.number().default(0),
});

export const insertFarmerPlantSchema = createInsertSchema(farmerPlants).pick({
  farmerId: true,
  plantId: true,
  landSize: true,
  notes: true,
}).extend({
  farmerId: z.string().min(1, "Farmer ID is required"),
  plantId: z.string().min(1, "Plant ID is required"),
  landSize: z.string().optional(),
  notes: z.string().optional(),
});

export const insertFarmerAnswerSchema = createInsertSchema(farmerAnswers).pick({
  farmerId: true,
  plantId: true,
  questionId: true,
  answer: true,
  customAnswer: true,
}).extend({
  farmerId: z.string().min(1, "Farmer ID is required"),
  plantId: z.string().min(1, "Plant ID is required"),
  questionId: z.string().min(1, "Question ID is required"),
  answer: z.union([
    z.string(),
    z.array(z.string()),
    z.record(z.any()),
  ], {
    required_error: "Answer is required"
  }),
  customAnswer: z.string().optional(),
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertFarmer = z.infer<typeof insertFarmerSchema>;
export type InsertBuyer = z.infer<typeof insertBuyerSchema>;
export type User = typeof users.$inferSelect;
export type InsertOtpCode = z.infer<typeof insertOtpCodeSchema>;
export type OtpCode = typeof otpCodes.$inferSelect;
export type InsertHttpLog = z.infer<typeof insertHttpLogSchema>;
export type HttpLog = typeof httpLogs.$inferSelect;
export type InsertErrorLog = z.infer<typeof insertErrorLogSchema>;
export type ErrorLog = typeof errorLogs.$inferSelect;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;

// Plant management types
export type InsertPlant = z.infer<typeof insertPlantSchema>;
export type Plant = typeof plants.$inferSelect;
export type InsertPlantQuestion = z.infer<typeof insertPlantQuestionSchema>;
export type PlantQuestion = typeof plantQuestions.$inferSelect;
export type InsertFarmerPlant = z.infer<typeof insertFarmerPlantSchema>;
export type FarmerPlant = typeof farmerPlants.$inferSelect;
export type InsertFarmerAnswer = z.infer<typeof insertFarmerAnswerSchema>;
export type FarmerAnswer = typeof farmerAnswers.$inferSelect;

// Login schemas
export const loginSchema = z.object({
  identifier: z.string().min(1, "Phone number or email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

// User type selection schema
export const userTypeSchema = z.object({
  userType: z.enum(["farmer", "buyer"], {
    required_error: "Please select either Farmer or Buyer"
  })
});

export const verifyOtpSchema = z.object({
  userId: z.string(),
  code: z.string().length(6, "OTP code must be 6 digits"),
  type: z.enum(["sms", "email"]),
});

export const requestOtpSchema = z.object({
  userId: z.string(),
  type: z.enum(["sms", "email"]),
  purpose: z.enum(["verification", "login", "password_reset"]),
});

// Password reset schemas
export const forgotPasswordSchema = z.object({
  identifier: z.string().min(1, "Phone number or email is required"),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(6, "Password confirmation is required"),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

export type LoginData = z.infer<typeof loginSchema>;
export type VerifyOtpData = z.infer<typeof verifyOtpSchema>;
export type RequestOtpData = z.infer<typeof requestOtpSchema>;
export type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordData = z.infer<typeof resetPasswordSchema>;
