import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./users";
import { otpCodes, sessions, passwordResetTokens } from "./auth";
import { plants, plantQuestions, farmerPlants, farmerAnswers } from "./plants";
import { farmerCrops, cropOrders, cropNotifications } from "./crops";
import { deliveryLocations, deliveryUnits } from "./locations";
import { httpLogs, errorLogs } from "./logs";
import { userNotificationPreferences } from "./notifications";

export const insertFarmerSchema = createInsertSchema(users)
  .pick({
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
  })
  .extend({
    userType: z.literal("farmer"),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    phone: z.string().min(10, "Valid phone number is required"),
    email: z
      .union([
        z.string().email("Please enter a valid email address"),
        z.literal(""),
        z.undefined(),
      ])
      .optional(),
    password: z.string().min(6, "Password must be at least 6 characters"),
    homeStreet: z.string().min(1, "Home street is required"),
    homeHouseNumber: z.string().min(1, "Home house number is required"),
    homeBusStop: z.string().min(1, "Home bus stop is required"),
    homeLocalGov: z.string().min(1, "Home local government is required"),
    homeState: z.string().min(1, "Home state is required"),
    homeCountry: z.string().default("Nigeria"),
    farmStreet: z.string().min(1, "Farm street is required"),
    farmHouseNumber: z.string().min(1, "Farm house number is required"),
    farmBusStop: z.string().min(1, "Farm bus stop is required"),
    farmLocalGov: z.string().min(1, "Farm local government is required"),
    farmState: z.string().min(1, "Farm state is required"),
    farmCountry: z.string().default("Nigeria"),
  });

export const insertBuyerSchema = createInsertSchema(users)
  .pick({
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
  })
  .extend({
    userType: z.literal("buyer"),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    phone: z.string().min(10, "Valid phone number is required"),
    email: z
      .union([
        z.string().email("Please enter a valid email address"),
        z.literal(""),
        z.undefined(),
      ])
      .optional(),
    password: z.string().min(6, "Password must be at least 6 characters"),
    homeStreet: z.string().min(1, "Home street is required"),
    homeHouseNumber: z.string().min(1, "Home house number is required"),
    homeBusStop: z.string().min(1, "Home bus stop is required"),
    homeLocalGov: z.string().min(1, "Home local government is required"),
    homeState: z.string().min(1, "Home state is required"),
    homeCountry: z.string().default("Nigeria"),
  });

export const insertUserSchema = createInsertSchema(users)
  .pick({
    firstName: true,
    lastName: true,
    email: true,
    phone: true,
    password: true,
    userType: true,
  })
  .extend({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    phone: z.string().min(10, "Valid phone number is required"),
    email: z
      .union([
        z.string().email("Please enter a valid email address"),
        z.literal(""),
        z.undefined(),
      ])
      .optional(),
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

export const insertPasswordResetTokenSchema = createInsertSchema(
  passwordResetTokens,
).pick({
  userId: true,
  token: true,
  expiresAt: true,
});

export const insertPlantSchema = createInsertSchema(plants)
  .pick({
    name: true,
    description: true,
    category: true,
    growthDuration: true,
    isActive: true,
  })
  .extend({
    name: z.string().min(1, "Plant name is required"),
    description: z.string().optional(),
    category: z.string().optional(),
    growthDuration: z.string().optional(),
    isActive: z.boolean().default(true),
  });

export const insertPlantQuestionSchema = createInsertSchema(plantQuestions)
  .pick({
    plantId: true,
    question: true,
    questionType: true,
    options: true,
    isRequired: true,
    category: true,
    orderIndex: true,
  })
  .extend({
    plantId: z.string().min(1, "Plant ID is required"),
    question: z.string().min(1, "Question is required"),
    questionType: z.enum(["multiple_choice", "checkbox", "text"], {
      required_error: "Question type is required",
    }),
    options: z
      .array(
        z.object({
          value: z.string(),
          label: z.string(),
        }),
      )
      .optional(),
    isRequired: z.boolean().default(true),
    category: z.string().optional(),
    orderIndex: z.number().default(0),
  });

export const insertFarmerPlantSchema = createInsertSchema(farmerPlants)
  .pick({
    farmerId: true,
    plantId: true,
    landSize: true,
    notes: true,
  })
  .extend({
    farmerId: z.string().min(1, "Farmer ID is required"),
    plantId: z.string().min(1, "Plant ID is required"),
    landSize: z.string().optional(),
    notes: z.string().optional(),
  });

export const insertFarmerAnswerSchema = createInsertSchema(farmerAnswers)
  .pick({
    farmerId: true,
    plantId: true,
    questionId: true,
    answer: true,
    customAnswer: true,
  })
  .extend({
    farmerId: z.string().min(1, "Farmer ID is required"),
    plantId: z.string().min(1, "Plant ID is required"),
    questionId: z.string().min(1, "Question ID is required"),
    answer: z.union([z.string(), z.array(z.string()), z.record(z.any())], {
      required_error: "Answer is required",
    }),
    customAnswer: z.string().optional(),
  });

export const insertUserNotificationPreferencesSchema = createInsertSchema(
  userNotificationPreferences,
)
  .omit({
    id: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    smsEnabled: z.boolean().optional(),
    emailEnabled: z.boolean().optional(),
    whatsappEnabled: z.boolean().optional(),
    inAppEnabled: z.boolean().optional(),
  });

export const insertFarmerCropSchema = createInsertSchema(farmerCrops)
  .omit({
    id: true,
    farmerId: true,
    availableQuantity: true,
    isActive: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    plantId: z.string().min(1, "Plant selection is required"),
    totalQuantity: z.number().int().min(1, "Quantity must be at least 1"),
    unit: z.string().min(1, "Unit is required"),
    pricePerUnit: z.number().int().min(1, "Price must be greater than 0"),
    harvestDate: z
      .string({
        required_error: "Harvest date is required",
      })
      .transform((dateString, ctx) => {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
          ctx.addIssue({
            code: z.ZodIssueCode.invalid_date,
            message: "Invalid harvest date format",
          });
          return z.NEVER;
        }
        return date;
      }),
    state: z.string().min(1, "State is required"),
    lga: z.string().min(1, "Local Government Area is required"),
    farmAddress: z.string().optional(),
    description: z.string().optional(),
  });

export const updateFarmerCropSchema = insertFarmerCropSchema.partial().extend({
  harvestDate: z.string({
    required_error: "Harvest date is required"
  }).transform((dateString, ctx) => {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      ctx.addIssue({
        code: z.ZodIssueCode.invalid_date,
        message: "Invalid harvest date format"
      });
      return z.NEVER;
    }
    return date;
  }).optional()
});

export const insertCropOrderSchema = createInsertSchema(cropOrders)
  .omit({
    id: true,
    buyerId: true,
    farmerId: true,
    pricePerUnit: true,
    subtotal: true,
    total: true,
    status: true,
    orderDate: true,
    deliveredAt: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    cropId: z.string().min(1, "Crop selection is required"),
    quantityOrdered: z.number().int().min(1, "Quantity must be at least 1"),
    deliveryFee: z
      .number()
      .int()
      .min(0, "Delivery fee cannot be negative")
      .default(0),
    deliveryAddress: z.string().min(1, "Delivery address is required"),
    deliveryState: z.string().min(1, "Delivery state is required"),
    deliveryLga: z.string().min(1, "Delivery LGA is required"),
    deliveryNote: z.string().optional(),
  });

export const insertCropNotificationSchema = createInsertSchema(
  cropNotifications,
)
  .omit({
    id: true,
    buyerId: true,
    farmerId: true,
    isRead: true,
    createdAt: true,
  })
  .extend({
    cropId: z.string().min(1, "Crop ID is required"),
    message: z.string().min(1, "Message is required"),
    notificationType: z.enum(
      ["crop_ready", "price_change", "quantity_update"],
      {
        required_error: "Notification type is required",
      },
    ),
  });

export const insertDeliveryLocationSchema = createInsertSchema(
  deliveryLocations,
)
  .omit({
    id: true,
    userId: true,
    isDefault: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    name: z.string().min(1, "Location name is required"),
    address: z.string().min(1, "Address is required"),
    state: z.string().min(1, "State is required"),
    lga: z.string().min(1, "LGA is required"),
    phoneNumber: z.string().optional(),
  });

export const insertDeliveryUnitSchema = createInsertSchema(deliveryUnits)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
  })
  .extend({
    name: z
      .string()
      .min(1, "Unit name is required")
      .regex(/^[a-z_]+$/, "Unit name must be lowercase with underscores only"),
    displayName: z.string().min(1, "Display name is required"),
    weightInKg: z.number().int().min(1, "Weight must be at least 1 gram"),
    description: z.string().optional(),
    isActive: z.boolean().optional().default(true),
  });

export const cropSearchSchema = z.object({
  query: z.string().optional(),
  plantCategory: z.string().optional(),
  state: z.string().optional(),
  lga: z.string().optional(),
  minPrice: z.number().int().min(0).optional(),
  maxPrice: z.number().int().min(0).optional(),
  unit: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export const deliveryFeeRequestSchema = z.object({
  fromState: z.string().min(1, "Origin state is required"),
  fromLga: z.string().min(1, "Origin LGA is required"),
  fromAddress: z.string().optional(),
  toState: z.string().min(1, "Destination state is required"),
  toLga: z.string().min(1, "Destination LGA is required"),
  toAddress: z.string().min(1, "Destination address is required"),
  weight: z.number().min(0.1, "Weight must be greater than 0"),
  unit: z.string().min(1, "Unit is required"),
  quantity: z.number().int().min(1, "Quantity must be at least 1"),
});

export const loginSchema = z.object({
  identifier: z.string().min(1, "Phone number or email is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export const userTypeSchema = z.object({
  userType: z.enum(["farmer", "buyer"], {
    required_error: "Please select either Farmer or Buyer",
  }),
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

export const forgotPasswordSchema = z.object({
  identifier: z.string().min(1, "Phone number or email is required"),
});

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Reset token is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(6, "Password confirmation is required"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertFarmer = z.infer<typeof insertFarmerSchema>;
export type InsertBuyer = z.infer<typeof insertBuyerSchema>;
export type InsertOtpCode = z.infer<typeof insertOtpCodeSchema>;
export type InsertHttpLog = z.infer<typeof insertHttpLogSchema>;
export type InsertErrorLog = z.infer<typeof insertErrorLogSchema>;
export type InsertSession = z.infer<typeof insertSessionSchema>;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
export type InsertPlant = z.infer<typeof insertPlantSchema>;
export type InsertPlantQuestion = z.infer<typeof insertPlantQuestionSchema>;
export type InsertFarmerPlant = z.infer<typeof insertFarmerPlantSchema>;
export type InsertFarmerAnswer = z.infer<typeof insertFarmerAnswerSchema>;
export type InsertFarmerCrop = z.infer<typeof insertFarmerCropSchema>;
export type InsertCropOrder = z.infer<typeof insertCropOrderSchema>;
export type InsertCropNotification = z.infer<typeof insertCropNotificationSchema>;
export type InsertDeliveryLocation = z.infer<typeof insertDeliveryLocationSchema>;
export type InsertDeliveryUnit = z.infer<typeof insertDeliveryUnitSchema>;
export type CropSearchParams = z.infer<typeof cropSearchSchema>;
export type DeliveryFeeRequest = z.infer<typeof deliveryFeeRequestSchema>;
export type LoginData = z.infer<typeof loginSchema>;
export type VerifyOtpData = z.infer<typeof verifyOtpSchema>;
export type RequestOtpData = z.infer<typeof requestOtpSchema>;
export type ForgotPasswordData = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordData = z.infer<typeof resetPasswordSchema>;
