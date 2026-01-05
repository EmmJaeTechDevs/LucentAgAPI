import type { Express } from "express";
import { storage } from "../storage";
import { authenticateToken } from "../middleware/auth";
import { createLoggingMiddleware } from "../middleware/logging";
import { 
  insertUserNotificationPreferencesSchema
} from "@shared/schema";
import { z } from "zod";

const apiLoggingMiddleware = createLoggingMiddleware({
  includePaths: ['/api/'],
  excludePaths: ['/api/health'],
});

export function registerUsersRoutes(app: Express): void {
  app.use('/api', apiLoggingMiddleware);

  /**
   * @swagger
   * /api/users/profile:
   *   get:
   *     summary: Get User Profile
   *     description: Get current authenticated user's profile information
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: User profile retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: string
   *                   format: uuid
   *                 username:
   *                   type: string
   *                 email:
   *                   type: string
   *                   format: email
   *                   nullable: true
   *                 phone:
   *                   type: string
   *                 isVerified:
   *                   type: boolean
   *       401:
   *         description: Unauthorized - token required or invalid
   */
  app.get('/api/users/profile', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      res.json({
        id: user.id,
        username: user.username,
        email: user.email,
        phone: user.phone,
        isVerified: user.isVerified,
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/dashboard/stats:
   *   get:
   *     summary: Get Dashboard Statistics
   *     description: Get system statistics including user counts, sessions, and API usage
   *     tags: [Dashboard]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Dashboard statistics retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 totalUsers:
   *                   type: integer
   *                   description: Total number of registered users
   *                   example: 150
   *                 activeSessions:
   *                   type: integer
   *                   description: Number of active user sessions
   *                   example: 25
   *                 otpSentToday:
   *                   type: integer
   *                   description: OTP codes sent today
   *                   example: 45
   *                 apiErrorsToday:
   *                   type: integer
   *                   description: API errors logged today
   *                   example: 3
   *       401:
   *         description: Unauthorized - token required or invalid
   */
  app.get('/api/dashboard/stats', authenticateToken, async (req, res, next) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/dashboard/activity:
   *   get:
   *     summary: Get Recent Activity
   *     description: Get recent API activity and user interactions
   *     tags: [Dashboard]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Recent activity retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   id:
   *                     type: string
   *                   method:
   *                     type: string
   *                     example: "POST"
   *                   url:
   *                     type: string
   *                     example: "/api/auth/login"
   *                   statusCode:
   *                     type: integer
   *                     example: 200
   *                   responseTime:
   *                     type: integer
   *                     description: Response time in milliseconds
   *                     example: 150
   *                   createdAt:
   *                     type: string
   *                     format: date-time
   *       401:
   *         description: Unauthorized - token required or invalid
   */
  app.get('/api/dashboard/activity', authenticateToken, async (req, res, next) => {
    try {
      const activity = await storage.getRecentActivity(10);
      res.json(activity);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/users/notification-preferences:
   *   get:
   *     summary: Get User Notification Preferences
   *     description: Retrieve the notification preferences for the authenticated user
   *     tags: [User Preferences]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Notification preferences retrieved successfully
   *       401:
   *         description: Unauthorized - token required
   *       404:
   *         description: No preferences found (user can set them using POST)
   */
  app.get('/api/users/notification-preferences', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      
      const preferences = await storage.getUserNotificationPreferences(user.id);
      
      if (!preferences) {
        return res.status(404).json({ 
          message: 'No notification preferences found. Please set your preferences.',
          defaultPreferences: {
            smsEnabled: true,
            emailEnabled: true,
            whatsappEnabled: false,
            inAppEnabled: true
          }
        });
      }
      
      res.json(preferences);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/users/notification-preferences:
   *   post:
   *     summary: Set or Update User Notification Preferences
   *     description: Create new notification preferences or update existing ones for the authenticated user
   *     tags: [User Preferences]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               smsEnabled:
   *                 type: boolean
   *                 description: Enable SMS notifications
   *                 example: true
   *               emailEnabled:
   *                 type: boolean
   *                 description: Enable email notifications
   *                 example: true
   *               whatsappEnabled:
   *                 type: boolean
   *                 description: Enable WhatsApp notifications
   *                 example: false
   *               inAppEnabled:
   *                 type: boolean
   *                 description: Enable in-app notifications
   *                 example: true
   *     responses:
   *       200:
   *         description: Preferences updated successfully
   *       201:
   *         description: Preferences created successfully
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized - token required
   */
  app.post('/api/users/notification-preferences', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      
      const bodyData = insertUserNotificationPreferencesSchema.parse(req.body);
      const validatedData = {
        ...bodyData,
        userId: user.id
      };

      const preferences = await storage.createOrUpdateUserNotificationPreferences(validatedData);
      
      const isNewRecord = !await storage.getUserNotificationPreferences(user.id);
      
      res.status(isNewRecord ? 201 : 200).json({
        message: isNewRecord 
          ? 'Notification preferences created successfully'
          : 'Notification preferences updated successfully',
        preferences
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      }
      next(error);
    }
  });
}
