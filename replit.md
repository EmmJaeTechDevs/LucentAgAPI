# Overview

This is an API-only authentication and user management system built with Express.js and PostgreSQL. The application provides RESTful endpoints for user authentication, OTP verification, session management, and comprehensive logging capabilities. It includes a health check endpoint to monitor server and database status.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## API Architecture

**Express.js Server**: RESTful API built with Express.js and TypeScript. The server follows a modular structure with separate layers for routes, services, and data access.

**Service Layer Pattern**: Authentication, OTP management, and external communications are encapsulated in dedicated service classes (AuthService, OtpService, EmailService, SmsService).

**Middleware Architecture**: Custom logging middleware captures HTTP requests and responses. Authentication middleware protects sensitive endpoints using JWT tokens.

**Error Handling**: Centralized error handling with proper HTTP status codes and structured error responses.

## Data Storage Solutions

**PostgreSQL Database**: Primary data store using Neon serverless PostgreSQL. Database schema includes users, sessions, OTP codes, and comprehensive logging tables.

**Drizzle ORM**: Type-safe database access layer that provides excellent TypeScript integration. Schema definitions provide consistency across the API.

**Connection Pooling**: Uses Neon's serverless connection pooling for efficient database connections in serverless environments.

## Authentication and Authorization

**JWT-Based Sessions**: Stateless authentication using JSON Web Tokens with configurable expiration times. Session tokens are stored in the database for revocation capabilities.

**Multi-Factor Authentication**: Phone and email-based OTP verification for user registration and login. OTP codes have configurable expiration times and single-use enforcement.

**Password Security**: Bcrypt hashing with salt rounds for secure password storage. No plaintext passwords are ever stored.

**Session Management**: Users can have multiple active sessions across devices. Sessions can be individually revoked or bulk-deleted.

## External Dependencies

**Neon Database**: Serverless PostgreSQL hosting with WebSocket support for real-time connections.

**Twilio SMS**: SMS delivery service for phone-based OTP verification. Includes fallback logging when credentials are not configured.

**SMTP Email**: Email delivery through configurable SMTP providers (defaults to Gmail SMTP). Supports HTML email templates for OTP delivery.

**Zod**: Runtime type validation for API requests and database schemas, ensuring data integrity across the application.

**Health Monitoring**: Built-in health check endpoint (`/api/health`) that monitors server uptime, memory usage, and database connectivity status.

**Replit Integration**: Development environment optimized for Replit with streamlined API-only deployment.