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

function formatCurrency(value) {
  if (value === undefined || value === null || value === '') return '';
  const number = Number(value);
  if (!Number.isFinite(number)) return escapeHtml(value);
  return `${number.toLocaleString('vi-VN')}đ`;
}

function renderDetailRow(label, value) {
  if (value === undefined || value === null || value === '') return '';
  return `<tr>
    <td style="padding:8px 0;color:#64748b;font-size:13px;width:128px;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:8px 0;color:#1e293b;font-size:13px;font-weight:600;line-height:1.5;">${escapeHtml(value)}</td>
  </tr>`;
}

function formatPerson(person) {
  if (!person) return '';
  const name = person.name || 'Chưa có tên';
  const extra = [person.email, person.studentId ? `MSSV: ${person.studentId}` : ''].filter(Boolean);
  return extra.length ? `${name} (${extra.join(' - ')})` : name;
}

function renderOrderDetails(orderDetails = {}, orderId, status) {
  const buyer = formatPerson(orderDetails.buyer);
  const seller = formatPerson(orderDetails.seller);
  const product = orderDetails.product || {};
  const rows = [
    renderDetailRow('Mã đơn hàng', orderDetails.orderCode || (orderId ? `#${String(orderId).substring(0, 8)}` : '')),
    renderDetailRow('Sản phẩm', product.title),
    renderDetailRow('Giá', formatCurrency(product.price ?? orderDetails.price)),
    renderDetailRow('Người mua', buyer),
    renderDetailRow('Người bán', seller),
    renderDetailRow('Trạng thái', status || orderDetails.status),
    renderDetailRow('Lý do hủy', orderDetails.reason),
  ].join('');

  if (!rows) return '';

  return `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin:0 0 20px;">
    <p style="margin:0 0 8px;color:#0f172a;font-size:14px;font-weight:700;">Thông tin đơn hàng</p>
    <table width="100%" cellpadding="0" cellspacing="0">${rows}</table>
  </div>`;
}

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
export async function sendOrderEmail(toEmail, { subject, title, body, orderId, status, orderDetails }) {
  const transport = getTransporter();
  if (!transport) {
    logger.warn('[Email] SMTP not configured, skipping email notification');
    return;
  }

  const safeTitle = escapeHtml(title);
  const safeBody = escapeHtml(body);
  const detailsHtml = renderOrderDetails(orderDetails, orderId, status);

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 0;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#4f46e5,#7c3aed);padding:28px 40px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:20px;font-weight:600;">${escapeHtml(APP_NAME)}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <h2 style="color:#1e293b;margin:0 0 12px;font-size:18px;">${safeTitle}</h2>
            <p style="color:#475569;font-size:14px;margin:0 0 20px;line-height:1.6;">${safeBody}</p>
            ${detailsHtml}
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

/**
 * Send a manually composed email from the admin console.
 */
export async function sendAdminComposedEmail({ to, subject, body, senderName }) {
  const transport = getTransporter();
  if (!transport) {
    logger.warn('[Email] SMTP not configured, cannot send admin composed email');
    throw new Error('SMTP is not configured');
  }

  const recipients = Array.isArray(to) ? to : [to];
  const safeBody = escapeHtml(body).replace(/\n/g, '<br />');
  const safeSender = escapeHtml(senderName || 'IUH Exchange Admin');

  const html = `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f4f6f8;font-family:'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6f8;padding:40px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr>
          <td style="background:#0f172a;padding:24px 32px;">
            <h1 style="color:#fff;margin:0;font-size:18px;font-weight:700;">${escapeHtml(APP_NAME)}</h1>
            <p style="color:#94a3b8;margin:6px 0 0;font-size:13px;">Thông báo từ ban quản trị</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;color:#334155;font-size:14px;line-height:1.7;">
            ${safeBody}
          </td>
        </tr>
        <tr>
          <td style="background:#f8fafc;padding:18px 32px;border-top:1px solid #e5e7eb;color:#64748b;font-size:12px;">
            Người gửi: ${safeSender}
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const result = await transport.sendMail({
    from: `"${APP_NAME}" <${SMTP_FROM}>`,
    to: recipients.join(','),
    subject: `[${APP_NAME}] ${subject}`,
    text: body,
    html,
  });

  logger.info(`[Email] Admin composed email sent to ${recipients.length} recipient(s)`);
  return { messageId: result.messageId, accepted: result.accepted, rejected: result.rejected };
}
