import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authService } from "./services/auth";
import { otpService } from "./services/otp";
import { createLoggingMiddleware, createErrorLoggingMiddleware } from "./middleware/logging";
import { 
  loginSchema, 
  verifyOtpSchema, 
  requestOtpSchema, 
  insertUserSchema 
} from "@shared/schema";
import { z } from "zod";

// Custom middleware for auth endpoints
const authLoggingMiddleware = createLoggingMiddleware({
  includePaths: ['/api/auth', '/api/users'],
  logRequestBody: false, // Don't log passwords
  logResponseBody: false,
});

// Middleware for API routes
const apiLoggingMiddleware = createLoggingMiddleware({
  includePaths: ['/api/'],
  excludePaths: ['/api/health'],
});

// Authentication middleware
async function authenticateToken(req: Request, res: Response, next: any) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Access token required' });
  }

  try {
    const user = await authService.validateSession(token);
    if (!user) {
      return res.status(401).json({ message: 'Invalid or expired token' });
    }

    (req as any).user = user;
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid token' });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Health check endpoint (no logging)
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

      // Test database connection
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

  // Authentication routes with specific logging
  app.use('/api/auth', authLoggingMiddleware);
  
  // Register user
  app.post('/api/auth/register', async (req, res, next) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUserByEmail = await storage.getUserByEmail(validatedData.email);
      const existingUserByPhone = await storage.getUserByPhone(validatedData.phone);
      const existingUserByUsername = await storage.getUserByUsername(validatedData.username);

      if (existingUserByEmail) {
        return res.status(400).json({ message: 'Email already registered' });
      }
      if (existingUserByPhone) {
        return res.status(400).json({ message: 'Phone number already registered' });
      }
      if (existingUserByUsername) {
        return res.status(400).json({ message: 'Username already taken' });
      }

      const user = await authService.registerUser(validatedData);
      
      // Send verification OTPs
      await otpService.createAndSendOtp(user.id, 'sms', 'verification', user.phone);
      await otpService.createAndSendOtp(user.id, 'email', 'verification', user.email);

      res.status(201).json({ 
        message: 'User registered successfully. Please verify your phone and email.',
        userId: user.id 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      }
      next(error);
    }
  });

  // Login user
  app.post('/api/auth/login', async (req, res, next) => {
    try {
      const { identifier, password } = loginSchema.parse(req.body);
      
      const user = await authService.authenticateUser(identifier, password);
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      if (!user.isVerified) {
        return res.status(403).json({ 
          message: 'Account not verified. Please verify your phone and email.',
          userId: user.id 
        });
      }

      const token = await authService.createSession(user.id);
      
      res.json({ 
        message: 'Login successful',
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          phone: user.phone,
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      }
      next(error);
    }
  });

  // Request OTP
  app.post('/api/auth/request-otp', async (req, res, next) => {
    try {
      const { userId, type, purpose } = requestOtpSchema.parse(req.body);
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const destination = type === 'sms' ? user.phone : user.email;
      await otpService.createAndSendOtp(userId, type, purpose, destination);

      res.json({ message: `OTP sent successfully via ${type}` });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      }
      next(error);
    }
  });

  // Verify OTP
  app.post('/api/auth/verify-otp', async (req, res, next) => {
    try {
      const { userId, code, type } = verifyOtpSchema.parse(req.body);
      
      const isValid = await otpService.verifyOtp(userId, code, type);
      if (!isValid) {
        return res.status(400).json({ message: 'Invalid or expired OTP code' });
      }

      // If this is account verification, mark user as verified
      const user = await storage.getUser(userId);
      if (user && !user.isVerified) {
        await storage.updateUser(userId, { isVerified: true });
      }

      res.json({ message: 'OTP verified successfully' });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      }
      next(error);
    }
  });

  // Logout
  app.post('/api/auth/logout', authenticateToken, async (req, res, next) => {
    try {
      const authHeader = req.headers['authorization'];
      const token = authHeader?.split(' ')[1];
      
      if (token) {
        await authService.logout(token);
      }
      
      res.json({ message: 'Logged out successfully' });
    } catch (error) {
      next(error);
    }
  });

  // API routes with logging
  app.use('/api', apiLoggingMiddleware);

  // Get user profile
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

  // Dashboard stats (protected)
  app.get('/api/dashboard/stats', authenticateToken, async (req, res, next) => {
    try {
      const stats = await storage.getDashboardStats();
      res.json(stats);
    } catch (error) {
      next(error);
    }
  });

  // Recent activity (protected)
  app.get('/api/dashboard/activity', authenticateToken, async (req, res, next) => {
    try {
      const activity = await storage.getRecentActivity(10);
      res.json(activity);
    } catch (error) {
      next(error);
    }
  });

  // HTTP logs (protected)
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

  // Error logs (protected)
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

  // Error logging middleware
  app.use(createErrorLoggingMiddleware());

  const httpServer = createServer(app);

  // Cleanup expired OTPs every hour
  setInterval(async () => {
    try {
      await otpService.cleanupExpiredOtps();
    } catch (error) {
      console.error('Failed to cleanup expired OTPs:', error);
    }
  }, 60 * 60 * 1000); // 1 hour

  return httpServer;
}
