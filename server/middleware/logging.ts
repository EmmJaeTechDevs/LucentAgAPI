import { Request, Response, NextFunction } from "express";
import { storage } from "../storage";

export interface LoggingOptions {
  excludePaths?: string[];
  includePaths?: string[];
  logRequestBody?: boolean;
  logResponseBody?: boolean;
}

export function createLoggingMiddleware(options: LoggingOptions = {}) {
  const {
    excludePaths = [],
    includePaths = [],
    logRequestBody = true,
    logResponseBody = true,
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    const originalSend = res.send;
    let responseBody: any;

    // Capture response body if enabled
    if (logResponseBody) {
      res.send = function (body) {
        responseBody = body;
        return originalSend.call(this, body);
      };
    }

    // Check if path should be logged
    const shouldLog = () => {
      const path = req.path;
      
      // If includePaths is specified, only log those paths
      if (includePaths.length > 0) {
        return includePaths.some(includePath => path.startsWith(includePath));
      }
      
      // Otherwise, log all except excluded paths
      return !excludePaths.some(excludePath => path.startsWith(excludePath));
    };

    res.on('finish', async () => {
      if (!shouldLog()) return;

      const responseTime = Date.now() - startTime;
      
      try {
        await storage.createHttpLog({
          method: req.method,
          url: req.originalUrl,
          statusCode: res.statusCode,
          responseTime,
          ipAddress: req.ip || req.socket.remoteAddress || null,
          userAgent: req.get('user-agent') || null,
          requestBody: logRequestBody ? req.body : null,
          responseBody: logResponseBody ? responseBody : null,
          userId: (req as any).user?.id || null,
        });
      } catch (error) {
        console.error('Failed to log HTTP request:', error);
      }
    });

    next();
  };
}

export function createErrorLoggingMiddleware() {
  return async (err: any, req: Request, res: Response, next: NextFunction) => {
    try {
      await storage.createErrorLog({
        message: err.message || 'Unknown error',
        stack: err.stack || null,
        route: req.path,
        method: req.method,
        statusCode: err.status || err.statusCode || 500,
        ipAddress: req.ip || req.socket.remoteAddress || null,
        userAgent: req.get('user-agent') || null,
        userId: (req as any).user?.id || null,
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    next(err);
  };
}
