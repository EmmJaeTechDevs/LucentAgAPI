# Overview

This is a full-stack authentication and user management system built with React, Express, and PostgreSQL. The application provides a complete dashboard interface for monitoring user activity, managing authentication flows, and viewing system logs. It implements phone/email-based authentication with OTP verification, session management, and comprehensive logging capabilities.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**React with TypeScript**: Single-page application using functional components and modern React patterns. The frontend employs a component-based architecture with clear separation of concerns.

**UI Framework**: Built with shadcn/ui components on top of Radix UI primitives, providing a consistent design system with Tailwind CSS for styling. The design follows a professional dashboard aesthetic with proper accessibility considerations.

**State Management**: Uses TanStack Query (React Query) for server state management, eliminating the need for complex global state. Local component state is managed with React hooks.

**Routing**: Implements client-side routing with Wouter, a lightweight routing library. The application supports protected routes and role-based navigation.

**Development Setup**: Configured with Vite for fast development builds and hot module replacement. TypeScript provides type safety across the entire frontend codebase.

## Backend Architecture

**Express.js Server**: RESTful API built with Express.js and TypeScript. The server follows a modular structure with separate layers for routes, services, and data access.

**Service Layer Pattern**: Authentication, OTP management, and external communications are encapsulated in dedicated service classes (AuthService, OtpService, EmailService, SmsService).

**Middleware Architecture**: Custom logging middleware captures HTTP requests and responses. Authentication middleware protects sensitive endpoints using JWT tokens.

**Error Handling**: Centralized error handling with proper HTTP status codes and structured error responses.

## Data Storage Solutions

**PostgreSQL Database**: Primary data store using Neon serverless PostgreSQL. Database schema includes users, sessions, OTP codes, and comprehensive logging tables.

**Drizzle ORM**: Type-safe database access layer that provides excellent TypeScript integration. Schema definitions are shared between frontend and backend for consistency.

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

**shadcn/ui**: Comprehensive UI component library built on Radix UI primitives, providing accessible and customizable components.

**TanStack Query**: Data fetching and caching library for efficient API communication and state synchronization.

**Tailwind CSS**: Utility-first CSS framework for consistent styling and responsive design.

**Zod**: Runtime type validation for API requests and database schemas, ensuring data integrity across the application.

**Replit Integration**: Development environment optimized for Replit with proper asset handling and development tooling.