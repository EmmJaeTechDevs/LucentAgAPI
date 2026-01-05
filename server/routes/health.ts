import type { Express } from "express";
import { storage } from "../storage";

export function registerHealthRoutes(app: Express): void {
  /**
   * @swagger
   * /api/health:
   *   get:
   *     summary: Health Check
   *     description: Returns the health status of the API server and database connection
   *     tags: [System]
   *     responses:
   *       200:
   *         description: Service is healthy
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HealthStatus'
   *             example:
   *               status: "ok"
   *               timestamp: "2024-01-15T10:30:00.000Z"
   *               server:
   *                 status: "healthy"
   *                 uptime: 3600
   *                 memory: { "rss": 25165824, "heapTotal": 16777216, "heapUsed": 12345678 }
   *                 version: "v18.17.0"
   *               database:
   *                 status: "healthy"
   *                 connected: true
   *       503:
   *         description: Service is degraded (database issues)
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/HealthStatus'
   */
  app.get('/api/health', async (req, res) => {
    try {
      const healthCheck = {
        status: 'ok',
        timestamp: new Date().toISOString(),
        server: {
          status: 'healthy',
          uptime: process.uptime(),
          memory: process.memoryUsage(),
          version: process.version
        },
        database: {
          status: 'healthy',
          connected: false,
          error: undefined as string | undefined
        }
      };

      try {
        const result = await storage.testConnection();
        healthCheck.database.connected = true;
        healthCheck.database.status = 'healthy';
      } catch (dbError) {
        healthCheck.status = 'degraded';
        healthCheck.database.status = 'unhealthy';
        healthCheck.database.error = dbError instanceof Error ? dbError.message : 'Unknown database error';
      }

      const statusCode = healthCheck.status === 'ok' ? 200 : 503;
      res.status(statusCode).json(healthCheck);
    } catch (error) {
      res.status(500).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}
