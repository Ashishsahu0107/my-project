import nodemailer from 'nodemailer';
import { config } from '../config/environment.js';
import { logger } from './logger.js';

let transporter = null;

// Initialize transporter if SMTP configuration is present
if (config.smtp.host && config.smtp.user) {
  try {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.port === 465,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass
      }
    });
    logger.info(`SMTP Transporter configured: ${config.smtp.host}:${config.smtp.port}`);
  } catch (err) {
    logger.warn(`Failed to initialize SMTP transporter: ${err.message}. Falling back to console logger.`);
  }
}

/**
 * Send an email with OTP or notification
 */
export const sendEmail = async ({ to, subject, html, text, otp, purpose }) => {
  // If SMTP is configured, attempt sending real email
  if (transporter) {
    try {
      const info = await transporter.sendMail({
        from: config.smtp.from,
        to,
        subject,
        text,
        html
      });
      logger.info(`Email dispatched to ${to}: MessageId ${info.messageId}`);
      return { success: true, messageId: info.messageId };
    } catch (error) {
      logger.error(`Error sending email to ${to}: ${error.message}`);
      // Fall through to dev display if sending failed
    }
  }

  // Developer / Local fallback logging
  console.log('\n' + '='.repeat(60));
  console.log(` 📧 EMAIL NOTIFICATION: ${purpose || 'One-Time Password'}`);
  console.log(` To: ${to}`);
  console.log(` Subject: ${subject}`);
  if (otp) {
    console.log(' ┌──────────────────────────────────────────────┐');
    console.log(` │   SECURITY CODE / OTP: [  ${otp}  ]          │`);
    console.log(` │   Expires in ${config.otpExpiryMinutes} minutes                     │`);
    console.log(' └──────────────────────────────────────────────┘');
  }
  console.log('='.repeat(60) + '\n');

  return { success: true, loggedToConsole: true, otp };
};

/**
 * Send email verification OTP
 */
export const sendVerificationOTP = async (email, username, otp) => {
  const subject = `${otp} is your verification code for ChatApp`;
  const text = `Hello ${username},\n\nYour ChatApp account verification code is: ${otp}\nThis code will expire in ${config.otpExpiryMinutes} minutes.\n\nIf you did not request this, please ignore this email.`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; background: #4f46e5; color: #ffffff; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 18px; letter-spacing: -0.5px;">ChatApp</div>
      </div>
      <h2 style="color: #0f172a; font-size: 20px; font-weight: 600; margin-bottom: 12px;">Verify your email address</h2>
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
        Hello <strong>${username}</strong>,<br/>
        Welcome to ChatApp! Please use the following 6-digit one-time passcode to confirm your registration.
      </p>
      <div style="background: #f1f5f9; border: 1px dashed #cbd5e1; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #4f46e5; font-family: monospace;">${otp}</span>
      </div>
      <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin-bottom: 20px;">
        This code is valid for <strong>${config.otpExpiryMinutes} minutes</strong>. For your security, never share this code with anyone.
      </p>
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
        If you did not create an account with ChatApp, please safely disregard this email.
      </p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject,
    text,
    html,
    otp,
    purpose: 'Registration Email OTP'
  });
};

/**
 * Send password reset OTP
 */
export const sendPasswordResetOTP = async (email, username, otp) => {
  const subject = `${otp} is your password reset code for ChatApp`;
  const text = `Hello ${username},\n\nWe received a request to reset your ChatApp password. Your code is: ${otp}\nThis code will expire in ${config.otpExpiryMinutes} minutes.\n\nIf you did not request this, please secure your account immediately.`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 540px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
      <div style="text-align: center; margin-bottom: 24px;">
        <div style="display: inline-block; background: #ef4444; color: #ffffff; padding: 10px 18px; border-radius: 8px; font-weight: 700; font-size: 18px; letter-spacing: -0.5px;">ChatApp Security</div>
      </div>
      <h2 style="color: #0f172a; font-size: 20px; font-weight: 600; margin-bottom: 12px;">Reset your password</h2>
      <p style="color: #475569; font-size: 15px; line-height: 1.6; margin-bottom: 20px;">
        Hello <strong>${username}</strong>,<br/>
        We received a request to reset the password for your ChatApp account. Enter this code to proceed:
      </p>
      <div style="background: #fef2f2; border: 1px dashed #fca5a5; border-radius: 8px; padding: 18px; text-align: center; margin: 24px 0;">
        <span style="font-size: 32px; font-weight: 800; letter-spacing: 8px; color: #dc2626; font-family: monospace;">${otp}</span>
      </div>
      <p style="color: #64748b; font-size: 13px; line-height: 1.5; margin-bottom: 20px;">
        This code expires in <strong>${config.otpExpiryMinutes} minutes</strong>. If you did not make this request, your account is safe and you can ignore this email.
      </p>
      <hr style="border: none; border-top: 1px solid #f1f5f9; margin: 24px 0;" />
      <p style="color: #94a3b8; font-size: 12px; text-align: center; margin: 0;">
        Secure Authentication Service • ChatApp
      </p>
    </div>
  `;

  return sendEmail({
    to: email,
    subject,
    text,
    html,
    otp,
    purpose: 'Password Reset OTP'
  });
};
