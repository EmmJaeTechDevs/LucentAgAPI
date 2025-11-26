// @ts-ignore - africastalking package doesn't have TypeScript definitions
import africastalking from 'africastalking';

interface SmsDeliveryResult {
  messageId: string;
  status: string;
  cost: string;
  phoneNumber: string;
}

export class SmsService {
  private africastalking: any;
  private smsClient: any;
  private username: string;
  private apiKey: string;
  private senderId: string;

  constructor() {
    this.username = process.env.AFRICASTALKING_USERNAME || '';
    this.apiKey = process.env.AFRICASTALKING_API_KEY || '';
    this.senderId = process.env.AFRICASTALKING_SENDER_ID || 'LucentAg';

    // Initialize Africa's Talking SDK
    if (this.username && this.apiKey) {
      this.africastalking = africastalking({
        apiKey: this.apiKey,
        username: this.username
      });
      this.smsClient = this.africastalking.SMS;
    }
  }

  async sendOtp(phoneNumber: string, code: string, purpose: string): Promise<SmsDeliveryResult> {
    if (!this.username || !this.apiKey) {
      console.error('Africa\'s Talking credentials not configured. Cannot send SMS to:', phoneNumber);
      throw new Error('SMS service not configured. Please contact support.');
    }

    try {
      const message = this.formatOtpMessage(code, purpose);
      
      // Normalize phone number to E.164 format (required by Africa's Talking)
      const formattedPhone = this.normalizePhoneNumber(phoneNumber);
      
      // Send SMS via Africa's Talking
      const response = await this.smsClient.send({
        to: [formattedPhone],
        message: message,
        from: this.senderId
      });

      console.log('Africa\'s Talking raw response:', JSON.stringify(response, null, 2));

      // Parse Africa's Talking response
      if (!response.SMSMessageData || !response.SMSMessageData.Recipients) {
        throw new Error('Invalid response format from Africa\'s Talking');
      }

      const recipients = response.SMSMessageData.Recipients;
      
      if (recipients.length === 0) {
        throw new Error('No recipients in SMS response');
      }

      const recipient = recipients[0];
      
      // Check status code: 101 = Success, 102 = Queued
      if (recipient.statusCode !== 101 && recipient.statusCode !== 102) {
        const errorMessage = `SMS delivery failed: ${recipient.status} (Code: ${recipient.statusCode})`;
        console.error('Africa\'s Talking delivery error:', {
          statusCode: recipient.statusCode,
          status: recipient.status,
          number: recipient.number,
          cost: recipient.cost
        });
        throw new Error(errorMessage);
      }

      // Return delivery metadata for auditing
      const deliveryResult: SmsDeliveryResult = {
        messageId: recipient.messageId || `at_${Date.now()}`,
        status: recipient.status,
        cost: recipient.cost || 'N/A',
        phoneNumber: formattedPhone
      };

      console.log(`OTP sent successfully to ${phoneNumber}:`, deliveryResult);
      
      return deliveryResult;
    } catch (error: any) {
      console.error('Failed to send SMS:', error);
      
      // Throw specific error to prevent database persistence
      if (error.message?.includes('SMS delivery failed')) {
        throw error;
      }
      
      throw new Error(`Failed to send SMS verification code: ${error.message || 'Unknown error'}`);
    }
  }

  /**
   * Normalize phone number to E.164 format
   * Supports Nigerian numbers primarily, can be extended for other countries
   */
  private normalizePhoneNumber(phoneNumber: string): string {
    // Remove all spaces and hyphens
    let cleaned = phoneNumber.replace(/[\s-]/g, '');
    
    // Already in E.164 format
    if (cleaned.startsWith('+')) {
      return cleaned;
    }
    
    // Handle Nigerian numbers
    if (cleaned.startsWith('234')) {
      return `+${cleaned}`;
    }
    
    if (cleaned.startsWith('0')) {
      return `+234${cleaned.substring(1)}`;
    }
    
    // Default: assume Nigerian number
    return `+234${cleaned}`;
  }

  private formatOtpMessage(code: string, purpose: string): string {
    const messages = {
      verification: `Your Lucent Ag verification code is: ${code}. This code will expire in 10 minutes.`,
      login: `Your Lucent Ag login code is: ${code}. This code will expire in 10 minutes.`,
      password_reset: `Your Lucent Ag password reset code is: ${code}. This code will expire in 10 minutes.`,
    };

    const message = messages[purpose as keyof typeof messages] || `Your Lucent Ag code is: ${code}`;
    
    // Ensure message doesn't exceed 160 characters (single SMS limit)
    if (message.length > 160) {
      console.warn(`SMS message exceeds 160 characters (${message.length}), may be split into multiple messages`);
    }
    
    return message;
  }
}

export const smsService = new SmsService();
