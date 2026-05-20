import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Bell,
  ShoppingCart,
  PackageCheck,
  AlertOctagon,
  Info,
  Check,
  CheckCheck,
  ArrowLeft,
  Clock,
  MessageSquare,
  Star,
} from 'lucide-react';
import { notificationService, normalizeNotification } from '../services/notificationService';
import type { Notification } from '../services/notificationService';

/* ─── Map type → route ─────────────────────────────────────────────────────── */
const getNotifLink = (n: Notification): string | null => {
  const t = n.type?.toUpperCase() || '';
  if (!n.targetId) return null;
  if (t.includes('ORDER')) return `/orders/${n.targetId}`;
  if (t === 'PRODUCT' || t.includes('PRODUCT')) return `/products/${n.targetId}`;
  if (t.includes('LOST')) return `/lost-found/${n.targetId}`;
  if (t.includes('KARMA')) return '/karma-history';
  if (t.includes('REPORT')) return '/my-reports';
  return null;
};

/* ─── Icon per type ─────────────────────────────────────────────────────────── */
const NotifIcon: React.FC<{ type: string }> = ({ type }) => {
  const t = type?.toUpperCase() || '';
  if (t.includes('ORDER'))   return <ShoppingCart size={16} />;
  if (t.includes('PRODUCT')) return <PackageCheck size={16} />;
  if (t.includes('KARMA'))   return <AlertOctagon size={16} />;
  if (t.includes('CHAT') || t.includes('MESSAGE')) return <MessageSquare size={16} />;
  if (t.includes('REVIEW'))  return <Star size={16} />;
  return <Info size={16} />;
};

const iconBg = (type: string) => {
  const t = type?.toUpperCase() || '';
  if (t.includes('ORDER'))   return 'bg-emerald-100 text-emerald-600';
  if (t.includes('PRODUCT')) return 'bg-amber-100 text-amber-600';
  if (t.includes('KARMA'))   return 'bg-purple-100 text-purple-600';
  if (t.includes('CHAT') || t.includes('MESSAGE')) return 'bg-blue-100 text-blue-600';
  if (t.includes('REVIEW'))  return 'bg-yellow-100 text-yellow-600';
  return 'bg-slate-100 text-slate-500';
};

const TYPE_LABELS: Record<string, string> = {
  ORDER:         'Đơn hàng',
  ORDER_UPDATE:  'Đơn hàng',
  PRODUCT:       'Sản phẩm',
  KARMA_UPDATE:  'Karma',
  CHAT:          'Tin nhắn',
  MESSAGE:       'Tin nhắn',
  REVIEW:        'Đánh giá',
  REPORT:        'Tố cáo',
  SYSTEM:        'Hệ thống',
};

const typeLabel = (t?: string) => t ? (TYPE_LABELS[t.toUpperCase()] ?? t) : 'Thông báo';

/* ─── Time ago helper ────────────────────────────────────────────────────────── */
const timeAgo = (iso?: string) => {
  if (!iso) return 'Vừa xong';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'Vừa xong';
  if (mins < 60) return `${mins} phút trước`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs} giờ trước`;
  const days = Math.floor(hrs / 24);
  return `${days} ngày trước`;
};

/* ─── Page ───────────────────────────────────────────────────────────────────── */
const Notifications: React.FC = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const res = await notificationService.getNotifications();
        if (res.success) setNotifications(res.data.map(normalizeNotification));
      } catch { /* ignore */ }
      finally { setLoading(false); }
    })();
  }, []);

  const handleMarkRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch { /* ignore */ }
  };

  const handleMarkAll = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch { /* ignore */ }
  };

  const handleClick = (n: Notification) => {
    if (!n.isRead) handleMarkRead(n.id);
    const link = getNotifLink(n);
    if (link) navigate(link);
  };

  const displayed = filter === 'unread' ? notifications.filter(n => !n.isRead) : notifications;
  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Bell size={20} className="text-indigo-500" />
            Thông báo
            {unreadCount > 0 && (
              <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-[10px] font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">Tất cả thông báo của bạn</p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAll}
            className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100"
          >
            <CheckCheck size={14} />
            Đọc tất cả
          </button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex p-1 bg-slate-100 rounded-lg w-fit mb-6 gap-1">
        {(['all', 'unread'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
              filter === f ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {f === 'all' ? 'Tất cả' : `Chưa đọc${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="h-20 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : displayed.length === 0 ? (
        <div className="py-24 text-center">
          <Bell size={40} className="mx-auto mb-3 text-slate-200" />
          <p className="text-slate-400 text-sm font-medium">
            {filter === 'unread' ? 'Bạn đã đọc hết thông báo!' : 'Chưa có thông báo nào.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map((n, i) => {
            const link = getNotifLink(n);
            return (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => handleClick(n)}
                className={`relative flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all hover:shadow-sm ${
                  n.isRead
                    ? 'border-slate-200 bg-white hover:border-slate-300'
                    : 'border-indigo-100 bg-indigo-50/50 hover:border-indigo-200'
                }`}
              >
                {/* Unread dot */}
                {!n.isRead && (
                  <span className="absolute top-4 right-4 w-2 h-2 rounded-full bg-indigo-500" />
                )}

                {/* Icon */}
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg(n.type)}`}>
                  <NotifIcon type={n.type} />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pr-4">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                      {typeLabel(n.type)}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-slate-800 leading-snug">{n.message}</p>
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
                    <Clock size={11} />
                    <span>{timeAgo(n.createdAt)}</span>
                    {link && (
                      <>
                        <span>·</span>
                        <span className="text-indigo-500 font-medium">Xem chi tiết →</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Mark read button */}
                {!n.isRead && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleMarkRead(n.id); }}
                    className="shrink-0 p-1 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-white transition-all"
                    title="Đánh dấu đã đọc"
                  >
                    <Check size={14} />
                  </button>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Notifications;
