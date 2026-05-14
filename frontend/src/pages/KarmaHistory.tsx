import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ArrowLeft, TrendingUp, Clock, ArrowUp, ArrowDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

interface KarmaEntry {
  _id: string;
  amount: number;
  previousKarma: number;
  newKarma: number;
  reason: string;
  source: string;
  createdAt: string;
}

const KarmaHistory: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuthStore() as any;
  const [history, setHistory] = useState<KarmaEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    fetchHistory();
  }, [page]);

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/users/me/karma-history?page=${page}&size=20`);
      if (res.data?.success) {
        setHistory(res.data.data.content || []);
        setTotalPages(res.data.data.totalPages || 1);
      }
    } catch (e) {
      console.error('Failed to fetch karma history', e);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getSourceLabel = (source: string) => {
    switch (source) {
      case 'ADMIN': return 'Admin điều chỉnh';
      case 'ORDER': return 'Giao dịch';
      case 'REPORT': return 'Tố cáo';
      case 'SYSTEM': return 'Hệ thống';
      default: return source;
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-10 px-4">
      <button
        onClick={() => navigate('/profile')}
        className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-medium mb-8 transition-colors"
      >
        <ArrowLeft size={18} />
        Quay lại hồ sơ
      </button>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">Lịch sử Karma</h1>
        <p className="text-slate-500">Theo dõi sự thay đổi điểm Karma của bạn</p>
      </div>

      {/* Current Karma */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-gradient-to-br from-indigo-600 to-violet-600 rounded-3xl p-8 text-white mb-8 shadow-xl shadow-indigo-200"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-indigo-200 text-sm font-bold uppercase tracking-wider mb-1">Điểm Karma hiện tại</p>
            <p className="text-6xl font-black tracking-tight">{user?.karmaPoint ?? 0}</p>
          </div>
          <div className="w-20 h-20 bg-white/10 rounded-[1.5rem] flex items-center justify-center">
            <TrendingUp size={40} />
          </div>
        </div>
        <p className="text-indigo-200 text-xs mt-4">
          Karma dưới 0 sẽ bị khóa quyền đăng bài. Giao dịch thành công sẽ được cộng điểm.
        </p>
      </motion.div>

      {/* History List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-20 bg-slate-100 animate-pulse rounded-2xl" />
          ))}
        </div>
      ) : history.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-200">
          <Clock size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500 font-medium">Chưa có lịch sử thay đổi Karma</p>
        </div>
      ) : (
        <div className="space-y-3">
          {history.map((entry, i) => (
            <motion.div
              key={entry._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-2xl border border-slate-100 p-5 flex items-center gap-4 hover:shadow-md transition-all"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${entry.amount > 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                {entry.amount > 0 ? <ArrowUp size={24} /> : <ArrowDown size={24} />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`font-black text-lg ${entry.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {entry.amount > 0 ? '+' : ''}{entry.amount}
                  </span>
                  <span className="text-xs text-slate-400 font-medium">
                    ({entry.previousKarma} → {entry.newKarma})
                  </span>
                </div>
                <p className="text-sm text-slate-700 font-medium truncate">
                  {entry.reason || getSourceLabel(entry.source)}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {getSourceLabel(entry.source)}
                  </span>
                  <span className="text-[10px] text-slate-300">•</span>
                  <span className="text-[10px] text-slate-400">
                    {formatDate(entry.createdAt)}
                  </span>
                </div>
              </div>
            </motion.div>
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-6">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 disabled:opacity-30"
              >
                <ArrowLeft size={16} />
              </button>
              <span className="text-sm text-slate-500 font-medium px-3">
                Trang {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:border-indigo-300 disabled:opacity-30"
              >
                <ArrowLeft size={16} className="rotate-180" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default KarmaHistory;
