export class SmsService {
  private bulkSmsApiToken: string;
  private bulkSmsSenderId: string;
  private bulkSmsGateway: string;

  constructor() {
    this.bulkSmsApiToken = process.env.BULKSMS_API_TOKEN || '';
    this.bulkSmsSenderId = process.env.BULKSMS_SENDER_ID || 'LucentAg';
    this.bulkSmsGateway = process.env.BULKSMS_GATEWAY || 'otp'; // Use OTP gateway for verification codes
  }

  async sendOtp(phoneNumber: string, code: string, purpose: string): Promise<void> {
    if (!this.bulkSmsApiToken) {
      console.warn('BulkSMS credentials not configured, OTP would be sent to:', phoneNumber, 'Code:', code);
      return;
    }

    try {
      const message = this.formatOtpMessage(code, purpose);
      
      // Format phone number - add Nigeria country code if not present
      let formattedPhone = phoneNumber;
      if (!phoneNumber.startsWith('+')) {
        if (phoneNumber.startsWith('234')) {
          formattedPhone = phoneNumber;
        } else if (phoneNumber.startsWith('0')) {
          formattedPhone = '234' + phoneNumber.substring(1);
        } else {
          formattedPhone = '234' + phoneNumber;
        }
      } else {
        formattedPhone = phoneNumber.substring(1); // Remove + prefix for BulkSMS
      }
      
      // Using BulkSMSNigeria REST API
      const response = await fetch('https://www.bulksmsnigeria.com/api/v2/sms', {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: this.bulkSmsSenderId,
          to: formattedPhone,
          body: message,
          api_token: this.bulkSmsApiToken,
          gateway: this.bulkSmsGateway,
          append_sender: 'hosted', // Append sender ID if needed
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText || 'Unknown error', status: response.status };
        }
        
        console.error('BulkSMS API Error:', {
          status: response.status,
          statusText: response.statusText,
          errorData: errorData,
          phone: formattedPhone,
          sender: this.bulkSmsSenderId
        });
        
        throw new Error(`SMS send failed (${response.status}): ${errorData.error?.message || errorData.message || response.statusText}`);
      }

      const responseData = await response.json();
      console.log(`OTP sent successfully to ${phoneNumber}:`, responseData);
    } catch (error) {
      console.error('Failed to send SMS:', error);
      throw new Error('Failed to send SMS verification code');
    }
  }

  private formatOtpMessage(code: string, purpose: string): string {
    const messages = {
      verification: `Your Lucent Ag verification code is: ${code}. This code will expire in 10 minutes.`,
      login: `Your Lucent Ag login code is: ${code}. This code will expire in 10 minutes.`,
      password_reset: `Your Lucent Ag password reset code is: ${code}. This code will expire in 10 minutes.`,
    };

    return messages[purpose as keyof typeof messages] || `Your Lucent Ag code is: ${code}`;
  }
}

export const smsService = new SmsService();
