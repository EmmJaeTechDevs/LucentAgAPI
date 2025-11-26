import sgMail from '@sendgrid/mail';

export interface EmailDeliveryResult {
  messageId: string;
  status: string;
  email: string;
}

export class EmailService {
  private apiKey: string;
  private fromEmail: string;
  private isConfigured: boolean;

  constructor() {
    this.apiKey = process.env.SENDGRID_API_KEY || '';
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@lucentag.com';
    this.isConfigured = false;

    if (this.apiKey) {
      sgMail.setApiKey(this.apiKey);
      this.isConfigured = true;
    }
  }

  async sendOtp(email: string, code: string, purpose: string): Promise<EmailDeliveryResult> {
    if (!this.apiKey || !this.isConfigured) {
      console.error('SendGrid API key not configured. Cannot send email to:', email);
      throw new Error('Email service not configured. Please contact support.');
    }

    try {
      const subject = this.getEmailSubject(purpose);
      const html = this.formatOtpEmail(code, purpose);

      const msg = {
        to: email,
        from: this.fromEmail,
        subject,
        html,
      };

      const response = await sgMail.send(msg);
      
      // SendGrid returns an array, first element contains the response
      const [firstResponse] = response;
      
      console.log(`Email sent successfully to ${email} via SendGrid`);
      console.log(`SendGrid Response - Status: ${firstResponse.statusCode}, MessageID: ${firstResponse.headers['x-message-id']}`);

      return {
        messageId: firstResponse.headers['x-message-id'] || `sendgrid_${Date.now()}`,
        status: firstResponse.statusCode === 202 ? 'Accepted' : `Status ${firstResponse.statusCode}`,
        email: email
      };

    } catch (error: any) {
      console.error('Failed to send email via SendGrid:', error);
      
      if (error.response) {
        console.error('SendGrid Error Details:', error.response.body);
      }
      
      throw new Error(`Failed to send email verification code: ${error.message}`);
    }
  }

  private getEmailSubject(purpose: string): string {
    const subjects = {
      verification: 'Verify your Lucennt Ag account',
      login: 'Lucennt Ag Login Verification',
      password_reset: 'Reset your Lucennt Ag password',
    };

    return subjects[purpose as keyof typeof subjects] || 'Lucennt Ag Verification Code';
  }

  private formatOtpEmail(code: string, purpose: string): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Lucennt Ag Verification</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #1e40af; color: white; padding: 20px; text-align: center; }
          .content { padding: 30px 20px; background: #f9fafb; }
          .code { font-size: 32px; font-weight: bold; color: #1e40af; text-align: center; letter-spacing: 4px; }
          .footer { padding: 20px; text-align: center; font-size: 14px; color: #666; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Lucennt Ag</h1>
          </div>
          <div class="content">
            <h2>Verification Code</h2>
            <p>Your verification code is:</p>
            <div class="code">${code}</div>
            <p>This code will expire in 10 minutes.</p>
            <p>If you didn't request this code, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; 2024 Lucennt Ag. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export const emailService = new EmailService();
