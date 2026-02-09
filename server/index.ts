import 'dotenv/config';
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import swaggerJSDoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";
import { registerRoutes } from "./routes";

const app = express();

// CORS configuration to allow requests from React apps
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? [
            "https://lucent-ag-mvp-damidek.replit.app",
            "http://lucent-ag-mvp-damidek.replit.app/",
            "http://localhost:5000",
            "https://dev.shambabridge-lucentag.com",

            "*",
          ] // Add your production frontend URL here
        : [
            "http://localhost:3000",
            "http://localhost:5000",
            "http://localhost:5173",
            "http://127.0.0.1:3000",
            "http://127.0.0.1:5173",
            "http://lucent-ag-mvp-damidek.replit.app/",
            "https://lucent-ag-mvp-damidek.replit.app/",
            "https://dev.shambabridge-lucentag.com",
            "*",
          ], // Common React dev server ports
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Simple logging middleware for API requests
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      console.log(`[express] ${logLine}`);
    }
  });

  next();
});

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Lucent Ag API",
      version: "1.0.0",
      description:
        "API-only backend for Lucent Ag agricultural platform supporting farmers and buyers with comprehensive registration, authentication, and OTP verification",
      contact: {
        name: "Lucent Ag API Support",
      },
    },
    servers: [
      {
        url:
          process.env.NODE_ENV === "production"
            ? "https://your-production-domain.com"
            : `http://localhost:${parseInt(process.env.PORT || "5000", 10)}`,
        description:
          process.env.NODE_ENV === "production"
            ? "Production server"
            : "Development server",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "JWT token obtained from login endpoint",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            id: {
              type: "string",
              format: "uuid",
              description: "User unique identifier",
            },
            firstName: { type: "string", description: "User first name" },
            lastName: { type: "string", description: "User last name" },
            email: {
              type: "string",
              format: "email",
              nullable: true,
              description: "User email address",
            },
            phone: { type: "string", description: "User phone number" },
            userType: {
              type: "string",
              enum: ["farmer", "buyer"],
              description: "Type of user account",
            },
            isVerified: {
              type: "boolean",
              description: "Whether user has completed verification",
            },
            createdAt: {
              type: "string",
              format: "date-time",
              description: "Account creation timestamp",
            },
          },
        },
        Error: {
          type: "object",
          properties: {
            message: { type: "string", description: "Error message" },
            errors: {
              type: "array",
              items: { type: "object" },
              description: "Validation errors",
            },
            missingFields: {
              type: "array",
              items: { type: "string" },
              description: "Missing required fields",
            },
          },
        },
        HealthStatus: {
          type: "object",
          properties: {
            status: { type: "string", description: "Service health status" },
            timestamp: {
              type: "string",
              format: "date-time",
              description: "Health check timestamp",
            },
            uptime: { type: "string", description: "Server uptime" },
            database: {
              type: "string",
              description: "Database connection status",
            },
            memory: { type: "object", description: "Memory usage statistics" },
          },
        },
      },
    },
  },
  apis: ["./server/routes.ts"], // Path to the API routes
};

const swaggerSpec = swaggerJSDoc(swaggerOptions);

// Serve Swagger UI at /api-docs
app.use(
  "/api-docs",
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: ".swagger-ui .topbar { display: none }",
    customSiteTitle: "Lucent Ag API Documentation",
  }),
);

// Serve swagger.json at /api-docs.json for external tools
app.get("/api-docs.json", (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.send(swaggerSpec);
});

(async () => {
  const server = await registerRoutes(app);

  // Global error handler
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      console.log(`[express] API server serving on port ${port}`);
      
      // Start scheduled cleanup job for unverified accounts
      // Runs every 15 minutes to delete unverified accounts older than 8 hours
      const CLEANUP_INTERVAL = 15 * 60 * 1000; // 15 minutes in milliseconds
      const ACCOUNT_EXPIRY_HOURS = 8;
      
      setInterval(async () => {
        try {
          const { storage } = await import('./storage');
          const deletedCount = await storage.deleteUnverifiedAccounts(ACCOUNT_EXPIRY_HOURS);
          if (deletedCount > 0) {
            console.log(`[cleanup] Removed ${deletedCount} unverified accounts older than ${ACCOUNT_EXPIRY_HOURS} hours`);
          }
        } catch (error) {
          console.error('[cleanup] Error cleaning up unverified accounts:', error);
        }
      }, CLEANUP_INTERVAL);
      
      console.log(`[cleanup] Scheduled cleanup job started - runs every ${CLEANUP_INTERVAL / 60000} minutes`);
    },
  );
})();
