import { MongoClient } from 'mongodb';
import { createClient } from '@supabase/supabase-js';

const required = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'USER_SERVICE_MONGO_URI',
  'ORDER_SERVICE_MONGO_URI',
];

const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing required env vars: ${missing.join(', ')}`);
  console.error('Set SUPABASE_SERVICE_ROLE_KEY from Supabase Project Settings > API before running this migration.');
  process.exit(1);
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function objectIdToString(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (typeof value.toHexString === 'function') return value.toHexString();
  return String(value);
}

function iso(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function jsonSafe(value, fallback) {
  if (value === undefined || value === null) return fallback;
  return JSON.parse(JSON.stringify(value));
}

function mapUser(user, seenStudentIds) {
  const studentId = user.studentId || null;
  const uniqueStudentId = studentId && !seenStudentIds.has(studentId) ? studentId : null;
  if (studentId && uniqueStudentId) seenStudentIds.add(studentId);

  return {
    id: objectIdToString(user._id),
    email: user.email,
    password_hash: user.passwordHash,
    name: user.name,
    student_id: uniqueStudentId,
    student_verification: jsonSafe(user.studentVerification, {}),
    avatar_url: user.avatarUrl || '',
    bank_info: jsonSafe(user.bankInfo, {}),
    is_verified: Boolean(user.isVerified),
    is_active: user.isActive !== false,
    karma_point: Number(user.karmaPoint ?? 100),
    role: user.role || 'STUDENT',
    permissions: Array.isArray(user.permissions) ? user.permissions : ['CAN_POST', 'CAN_CHAT', 'CAN_REPORT'],
    otp: user.otp || null,
    otp_expiry: iso(user.otpExpiry),
    otp_attempt_count: Number(user.otpAttemptCount ?? 0),
    refresh_token: user.refreshToken || null,
    password_reset_otp: user.passwordResetOtp || null,
    password_reset_otp_expiry: iso(user.passwordResetOtpExpiry),
    admin_two_factor_enabled: user.adminTwoFactorEnabled !== false,
    admin_login_otp: user.adminLoginOtp || null,
    admin_login_otp_expiry: iso(user.adminLoginOtpExpiry),
    failed_login_attempts: Number(user.failedLoginAttempts ?? 0),
    lock_until: iso(user.lockUntil),
    is_deleted: Boolean(user.isDeleted),
    deleted_at: iso(user.deletedAt),
    created_at: iso(user.createdAt) || new Date().toISOString(),
    updated_at: iso(user.updatedAt) || new Date().toISOString(),
    raw: jsonSafe(user, {}),
  };
}

function mapKarmaHistory(item) {
  return {
    id: objectIdToString(item._id),
    user_id: objectIdToString(item.userId),
    type: item.type || null,
    points: item.points == null ? null : Number(item.points),
    reason: item.reason || null,
    related_id: objectIdToString(item.relatedId),
    metadata: jsonSafe(item.metadata, {}),
    created_at: iso(item.createdAt) || new Date().toISOString(),
    updated_at: iso(item.updatedAt),
    raw: jsonSafe(item, {}),
  };
}

function mapOrder(order) {
  return {
    id: objectIdToString(order._id),
    buyer_id: order.buyerId,
    seller_id: order.sellerId,
    product_id: order.productId,
    offer_id: order.offerId || null,
    price: Number(order.price ?? 0),
    listing_type: order.listingType || 'SELL',
    trade_item_title: order.tradeItemTitle || '',
    trade_item_description: order.tradeItemDescription || '',
    status: order.status || 'PENDING',
    buyer_note: order.buyerNote || '',
    handover_location: order.handoverLocation || '',
    handover_time: iso(order.handoverTime),
    handover_status: order.handoverStatus || 'NOT_SCHEDULED',
    meeting_proposals: jsonSafe(order.meetingProposals, []),
    handover_code: order.handoverCode || null,
    handover_code_expires_at: iso(order.handoverCodeExpiresAt),
    handover_proofs: jsonSafe(order.handoverProofs, []),
    buyer_handover_confirmed_at: iso(order.buyerHandoverConfirmedAt),
    seller_handover_confirmed_at: iso(order.sellerHandoverConfirmedAt),
    no_show_reports: jsonSafe(order.noShowReports, []),
    cancellation_reason: order.cancellationReason || '',
    cancellation_category: order.cancellationCategory || null,
    cancelled_by: order.cancelledBy || null,
    cancelled_at: iso(order.cancelledAt),
    dispute_status: order.disputeStatus || 'NONE',
    dispute_reason: order.disputeReason || '',
    dispute_opened_by: order.disputeOpenedBy || null,
    dispute_opened_at: iso(order.disputeOpenedAt),
    dispute_resolved_by: order.disputeResolvedBy || null,
    dispute_resolved_at: iso(order.disputeResolvedAt),
    dispute_resolution: order.disputeResolution || '',
    dispute_evidence: jsonSafe(order.disputeEvidence, []),
    dispute_timeline: jsonSafe(order.disputeTimeline, []),
    idempotency_key: order.idempotencyKey || null,
    payment_status: order.paymentStatus || 'UNPAID',
    payment_method: order.paymentMethod || 'NONE',
    payment_transaction_id: order.paymentTransactionId || null,
    transfer_proof_url: order.transferProofUrl || '',
    transfer_reported_at: iso(order.transferReportedAt),
    transfer_confirmed_at: iso(order.transferConfirmedAt),
    transfer_confirmed_by: order.transferConfirmedBy || null,
    payment_provider_status: order.paymentProviderStatus || 'MOCK_PENDING',
    payment_webhook_verified: Boolean(order.paymentWebhookVerified),
    payment_issue_status: order.paymentIssueStatus || 'NONE',
    payment_issue_reason: order.paymentIssueReason || '',
    payment_issue_opened_by: order.paymentIssueOpenedBy || null,
    payment_issue_opened_at: iso(order.paymentIssueOpenedAt),
    payment_issue_resolved_by: order.paymentIssueResolvedBy || null,
    payment_issue_resolved_at: iso(order.paymentIssueResolvedAt),
    payment_issue_resolution: order.paymentIssueResolution || '',
    payment_issue_timeline: jsonSafe(order.paymentIssueTimeline, []),
    reconciliation_status: order.reconciliationStatus || 'NOT_REQUIRED',
    paid_at: iso(order.paidAt),
    refunded_at: iso(order.refundedAt),
    completed_at: iso(order.completedAt),
    receipt_number: order.receiptNumber || null,
    status_history: jsonSafe(order.statusHistory, []),
    transactions: jsonSafe(order.transactions, []),
    created_at: iso(order.createdAt) || new Date().toISOString(),
    updated_at: iso(order.updatedAt) || new Date().toISOString(),
    raw: jsonSafe(order, {}),
  };
}

async function upsertRows(table, rows, chunkSize = 500) {
  for (let index = 0; index < rows.length; index += chunkSize) {
    const chunk = rows.slice(index, index + chunkSize);
    const { error } = await supabase.from(table).upsert(chunk, { onConflict: 'id' });
    if (error) throw new Error(`${table} upsert failed: ${error.message}`);
  }
  console.log(`${table}: ${rows.length} rows migrated`);
}

async function main() {
  const userMongo = new MongoClient(process.env.USER_SERVICE_MONGO_URI);
  const orderMongo = new MongoClient(process.env.ORDER_SERVICE_MONGO_URI);

  await Promise.all([userMongo.connect(), orderMongo.connect()]);
  try {
    const usersDb = userMongo.db();
    const ordersDb = orderMongo.db();

    const users = await usersDb.collection('users').find({}).toArray();
    const karmaHistories = await usersDb.collection('karmahistories').find({}).toArray();
    const orders = await ordersDb.collection('orders').find({}).toArray();

    const seenStudentIds = new Set();
    await upsertRows('users', users.map((user) => mapUser(user, seenStudentIds)));
    await upsertRows('karma_histories', karmaHistories.map(mapKarmaHistory));
    await upsertRows('orders', orders.map(mapOrder));
  } finally {
    await Promise.allSettled([userMongo.close(), orderMongo.close()]);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
