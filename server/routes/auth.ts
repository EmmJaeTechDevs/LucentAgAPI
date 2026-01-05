import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "../storage";
import { authService } from "../services/auth";
import { otpService } from "../services/otp";
import { emailService } from "../services/email";
import { passwordResetService } from "../services/passwordReset";
import { createLoggingMiddleware } from "../middleware/logging";
import { authenticateToken } from "../middleware/auth";
import { 
  loginSchema, 
  verifyOtpSchema, 
  requestOtpSchema, 
  insertUserSchema,
  insertFarmerSchema,
  insertBuyerSchema,
  forgotPasswordSchema,
  resetPasswordSchema
} from "@shared/schema";
import { z } from "zod";

const authLoggingMiddleware = createLoggingMiddleware({
  includePaths: ['/api/auth', '/api/users'],
  logRequestBody: false,
  logResponseBody: false,
});

export function registerAuthRoutes(app: Express): void {
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

      const { code, expiresAt } = otpService.generateOtpData();
      
      try {
        await emailService.sendOtp(validatedData.email!, code, 'verification');
      } catch (emailError: any) {
        console.error('Email delivery failed during user registration:', emailError);
        return res.status(500).json({ 
          message: 'Failed to send verification email. Please try again or check your email address.',
          error: emailError.message 
        });
      }

      const user = await authService.registerUser(validatedData);
      
      try {
        await otpService.persistOtpCode(user.id, code, expiresAt, 'email', 'verification');
      } catch (otpError: any) {
        console.error('Failed to persist OTP after user creation, rolling back:', otpError);
        await storage.deleteUser(user.id);
        return res.status(500).json({ 
          message: 'Registration failed. Please try again.',
          error: 'Failed to complete registration process'
        });
      }

      res.status(201).json({ 
        message: 'User registered successfully. Please verify your email address.',
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
      
      const existingUserByPhone = await storage.getUserByPhone(validatedData.phone);
      if (existingUserByPhone) {
        return res.status(400).json({ message: 'Phone number already registered' });
      }

      if (validatedData.email) {
        const existingUserByEmail = await storage.getUserByEmail(validatedData.email);
        if (existingUserByEmail) {
          return res.status(400).json({ message: 'Email already registered' });
        }
      }

      const { code, expiresAt } = otpService.generateOtpData();
      
      try {
        await emailService.sendOtp(validatedData.email!, code, 'verification');
      } catch (emailError: any) {
        console.error('Email delivery failed during farmer registration:', emailError);
        return res.status(500).json({ 
          message: 'Failed to send verification email. Please try again or check your email address.',
          error: emailError.message 
        });
      }

      const farmer = await storage.createFarmer(validatedData);
      
      try {
        await otpService.persistOtpCode(farmer.id, code, expiresAt, 'email', 'verification');
      } catch (otpError: any) {
        console.error('Failed to persist OTP after user creation, rolling back:', otpError);
        await storage.deleteUser(farmer.id);
        return res.status(500).json({ 
          message: 'Registration failed. Please try again.',
          error: 'Failed to complete registration process'
        });
      }

      const verificationMessage = 'Farmer registered successfully. Please verify your email address.';

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
      
      const existingUserByPhone = await storage.getUserByPhone(validatedData.phone);
      if (existingUserByPhone) {
        return res.status(400).json({ message: 'Phone number already registered' });
      }

      if (validatedData.email) {
        const existingUserByEmail = await storage.getUserByEmail(validatedData.email);
        if (existingUserByEmail) {
          return res.status(400).json({ message: 'Email already registered' });
        }
      }

      const { code, expiresAt } = otpService.generateOtpData();
      
      try {
        await emailService.sendOtp(validatedData.email!, code, 'verification');
      } catch (emailError: any) {
        console.error('Email delivery failed during buyer registration:', emailError);
        return res.status(500).json({ 
          message: 'Failed to send verification email. Please try again or check your email address.',
          error: emailError.message 
        });
      }

      const buyer = await storage.createBuyer(validatedData);
      
      try {
        await otpService.persistOtpCode(buyer.id, code, expiresAt, 'email', 'verification');
      } catch (otpError: any) {
        console.error('Failed to persist OTP after user creation, rolling back:', otpError);
        await storage.deleteUser(buyer.id);
        return res.status(500).json({ 
          message: 'Registration failed. Please try again.',
          error: 'Failed to complete registration process'
        });
      }

      const verificationMessage = 'Buyer registered successfully. A verification email has been sent to your email address. Please enter the code to complete your registration.';

      res.status(201).json({ 
        message: verificationMessage,
        userId: buyer.id,
        userType: 'buyer',
        verificationMethod: 'email'
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
   *       403:
   *         description: Account not verified
   *       429:
   *         description: Too many failed login attempts
   */
  app.post('/api/auth/login', async (req, res, next) => {
    try {
      const { identifier, password } = loginSchema.parse(req.body);
      
      const loginResult = await authService.loginUser(identifier, password);
      
      if (!loginResult.success) {
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

      res.json({ 
        message: 'Login successful',
        success: true,
        token: loginResult.token,
        tokenExpiration: '8 hours',
        user: {
          userId: loginResult.user!.id,
          id: loginResult.user!.id,
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
   *       404:
   *         description: User not found
   *       400:
   *         description: Validation error
   */
  app.post('/api/auth/request-otp', async (req, res, next) => {
    try {
      const { userId, type, purpose } = requestOtpSchema.parse(req.body);
      
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

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
   *       400:
   *         description: Invalid or expired OTP code
   *       404:
   *         description: User not found
   */
  app.post('/api/auth/verify-otp', async (req, res, next) => {
    try {
      const { userId, code, type } = verifyOtpSchema.parse(req.body);
      
      const isValid = await otpService.verifyOtp(userId, code, type);
      if (!isValid) {
        return res.status(400).json({ message: 'Invalid or expired OTP code' });
      }

      let user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      if (!user.isVerified) {
        await storage.updateUser(userId, { isVerified: true });
        user = await storage.getUser(userId);
      }

      const token = authService.generateJWT({ userId: user!.id });
      await storage.createSession({
        userId: user!.id,
        token,
        expiresAt: new Date(Date.now() + 8 * 60 * 60 * 1000),
      });

      res.json({ 
        message: 'OTP verified successfully. You are now logged in.',
        success: true,
        token,
        tokenExpiration: '8 hours',
        user: {
          userId: user!.id,
          id: user!.id,
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
   *       400:
   *         description: Validation error
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
   *       400:
   *         description: Invalid or expired OTP code
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
   *       400:
   *         description: Invalid token or password validation error
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
   *       400:
   *         description: Token is invalid or expired
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
   *       401:
   *         description: Unauthorized - token required
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
}
