import nodemailer from 'nodemailer';
import { logger } from '@iuh-exchange/common';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
const APP_NAME = process.env.APP_NAME || 'IUH Exchange';

// Bug #5 fix: Escape HTML to prevent XSS in email templates
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

/**
 * Gửi email OTP xác thực tài khoản
 */
export async function sendOtpEmail(toEmail, otpCode, userName) {
  const html = buildOtpTemplate(userName, otpCode, 'Xác thực tài khoản');
  try {
    await transporter.sendMail({
      from: `"${APP_NAME}" <${SMTP_FROM}>`,
      to: toEmail,
      subject: `[${APP_NAME}] Mã xác thực tài khoản của bạn`,
      html,
    });
    logger.info(`[Email] OTP sent to: ${toEmail}`);
  } catch (err) {
    logger.error(`[Email] Failed to send OTP to ${toEmail}: ${err.message}`);
  }
}

/**
 * Gửi email OTP đặt lại mật khẩu
 */
export async function sendPasswordResetOtpEmail(toEmail, otpCode, userName) {
  const html = buildOtpTemplate(userName, otpCode, 'Đặt lại mật khẩu');
  try {
    await transporter.sendMail({
      from: `"${APP_NAME}" <${SMTP_FROM}>`,
      to: toEmail,
      subject: `[${APP_NAME}] Mã đặt lại mật khẩu`,
      html,
    });
    logger.info(`[Email] Password reset OTP sent to: ${toEmail}`);
  } catch (err) {
    logger.error(`[Email] Failed to send reset OTP to ${toEmail}: ${err.message}`);
  }
}

function buildOtpTemplate(userName, otp, purpose) {
  const safeUserName = escapeHtml(userName);
  const safeOtp = escapeHtml(otp);
  const safePurpose = escapeHtml(purpose);
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1a73e8,#0d47a1);padding:32px 40px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:600;">🎓 ${escapeHtml(APP_NAME)}</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="color:#333;font-size:15px;margin:0 0 12px;">Xin chào <strong>${safeUserName}</strong>,</p>
              <p style="color:#555;font-size:14px;margin:0 0 24px;">Bạn đã yêu cầu ${safePurpose.toLowerCase()}. Dưới đây là mã OTP của bạn:</p>
              <div style="background:#f0f4ff;border:2px dashed #1a73e8;border-radius:10px;padding:24px;text-align:center;margin:0 0 24px;">
                <span style="font-size:36px;font-weight:700;color:#1a73e8;letter-spacing:8px;">${safeOtp}</span>
              </div>
              <p style="color:#888;font-size:13px;margin:0 0 8px;">⏰ Mã này có hiệu lực trong <strong>10 phút</strong>.</p>
              <p style="color:#888;font-size:13px;margin:0;">🔒 Vui lòng không chia sẻ mã này với bất kỳ ai.</p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #eee;">
              <p style="color:#aaa;font-size:12px;margin:0;">Nếu bạn không thực hiện yêu cầu này, hãy bỏ qua email này.</p>
              <p style="color:#aaa;font-size:12px;margin:8px 0 0;">© ${new Date().getFullYear()} ${APP_NAME}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
