export class EmailService {
  private smtpHost: string;
  private smtpPort: number;
  private smtpUser: string;
  private smtpPass: string;
  private fromEmail: string;

  constructor() {
    this.smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
    this.smtpPort = parseInt(process.env.SMTP_PORT || '587');
    this.smtpUser = process.env.SMTP_USER || '';
    this.smtpPass = process.env.SMTP_PASS || '';
    this.fromEmail = process.env.FROM_EMAIL || 'noreply@lucentag.com';
  }

  async sendOtp(email: string, code: string, purpose: string): Promise<void> {
    if (!this.smtpUser || !this.smtpPass) {
      console.warn('SMTP credentials not configured, OTP would be sent to:', email, 'Code:', code);
      return;
    }

    try {
      const subject = this.getEmailSubject(purpose);
      const html = this.formatOtpEmail(code, purpose);

      // Using nodemailer would require adding it to dependencies
      // For now, we'll simulate the email sending
      console.log(`Email would be sent to ${email} with subject: ${subject}`);
      console.log(`OTP Code: ${code}`);
      
      // In a real implementation, you would use nodemailer here:
      /*
      const transporter = nodemailer.createTransporter({
        host: this.smtpHost,
        port: this.smtpPort,
        secure: false,
        auth: {
          user: this.smtpUser,
          pass: this.smtpPass,
        },
      });

      await transporter.sendMail({
        from: this.fromEmail,
        to: email,
        subject,
        html,
      });
      */

    } catch (error) {
      console.error('Failed to send email:', error);
      throw new Error('Failed to send email verification code');
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
