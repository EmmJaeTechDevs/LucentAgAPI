import { sql } from "drizzle-orm";
import {
  pgTable,
  varchar,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const userNotificationPreferences = pgTable(
  "user_notification_preferences",
  {
    id: varchar("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    userId: varchar("user_id")
      .notNull()
      .unique()
      .references(() => users.id, { onDelete: "cascade" }),
    smsEnabled: boolean("sms_enabled").default(true),
    emailEnabled: boolean("email_enabled").default(true),
    whatsappEnabled: boolean("whatsapp_enabled").default(false),
    inAppEnabled: boolean("in_app_enabled").default(true),
    createdAt: timestamp("created_at").default(sql`now()`),
    updatedAt: timestamp("updated_at").default(sql`now()`),
  },
);

export type UserNotificationPreferences = typeof userNotificationPreferences.$inferSelect;
export type InsertUserNotificationPreferences = typeof userNotificationPreferences.$inferInsert;
