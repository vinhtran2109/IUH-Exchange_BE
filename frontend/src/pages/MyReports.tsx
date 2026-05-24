import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, ArrowLeft, CheckCircle, Clock, Flag, Send, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/Toast';
import api from '../services/api';

type ReportTargetType = 'USER' | 'PRODUCT' | 'LOST_FOUND';

interface Report {
  id: string;
  _id?: string;
  targetType: string;
  targetId: string;
  reason: string;
  status: string;
  adminNote?: string;
  createdAt: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING: { label: 'Chờ xử lý', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: <Clock size={13} /> },
  REVIEWED: { label: 'Đã xem xét', color: 'bg-blue-50 text-blue-700 border-blue-200', icon: <AlertTriangle size={13} /> },
  RESOLVED: { label: 'Đã xử lý', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: <CheckCircle size={13} /> },
  DISMISSED: { label: 'Đã bỏ qua', color: 'bg-slate-50 text-slate-600 border-slate-200', icon: <XCircle size={13} /> },
};

const TARGET_LABELS: Record<string, string> = {
  PRODUCT: 'Sản phẩm',
  USER: 'Người dùng',
  LOST_FOUND: 'Đồ thất lạc',
};

function parseReportTarget(rawValue: string, fallbackType: ReportTargetType) {
  const value = rawValue.trim();
  if (!value) return { targetType: fallbackType, targetId: '' };

  try {
    const url = new URL(value, window.location.origin);
    const parts = url.pathname.split('/').filter(Boolean);
    const [section, id] = parts;

    if (section === 'products' && id) return { targetType: 'PRODUCT' as const, targetId: id };
    if (section === 'lost-found' && id) return { targetType: 'LOST_FOUND' as const, targetId: id };
    if ((section === 'sellers' || section === 'users') && id) return { targetType: 'USER' as const, targetId: id };
  } catch {
    // Keep the raw value below.
  }

  return { targetType: fallbackType, targetId: value };
}

const MyReports: React.FC = () => {
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToast();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [targetType, setTargetType] = useState<ReportTargetType>('USER');
  const [targetId, setTargetId] = useState('');
  const [reason, setReason] = useState('');

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/my?page=1&size=50');
      if (res.data?.success) {
        setReports(res.data.data.content || []);
      }
    } catch (error) {
      console.error('Failed to fetch reports', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const handleSubmitReport = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsedTarget = parseReportTarget(targetId, targetType);
    const trimmedReason = reason.trim();

    if (!parsedTarget.targetId) {
      toastError('Vui lòng nhập link hoặc mã đối tượng cần báo cáo.');
      return;
    }
    if (trimmedReason.length < 5) {
      toastError('Lý do báo cáo cần ít nhất 5 ký tự.');
      return;
    }

    try {
      setSubmitting(true);
      await api.post('/reports', {
        targetType: parsedTarget.targetType,
        targetId: parsedTarget.targetId,
        reason: trimmedReason,
      });
      setTargetType(parsedTarget.targetType);
      setTargetId('');
      setReason('');
      toastSuccess('Đã gửi báo cáo cho admin.');
      await fetchReports();
    } catch (error: any) {
      toastError(error?.response?.data?.message || 'Không thể gửi báo cáo lúc này.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft size={16} />
        Quay lại
      </button>

      <div className="mb-6">
        <h1 className="mb-1 flex items-center gap-2 text-2xl font-bold text-slate-900">
          <Flag size={22} className="text-slate-500" />
          Báo cáo của tôi
        </h1>
        <p className="text-sm text-slate-500">Gửi báo cáo cho admin và theo dõi trạng thái xử lý.</p>
      </div>

      <form onSubmit={handleSubmitReport} className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
        <div className="mb-4 flex items-center gap-2">
          <Send size={17} className="text-slate-500" />
          <h2 className="text-sm font-bold text-slate-900">Gửi báo cáo cho admin</h2>
        </div>

        <div className="grid gap-3 md:grid-cols-[180px_1fr]">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500">Loại đối tượng</label>
            <select
              value={targetType}
              onChange={(event) => setTargetType(event.target.value as ReportTargetType)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
            >
              <option value="USER">Người dùng</option>
              <option value="PRODUCT">Sản phẩm</option>
              <option value="LOST_FOUND">Đồ thất lạc</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500">Link hoặc mã đối tượng</label>
            <input
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
              placeholder="Dán link trang sản phẩm, người bán, đồ thất lạc hoặc mã ID"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
            />
            <p className="mt-1.5 text-xs text-slate-400">
              Dễ nhất là mở trang cần báo cáo rồi dán đường link vào đây. Hệ thống sẽ tự nhận dạng loại đối tượng nếu link là /products, /sellers hoặc /lost-found.
            </p>
          </div>
        </div>

        <div className="mt-3">
          <label className="mb-1.5 block text-xs font-semibold text-slate-500">Lý do báo cáo</label>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={4}
            maxLength={1000}
            placeholder="Mô tả ngắn gọn vấn đề để admin kiểm tra."
            className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-400"
          />
          <div className="mt-1 text-right text-[11px] text-slate-400">{reason.length}/1000</div>
        </div>

        <div className="mt-3 flex justify-end">
          <button
            type="submit"
            disabled={submitting || !targetId.trim() || reason.trim().length < 5}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? 'Đang gửi...' : 'Gửi báo cáo'}
          </button>
        </div>
      </form>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-24 animate-pulse rounded-xl border border-slate-200 bg-slate-50" />
          ))}
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <Flag size={40} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm text-slate-500">Bạn chưa gửi báo cáo nào</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report, index) => {
            const statusInfo = STATUS_LABELS[report.status] || {
              label: report.status,
              color: 'bg-slate-50 text-slate-600 border-slate-200',
              icon: <AlertTriangle size={13} />,
            };
            const reportId = report.id || report._id || `${report.targetType}:${report.targetId}:${report.createdAt}`;

            return (
              <motion.div
                key={reportId}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
                className="rounded-xl border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300"
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                      {TARGET_LABELS[report.targetType] || report.targetType}
                    </span>
                    <span className={`flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-medium ${statusInfo.color}`}>
                      {statusInfo.icon}
                      {statusInfo.label}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs text-slate-400">
                    {new Date(report.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>

                <div className="mb-1 break-all text-xs text-slate-400">ID: {report.targetId}</div>
                <p className="text-sm text-slate-700">{report.reason}</p>

                {report.adminNote && (
                  <div className="mt-2 rounded-lg border border-slate-100 bg-slate-50 p-3">
                    <p className="mb-0.5 text-xs font-medium text-slate-500">Phản hồi từ admin:</p>
                    <p className="text-sm text-slate-600">{report.adminNote}</p>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MyReports;
