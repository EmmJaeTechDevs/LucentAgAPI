import type { Request, Response, NextFunction } from "express";
import { authService } from "../services/auth";

export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
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
