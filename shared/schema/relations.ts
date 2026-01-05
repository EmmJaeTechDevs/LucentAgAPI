import { relations } from "drizzle-orm";
import { users } from "./users";
import { otpCodes, sessions, passwordResetTokens } from "./auth";
import { plants, plantQuestions, farmerPlants, farmerAnswers } from "./plants";
import { farmerCrops, cropOrders, cropNotifications } from "./crops";
import { deliveryLocations } from "./locations";
import { httpLogs, errorLogs } from "./logs";
import { userNotificationPreferences } from "./notifications";

export const usersRelations = relations(users, ({ many, one }) => ({
  otpCodes: many(otpCodes),
  httpLogs: many(httpLogs),
  errorLogs: many(errorLogs),
  sessions: many(sessions),
  passwordResetTokens: many(passwordResetTokens),
  farmerPlants: many(farmerPlants),
  farmerAnswers: many(farmerAnswers),
  notificationPreferences: one(userNotificationPreferences),
  farmerCrops: many(farmerCrops, { relationName: "farmer_crops" }),
  buyerOrders: many(cropOrders, { relationName: "buyer_orders" }),
  farmerOrders: many(cropOrders, { relationName: "farmer_orders" }),
  cropNotifications: many(cropNotifications),
  deliveryLocations: many(deliveryLocations),
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

export const passwordResetTokensRelations = relations(
  passwordResetTokens,
  ({ one }) => ({
    user: one(users, {
      fields: [passwordResetTokens.userId],
      references: [users.id],
    }),
  }),
);

export const plantsRelations = relations(plants, ({ many }) => ({
  questions: many(plantQuestions),
  farmerPlants: many(farmerPlants),
  farmerAnswers: many(farmerAnswers),
}));

export const plantQuestionsRelations = relations(
  plantQuestions,
  ({ one, many }) => ({
    plant: one(plants, {
      fields: [plantQuestions.plantId],
      references: [plants.id],
    }),
    farmerAnswers: many(farmerAnswers),
  }),
);

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

export const userNotificationPreferencesRelations = relations(
  userNotificationPreferences,
  ({ one }) => ({
    user: one(users, {
      fields: [userNotificationPreferences.userId],
      references: [users.id],
    }),
  }),
);

export const farmerCropsRelations = relations(farmerCrops, ({ one, many }) => ({
  farmer: one(users, {
    fields: [farmerCrops.farmerId],
    references: [users.id],
    relationName: "farmer_crops",
  }),
  plant: one(plants, {
    fields: [farmerCrops.plantId],
    references: [plants.id],
  }),
  orders: many(cropOrders),
  notifications: many(cropNotifications),
}));

export const cropOrdersRelations = relations(cropOrders, ({ one }) => ({
  crop: one(farmerCrops, {
    fields: [cropOrders.cropId],
    references: [farmerCrops.id],
  }),
  buyer: one(users, {
    fields: [cropOrders.buyerId],
    references: [users.id],
    relationName: "buyer_orders",
  }),
  farmer: one(users, {
    fields: [cropOrders.farmerId],
    references: [users.id],
    relationName: "farmer_orders",
  }),
}));

export const cropNotificationsRelations = relations(
  cropNotifications,
  ({ one }) => ({
    crop: one(farmerCrops, {
      fields: [cropNotifications.cropId],
      references: [farmerCrops.id],
    }),
    buyer: one(users, {
      fields: [cropNotifications.buyerId],
      references: [users.id],
    }),
    farmer: one(users, {
      fields: [cropNotifications.farmerId],
      references: [users.id],
    }),
  }),
);

export const deliveryLocationsRelations = relations(
  deliveryLocations,
  ({ one }) => ({
    user: one(users, {
      fields: [deliveryLocations.userId],
      references: [users.id],
    }),
  }),
);
