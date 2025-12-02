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

**Role-Based Access Control**: User roles are managed through a normalized roles table with roleId foreign key in the users table. Current roles: farmer (id=1) and buyer (id=2). All authorization checks use roleId for consistent access control. The userType column is retained for backwards compatibility with existing API clients.

**Multi-Factor Authentication**: Email-based OTP verification for user registration and login using SendGrid email API. OTP codes have configurable expiration times (10 minutes) and single-use enforcement. SMS OTP has been disabled in favor of email-only verification.

**Transactional Registration Flow**: User registration follows a strict transactional flow to ensure data integrity:
1. Generate OTP code without persisting to database
2. Send email via SendGrid - if email delivery fails, abort registration immediately
3. Create user in database ONLY after email sends successfully
4. Persist OTP code to database - if persistence fails, rollback by deleting the created user
5. This ensures no orphaned users exist without valid OTP codes, and no users are created without successful email delivery

**Automatic Cleanup**: A scheduled background job runs every 15 minutes to delete unverified accounts older than 8 hours. This cleanup cascades to associated OTP codes and sessions, maintaining database integrity and preventing accumulation of incomplete registrations.

**Password Security**: Bcrypt hashing with salt rounds for secure password storage. No plaintext passwords are ever stored.

**Session Management**: Users can have multiple active sessions across devices. Sessions can be individually revoked or bulk-deleted.

## External Dependencies

**Neon Database**: Serverless PostgreSQL hosting with WebSocket support for real-time connections.

**SendGrid Email**: Primary email delivery service for email-based OTP verification using SendGrid API. The service requires a valid API key (SENDGRID_API_KEY) and a verified sender email address (FROM_EMAIL). Throws errors if credentials are missing to prevent bypassing email verification. Returns delivery metadata including messageId and status codes (202=Accepted) for auditing purposes.

**SMTP Email**: Email delivery through configurable SMTP providers (defaults to Gmail SMTP). Supports HTML email templates for OTP delivery.

**Zod**: Runtime type validation for API requests and database schemas, ensuring data integrity across the application.

**Health Monitoring**: Built-in health check endpoint (`/api/health`) that monitors server uptime, memory usage, and database connectivity status.

**Replit Integration**: Development environment optimized for Replit with streamlined API-only deployment. The project includes a minimal frontend structure required for the build process, but remains functionally a backend-only API.

**CORS Configuration**: Configured to allow cross-origin requests from React applications. Supports common development ports (3000, 5173) in development and configurable production origins. Includes proper preflight request handling for all HTTP methods.