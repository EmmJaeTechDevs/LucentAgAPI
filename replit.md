# Overview

This is an API-only e-commerce platform for farmers and buyers built with Express.js and PostgreSQL. The application provides RESTful endpoints for user authentication, OTP verification, session management, crop management, order processing, and comprehensive logging capabilities. It includes a health check endpoint to monitor server and database status.

# User Preferences

Preferred communication style: Simple, everyday language.

# Project Structure

The project follows a modular architecture for better maintainability:

```
server/
├── index.ts                    # Entry point with dotenv/config import
├── routes.ts                   # Main route aggregator
├── storage.ts                  # Database access layer (IStorage interface)
├── db.ts                       # Database connection
├── middleware/
│   ├── auth.ts                 # JWT authentication middleware
│   └── logging.ts              # HTTP request/response logging
├── routes/
│   ├── index.ts                # Route registration aggregator
│   ├── auth.ts                 # Authentication routes (register, login, OTP, password reset)
│   ├── users.ts                # User profile and notification preferences
│   ├── farmer.ts               # Farmer routes (plants, answers, crops, orders)
│   ├── buyer.ts                # Buyer routes (crop search, orders, notifications)
│   ├── plants.ts               # Plant catalog and questions
│   ├── delivery.ts             # Delivery fee calculation and providers
│   ├── locations.ts            # Countries, states, LGAs reference data
│   ├── logs.ts                 # HTTP and error log viewing
│   └── health.ts               # Health check endpoint
└── services/
    ├── auth.ts                 # Authentication service (JWT, session management)
    ├── otp.ts                  # OTP generation and verification
    ├── email.ts                # SendGrid email service
    ├── sms.ts                  # SMS service (Africa's Talking - currently disabled)
    ├── passwordReset.ts        # Password reset token management
    └── delivery.ts             # Delivery fee calculation service

shared/
├── schema.ts                   # Re-exports from schema/ directory
└── schema/
    ├── index.ts                # Central exports
    ├── users.ts                # Users and roles tables
    ├── auth.ts                 # OTP codes, sessions, password reset tokens
    ├── plants.ts               # Plants, questions, farmer plants, answers
    ├── crops.ts                # Farmer crops, orders, crop notifications
    ├── locations.ts            # Delivery locations, units, countries, states, LGAs
    ├── logs.ts                 # HTTP logs, error logs
    ├── notifications.ts        # User notification preferences
    ├── relations.ts            # All Drizzle ORM relations
    └── validation.ts           # All Zod validation schemas and types
```

# Environment Configuration

The application uses dotenv for environment variable management. The server loads `.env` files automatically via `import 'dotenv/config'` at the top of `server/index.ts`.

Required environment variables:
- `DATABASE_URL` - PostgreSQL connection string (auto-provided by Replit)
- `SENDGRID_API_KEY` - SendGrid API key for email OTP delivery
- `FROM_EMAIL` - Verified sender email address (default: no-reply@shambabridge-lucentag.com)

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

**Zod**: Runtime type validation for API requests and database schemas, ensuring data integrity across the application.

**Health Monitoring**: Built-in health check endpoint (`/api/health`) that monitors server uptime, memory usage, and database connectivity status.

**Replit Integration**: Development environment optimized for Replit with streamlined API-only deployment. The project includes a minimal frontend structure required for the build process, but remains functionally a backend-only API.

**CORS Configuration**: Configured to allow cross-origin requests from React applications. Supports common development ports (3000, 5173) in development and configurable production origins. Includes proper preflight request handling for all HTTP methods.

# Recent Changes

- **2026-01-05**: Refactored project into modular file structure
  - Split schema.ts (1042 lines) into 9 modular files under shared/schema/
  - Split routes.ts (4121 lines) into 10 modular files under server/routes/
  - Created dedicated auth middleware file
  - Added dotenv support for .env file loading
- **2026-01-04**: Migrated OTP delivery from SMS (Africa's Talking) to email (SendGrid)
  - Updated all registration endpoints to use email OTP
  - Transactional registration flow: email first, then create user
