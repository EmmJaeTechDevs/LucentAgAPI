export class SmsService {
  private twilioAccountSid: string;
  private twilioAuthToken: string;
  private twilioPhoneNumber: string;

  constructor() {
    this.twilioAccountSid = process.env.TWILIO_ACCOUNT_SID || '';
    this.twilioAuthToken = process.env.TWILIO_AUTH_TOKEN || '';
    this.twilioPhoneNumber = process.env.TWILIO_PHONE_NUMBER || '';
  }

  async sendOtp(phoneNumber: string, code: string, purpose: string): Promise<void> {
    if (!this.twilioAccountSid || !this.twilioAuthToken) {
      console.warn('Twilio credentials not configured, OTP would be sent to:', phoneNumber, 'Code:', code);
      return;
    }

    try {
      const message = this.formatOtpMessage(code, purpose);
      
      // Using Twilio REST API directly
      const auth = Buffer.from(`${this.twilioAccountSid}:${this.twilioAuthToken}`).toString('base64');
      
      const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.twilioAccountSid}/Messages.json`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: phoneNumber,
          From: this.twilioPhoneNumber,
          Body: message,
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`SMS send failed: ${error}`);
      }

      console.log(`OTP sent successfully to ${phoneNumber}`);
    } catch (error) {
      console.error('Failed to send SMS:', error);
      throw new Error('Failed to send SMS verification code');
    }
  }

  private formatOtpMessage(code: string, purpose: string): string {
    const messages = {
      verification: `Your Lucennt Ag verification code is: ${code}. This code will expire in 10 minutes.`,
      login: `Your Lucennt Ag login code is: ${code}. This code will expire in 10 minutes.`,
      password_reset: `Your Lucennt Ag password reset code is: ${code}. This code will expire in 10 minutes.`,
    };

    return messages[purpose as keyof typeof messages] || `Your Lucennt Ag code is: ${code}`;
  }
}

export const smsService = new SmsService();
