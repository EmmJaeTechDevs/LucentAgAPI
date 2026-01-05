import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  timestamp,
  integer,
  boolean,
  jsonb,
} from "drizzle-orm/pg-core";
import { users } from "./users";

export const plants = pgTable("plants", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull().unique(),
  description: text("description"),
  category: text("category"),
  growthDuration: text("growth_duration"),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const plantQuestions = pgTable("plant_questions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  plantId: varchar("plant_id")
    .notNull()
    .references(() => plants.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  questionType: text("question_type").notNull(),
  options: jsonb("options"),
  isRequired: boolean("is_required").default(true),
  category: text("category"),
  orderIndex: integer("order_index").default(0),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const farmerPlants = pgTable("farmer_plants", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  farmerId: varchar("farmer_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  plantId: varchar("plant_id")
    .notNull()
    .references(() => plants.id, { onDelete: "cascade" }),
  landSize: text("land_size"),
  notes: text("notes"),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const farmerAnswers = pgTable("farmer_answers", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  farmerId: varchar("farmer_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  plantId: varchar("plant_id")
    .notNull()
    .references(() => plants.id, { onDelete: "cascade" }),
  questionId: varchar("question_id")
    .notNull()
    .references(() => plantQuestions.id, { onDelete: "cascade" }),
  answer: jsonb("answer").notNull(),
  customAnswer: text("custom_answer"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export type Plant = typeof plants.$inferSelect;
export type PlantQuestion = typeof plantQuestions.$inferSelect;
export type FarmerPlant = typeof farmerPlants.$inferSelect;
export type FarmerAnswer = typeof farmerAnswers.$inferSelect;
