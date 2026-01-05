import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const deliveryLocations = pgTable("delivery_locations", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  address: text("address").notNull(),
  state: text("state").notNull(),
  lga: text("lga").notNull(),
  phoneNumber: text("phone_number"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const deliveryUnits = pgTable("delivery_units", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  displayName: text("display_name").notNull(),
  weightInKg: integer("weight_in_kg").notNull(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const countries = pgTable("countries", {
  id: integer("id").primaryKey(),
  name: varchar("name").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const states = pgTable("states", {
  id: integer("id").primaryKey(),
  name: varchar("name").notNull(),
  countryId: integer("country_id").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const lgas = pgTable("lgas", {
  id: integer("id").primaryKey(),
  name: varchar("name").notNull(),
  stateId: integer("state_id").notNull(),
  countryId: integer("country_id").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export type DeliveryLocation = typeof deliveryLocations.$inferSelect;
export type DeliveryUnit = typeof deliveryUnits.$inferSelect;
export type Country = typeof countries.$inferSelect;
export type State = typeof states.$inferSelect;
export type Lga = typeof lgas.$inferSelect;
