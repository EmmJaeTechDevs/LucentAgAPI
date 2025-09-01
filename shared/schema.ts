import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  phone: text("phone").notNull().unique(),
  password: text("password").notNull(),
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

// Insert schemas
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  phone: true,
  password: true,
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
