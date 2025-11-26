import { storage } from '../storage';
import { smsService } from './sms';
import { emailService } from './email';
import { InsertOtpCode, OtpCode } from '@shared/schema';

export class OtpService {
  generateOtpCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Generate OTP code and expiry time without persisting to database
   * Used for registration flow where SMS must succeed before user creation
   */
  generateOtpData(): { code: string; expiresAt: Date } {
    const code = this.generateOtpCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiry
    return { code, expiresAt };
  }

  /**
   * Persist pre-generated OTP code to database
   * Used after successful SMS delivery in registration flow
   */
  async persistOtpCode(
    userId: string,
    code: string,
    expiresAt: Date,
    type: 'sms' | 'email',
    purpose: string
  ): Promise<OtpCode> {
    const otpCode = await storage.createOtpCode({
      userId,
      code,
      type,
      purpose,
      expiresAt,
    });
    return otpCode;
  }

  async createAndSendOtp(
    userId: string, 
    type: 'sms' | 'email', 
    purpose: string,
    destination: string
  ): Promise<OtpCode> {
    const code = this.generateOtpCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minutes expiry

    const otpCode = await storage.createOtpCode({
      userId,
      code,
      type,
      purpose,
      expiresAt,
    });

    // Send OTP based on type
    if (type === 'sms') {
      await smsService.sendOtp(destination, code, purpose);
    } else if (type === 'email') {
      await emailService.sendOtp(destination, code, purpose);
    }

    return otpCode;
  }

  async verifyOtp(userId: string, code: string, type: 'sms' | 'email'): Promise<boolean> {
    const otpCode = await storage.getValidOtpCode(userId, code, type);
    
    if (!otpCode) {
      return false;
    }

    await storage.markOtpAsUsed(otpCode.id);
    return true;
  }

  async cleanupExpiredOtps(): Promise<void> {
    await storage.cleanupExpiredOtps();
  }
}

export const otpService = new OtpService();
