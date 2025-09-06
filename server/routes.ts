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
  insertUserSchema,
  insertFarmerSchema,
  insertBuyerSchema 
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
        if (loginResult.error?.includes('Too many failed attempts')) {
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
        tokenExpiration: '3 days', // Informational for frontend
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
   *         description: OTP verified successfully, user account is now verified
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 message:
   *                   type: string
   *                   example: "OTP verified successfully"
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
   */
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
