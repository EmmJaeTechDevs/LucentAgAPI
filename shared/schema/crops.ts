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
import { plants } from "./plants";

export const farmerCrops = pgTable("farmer_crops", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  farmerId: varchar("farmer_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  plantId: varchar("plant_id")
    .notNull()
    .references(() => plants.id, { onDelete: "cascade" }),
  totalQuantity: integer("total_quantity").notNull(),
  availableQuantity: integer("available_quantity").notNull(),
  unit: text("unit").notNull(),
  pricePerUnit: integer("price_per_unit").notNull(),
  harvestDate: timestamp("harvest_date").notNull(),
  state: text("state").notNull(),
  lga: text("lga").notNull(),
  farmAddress: text("farm_address"),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const cropOrders = pgTable("crop_orders", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  cropId: varchar("crop_id")
    .notNull()
    .references(() => farmerCrops.id, { onDelete: "cascade" }),
  buyerId: varchar("buyer_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  farmerId: varchar("farmer_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  quantityOrdered: integer("quantity_ordered").notNull(),
  pricePerUnit: integer("price_per_unit").notNull(),
  subtotal: integer("subtotal").notNull(),
  deliveryFee: integer("delivery_fee").default(0),
  total: integer("total").notNull(),
  status: text("status").notNull().default("pending"),
  deliveryAddress: text("delivery_address").notNull(),
  deliveryState: text("delivery_state").notNull(),
  deliveryLga: text("delivery_lga").notNull(),
  deliveryNote: text("delivery_note"),
  orderDate: timestamp("order_date").default(sql`now()`),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const cropNotifications = pgTable("crop_notifications", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  cropId: varchar("crop_id")
    .notNull()
    .references(() => farmerCrops.id, { onDelete: "cascade" }),
  buyerId: varchar("buyer_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  farmerId: varchar("farmer_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  notificationType: text("notification_type").notNull(),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export type FarmerCrop = typeof farmerCrops.$inferSelect;
export type CropOrder = typeof cropOrders.$inferSelect;
export type CropNotification = typeof cropNotifications.$inferSelect;
