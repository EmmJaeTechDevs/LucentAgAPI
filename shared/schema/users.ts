import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  boolean,
} from "drizzle-orm/pg-core";

export const roles = pgTable("roles", {
  id: integer("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  roleId: integer("role_id").references(() => roles.id),
  username: text("username"),
  userType: text("user_type"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  phone: text("phone").notNull().unique(),
  email: text("email"),
  password: text("password").notNull(),
  homeStreet: text("home_street"),
  homeHouseNumber: text("home_house_number"),
  homeAdditionalDesc: text("home_additional_desc"),
  homeBusStop: text("home_bus_stop"),
  homeLocalGov: text("home_local_gov"),
  homePostcode: text("home_postcode"),
  homeState: text("home_state"),
  homeCountry: text("home_country").default("Nigeria"),
  farmStreet: text("farm_street"),
  farmHouseNumber: text("farm_house_number"),
  farmAdditionalDesc: text("farm_additional_desc"),
  farmBusStop: text("farm_bus_stop"),
  farmLocalGov: text("farm_local_gov"),
  farmPostcode: text("farm_postcode"),
  farmState: text("farm_state"),
  farmCountry: text("farm_country").default("Nigeria"),
  isVerified: boolean("is_verified").default(false),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export type Role = typeof roles.$inferSelect;
export type User = typeof users.$inferSelect;
