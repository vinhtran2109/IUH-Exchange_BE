import nodemailer from 'nodemailer';
import { logger } from '@iuh-exchange/common';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
const APP_NAME = process.env.APP_NAME || 'IUH Exchange';

let transporter = null;

function getTransporter() {
  if (!transporter && SMTP_USER && SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

/**
 * Send an order notification email.
 */
export async function sendOrderEmail(toEmail, { subject, title, body, orderId, status }) {
  const transport = getTransporter();
  if (!transport) {
    logger.warn('[Email] SMTP not configured, skipping email notification');
    return;
  }

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 40px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:20px;font-weight:600;">🎓 ${APP_NAME}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <h2 style="color:#1e293b;margin:0 0 12px;font-size:18px;">${title}</h2>
            <p style="color:#475569;font-size:14px;margin:0 0 20px;line-height:1.6;">${body}</p>
            ${orderId ? `<div style="background:#f1f5f9;border-radius:8px;padding:16px;margin:0 0 20px;">
              <p style="margin:0;color:#64748b;font-size:13px;">Mã đơn hàng</p>
              <p style="margin:4px 0 0;font-size:16px;font-weight:700;color:#1e293b;">#${orderId.substring(0, 8)}</p>
            </div>` : ''}
            ${status ? `<p style="margin:0;color:#4f46e5;font-size:14px;font-weight:600;">Trạng thái: ${status}</p>` : ''}
          </td>
        </tr>
        <tr>
          <td style="background:#f9fafb;padding:16px 40px;text-align:center;border-top:1px solid #eee;">
            <p style="color:#aaa;font-size:12px;margin:0;">© ${new Date().getFullYear()} ${APP_NAME}</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  try {
    await transport.sendMail({
      from: `"${APP_NAME}" <${SMTP_FROM}>`,
      to: toEmail,
      subject: `[${APP_NAME}] ${subject}`,
      html,
    });
    logger.info(`[Email] Order notification sent to: ${toEmail}`);
  } catch (err) {
    logger.error(`[Email] Failed to send to ${toEmail}: ${err.message}`);
  }
}
