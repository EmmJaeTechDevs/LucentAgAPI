import type { Express } from "express";
import { storage } from "../storage";
import { authenticateToken } from "../middleware/auth";

export function registerLogsRoutes(app: Express): void {
  /**
   * @swagger
   * /api/logs/http:
   *   get:
   *     summary: Get HTTP Request Logs
   *     description: Get paginated HTTP request logs for monitoring and debugging
   *     tags: [Logs]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Page number for pagination
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 50
   *         description: Number of logs per page
   *     responses:
   *       200:
   *         description: HTTP logs retrieved successfully
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
   *                     example: "/api/auth/register"
   *                   statusCode:
   *                     type: integer
   *                     example: 201
   *                   responseTime:
   *                     type: integer
   *                     description: Response time in milliseconds
   *                   ipAddress:
   *                     type: string
   *                     example: "192.168.1.1"
   *                   userAgent:
   *                     type: string
   *                   createdAt:
   *                     type: string
   *                     format: date-time
   *       401:
   *         description: Unauthorized - token required or invalid
   */
  app.get('/api/logs/http', authenticateToken, async (req, res, next) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;
      
      const logs = await storage.getHttpLogs(limit, offset);
      res.json(logs);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/logs/errors:
   *   get:
   *     summary: Get Error Logs
   *     description: Get paginated error logs for debugging and monitoring system issues
   *     tags: [Logs]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: page
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *         description: Page number for pagination
   *       - in: query
   *         name: limit
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 50
   *         description: Number of error logs per page
   *     responses:
   *       200:
   *         description: Error logs retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   id:
   *                     type: string
   *                   message:
   *                     type: string
   *                     description: Error message
   *                     example: "Database connection failed"
   *                   stack:
   *                     type: string
   *                     description: Error stack trace
   *                   route:
   *                     type: string
   *                     example: "/api/auth/login"
   *                   method:
   *                     type: string
   *                     example: "POST"
   *                   statusCode:
   *                     type: integer
   *                     example: 500
   *                   ipAddress:
   *                     type: string
   *                     example: "192.168.1.1"
   *                   userAgent:
   *                     type: string
   *                   createdAt:
   *                     type: string
   *                     format: date-time
   *       401:
   *         description: Unauthorized - token required or invalid
   */
  app.get('/api/logs/errors', authenticateToken, async (req, res, next) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = (page - 1) * limit;
      
      const logs = await storage.getErrorLogs(limit, offset);
      res.json(logs);
    } catch (error) {
      next(error);
    }
  });
}
