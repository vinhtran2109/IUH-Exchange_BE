import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    userId: { type: String, default: null, index: true },
    action: { type: String, required: true, index: true },
    resource: { type: String, required: true },
    resourceId: { type: String, default: null },
    method: { type: String, required: true },
    path: { type: String, required: true },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    statusCode: { type: Number, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
