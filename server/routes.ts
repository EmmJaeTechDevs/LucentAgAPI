import type { Express } from "express";
import { createServer, type Server } from "http";
import { createErrorLoggingMiddleware } from "./middleware/logging";
import { otpService } from "./services/otp";
import { registerAllRoutes } from "./routes/index";

export async function registerRoutes(app: Express): Promise<Server> {
  registerAllRoutes(app);

  app.use(createErrorLoggingMiddleware());

  const httpServer = createServer(app);

  setInterval(async () => {
    try {
      await otpService.cleanupExpiredOtps();
    } catch (error) {
      console.error('Failed to cleanup expired OTPs:', error);
    }
  }, 60 * 60 * 1000);

  return httpServer;
}
