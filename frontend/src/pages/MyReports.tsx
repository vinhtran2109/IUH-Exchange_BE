import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Flag, Clock, CheckCircle, XCircle, AlertTriangle, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

interface Report {
  id: string;
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

const MyReports: React.FC = () => {
  const navigate = useNavigate();
  const [reports, setReports] = useState<Report[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const res = await api.get('/reports/my?page=1&size=50');
      if (res.data?.success) {
        setReports(res.data.data.content || []);
      }
    } catch (e) {
      console.error('Failed to fetch reports', e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 text-sm font-medium mb-6 transition-colors"
      >
        <ArrowLeft size={16} />
        Quay lại
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-1 flex items-center gap-2">
          <Flag size={22} className="text-slate-500" />
          Báo cáo của tôi
        </h1>
        <p className="text-slate-500 text-sm">Theo dõi trạng thái các báo cáo bạn đã gửi</p>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-50 animate-pulse rounded-xl border border-slate-200" />)}
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-dashed border-slate-200">
          <Flag size={40} className="mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 text-sm">Bạn chưa gửi báo cáo nào</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report, i) => {
            const statusInfo = STATUS_LABELS[report.status] || { label: report.status, color: 'bg-slate-50 text-slate-600 border-slate-200', icon: <AlertTriangle size={13} /> };
            return (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded">
                      {TARGET_LABELS[report.targetType] || report.targetType}
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[11px] font-medium flex items-center gap-1 border ${statusInfo.color}`}>
                      {statusInfo.icon}
                      {statusInfo.label}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(report.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>

                <p className="text-sm text-slate-700 mb-1">{report.reason}</p>

                {report.adminNote && (
                  <div className="mt-2 p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <p className="text-xs font-medium text-slate-500 mb-0.5">Phản hồi từ Admin:</p>
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
