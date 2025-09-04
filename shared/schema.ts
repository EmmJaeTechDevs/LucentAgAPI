import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userType: text("user_type").notNull(), // 'farmer' or 'buyer'
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone").notNull().unique(),
  email: text("email"), // Optional for farmers
  password: text("password").notNull(),
  
  // Home address fields
  homeStreet: text("home_street").notNull(),
  homeHouseNumber: text("home_house_number").notNull(),
  homeAdditionalDesc: text("home_additional_desc"),
  homeBusStop: text("home_bus_stop").notNull(),
  homeLocalGov: text("home_local_gov").notNull(),
  homePostcode: text("home_postcode"),
  homeState: text("home_state").notNull(),
  homeCountry: text("home_country").notNull().default('Nigeria'),
  
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

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  otpCodes: many(otpCodes),
  httpLogs: many(httpLogs),
  errorLogs: many(errorLogs),
  sessions: many(sessions),
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
  email: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
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
  email: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
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
  email: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
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

export type LoginData = z.infer<typeof loginSchema>;
export type VerifyOtpData = z.infer<typeof verifyOtpSchema>;
export type RequestOtpData = z.infer<typeof requestOtpSchema>;
