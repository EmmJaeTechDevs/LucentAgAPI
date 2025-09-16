import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authService } from "./services/auth";
import { otpService } from "./services/otp";
import { createLoggingMiddleware, createErrorLoggingMiddleware } from "./middleware/logging";
import { passwordResetService } from "./services/passwordReset";
import { 
  loginSchema, 
  verifyOtpSchema, 
  requestOtpSchema, 
  insertUserSchema,
  insertFarmerSchema,
  insertBuyerSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  insertFarmerPlantSchema,
  insertFarmerAnswerSchema,
  insertUserNotificationPreferencesSchema,
  insertFarmerCropSchema,
  insertCropOrderSchema,
  insertCropNotificationSchema,
  insertDeliveryLocationSchema,
  cropSearchSchema,
  deliveryFeeRequestSchema
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
  
  /**
   * @swagger
   * /api/auth/register:
   *   post:
   *     summary: Register General User (Legacy)
   *     description: Register a general user account. Use /api/auth/register-farmer or /api/auth/register-buyer instead.
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [firstName, lastName, phone, password, userType]
   *             properties:
   *               firstName:
   *                 type: string
   *                 description: User's first name
   *                 example: "John"
   *               lastName:
   *                 type: string
   *                 description: User's last name
   *                 example: "Doe"
   *               email:
   *                 type: string
   *                 format: email
   *                 description: User's email address (optional)
   *                 example: "john.doe@example.com"
   *               phone:
   *                 type: string
   *                 description: User's phone number
   *                 example: "+2348123456789"
   *               password:
   *                 type: string
   *                 minLength: 6
   *                 description: User's password
   *                 example: "securepass123"
   *               userType:
   *                 type: string
   *                 enum: [farmer, buyer]
   *                 description: Type of user account
   *                 example: "buyer"
   *     responses:
   *       201:
   *         description: User registered successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "User registered successfully. Please verify your phone and email."
   *                 userId:
   *                   type: string
   *                   format: uuid
   *                   example: "e1234567-e89b-12d3-a456-426614174000"
   *       400:
   *         description: Validation error or user already exists
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  app.post('/api/auth/register', async (req, res, next) => {
    try {
      const validatedData = insertUserSchema.parse(req.body);
      
      // Check if user already exists
      const existingUserByPhone = await storage.getUserByPhone(validatedData.phone);
      let existingUserByEmail = null;
      if (validatedData.email) {
        existingUserByEmail = await storage.getUserByEmail(validatedData.email);
      }

      if (existingUserByEmail) {
        return res.status(400).json({ message: 'Email already registered' });
      }
      if (existingUserByPhone) {
        return res.status(400).json({ message: 'Phone number already registered' });
      }

      const user = await authService.registerUser(validatedData);
      
      // Send verification OTP via SMS only
      await otpService.createAndSendOtp(user.id, 'sms', 'verification', user.phone);

      res.status(201).json({ 
        message: 'User registered successfully. Please verify your phone number.',
        userId: user.id 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      }
      next(error);
    }
  });

  /**
   * @swagger
   * /api/auth/register-farmer:
   *   post:
   *     summary: Register Farmer Account
   *     description: Register a farmer account with detailed home and farm address information
   *     tags: [Authentication, Farmers]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [userType, firstName, lastName, phone, password, homeStreet, homeHouseNumber, homeBusStop, homeLocalGov, homeState, farmStreet, farmHouseNumber, farmBusStop, farmLocalGov, farmState]
   *             properties:
   *               userType:
   *                 type: string
   *                 enum: [farmer]
   *                 example: "farmer"
   *               firstName:
   *                 type: string
   *                 example: "David"
   *               lastName:
   *                 type: string
   *                 example: "Farm"
   *               phone:
   *                 type: string
   *                 example: "+2348123456789"
   *               email:
   *                 type: string
   *                 format: email
   *                 description: Optional email address
   *                 example: "david@farm.com"
   *               password:
   *                 type: string
   *                 minLength: 6
   *                 example: "farmpass123"
   *               homeStreet:
   *                 type: string
   *                 example: "Farm Home Street"
   *               homeHouseNumber:
   *                 type: string
   *                 example: "12A"
   *               homeAdditionalDesc:
   *                 type: string
   *                 description: Optional additional home address description
   *                 example: "Near the market"
   *               homeBusStop:
   *                 type: string
   *                 example: "Central Market"
   *               homeLocalGov:
   *                 type: string
   *                 example: "Ikeja"
   *               homePostcode:
   *                 type: string
   *                 description: Optional postcode
   *                 example: "100001"
   *               homeState:
   *                 type: string
   *                 example: "Lagos"
   *               homeCountry:
   *                 type: string
   *                 default: "Nigeria"
   *                 example: "Nigeria"
   *               farmStreet:
   *                 type: string
   *                 example: "Farm Land Road"
   *               farmHouseNumber:
   *                 type: string
   *                 example: "Plot 5"
   *               farmAdditionalDesc:
   *                 type: string
   *                 description: Optional additional farm address description
   *                 example: "Behind the hill"
   *               farmBusStop:
   *                 type: string
   *                 example: "Farm Gate"
   *               farmLocalGov:
   *                 type: string
   *                 example: "Ikorodu"
   *               farmPostcode:
   *                 type: string
   *                 description: Optional farm postcode
   *                 example: "100002"
   *               farmState:
   *                 type: string
   *                 example: "Lagos"
   *               farmCountry:
   *                 type: string
   *                 default: "Nigeria"
   *                 example: "Nigeria"
   *     responses:
   *       201:
   *         description: Farmer registered successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Farmer registered successfully. Please verify your phone number and email address."
   *                 userId:
   *                   type: string
   *                   format: uuid
   *                 userType:
   *                   type: string
   *                   example: "farmer"
   *       400:
   *         description: Validation error or user already exists
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *             example:
   *               message: "You are not able to proceed because the following mandatory fields are empty: farmStreet, farmHouseNumber. Please fill in the required information to proceed."
   *               missingFields: ["farmStreet", "farmHouseNumber"]
   */
  app.post('/api/auth/register-farmer', async (req, res, next) => {
    try {
      const validatedData = insertFarmerSchema.parse(req.body);
      
      // Check if user already exists by phone
      const existingUserByPhone = await storage.getUserByPhone(validatedData.phone);
      if (existingUserByPhone) {
        return res.status(400).json({ message: 'Phone number already registered' });
      }

      // Check if email exists (if provided)
      if (validatedData.email) {
        const existingUserByEmail = await storage.getUserByEmail(validatedData.email);
        if (existingUserByEmail) {
          return res.status(400).json({ message: 'Email already registered' });
        }
      }

      // Create farmer user
      const farmer = await storage.createFarmer(validatedData);
      
      // Send verification OTP via SMS only
      await otpService.createAndSendOtp(farmer.id, 'sms', 'verification', farmer.phone);

      const verificationMessage = 'Farmer registered successfully. Please verify your phone number.';

      res.status(201).json({ 
        message: verificationMessage,
        userId: farmer.id,
        userType: 'farmer'
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const missingFields = error.errors
          .filter(err => err.message.includes('required'))
          .map(err => err.path.join('.'));
        
        const errorMessage = missingFields.length > 0 
          ? `You are not able to proceed because the following mandatory fields are empty: ${missingFields.join(', ')}. Please fill in the required information to proceed.`
          : 'Validation failed';

        return res.status(400).json({ 
          message: errorMessage, 
          errors: error.errors,
          missingFields 
        });
      }
      next(error);
    }
  });

  /**
   * @swagger
   * /api/auth/register-buyer:
   *   post:
   *     summary: Register Buyer Account
   *     description: Register a buyer account with home address information. Email is optional - if provided, email verification is used; otherwise SMS verification is used.
   *     tags: [Authentication, Buyers]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [userType, firstName, lastName, phone, password, homeStreet, homeHouseNumber, homeBusStop, homeLocalGov, homeState]
   *             properties:
   *               userType:
   *                 type: string
   *                 enum: [buyer]
   *                 example: "buyer"
   *               firstName:
   *                 type: string
   *                 example: "Sarah"
   *               lastName:
   *                 type: string
   *                 example: "Customer"
   *               phone:
   *                 type: string
   *                 example: "+2348987654321"
   *               email:
   *                 type: string
   *                 format: email
   *                 description: Optional email address. If provided, email verification is used instead of SMS.
   *                 example: "sarah@buyer.com"
   *               password:
   *                 type: string
   *                 minLength: 6
   *                 example: "buyerpass123"
   *               homeStreet:
   *                 type: string
   *                 example: "Shopping Street"
   *               homeHouseNumber:
   *                 type: string
   *                 example: "45B"
   *               homeAdditionalDesc:
   *                 type: string
   *                 description: Optional additional home address description
   *                 example: "Opposite the mall"
   *               homeBusStop:
   *                 type: string
   *                 example: "Mall Junction"
   *               homeLocalGov:
   *                 type: string
   *                 example: "Victoria Island"
   *               homePostcode:
   *                 type: string
   *                 description: Optional postcode
   *                 example: "101001"
   *               homeState:
   *                 type: string
   *                 example: "Lagos"
   *               homeCountry:
   *                 type: string
   *                 default: "Nigeria"
   *                 example: "Nigeria"
   *     responses:
   *       201:
   *         description: Buyer registered successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Buyer registered successfully. A verification email has been sent to your email address."
   *                 userId:
   *                   type: string
   *                   format: uuid
   *                 userType:
   *                   type: string
   *                   example: "buyer"
   *                 verificationMethod:
   *                   type: string
   *                   enum: [email, sms]
   *                   example: "email"
   *       400:
   *         description: Validation error or user already exists
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  app.post('/api/auth/register-buyer', async (req, res, next) => {
    try {
      const validatedData = insertBuyerSchema.parse(req.body);
      
      // Check if user already exists
      const existingUserByPhone = await storage.getUserByPhone(validatedData.phone);
      if (existingUserByPhone) {
        return res.status(400).json({ message: 'Phone number already registered' });
      }

      // Check if email exists (if provided)
      if (validatedData.email) {
        const existingUserByEmail = await storage.getUserByEmail(validatedData.email);
        if (existingUserByEmail) {
          return res.status(400).json({ message: 'Email already registered' });
        }
      }

      // Create buyer user
      const buyer = await storage.createBuyer(validatedData);
      
      // Send verification OTP via SMS only
      await otpService.createAndSendOtp(buyer.id, 'sms', 'verification', buyer.phone);

      const verificationMessage = 'Buyer registered successfully. A verification SMS has been sent to your phone number. Please enter the code to complete your registration.';

      res.status(201).json({ 
        message: verificationMessage,
        userId: buyer.id,
        userType: 'buyer',
        verificationMethod: 'sms'
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const missingFields = error.errors
          .filter(err => err.message.includes('required'))
          .map(err => err.path.join('.'));
        
        const errorMessage = missingFields.length > 0 
          ? `You are not able to proceed because the following mandatory fields are empty: ${missingFields.join(', ')}. Please fill in the required information to proceed.`
          : 'Validation failed';

        return res.status(400).json({ 
          message: errorMessage, 
          errors: error.errors,
          missingFields 
        });
      }
      next(error);
    }
  });

  /**
   * @swagger
   * /api/auth/login:
   *   post:
   *     summary: User Login
   *     description: Authenticate user with phone number or email and password. Returns JWT token and comprehensive user info. Supports rate limiting for security.
   *     tags: [Authentication]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [identifier, password]
   *             properties:
   *               identifier:
   *                 type: string
   *                 description: Phone number or email address for authentication
   *                 example: "+2348123456789"
   *               password:
   *                 type: string
   *                 minLength: 6
   *                 description: User password
   *                 example: "userpass123"
   *     responses:
   *       200:
   *         description: Login successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Login successful"
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 token:
   *                   type: string
   *                   description: JWT authentication token (expires in 3 days by default)
   *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   *                 tokenExpiration:
   *                   type: string
   *                   example: "3 days"
   *                 user:
   *                   type: object
   *                   properties:
   *                     userId:
   *                       type: string
   *                       format: uuid
   *                       example: "e1234567-e89b-12d3-a456-426614174000"
   *                     id:
   *                       type: string
   *                       format: uuid
   *                       description: "Same as userId for backward compatibility"
   *                     firstName:
   *                       type: string
   *                       example: "John"
   *                     lastName:
   *                       type: string
   *                       example: "Doe"
   *                     fullName:
   *                       type: string
   *                       example: "John Doe"
   *                     email:
   *                       type: string
   *                       format: email
   *                       example: "john@example.com"
   *                     phone:
   *                       type: string
   *                       example: "+2348123456789"
   *                     userType:
   *                       type: string
   *                       enum: [farmer, buyer]
   *                       example: "buyer"
   *                     isVerified:
   *                       type: boolean
   *                       example: true
   *       401:
   *         description: Invalid credentials
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Invalid credentials"
   *                 type:
   *                   type: string
   *                   example: "invalid_credentials"
   *       403:
   *         description: Account not verified
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Account not verified. Please verify your phone number."
   *                 type:
   *                   type: string
   *                   example: "account_not_verified"
   *                 user:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                       format: uuid
   *                       example: "e1234567-e89b-12d3-a456-426614174000"
   *       429:
   *         description: Too many failed login attempts
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Too many failed attempts. Try again in 15 minutes."
   *                 type:
   *                   type: string
   *                   example: "rate_limit_exceeded"
   */
  app.post('/api/auth/login', async (req, res, next) => {
    try {
      const { identifier, password } = loginSchema.parse(req.body);
      
      // Enhanced login with comprehensive security and error handling
      const loginResult = await authService.loginUser(identifier, password);
      
      if (!loginResult.success) {
        // Handle different error scenarios with appropriate status codes
        if (loginResult.errorType === 'rate_limit_exceeded') {
          return res.status(429).json({ 
            message: loginResult.error,
            type: 'rate_limit_exceeded'
          });
        }
        
        if (loginResult.error?.includes('not verified')) {
          return res.status(403).json({ 
            message: loginResult.error,
            type: 'account_not_verified',
            user: loginResult.user
          });
        }
        
        return res.status(401).json({ 
          message: loginResult.error || 'Authentication failed',
          type: 'invalid_credentials'
        });
      }

      // Successful login response with comprehensive user information
      res.json({ 
        message: 'Login successful',
        success: true,
        token: loginResult.token,
        tokenExpiration: '8 hours', // Informational for frontend
        user: {
          userId: loginResult.user!.id,
          id: loginResult.user!.id, // Also include as 'id' for backward compatibility
          firstName: loginResult.user!.firstName,
          lastName: loginResult.user!.lastName,
          fullName: `${loginResult.user!.firstName} ${loginResult.user!.lastName}`,
          email: loginResult.user!.email,
          phone: loginResult.user!.phone,
          userType: loginResult.user!.userType,
          isVerified: loginResult.user!.isVerified
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: 'Invalid request data', 
          type: 'validation_error',
          errors: error.errors 
        });
      }
      console.error('Login error:', error);
      res.status(500).json({ 
        message: 'An internal server error occurred',
        type: 'server_error'
      });
    }
  });

  /**
   * @swagger
   * /api/auth/request-otp:
   *   post:
   *     summary: Request OTP Code
   *     description: Request a new OTP code for verification purposes
   *     tags: [Authentication, OTP]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [userId, type, purpose]
   *             properties:
   *               userId:
   *                 type: string
   *                 format: uuid
   *                 description: User ID
   *                 example: "e1234567-e89b-12d3-a456-426614174000"
   *               type:
   *                 type: string
   *                 enum: [sms]
   *                 description: OTP delivery method (SMS only)
   *                 example: "sms"
   *               purpose:
   *                 type: string
   *                 enum: [verification, login, password_reset]
   *                 description: Purpose of the OTP
   *                 example: "verification"
   *     responses:
   *       200:
   *         description: OTP sent successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "OTP sent successfully via sms"
   *       404:
   *         description: User not found
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       400:
   *         description: Validation error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  app.post('/api/auth/request-otp', async (req, res, next) => {
    try {
      const { userId, type, purpose } = requestOtpSchema.parse(req.body);
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Only SMS OTP is supported
      if (type !== 'sms') {
        return res.status(400).json({ message: 'Only SMS OTP is supported' });
      }
      
      await otpService.createAndSendOtp(userId, type, purpose, user.phone);

      res.json({ message: `OTP sent successfully via ${type}` });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      }
      next(error);
    }
  });

  /**
   * @swagger
   * /api/auth/verify-otp:
   *   post:
   *     summary: Verify OTP Code
   *     description: Verify OTP code for account verification. This completes the user verification process.
   *     tags: [Authentication, OTP]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [userId, code, type]
   *             properties:
   *               userId:
   *                 type: string
   *                 format: uuid
   *                 description: User ID from registration response
   *                 example: "e1234567-e89b-12d3-a456-426614174000"
   *               code:
   *                 type: string
   *                 minLength: 6
   *                 maxLength: 6
   *                 pattern: '^[0-9]{6}$'
   *                 description: 6-digit OTP code received via SMS
   *                 example: "123456"
   *               type:
   *                 type: string
   *                 enum: [sms]
   *                 description: OTP delivery method (SMS only)
   *                 example: "sms"
   *     responses:
   *       200:
   *         description: OTP verified successfully, user is now logged in
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "OTP verified successfully. You are now logged in."
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 token:
   *                   type: string
   *                   description: JWT authentication token
   *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   *                 tokenExpiration:
   *                   type: string
   *                   description: Token expiration information
   *                   example: "3 days"
   *                 user:
   *                   type: object
   *                   description: Complete user information
   *                   properties:
   *                     userId:
   *                       type: string
   *                       description: User's unique identifier
   *                       example: "123"
   *                     id:
   *                       type: string
   *                       description: User's unique identifier (backward compatibility)
   *                       example: "123"
   *                     firstName:
   *                       type: string
   *                       example: "John"
   *                     lastName:
   *                       type: string
   *                       example: "Doe"
   *                     fullName:
   *                       type: string
   *                       example: "John Doe"
   *                     email:
   *                       type: string
   *                       example: "john.doe@example.com"
   *                     phone:
   *                       type: string
   *                       example: "+2348123456789"
   *                     userType:
   *                       type: string
   *                       enum: [farmer, buyer]
   *                       example: "farmer"
   *                     isVerified:
   *                       type: boolean
   *                       example: true
   *       400:
   *         description: Invalid or expired OTP code
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Invalid or expired OTP code"
   *       404:
   *         description: User not found
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "User not found"
   */
  app.post('/api/auth/verify-otp', async (req, res, next) => {
    try {
      const { userId, code, type } = verifyOtpSchema.parse(req.body);
      
      const isValid = await otpService.verifyOtp(userId, code, type);
      if (!isValid) {
        return res.status(400).json({ message: 'Invalid or expired OTP code' });
      }

      // Get user and mark as verified if needed
      let user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (!user.isVerified) {
        await storage.updateUser(userId, { isVerified: true });
        // Get updated user data
        user = await storage.getUser(userId);
      }

      // Generate JWT token and create session for automatic login
      const token = authService.generateJWT({ userId: user!.id });
      await storage.createSession({
        userId: user!.id,
        token,
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000), // 8 hours
      });

      // Return same response structure as successful login
      res.json({ 
        message: 'OTP verified successfully. You are now logged in.',
        success: true,
        token,
        tokenExpiration: '8 hours', // Informational for frontend
        user: {
          userId: user!.id,
          id: user!.id, // Also include as 'id' for backward compatibility
          firstName: user!.firstName,
          lastName: user!.lastName,
          fullName: `${user!.firstName} ${user!.lastName}`,
          email: user!.email,
          phone: user!.phone,
          userType: user!.userType,
          isVerified: user!.isVerified
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      }
      next(error);
    }
  });

  /**
   * @swagger
   * /api/auth/forgot-password:
   *   post:
   *     summary: Request Password Reset
   *     description: Initiate password reset process by sending OTP to user's phone or email
   *     tags: [Authentication, Password Reset]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [identifier]
   *             properties:
   *               identifier:
   *                 type: string
   *                 description: Phone number or email address
   *                 example: "+2348123456789"
   *     responses:
   *       200:
   *         description: Password reset instructions sent (or generic success message)
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "If an account with this phone number or email exists, we will send verification instructions."
   *                 userId:
   *                   type: string
   *                   description: User ID (for next step - verify OTP)
   *                   example: "e1234567-e89b-12d3-a456-426614174000"
   *       400:
   *         description: Validation error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  app.post('/api/auth/forgot-password', async (req, res, next) => {
    try {
      const { identifier } = forgotPasswordSchema.parse(req.body);
      
      const result = await passwordResetService.requestPasswordReset(identifier);
      
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      }
      next(error);
    }
  });

  /**
   * @swagger
   * /api/auth/verify-reset-otp:
   *   post:
   *     summary: Verify Password Reset OTP
   *     description: Verify OTP code and receive password reset token
   *     tags: [Authentication, Password Reset]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [userId, code, type]
   *             properties:
   *               userId:
   *                 type: string
   *                 format: uuid
   *                 description: User ID from forgot-password response
   *                 example: "e1234567-e89b-12d3-a456-426614174000"
   *               code:
   *                 type: string
   *                 pattern: "^[0-9]{6}$"
   *                 description: 6-digit OTP code
   *                 example: "123456"
   *               type:
   *                 type: string
   *                 enum: [sms, email]
   *                 description: OTP delivery method
   *                 example: "sms"
   *     responses:
   *       200:
   *         description: OTP verified successfully, password reset token provided
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 token:
   *                   type: string
   *                   description: Password reset token (valid for 1 hour)
   *                   example: "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456"
   *                 message:
   *                   type: string
   *                   example: "Verification successful. You can now reset your password."
   *       400:
   *         description: Invalid or expired OTP code
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  app.post('/api/auth/verify-reset-otp', async (req, res, next) => {
    try {
      const { userId, code, type } = verifyOtpSchema.parse(req.body);
      
      const result = await passwordResetService.verifyResetOtp(userId, code, type);
      
      if (!result.success) {
        return res.status(400).json({ 
          message: result.message,
          type: 'verification_failed'
        });
      }
      
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      }
      next(error);
    }
  });

  /**
   * @swagger
   * /api/auth/reset-password:
   *   post:
   *     summary: Reset Password with Token
   *     description: Reset user password using valid reset token
   *     tags: [Authentication, Password Reset]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [token, password, confirmPassword]
   *             properties:
   *               token:
   *                 type: string
   *                 description: Password reset token from verify-reset-otp
   *                 example: "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456"
   *               password:
   *                 type: string
   *                 minLength: 6
   *                 description: New password
   *                 example: "newSecurePassword123"
   *               confirmPassword:
   *                 type: string
   *                 minLength: 6
   *                 description: Confirm new password (must match password)
   *                 example: "newSecurePassword123"
   *     responses:
   *       200:
   *         description: Password reset successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "Password reset successfully. Please login with your new password."
   *       400:
   *         description: Invalid token or password validation error
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   */
  app.post('/api/auth/reset-password', async (req, res, next) => {
    try {
      const { token, password } = resetPasswordSchema.parse(req.body);
      
      const result = await passwordResetService.resetPassword(token, password);
      
      if (!result.success) {
        return res.status(400).json({ 
          message: result.message,
          type: result.message.includes('expired') ? 'token_expired' : 'reset_failed'
        });
      }
      
      res.json({ 
        success: result.success,
        message: result.message
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      }
      next(error);
    }
  });

  /**
   * @swagger
   * /api/auth/validate-reset-token/{token}:
   *   get:
   *     summary: Validate Password Reset Token
   *     description: Check if a password reset token is valid and not expired
   *     tags: [Authentication, Password Reset]
   *     parameters:
   *       - in: path
   *         name: token
   *         required: true
   *         schema:
   *           type: string
   *         description: Password reset token to validate
   *         example: "a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456"
   *     responses:
   *       200:
   *         description: Token is valid
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 valid:
   *                   type: boolean
   *                   example: true
   *                 message:
   *                   type: string
   *                   example: "Token is valid"
   *       400:
   *         description: Token is invalid or expired
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 valid:
   *                   type: boolean
   *                   example: false
   *                 message:
   *                   type: string
   *                   example: "Invalid or expired reset token"
   */
  app.get('/api/auth/validate-reset-token/:token', async (req, res, next) => {
    try {
      const { token } = req.params;
      
      if (!token) {
        return res.status(400).json({ 
          valid: false, 
          message: 'Token is required' 
        });
      }
      
      const result = await passwordResetService.validateResetToken(token);
      
      const statusCode = result.valid ? 200 : 400;
      res.status(statusCode).json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/auth/rate-limit-info/{identifier}:
   *   get:
   *     summary: Get Rate Limit Information (Admin)
   *     description: Get current rate limiting status for a specific identifier
   *     tags: [Authentication, Rate Limiting]
   *     parameters:
   *       - in: path
   *         name: identifier
   *         required: true
   *         schema:
   *           type: string
   *         description: Phone number or email to check
   *         example: "test@example.com"
   *     responses:
   *       200:
   *         description: Rate limit information
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 identifier:
   *                   type: string
   *                   example: "test@example.com"
   *                 attempts:
   *                   type: number
   *                   example: 3
   *                 isLocked:
   *                   type: boolean
   *                   example: false
   *                 lockTimeRemaining:
   *                   type: number
   *                   description: Minutes remaining until unlock
   *                   example: 12
   *                 maxAttempts:
   *                   type: number
   *                   example: 5
   *                 lockTimeMinutes:
   *                   type: number
   *                   example: 15
   */
  app.get('/api/auth/rate-limit-info/:identifier', async (req, res, next) => {
    try {
      const { identifier } = req.params;
      
      if (!identifier) {
        return res.status(400).json({ 
          message: 'Identifier is required' 
        });
      }
      
      const rateLimitInfo = authService.getRateLimitInfo(identifier);
      
      res.json({
        identifier,
        ...rateLimitInfo
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/auth/rate-limit-config:
   *   get:
   *     summary: Get Rate Limiting Configuration
   *     description: Get current rate limiting settings
   *     tags: [Authentication, Rate Limiting]
   *     responses:
   *       200:
   *         description: Rate limiting configuration
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 maxAttempts:
   *                   type: number
   *                   example: 5
   *                 lockTimeMinutes:
   *                   type: number
   *                   example: 15
   *                 description:
   *                   type: string
   *                   example: "Users are locked out for 15 minutes after 5 failed login attempts"
   */
  app.get('/api/auth/rate-limit-config', async (req, res, next) => {
    try {
      const config = authService.getRateLimitConfig();
      res.json(config);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/auth/logout:
   *   post:
   *     summary: User Logout
   *     description: Invalidate the current session token and log out the user
   *     tags: [Authentication]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Logout successful
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Logged out successfully"
   *       401:
   *         description: Unauthorized - token required
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Access token required"
   */
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
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Access token required"
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

  // ================================
  // PLANT MANAGEMENT ROUTES
  // ================================

  /**
   * @swagger
   * /api/plants:
   *   get:
   *     summary: Get All Plants
   *     description: Retrieve a list of all available plants that can be grown by farmers
   *     tags: [Plants]
   *     responses:
   *       200:
   *         description: List of plants retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   id:
   *                     type: string
   *                     example: "plant-123"
   *                   name:
   *                     type: string
   *                     example: "Tomato"
   *                   description:
   *                     type: string
   *                     example: "Nutritious red fruit, great for cooking"
   *                   category:
   *                     type: string
   *                     example: "vegetables"
   *                   growthDuration:
   *                     type: string
   *                     example: "3-4 months"
   *                   isActive:
   *                     type: boolean
   *                     example: true
   *                   createdAt:
   *                     type: string
   *                     format: date-time
   */
  app.get('/api/plants', async (req, res, next) => {
    try {
      const plants = await storage.getPlants();
      res.json(plants);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/plants/{plantId}/questions:
   *   get:
   *     summary: Get Questions for a Plant
   *     description: Retrieve all questions and options for a specific plant
   *     tags: [Plants]
   *     parameters:
   *       - in: path
   *         name: plantId
   *         required: true
   *         schema:
   *           type: string
   *         description: Plant ID
   *         example: "plant-123"
   *     responses:
   *       200:
   *         description: Plant questions retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   id:
   *                     type: string
   *                     example: "question-456"
   *                   plantId:
   *                     type: string
   *                     example: "plant-123"
   *                   question:
   *                     type: string
   *                     example: "How do you process your tomatoes after harvest?"
   *                   questionType:
   *                     type: string
   *                     enum: [multiple_choice, checkbox, text]
   *                     example: "checkbox"
   *                   options:
   *                     type: array
   *                     items:
   *                       type: object
   *                       properties:
   *                         value:
   *                           type: string
   *                           example: "drying"
   *                         label:
   *                           type: string
   *                           example: "Sun drying"
   *                   isRequired:
   *                     type: boolean
   *                     example: true
   *                   category:
   *                     type: string
   *                     example: "processing"
   *                   orderIndex:
   *                     type: number
   *                     example: 1
   *       404:
   *         description: Plant not found
   */
  app.get('/api/plants/:plantId/questions', async (req, res, next) => {
    try {
      const { plantId } = req.params;
      
      const plant = await storage.getPlant(plantId);
      if (!plant) {
        return res.status(404).json({ message: 'Plant not found' });
      }

      const questions = await storage.getPlantQuestions(plantId);
      res.json(questions);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/farmer/plants:
   *   get:
   *     summary: Get Farmer's Plants
   *     description: Retrieve all plants selected by the authenticated farmer
   *     tags: [Farmer Plants]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Farmer's plants retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   id:
   *                     type: string
   *                     example: "farmer-plant-789"
   *                   farmerId:
   *                     type: string
   *                     example: "farmer-123"
   *                   plantId:
   *                     type: string
   *                     example: "plant-123"
   *                   landSize:
   *                     type: string
   *                     example: "2 acres"
   *                   notes:
   *                     type: string
   *                     example: "Located in the north field"
   *                   plant:
   *                     type: object
   *                     properties:
   *                       name:
   *                         type: string
   *                         example: "Tomato"
   *                       category:
   *                         type: string
   *                         example: "vegetables"
   *       401:
   *         description: Unauthorized - token required
   */
  app.get('/api/farmer/plants', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      
      if (user.userType !== 'farmer') {
        return res.status(403).json({ message: 'Only farmers can access this endpoint' });
      }

      const farmerPlants = await storage.getFarmerPlants(user.id);
      res.json(farmerPlants);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/farmer/plants:
   *   post:
   *     summary: Add Plant to Farmer's Farm
   *     description: Add a plant to the authenticated farmer's farm with optional details
   *     tags: [Farmer Plants]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [plantId]
   *             properties:
   *               plantId:
   *                 type: string
   *                 description: ID of the plant to add
   *                 example: "plant-123"
   *               landSize:
   *                 type: string
   *                 description: Size of land dedicated to this plant
   *                 example: "2 acres"
   *               notes:
   *                 type: string
   *                 description: Additional notes about growing this plant
   *                 example: "Located in the north field, good soil quality"
   *     responses:
   *       201:
   *         description: Plant added successfully
   *       400:
   *         description: Validation error or plant already added
   *       401:
   *         description: Unauthorized - token required
   *       403:
   *         description: Only farmers can add plants
   *       404:
   *         description: Plant not found
   */
  app.post('/api/farmer/plants', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      
      if (user.userType !== 'farmer') {
        return res.status(403).json({ message: 'Only farmers can access this endpoint' });
      }

      const validatedData = insertFarmerPlantSchema.parse({
        ...req.body,
        farmerId: user.id
      });

      // Check if plant exists
      const plant = await storage.getPlant(validatedData.plantId);
      if (!plant) {
        return res.status(404).json({ message: 'Plant not found' });
      }

      // Check if farmer already has this plant
      const existingFarmerPlants = await storage.getFarmerPlants(user.id);
      const alreadyAdded = existingFarmerPlants.some(fp => fp.plantId === validatedData.plantId);
      
      if (alreadyAdded) {
        return res.status(400).json({ message: 'Plant already added to your farm' });
      }

      const farmerPlant = await storage.addFarmerPlant(validatedData);
      res.status(201).json({ 
        message: 'Plant added to your farm successfully',
        farmerPlant 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      }
      next(error);
    }
  });

  /**
   * @swagger
   * /api/farmer/plants/{plantId}:
   *   delete:
   *     summary: Remove Plant from Farmer's Farm
   *     description: Remove a plant from the authenticated farmer's farm
   *     tags: [Farmer Plants]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: plantId
   *         required: true
   *         schema:
   *           type: string
   *         description: Plant ID to remove
   *     responses:
   *       200:
   *         description: Plant removed successfully
   *       401:
   *         description: Unauthorized - token required
   *       403:
   *         description: Only farmers can remove plants
   *       404:
   *         description: Plant not found in farmer's collection
   */
  app.delete('/api/farmer/plants/:plantId', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      const { plantId } = req.params;
      
      if (user.userType !== 'farmer') {
        return res.status(403).json({ message: 'Only farmers can access this endpoint' });
      }

      await storage.removeFarmerPlant(user.id, plantId);
      res.json({ message: 'Plant removed from your farm successfully' });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/farmer/answers:
   *   get:
   *     summary: Get Farmer's Answers
   *     description: Retrieve all answers provided by the authenticated farmer for plant questions
   *     tags: [Farmer Answers]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: query
   *         name: plantId
   *         schema:
   *           type: string
   *         description: Filter answers by plant ID (optional)
   *     responses:
   *       200:
   *         description: Farmer's answers retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: array
   *               items:
   *                 type: object
   *                 properties:
   *                   id:
   *                     type: string
   *                   farmerId:
   *                     type: string
   *                   plantId:
   *                     type: string
   *                   questionId:
   *                     type: string
   *                   answer:
   *                     oneOf:
   *                       - type: string
   *                       - type: array
   *                         items:
   *                           type: string
   *                   customAnswer:
   *                     type: string
   *                   question:
   *                     type: object
   *                     properties:
   *                       question:
   *                         type: string
   *                       questionType:
   *                         type: string
   *       401:
   *         description: Unauthorized - token required
   */
  app.get('/api/farmer/answers', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      const { plantId } = req.query;
      
      if (user.userType !== 'farmer') {
        return res.status(403).json({ message: 'Only farmers can access this endpoint' });
      }

      const answers = await storage.getFarmerAnswers(user.id, plantId as string);
      res.json(answers);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/farmer/answers:
   *   post:
   *     summary: Submit Plant Question Answers
   *     description: Submit or update answers for plant questions
   *     tags: [Farmer Answers]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [plantId, questionId, answer]
   *             properties:
   *               plantId:
   *                 type: string
   *                 description: ID of the plant the question relates to
   *                 example: "plant-123"
   *               questionId:
   *                 type: string
   *                 description: ID of the question being answered
   *                 example: "question-456"
   *               answer:
   *                 oneOf:
   *                   - type: string
   *                     description: Single answer for text or single-choice questions
   *                     example: "We use traditional sun drying methods"
   *                   - type: array
   *                     items:
   *                       type: string
   *                     description: Multiple answers for checkbox questions
   *                     example: ["drying", "canning", "fresh_sale"]
   *               customAnswer:
   *                 type: string
   *                 description: Additional details for "Others" option
   *                 example: "We also use a special family recipe for preservation"
   *     responses:
   *       201:
   *         description: Answer submitted successfully
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized - token required
   *       403:
   *         description: Only farmers can submit answers
   *       404:
   *         description: Plant or question not found
   */
  app.post('/api/farmer/answers', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      
      if (user.userType !== 'farmer') {
        return res.status(403).json({ message: 'Only farmers can access this endpoint' });
      }

      const validatedData = insertFarmerAnswerSchema.parse({
        ...req.body,
        farmerId: user.id
      });

      // Check if plant exists and farmer has selected it
      const farmerPlants = await storage.getFarmerPlants(user.id);
      const hasPlant = farmerPlants.some(fp => fp.plantId === validatedData.plantId);
      
      if (!hasPlant) {
        return res.status(404).json({ 
          message: 'Plant not found in your farm. Please add the plant first.' 
        });
      }

      // Check if question exists for this plant
      const questions = await storage.getPlantQuestions(validatedData.plantId);
      const questionExists = questions.some(q => q.id === validatedData.questionId);
      
      if (!questionExists) {
        return res.status(404).json({ message: 'Question not found for this plant' });
      }

      const answer = await storage.createFarmerAnswer(validatedData);
      res.status(201).json({ 
        message: 'Answer submitted successfully',
        answer 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      }
      next(error);
    }
  });

  /**
   * @swagger
   * /api/farmer/plants/questions:
   *   post:
   *     summary: Get Questions for Selected Plants
   *     description: Submit an array of plant IDs and get back all questions for those plants
   *     tags: [Farmer Plants]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [plantIds]
   *             properties:
   *               plantIds:
   *                 type: array
   *                 items:
   *                   type: string
   *                 description: Array of plant IDs to get questions for
   *                 example: ["plant-tomato", "plant-maize", "plant-cassava"]
   *     responses:
   *       200:
   *         description: Questions retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 questions:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       plantId:
   *                         type: string
   *                       plantName:
   *                         type: string
   *                       questions:
   *                         type: array
   *                         items:
   *                           type: object
   *                           properties:
   *                             id:
   *                               type: string
   *                             question:
   *                               type: string
   *                             questionType:
   *                               type: string
   *                             options:
   *                               type: array
   *                             isRequired:
   *                               type: boolean
   *                             category:
   *                               type: string
   *       400:
   *         description: Validation error or no plants provided
   *       401:
   *         description: Unauthorized - token required
   *       403:
   *         description: Only farmers can access this endpoint
   */
  app.post('/api/farmer/plants/questions', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      
      if (user.userType !== 'farmer') {
        return res.status(403).json({ message: 'Only farmers can access this endpoint' });
      }

      const { plantIds } = req.body;
      
      if (!Array.isArray(plantIds) || plantIds.length === 0) {
        return res.status(400).json({ message: 'plantIds must be a non-empty array' });
      }

      // Get all questions for the selected plants
      const questionsData = [];
      
      for (const plantId of plantIds) {
        const plant = await storage.getPlant(plantId);
        if (!plant) {
          continue; // Skip invalid plant IDs
        }
        
        const questions = await storage.getPlantQuestions(plantId);
        questionsData.push({
          plantId: plant.id,
          plantName: plant.name,
          questions: questions
        });
      }

      res.json({ questions: questionsData });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/farmer/answers/bulk:
   *   post:
   *     summary: Submit Multiple Answers at Once
   *     description: Submit answers for multiple questions across different plants in a single request
   *     tags: [Farmer Answers]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [answers]
   *             properties:
   *               answers:
   *                 type: array
   *                 items:
   *                   type: object
   *                   required: [plantId, questionId, answer]
   *                   properties:
   *                     plantId:
   *                       type: string
   *                       description: ID of the plant the question relates to
   *                       example: "plant-tomato"
   *                     questionId:
   *                       type: string
   *                       description: ID of the question being answered
   *                       example: "q-tomato-processing"
   *                     answer:
   *                       oneOf:
   *                         - type: string
   *                           description: Single answer for text or single-choice questions
   *                           example: "We use traditional sun drying methods"
   *                         - type: array
   *                           items:
   *                             type: string
   *                           description: Multiple answers for checkbox questions
   *                           example: ["drying", "canning", "fresh_sale"]
   *                     customAnswer:
   *                       type: string
   *                       description: Additional details for "Others" option
   *                       example: "We also use a special family recipe for preservation"
   *                 example:
   *                   - plantId: "plant-tomato"
   *                     questionId: "q-tomato-processing"
   *                     answer: ["fresh_sale", "sun_drying"]
   *                     customAnswer: "We also make tomato paste for local market"
   *                   - plantId: "plant-maize"
   *                     questionId: "q-maize-storage"
   *                     answer: "traditional_barn"
   *     responses:
   *       200:
   *         description: All answers submitted successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "All answers submitted successfully"
   *                 processed:
   *                   type: number
   *                   description: Number of answers processed
   *                   example: 5
   *                 results:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       plantId:
   *                         type: string
   *                       questionId:
   *                         type: string
   *                       status:
   *                         type: string
   *                         enum: [success, error, skipped]
   *                       message:
   *                         type: string
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized - token required
   *       403:
   *         description: Only farmers can submit answers
   */
  app.post('/api/farmer/answers/bulk', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      
      if (user.userType !== 'farmer') {
        return res.status(403).json({ message: 'Only farmers can submit answers' });
      }

      const { answers } = req.body;
      
      if (!Array.isArray(answers) || answers.length === 0) {
        return res.status(400).json({ message: 'answers must be a non-empty array' });
      }

      // Get farmer's plants to validate they can answer questions for these plants
      const farmerPlants = await storage.getFarmerPlants(user.id);
      const farmerPlantIds = farmerPlants.map(fp => fp.plantId);

      const results = [];
      let processedCount = 0;

      for (const answerData of answers) {
        try {
          const { plantId, questionId, answer, customAnswer } = answerData;

          // Validate required fields
          if (!plantId || !questionId || answer === undefined) {
            results.push({
              plantId,
              questionId,
              status: 'error',
              message: 'Missing required fields: plantId, questionId, or answer'
            });
            continue;
          }

          // Check if farmer has selected this plant
          if (!farmerPlantIds.includes(plantId)) {
            results.push({
              plantId,
              questionId,
              status: 'skipped',
              message: 'Plant not found in your farm. Please add the plant first.'
            });
            continue;
          }

          // Check if question exists for this plant
          const questions = await storage.getPlantQuestions(plantId);
          const questionExists = questions.some(q => q.id === questionId);
          
          if (!questionExists) {
            results.push({
              plantId,
              questionId,
              status: 'error',
              message: 'Question not found for this plant'
            });
            continue;
          }

          // Validate and create the answer
          const validatedAnswer = insertFarmerAnswerSchema.parse({
            farmerId: user.id,
            plantId,
            questionId,
            answer,
            customAnswer
          });

          await storage.createFarmerAnswer(validatedAnswer);
          
          results.push({
            plantId,
            questionId,
            status: 'success',
            message: 'Answer submitted successfully'
          });
          processedCount++;

        } catch (error) {
          results.push({
            plantId: answerData.plantId,
            questionId: answerData.questionId,
            status: 'error',
            message: error instanceof z.ZodError ? 'Validation failed' : 'Failed to save answer'
          });
        }
      }

      res.json({
        message: `Processed ${processedCount} answers successfully`,
        processed: processedCount,
        results: results
      });
    } catch (error) {
      next(error);
    }
  });

  // ================================
  // USER NOTIFICATION PREFERENCES ROUTES
  // ================================

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
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 id:
   *                   type: string
   *                   example: "pref-123"
   *                 userId:
   *                   type: string
   *                   example: "user-456"
   *                 smsEnabled:
   *                   type: boolean
   *                   example: true
   *                 emailEnabled:
   *                   type: boolean
   *                   example: true
   *                 whatsappEnabled:
   *                   type: boolean
   *                   example: false
   *                 inAppEnabled:
   *                   type: boolean
   *                   example: true
   *                 createdAt:
   *                   type: string
   *                   format: date-time
   *                 updatedAt:
   *                   type: string
   *                   format: date-time
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
   *           example:
   *             smsEnabled: true
   *             emailEnabled: true
   *             whatsappEnabled: false
   *             inAppEnabled: true
   *     responses:
   *       200:
   *         description: Preferences updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "Notification preferences updated successfully"
   *                 preferences:
   *                   type: object
   *                   properties:
   *                     id:
   *                       type: string
   *                     userId:
   *                       type: string
   *                     smsEnabled:
   *                       type: boolean
   *                     emailEnabled:
   *                       type: boolean
   *                     whatsappEnabled:
   *                       type: boolean
   *                     inAppEnabled:
   *                       type: boolean
   *                     createdAt:
   *                       type: string
   *                       format: date-time
   *                     updatedAt:
   *                       type: string
   *                       format: date-time
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
      
      // Security fix: Only accept preferences from body, never userId
      const bodyData = insertUserNotificationPreferencesSchema.parse(req.body);
      const validatedData = {
        ...bodyData,
        userId: user.id // Inject userId from authenticated session only
      };

      const preferences = await storage.createOrUpdateUserNotificationPreferences(validatedData);
      
      // Check if this was a creation or update
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

  // ================================
  // E-COMMERCE: FARMER CROP MANAGEMENT ROUTES
  // ================================

  /**
   * @swagger
   * /api/farmer/crops:
   *   post:
   *     summary: Create or Update Farmer Crop (Idempotent)
   *     description: Create a new crop listing or update an existing one for the authenticated farmer
   *     tags: [Farmer - Crops]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [plantId, totalQuantity, unit, pricePerUnit, harvestDate, state, lga]
   *             properties:
   *               plantId:
   *                 type: string
   *                 example: "plant-maize"
   *               totalQuantity:
   *                 type: integer
   *                 minimum: 1
   *                 example: 100
   *               unit:
   *                 type: string
   *                 enum: [bags, baskets, kg]
   *                 example: "bags"
   *               pricePerUnit:
   *                 type: integer
   *                 minimum: 1
   *                 description: Price in cents
   *                 example: 5000
   *               harvestDate:
   *                 type: string
   *                 format: date-time
   *                 example: "2024-03-15T00:00:00Z"
   *               state:
   *                 type: string
   *                 example: "Lagos"
   *               lga:
   *                 type: string
   *                 example: "Ikeja"
   *               farmAddress:
   *                 type: string
   *                 example: "Plot 123, Farm Road, Ikeja"
   *               description:
   *                 type: string
   *                 example: "High-quality maize, organic farming"
   *     responses:
   *       201:
   *         description: Crop created successfully
   *       200:
   *         description: Crop updated successfully
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized
   */
  app.post('/api/farmer/crops', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      if (user.userType !== 'farmer') {
        return res.status(403).json({ message: 'Access denied. Farmer account required.' });
      }

      const validatedData = insertFarmerCropSchema.parse(req.body);
      const crop = await storage.createFarmerCrop(user.id, validatedData);
      
      res.status(201).json({
        message: 'Crop created successfully',
        crop
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      }
      next(error);
    }
  });

  /**
   * @swagger
   * /api/farmer/crops:
   *   get:
   *     summary: Get Farmer's Crops (Paginated)
   *     description: Retrieve all crops for the authenticated farmer with pagination
   *     tags: [Farmer - Crops]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: page
   *         in: query
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *       - name: limit
   *         in: query
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 20
   *     responses:
   *       200:
   *         description: Crops retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 crops:
   *                   type: array
   *                   items:
   *                     type: object
   *                 total:
   *                   type: integer
   *                 page:
   *                   type: integer
   *                 totalPages:
   *                   type: integer
   *       401:
   *         description: Unauthorized
   */
  app.get('/api/farmer/crops', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      if (user.userType !== 'farmer') {
        return res.status(403).json({ message: 'Access denied. Farmer account required.' });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await storage.getFarmerCrops(user.id, page, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/farmer/crops/{cropId}:
   *   get:
   *     summary: Get Single Farmer Crop
   *     description: Retrieve a specific crop by ID for the authenticated farmer
   *     tags: [Farmer - Crops]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: cropId
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Crop retrieved successfully
   *       404:
   *         description: Crop not found
   *       401:
   *         description: Unauthorized
   */
  app.get('/api/farmer/crops/:cropId', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      if (user.userType !== 'farmer') {
        return res.status(403).json({ message: 'Access denied. Farmer account required.' });
      }

      const crop = await storage.getFarmerCrop(req.params.cropId, user.id);
      if (!crop) {
        return res.status(404).json({ message: 'Crop not found' });
      }

      res.json({ crop });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/farmer/crops/{cropId}:
   *   put:
   *     summary: Update Farmer Crop
   *     description: Update an existing crop for the authenticated farmer
   *     tags: [Farmer - Crops]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: cropId
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               totalQuantity:
   *                 type: integer
   *                 minimum: 1
   *               pricePerUnit:
   *                 type: integer
   *                 minimum: 1
   *               harvestDate:
   *                 type: string
   *                 format: date-time
   *               description:
   *                 type: string
   *     responses:
   *       200:
   *         description: Crop updated successfully
   *       404:
   *         description: Crop not found
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized
   */
  app.put('/api/farmer/crops/:cropId', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      if (user.userType !== 'farmer') {
        return res.status(403).json({ message: 'Access denied. Farmer account required.' });
      }

      const updates = req.body;
      const crop = await storage.updateFarmerCrop(req.params.cropId, user.id, updates);
      
      if (!crop) {
        return res.status(404).json({ message: 'Crop not found' });
      }

      res.json({
        message: 'Crop updated successfully',
        crop
      });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/farmer/crops/{cropId}:
   *   delete:
   *     summary: Delete Farmer Crop
   *     description: Delete (deactivate) a crop for the authenticated farmer
   *     tags: [Farmer - Crops]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: cropId
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Crop deleted successfully
   *       404:
   *         description: Crop not found
   *       401:
   *         description: Unauthorized
   */
  app.delete('/api/farmer/crops/:cropId', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      if (user.userType !== 'farmer') {
        return res.status(403).json({ message: 'Access denied. Farmer account required.' });
      }

      const success = await storage.deleteFarmerCrop(req.params.cropId, user.id);
      
      if (!success) {
        return res.status(404).json({ message: 'Crop not found' });
      }

      res.json({ message: 'Crop deleted successfully' });
    } catch (error) {
      next(error);
    }
  });

  // ================================
  // E-COMMERCE: FARMER ORDER MANAGEMENT ROUTES
  // ================================

  /**
   * @swagger
   * /api/farmer/orders:
   *   get:
   *     summary: Get Farmer Orders (Paginated)
   *     description: Retrieve orders for the authenticated farmer's crops
   *     tags: [Farmer - Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: status
   *         in: query
   *         schema:
   *           type: string
   *           enum: [pending, confirmed, delivered, cancelled]
   *         description: Filter by order status
   *       - name: page
   *         in: query
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *       - name: limit
   *         in: query
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 20
   *     responses:
   *       200:
   *         description: Orders retrieved successfully
   *       401:
   *         description: Unauthorized
   */
  app.get('/api/farmer/orders', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      if (user.userType !== 'farmer') {
        return res.status(403).json({ message: 'Access denied. Farmer account required.' });
      }

      const status = req.query.status as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await storage.getFarmerOrders(user.id, status, page, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/farmer/orders/{orderId}:
   *   get:
   *     summary: Get Single Farmer Order
   *     description: Retrieve a specific order by ID for the authenticated farmer
   *     tags: [Farmer - Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: orderId
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Order retrieved successfully
   *       404:
   *         description: Order not found
   *       401:
   *         description: Unauthorized
   */
  app.get('/api/farmer/orders/:orderId', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      if (user.userType !== 'farmer') {
        return res.status(403).json({ message: 'Access denied. Farmer account required.' });
      }

      const order = await storage.getFarmerOrder(req.params.orderId, user.id);
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }

      res.json({ order });
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/farmer/orders/{orderId}/deliver:
   *   post:
   *     summary: Mark Order as Delivered
   *     description: Mark an order as delivered by the authenticated farmer
   *     tags: [Farmer - Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: orderId
   *         in: path
   *         required: true
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: Order marked as delivered successfully
   *       404:
   *         description: Order not found
   *       401:
   *         description: Unauthorized
   */
  app.post('/api/farmer/orders/:orderId/deliver', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      if (user.userType !== 'farmer') {
        return res.status(403).json({ message: 'Access denied. Farmer account required.' });
      }

      const order = await storage.markOrderAsDelivered(req.params.orderId, user.id);
      
      if (!order) {
        return res.status(404).json({ message: 'Order not found' });
      }

      res.json({
        message: 'Order marked as delivered successfully',
        order
      });
    } catch (error) {
      next(error);
    }
  });

  // ================================
  // E-COMMERCE: BUYER ROUTES
  // ================================

  /**
   * @swagger
   * /api/buyer/crops/search:
   *   get:
   *     summary: Search Available Crops
   *     description: Search for available crops with filters
   *     tags: [Buyer - Browse]
   *     parameters:
   *       - name: query
   *         in: query
   *         schema:
   *           type: string
   *         description: Search query (crop name or description)
   *       - name: plantCategory
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter by plant category ID
   *       - name: state
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter by state
   *       - name: lga
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter by LGA
   *       - name: minPrice
   *         in: query
   *         schema:
   *           type: integer
   *           minimum: 0
   *         description: Minimum price per unit (in cents)
   *       - name: maxPrice
   *         in: query
   *         schema:
   *           type: integer
   *           minimum: 0
   *         description: Maximum price per unit (in cents)
   *       - name: unit
   *         in: query
   *         schema:
   *           type: string
   *           enum: [bags, baskets, kg]
   *         description: Filter by unit type
   *       - name: page
   *         in: query
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *       - name: limit
   *         in: query
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 20
   *     responses:
   *       200:
   *         description: Crops retrieved successfully
   *       400:
   *         description: Invalid search parameters
   */
  app.get('/api/buyer/crops/search', async (req, res, next) => {
    try {
      const searchParams = cropSearchSchema.parse({
        ...req.query,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 20,
        minPrice: req.query.minPrice ? parseInt(req.query.minPrice as string) : undefined,
        maxPrice: req.query.maxPrice ? parseInt(req.query.maxPrice as string) : undefined,
      });

      const result = await storage.searchAvailableCrops(searchParams);
      res.json(result);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Invalid search parameters', errors: error.errors });
      }
      next(error);
    }
  });

  /**
   * @swagger
   * /api/buyer/crops/available:
   *   get:
   *     summary: Get Available Crops for Sale
   *     description: Get all crops that are currently available for purchase (already harvested)
   *     tags: [Buyer - Browse]
   *     parameters:
   *       - name: plantCategory
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter by plant category ID
   *       - name: page
   *         in: query
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *       - name: limit
   *         in: query
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 20
   *     responses:
   *       200:
   *         description: Available crops retrieved successfully
   */
  app.get('/api/buyer/crops/available', async (req, res, next) => {
    try {
      const plantCategory = req.query.plantCategory as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await storage.getAvailableCropsByCategory(plantCategory, page, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/buyer/crops/soon-ready:
   *   get:
   *     summary: Get Soon-to-be-Harvested Crops
   *     description: Get crops that are not yet ready for harvest but will be soon
   *     tags: [Buyer - Browse]
   *     parameters:
   *       - name: plantCategory
   *         in: query
   *         schema:
   *           type: string
   *         description: Filter by plant category ID
   *       - name: page
   *         in: query
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *       - name: limit
   *         in: query
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 20
   *     responses:
   *       200:
   *         description: Soon-to-be-ready crops retrieved successfully
   */
  app.get('/api/buyer/crops/soon-ready', async (req, res, next) => {
    try {
      const plantCategory = req.query.plantCategory as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await storage.getSoonToBeHarvestedCrops(plantCategory, page, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/buyer/orders:
   *   post:
   *     summary: Place Crop Order
   *     description: Place an order for a crop as an authenticated buyer
   *     tags: [Buyer - Orders]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [cropId, quantityOrdered, deliveryAddress, deliveryState, deliveryLga]
   *             properties:
   *               cropId:
   *                 type: string
   *                 example: "crop-123"
   *               quantityOrdered:
   *                 type: integer
   *                 minimum: 1
   *                 example: 10
   *               deliveryFee:
   *                 type: integer
   *                 minimum: 0
   *                 default: 0
   *                 description: Delivery fee in cents
   *                 example: 5000
   *               deliveryAddress:
   *                 type: string
   *                 example: "123 Main Street, Victoria Island"
   *               deliveryState:
   *                 type: string
   *                 example: "Lagos"
   *               deliveryLga:
   *                 type: string
   *                 example: "Lagos Island"
   *               deliveryNote:
   *                 type: string
   *                 example: "Please call before delivery"
   *     responses:
   *       201:
   *         description: Order placed successfully
   *       400:
   *         description: Validation error or insufficient stock
   *       401:
   *         description: Unauthorized
   */
  app.post('/api/buyer/orders', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      if (user.userType !== 'buyer') {
        return res.status(403).json({ message: 'Access denied. Buyer account required.' });
      }

      const validatedData = insertCropOrderSchema.parse(req.body);
      
      // Check if crop exists and has sufficient quantity
      const crop = await storage.getFarmerCrop(validatedData.cropId);
      if (!crop) {
        return res.status(400).json({ message: 'Crop not found' });
      }
      
      if (crop.availableQuantity < validatedData.quantityOrdered) {
        return res.status(400).json({ 
          message: 'Insufficient stock available',
          available: crop.availableQuantity,
          requested: validatedData.quantityOrdered
        });
      }

      const order = await storage.createCropOrder(user.id, validatedData);
      
      res.status(201).json({
        message: 'Order placed successfully',
        order
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      }
      next(error);
    }
  });

  /**
   * @swagger
   * /api/buyer/orders:
   *   get:
   *     summary: Get Buyer Orders (Paginated)
   *     description: Retrieve orders for the authenticated buyer
   *     tags: [Buyer - Orders]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: status
   *         in: query
   *         schema:
   *           type: string
   *           enum: [pending, confirmed, delivered, cancelled]
   *         description: Filter by order status
   *       - name: page
   *         in: query
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *       - name: limit
   *         in: query
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 20
   *     responses:
   *       200:
   *         description: Orders retrieved successfully
   *       401:
   *         description: Unauthorized
   */
  app.get('/api/buyer/orders', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      if (user.userType !== 'buyer') {
        return res.status(403).json({ message: 'Access denied. Buyer account required.' });
      }

      const status = req.query.status as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await storage.getBuyerOrders(user.id, status, page, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  /**
   * @swagger
   * /api/buyer/notifications:
   *   post:
   *     summary: Notify Buyer About Crop
   *     description: Subscribe to notifications for when a specific crop becomes ready
   *     tags: [Buyer - Notifications]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [cropId, message, notificationType]
   *             properties:
   *               cropId:
   *                 type: string
   *                 example: "crop-123"
   *               message:
   *                 type: string
   *                 example: "Please notify me when this crop is ready"
   *               notificationType:
   *                 type: string
   *                 enum: [crop_ready, price_change, quantity_update]
   *                 example: "crop_ready"
   *     responses:
   *       201:
   *         description: Notification subscription created successfully
   *       400:
   *         description: Validation error
   *       401:
   *         description: Unauthorized
   */
  app.post('/api/buyer/notifications', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      if (user.userType !== 'buyer') {
        return res.status(403).json({ message: 'Access denied. Buyer account required.' });
      }

      const validatedData = insertCropNotificationSchema.parse(req.body);
      
      // Get crop to find farmer ID
      const crop = await storage.getFarmerCrop(validatedData.cropId);
      if (!crop) {
        return res.status(400).json({ message: 'Crop not found' });
      }

      const notificationData = {
        ...validatedData,
        buyerId: user.id,
        farmerId: crop.farmerId,
      };

      const notification = await storage.createCropNotification(notificationData);
      
      res.status(201).json({
        message: 'Notification subscription created successfully',
        notification
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      }
      next(error);
    }
  });

  /**
   * @swagger
   * /api/buyer/notifications:
   *   get:
   *     summary: Get Buyer Notifications
   *     description: Retrieve notifications for the authenticated buyer
   *     tags: [Buyer - Notifications]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: page
   *         in: query
   *         schema:
   *           type: integer
   *           minimum: 1
   *           default: 1
   *       - name: limit
   *         in: query
   *         schema:
   *           type: integer
   *           minimum: 1
   *           maximum: 100
   *           default: 20
   *     responses:
   *       200:
   *         description: Notifications retrieved successfully
   *       401:
   *         description: Unauthorized
   */
  app.get('/api/buyer/notifications', authenticateToken, async (req, res, next) => {
    try {
      const user = (req as any).user;
      if (user.userType !== 'buyer') {
        return res.status(403).json({ message: 'Access denied. Buyer account required.' });
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await storage.getBuyerNotifications(user.id, page, limit);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  // ================================
  // E-COMMERCE: DELIVERY FEE CALCULATION
  // ================================

  /**
   * @swagger
   * /api/delivery/calculate-fee:
   *   post:
   *     summary: Calculate Delivery Fee
   *     description: Calculate delivery fee from farm location to delivery address using third-party service
   *     tags: [Delivery]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required: [fromState, fromLga, toState, toLga, toAddress, weight, unit, quantity]
   *             properties:
   *               fromState:
   *                 type: string
   *                 example: "Ogun"
   *               fromLga:
   *                 type: string
   *                 example: "Abeokuta North"
   *               fromAddress:
   *                 type: string
   *                 example: "Farm Road, Abeokuta"
   *               toState:
   *                 type: string
   *                 example: "Lagos"
   *               toLga:
   *                 type: string
   *                 example: "Lagos Island"
   *               toAddress:
   *                 type: string
   *                 example: "123 Victoria Island, Lagos"
   *               weight:
   *                 type: number
   *                 minimum: 0.1
   *                 example: 50.5
   *               unit:
   *                 type: string
   *                 enum: [bags, baskets, kg]
   *                 example: "bags"
   *               quantity:
   *                 type: integer
   *                 minimum: 1
   *                 example: 10
   *     responses:
   *       200:
   *         description: Delivery fee calculated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 deliveryFee:
   *                   type: integer
   *                   description: Delivery fee in cents
   *                   example: 15000
   *                 distance:
   *                   type: number
   *                   description: Distance in kilometers
   *                   example: 85.5
   *                 estimatedDuration:
   *                   type: string
   *                   description: Estimated delivery time
   *                   example: "2-3 business days"
   *                 provider:
   *                   type: string
   *                   example: "Nigerian Logistics Service"
   *       400:
   *         description: Validation error or location not found
   *       503:
   *         description: Third-party service unavailable
   */
  app.post('/api/delivery/calculate-fee', async (req, res, next) => {
    try {
      const validatedData = deliveryFeeRequestSchema.parse(req.body);
      
      // Mock implementation for demonstration
      // In production, this would integrate with a real delivery service API
      const mockDeliveryCalculation = {
        deliveryFee: Math.floor(Math.random() * 20000 + 5000), // Random fee between 50-250 Naira (in cents)
        distance: Math.floor(Math.random() * 200 + 10), // Random distance 10-210 km
        estimatedDuration: "2-4 business days",
        provider: "Nigerian Express Logistics"
      };

      res.json({
        message: 'Delivery fee calculated successfully',
        ...mockDeliveryCalculation,
        calculation: {
          fromLocation: `${validatedData.fromLga}, ${validatedData.fromState}`,
          toLocation: `${validatedData.toLga}, ${validatedData.toState}`,
          weight: validatedData.weight,
          unit: validatedData.unit,
          quantity: validatedData.quantity
        }
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: 'Validation failed', errors: error.errors });
      }
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
