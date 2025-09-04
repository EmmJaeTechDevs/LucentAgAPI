export class SmsService {
  private ebulkSmsUsername: string;
  private ebulkSmsApiKey: string;
  private ebulkSmsSenderId: string;

  constructor() {
    this.ebulkSmsUsername = process.env.EBULKSMS_USERNAME || '';
    this.ebulkSmsApiKey = process.env.EBULKSMS_API_KEY || '';
    this.ebulkSmsSenderId = process.env.EBULKSMS_SENDER_ID || 'LucentAg';
  }

  async sendOtp(phoneNumber: string, code: string, purpose: string): Promise<void> {
    if (!this.ebulkSmsUsername || !this.ebulkSmsApiKey) {
      console.warn('eBulkSMS credentials not configured, OTP would be sent to:', phoneNumber, 'Code:', code);
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
        formattedPhone = phoneNumber.substring(1); // Remove + prefix for eBulkSMS
      }
      
      // Generate unique message ID for delivery tracking
      const msgId = `lucent_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      
      // Using eBulkSMS REST API
      const requestBody = {
        SMS: {
          auth: {
            username: this.ebulkSmsUsername,
            apikey: this.ebulkSmsApiKey
          },
          message: {
            sender: this.ebulkSmsSenderId,
            messagetext: message,
            flash: "0" // Normal SMS, not flash
          },
          recipients: {
            gsm: [
              {
                msidn: formattedPhone,
                msgid: msgId
              }
            ]
          },
          dndsender: "0" // Disable DND option
        }
      };
      
      const response = await fetch('https://api.ebulksms.com/sendsms.json', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { message: errorText || 'Unknown error', status: response.status };
        }
        
        console.error('eBulkSMS API Error:', {
          status: response.status,
          statusText: response.statusText,
          errorData: errorData,
          phone: formattedPhone,
          sender: this.ebulkSmsSenderId,
          msgId: msgId
        });
        
        throw new Error(`SMS send failed (${response.status}): ${errorData.response?.status || errorData.message || response.statusText}`);
      }

      const responseData = await response.json();
      console.log(`OTP sent successfully to ${phoneNumber} (msgId: ${msgId}):`, responseData);
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
