import crypto from 'crypto';
import { storage } from '../storage';
import { otpService } from './otp';
import { User } from '@shared/schema';

export class PasswordResetService {
  private readonly TOKEN_EXPIRY_HOURS = 1; // Password reset tokens expire in 1 hour
  
  /**
   * Generate a secure random token for password reset
   */
  generateResetToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Request password reset - sends OTP to user's phone/email for verification
   */
  async requestPasswordReset(identifier: string): Promise<{
    success: boolean;
    message: string;
    userId?: string;
  }> {
    try {
      // Find user by phone or email
      const user = await storage.getUserByIdentifier(identifier);
      
      if (!user) {
        // Don't reveal if user exists for security - always return success message
        return {
          success: true,
          message: 'If an account with this phone number or email exists, we will send verification instructions.'
        };
      }

      // Determine the verification method based on what the user provided
      const isEmail = identifier.includes('@');
      const verificationType = isEmail ? 'email' : 'sms';

      // Generate and send OTP for identity verification
      await otpService.createAndSendOtp(user.id, verificationType, 'password_reset', isEmail ? user.email : user.phone);
      

      return {
        success: true,
        message: 'If an account with this phone number or email exists, we will send verification instructions.',
        userId: user.id // Only return userId internally for next step
      };
    } catch (error) {
      console.error('Error requesting password reset:', error);
      return {
        success: true,
        message: 'If an account with this phone number or email exists, we will send verification instructions.'
      };
    }
  }

  /**
   * Verify OTP and generate password reset token
   */
  async verifyResetOtp(userId: string, code: string, type: 'sms' | 'email'): Promise<{
    success: boolean;
    token?: string;
    message: string;
  }> {
    try {
      // Verify the OTP code
      const isValidOtp = await otpService.verifyOtp(userId, code, type);
      
      if (!isValidOtp) {
        return {
          success: false,
          message: 'Invalid or expired verification code'
        };
      }

      // Generate password reset token
      const resetToken = this.generateResetToken();
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.TOKEN_EXPIRY_HOURS);

      await storage.createPasswordResetToken({
        userId,
        token: resetToken,
        expiresAt
      });

      return {
        success: true,
        token: resetToken,
        message: 'Verification successful. You can now reset your password.'
      };
    } catch (error) {
      console.error('Error verifying reset OTP:', error);
      return {
        success: false,
        message: 'Failed to verify code. Please try again.'
      };
    }
  }

  /**
   * Reset password using valid token
   */
  async resetPassword(token: string, newPassword: string): Promise<{
    success: boolean;
    message: string;
    user?: User;
  }> {
    try {
      // Validate the reset token
      const resetToken = await storage.getValidPasswordResetToken(token);
      
      if (!resetToken) {
        return {
          success: false,
          message: 'Invalid or expired reset token'
        };
      }

      // Update user password
      const updatedUser = await storage.updateUserPassword(resetToken.userId, newPassword);
      
      if (!updatedUser) {
        return {
          success: false,
          message: 'Failed to update password. User not found.'
        };
      }

      // Mark token as used
      await storage.markPasswordResetTokenAsUsed(resetToken.id);

      // Revoke all existing sessions for security
      await storage.deleteUserSessions(resetToken.userId);

      return {
        success: true,
        message: 'Password reset successfully. Please login with your new password.',
        user: updatedUser
      };
    } catch (error) {
      console.error('Error resetting password:', error);
      return {
        success: false,
        message: 'Failed to reset password. Please try again.'
      };
    }
  }

  /**
   * Validate if a reset token is still valid
   */
  async validateResetToken(token: string): Promise<{
    valid: boolean;
    message: string;
    userId?: string;
  }> {
    try {
      const resetToken = await storage.getValidPasswordResetToken(token);
      
      if (!resetToken) {
        return {
          valid: false,
          message: 'Invalid or expired reset token'
        };
      }

      return {
        valid: true,
        message: 'Token is valid',
        userId: resetToken.userId
      };
    } catch (error) {
      console.error('Error validating reset token:', error);
      return {
        valid: false,
        message: 'Failed to validate token'
      };
    }
  }

  /**
   * Cleanup expired password reset tokens (should be called periodically)
   */
  async cleanupExpiredTokens(): Promise<void> {
    try {
      await storage.cleanupExpiredPasswordResetTokens();
    } catch (error) {
      console.error('Error cleaning up expired password reset tokens:', error);
    }
  }
}

export const passwordResetService = new PasswordResetService();