import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Loader2,
  MessageSquareWarning,
  PackageX,
  RefreshCw,
  Search,
  ShieldCheck,
  UserRound,
  XCircle,
} from 'lucide-react';
import { adminService, type ReportData, type ReportedMessageData, type UserAdminData } from '../services/adminService';
import { useAuthStore } from '../store/authStore';

type TabId = 'reports' | 'posts' | 'chat' | 'users';

type ProductModerationData = {
  id: string;
  _id?: string;
  title: string;
  description?: string;
  status: string;
  category?: string;
  sellerId?: string;
  createdAt: string;
};

const getList = <T,>(response: any): T[] => {
  const data = response?.data;
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.content)) return data.content;
  if (Array.isArray(data?.data?.content)) return data.data.content;
  return [];
};

const getId = (item: any) => String(item?.id || item?._id || '');

const statusLabel: Record<string, string> = {
  PENDING: 'Chờ xử lý',
  REVIEWED: 'Đã xem',
  RESOLVED: 'Đã xử lý',
  DISMISSED: 'Bỏ qua',
};

const ModerationDashboard: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState<TabId>('reports');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reports, setReports] = useState<ReportData[]>([]);
  const [messages, setMessages] = useState<ReportedMessageData[]>([]);
  const [products, setProducts] = useState<ProductModerationData[]>([]);
  const [users, setUsers] = useState<UserAdminData[]>([]);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState('');

  const canBan = user?.role === 'ADMIN' || user?.permissions?.includes('CAN_BAN');
  const canModeratePosts = user?.role === 'ADMIN' || user?.permissions?.includes('CAN_APPROVE_POST');

  const visibleUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((item) =>
      [item.name, item.email, item.studentId, item.role].some((value) => String(value || '').toLowerCase().includes(query))
    );
  }, [search, users]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [reportRes, messageRes, productRes, userRes] = await Promise.all([
        adminService.getReports('PENDING', 1, 50),
        adminService.getReportedMessages('PENDING', 1, 50),
        canModeratePosts ? adminService.getPendingProducts(1, 50) : Promise.resolve({ data: { content: [] } }),
        canBan ? adminService.getAllUsers(1, 100) : Promise.resolve({ data: { content: [] } }),
      ]);
      setReports(getList<ReportData>(reportRes));
      setMessages(getList<ReportedMessageData>(messageRes));
      setProducts(getList<ProductModerationData>(productRes));
      setUsers(getList<UserAdminData>(userRes));
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Không thể tải dữ liệu kiểm duyệt.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    document.title = 'Kiểm duyệt | IUH Exchange';
    loadData();
  }, []);

  const resolveReport = async (reportId: string, status: 'RESOLVED' | 'DISMISSED') => {
    setBusyId(reportId);
    try {
      await adminService.resolveReport(reportId, status, status === 'RESOLVED' ? 'Moderator resolved' : 'Moderator dismissed');
      setReports((current) => current.filter((item) => getId(item) !== reportId));
    } finally {
      setBusyId('');
    }
  };

  const resolveMessage = async (messageId: string, status: 'REVIEWED' | 'DISMISSED') => {
    setBusyId(messageId);
    try {
      await adminService.resolveReportedMessage(messageId, status);
      setMessages((current) => current.filter((item) => getId(item) !== messageId));
    } finally {
      setBusyId('');
    }
  };

  const resolveProduct = async (productId: string, action: 'APPROVE' | 'REJECT') => {
    setBusyId(productId);
    try {
      await adminService.resolveProductStatus(productId, action);
      setProducts((current) => current.filter((item) => getId(item) !== productId));
    } finally {
      setBusyId('');
    }
  };

  const toggleBan = async (targetUser: UserAdminData) => {
    if (!canBan || targetUser.role === 'ADMIN') return;
    const id = getId(targetUser);
    setBusyId(id);
    try {
      const response = await adminService.toggleBanUser(id);
      const updated = response?.data;
      setUsers((current) => current.map((item) => (getId(item) === id ? { ...item, ...updated } : item)));
    } finally {
      setBusyId('');
    }
  };

  const tabs = [
    { id: 'posts' as const, label: 'Bai cho duyet', icon: PackageX, count: canModeratePosts ? products.length : 0 },
    { id: 'reports' as const, label: 'Tố cáo', icon: AlertTriangle, count: reports.length },
    { id: 'chat' as const, label: 'Tin nhắn bị tố cáo', icon: MessageSquareWarning, count: messages.length },
    { id: 'users' as const, label: 'Khóa người dùng', icon: UserRound, count: canBan ? users.length : 0 },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-lg bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700">
            <ShieldCheck size={14} />
            Điều phối viên
          </div>
          <h1 className="text-2xl font-black text-slate-950">Trung tâm kiểm duyệt</h1>
          <p className="mt-1 text-sm text-slate-500">Xử lý báo cáo, tin nhắn vi phạm và khóa tài khoản khi được cấp quyền.</p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
          Làm mới
        </button>
      </div>

      {error && (
        <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-bold transition ${
              activeTab === tab.id ? 'bg-slate-950 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
            }`}
          >
            <tab.icon size={16} />
            {tab.label}
            <span className={activeTab === tab.id ? 'text-teal-200' : 'text-slate-400'}>{tab.count}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid min-h-72 place-items-center rounded-lg border border-slate-200 bg-white">
          <Loader2 size={28} className="animate-spin text-slate-400" />
        </div>
      ) : activeTab === 'reports' ? (
        <div className="space-y-3">
          {reports.map((report) => {
            const id = getId(report);
            return (
              <div key={id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                      <span className="rounded bg-amber-50 px-2 py-1 text-amber-700">{statusLabel[report.status] || report.status}</span>
                      <span>{report.targetType}</span>
                      <span>{new Date(report.createdAt).toLocaleString('vi-VN')}</span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-900">{report.reason}</p>
                    <p className="mt-1 break-all text-xs text-slate-400">Target: {report.targetId}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button onClick={() => resolveReport(id, 'DISMISSED')} disabled={busyId === id} className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200">
                      <XCircle size={15} /> Bỏ qua
                    </button>
                    <button onClick={() => resolveReport(id, 'RESOLVED')} disabled={busyId === id} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">
                      <CheckCircle2 size={15} /> Xử lý
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {reports.length === 0 && <EmptyState text="Không có tố cáo đang chờ xử lý." />}
        </div>
      ) : activeTab === 'posts' ? (
        <div className="space-y-3">
          {!canModeratePosts ? (
            <EmptyState text="Tai khoan nay chua co quyen CAN_APPROVE_POST." />
          ) : (
            products.map((product) => {
              const id = getId(product);
              return (
                <div key={id} className="rounded-lg border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                        <span className="rounded bg-sky-50 px-2 py-1 text-sky-700">{product.status}</span>
                        {product.category && <span>{product.category}</span>}
                        <span>{new Date(product.createdAt).toLocaleString('vi-VN')}</span>
                      </div>
                      <p className="mt-3 text-sm font-semibold text-slate-900">{product.title}</p>
                      {product.description && <p className="mt-1 line-clamp-2 text-xs text-slate-500">{product.description}</p>}
                      {product.sellerId && <p className="mt-1 break-all text-xs text-slate-400">Seller: {product.sellerId}</p>}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button onClick={() => resolveProduct(id, 'REJECT')} disabled={busyId === id} className="inline-flex items-center gap-2 rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100">
                        <XCircle size={15} /> An bai
                      </button>
                      <button onClick={() => resolveProduct(id, 'APPROVE')} disabled={busyId === id} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">
                        <CheckCircle2 size={15} /> Duyet
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
          {canModeratePosts && products.length === 0 && <EmptyState text="Khong co bai dang cho duyet." />}
        </div>
      ) : activeTab === 'chat' ? (
        <div className="space-y-3">
          {messages.map((message) => {
            const id = getId(message);
            return (
              <div key={id} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                      <span className="rounded bg-rose-50 px-2 py-1 text-rose-700">{statusLabel[message.moderationStatus] || message.moderationStatus}</span>
                      <span>{message.senderId} {'->'} {message.receiverId}</span>
                    </div>
                    <p className="mt-3 text-sm font-semibold text-slate-900">{message.content}</p>
                    {message.reports?.map((report, index) => (
                      <p key={`${id}-${index}`} className="mt-1 text-xs text-slate-500">Lý do: {report.reason}</p>
                    ))}
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button onClick={() => resolveMessage(id, 'DISMISSED')} disabled={busyId === id} className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200">
                      <XCircle size={15} /> Bỏ qua
                    </button>
                    <button onClick={() => resolveMessage(id, 'REVIEWED')} disabled={busyId === id} className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700">
                      <CheckCircle2 size={15} /> Đã xử lý
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {messages.length === 0 && <EmptyState text="Không có tin nhắn bị tố cáo đang chờ xử lý." />}
        </div>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 p-4">
            <label className="relative block max-w-md">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full rounded-lg border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-slate-400"
                placeholder="Tìm sinh viên theo tên, email, MSSV"
              />
            </label>
          </div>
          {!canBan ? (
            <EmptyState text="Tài khoản này chưa có quyền CAN_BAN." />
          ) : (
            <div className="divide-y divide-slate-100">
              {visibleUsers.map((item) => {
                const id = getId(item);
                const locked = item.isActive === false;
                const disabled = item.role === 'ADMIN' || busyId === id;
                return (
                  <div key={id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="font-bold text-slate-900">{item.name || item.email}</div>
                      <div className="mt-1 text-xs text-slate-500">{item.email} • {item.studentId || 'Chưa có MSSV'} • {item.role}</div>
                    </div>
                    <button
                      onClick={() => toggleBan(item)}
                      disabled={disabled}
                      className={`inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-bold disabled:cursor-not-allowed disabled:opacity-50 ${
                        locked ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
                      }`}
                    >
                      {locked ? <CheckCircle2 size={15} /> : <Ban size={15} />}
                      {locked ? 'Mở khóa' : 'Khóa'}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const EmptyState = ({ text }: { text: string }) => (
  <div className="grid min-h-48 place-items-center rounded-lg border border-dashed border-slate-200 bg-white p-8 text-center">
    <div>
      <PackageX size={28} className="mx-auto text-slate-300" />
      <p className="mt-3 text-sm font-semibold text-slate-500">{text}</p>
    </div>
  </div>
);

export default ModerationDashboard;
