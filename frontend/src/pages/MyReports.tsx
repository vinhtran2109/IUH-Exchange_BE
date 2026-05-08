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
  PENDING: { label: 'Chờ xử lý', color: 'bg-amber-50 text-amber-600 border-amber-100', icon: <Clock size={14} /> },
  REVIEWED: { label: 'Đã xem xét', color: 'bg-blue-50 text-blue-600 border-blue-100', icon: <AlertTriangle size={14} /> },
  RESOLVED: { label: 'Đã xử lý', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: <CheckCircle size={14} /> },
  DISMISSED: { label: 'Đã bỏ qua', color: 'bg-slate-50 text-slate-500 border-slate-100', icon: <XCircle size={14} /> },
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
      const res = await api.get('/reports/my?page=0&size=50');
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
    <div className="max-w-3xl mx-auto py-10 px-4">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-medium mb-8 transition-colors"
      >
        <ArrowLeft size={18} />
        Quay lại
      </button>

      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2 flex items-center gap-3">
          <Flag size={28} className="text-indigo-500" />
          Báo cáo của tôi
        </h1>
        <p className="text-slate-500">Theo dõi trạng thái các báo cáo bạn đã gửi</p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-28 bg-slate-100 animate-pulse rounded-2xl" />)}
        </div>
      ) : reports.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
          <Flag size={48} className="mx-auto text-slate-200 mb-4" />
          <p className="text-slate-500 font-medium">Bạn chưa gửi báo cáo nào</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map((report, i) => {
            const statusInfo = STATUS_LABELS[report.status] || { label: report.status, color: 'bg-slate-50 text-slate-500 border-slate-100', icon: <AlertTriangle size={14} /> };
            return (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-md transition-all"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg">
                      {TARGET_LABELS[report.targetType] || report.targetType}
                    </span>
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold flex items-center gap-1 border ${statusInfo.color}`}>
                      {statusInfo.icon}
                      {statusInfo.label}
                    </span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(report.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>

                <p className="text-sm text-slate-700 font-medium mb-2">{report.reason}</p>

                {report.adminNote && (
                  <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-xs font-bold text-slate-500 mb-1">Phản hồi từ Admin:</p>
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
