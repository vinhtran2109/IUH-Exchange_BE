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
  price?: number;
  status: string;
  category?: string;
  condition?: string;
  location?: string;
  imageUrls?: string[];
  sellerId?: string;
  sellerName?: string;
  sellerStudentId?: string;
  sellerEmail?: string;
  sellerAvatarUrl?: string;
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

const enrichProductsWithSellerProfiles = async (items: ProductModerationData[]) => {
  const missingSellerIds = Array.from(new Set(
    items
      .filter((item) => item.sellerId && !item.sellerName && !item.sellerEmail)
      .map((item) => String(item.sellerId))
  ));
  if (missingSellerIds.length === 0) return items;

  const profileEntries = await Promise.all(
    missingSellerIds.map(async (sellerId) => {
      try {
        const response = await adminService.getUserProfile(sellerId);
        return [sellerId, response?.data] as const;
      } catch {
        return [sellerId, null] as const;
      }
    })
  );
  const profiles = new Map(profileEntries);

  return items.map((item) => {
    const profile = item.sellerId ? profiles.get(String(item.sellerId)) : null;
    if (!profile) return item;
    return {
      ...item,
      sellerName: item.sellerName || profile.name || '',
      sellerStudentId: item.sellerStudentId || profile.studentId || '',
      sellerEmail: item.sellerEmail || profile.email || '',
      sellerAvatarUrl: item.sellerAvatarUrl || profile.avatarUrl || '',
    };
  });
};

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
      const productItems = getList<ProductModerationData>(productRes);
      setProducts(await enrichProductsWithSellerProfiles(productItems));
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
    { id: 'posts' as const, label: 'Bài chờ duyệt', description: 'Sản phẩm cần quyết định', icon: PackageX, count: canModeratePosts ? products.length : 0 },
    { id: 'reports' as const, label: 'Tố cáo', description: 'Báo cáo từ sinh viên', icon: AlertTriangle, count: reports.length },
    { id: 'chat' as const, label: 'Tin nhắn bị tố cáo', description: 'Nội dung chat cần xem', icon: MessageSquareWarning, count: messages.length },
    { id: 'users' as const, label: 'Khóa người dùng', description: 'Tài khoản cần can thiệp', icon: UserRound, count: canBan ? users.length : 0 },
  ];

  const activeMeta = tabs.find((tab) => tab.id === activeTab) || tabs[0];
  const totalQueue = (canModeratePosts ? products.length : 0) + reports.length + messages.length;
  const lockedUsers = users.filter((item) => item.isActive === false).length;

  const formatDateTime = (value?: string) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('vi-VN');
  };

  const shortId = (value?: string) => {
    if (!value) return 'N/A';
    return value.length > 12 ? value.slice(0, 6) + '...' + value.slice(-4) : value;
  };

  const targetLabel = (value?: string) => {
    switch (value) {
      case 'USER': return 'Người dùng';
      case 'PRODUCT': return 'Sản phẩm';
      case 'LOST_FOUND': return 'Đồ thất lạc';
      default: return value || 'Không rõ';
    }
  };

  const currency = (value?: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

  const conditionLabel = (value?: string) => {
    switch (value) {
      case 'NEW': return 'Mới';
      case 'LIKE_NEW': return 'Như mới';
      case 'GOOD': return 'Tốt';
      case 'FAIR': return 'Khá';
      case 'POOR': return 'Cũ';
      default: return value || 'Chưa rõ';
    }
  };

  const statusBadgeClass = (status?: string) => {
    switch (status) {
      case 'PENDING':
      case 'PENDING_APPROVAL':
        return 'bg-amber-50 text-amber-700 ring-1 ring-amber-100';
      case 'REVIEWED':
        return 'bg-blue-50 text-blue-700 ring-1 ring-blue-100';
      case 'RESOLVED':
        return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100';
      case 'DISMISSED':
        return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
      default:
        return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
    }
  };

  const primaryButtonClass = 'inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-xs font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60';
  const dangerButtonClass = 'inline-flex items-center justify-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60';
  const neutralButtonClass = 'inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-3.5 py-2.5 text-xs font-black text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60';

  const renderActionIcon = (id: string, fallback: React.ReactNode) => busyId === id ? <Loader2 size={15} className="animate-spin" /> : fallback;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-100 bg-teal-50 px-3 py-1 text-xs font-black text-teal-700">
              <ShieldCheck size={14} />
              Điều phối viên
            </div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950">Trung tâm kiểm duyệt</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Xử lý bài đăng, tố cáo, tin nhắn vi phạm và khóa tài khoản khi được cấp quyền. Giao diện ưu tiên các việc cần xử lý trước.</p>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-black text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
            Làm mới
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {[
            { label: 'Cần xử lý', value: totalQueue, helper: 'Tổng hàng đợi', icon: AlertTriangle, tone: 'border-amber-100 bg-amber-50 text-amber-700' },
            { label: 'Bài chờ duyệt', value: canModeratePosts ? products.length : 0, helper: canModeratePosts ? 'Có quyền duyệt bài' : 'Chưa có quyền', icon: PackageX, tone: 'border-blue-100 bg-blue-50 text-blue-700' },
            { label: 'Tố cáo', value: reports.length + messages.length, helper: 'Báo cáo và tin nhắn', icon: MessageSquareWarning, tone: 'border-rose-100 bg-rose-50 text-rose-700' },
            { label: 'Tài khoản khóa', value: lockedUsers, helper: canBan ? 'Có thể can thiệp' : 'Chưa có quyền', icon: Ban, tone: 'border-slate-200 bg-slate-50 text-slate-700' },
          ].map((item) => (
            <div key={item.label} className={'rounded-2xl border p-4 ' + item.tone}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-wide opacity-80">{item.label}</div>
                  <div className="mt-2 text-3xl font-black leading-none">{item.value.toLocaleString('vi-VN')}</div>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/80">
                  <item.icon size={22} />
                </div>
              </div>
              <div className="mt-3 text-xs font-bold opacity-80">{item.helper}</div>
            </div>
          ))}
        </div>
      </section>

      {error && (
        <div className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="space-y-3">
          {tabs.map((tab) => {
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={'flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition ' + (active ? 'border-slate-950 bg-slate-950 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200 hover:bg-blue-50')}
              >
                <div className={'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ' + (active ? 'bg-white/10 text-blue-100' : 'bg-slate-50 text-slate-500')}>
                  <tab.icon size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <span className="truncate text-sm font-black">{tab.label}</span>
                    <span className={'rounded-full px-2 py-0.5 text-xs font-black ' + (active ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500')}>{tab.count}</span>
                  </div>
                  <div className={'mt-1 truncate text-xs font-medium ' + (active ? 'text-slate-300' : 'text-slate-400')}>{tab.description}</div>
                </div>
              </button>
            );
          })}
        </aside>

        <main className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-950">{activeMeta.label}</h2>
              <p className="mt-1 text-sm text-slate-500">{activeMeta.description}</p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{activeMeta.count.toLocaleString('vi-VN')} mục</div>
          </div>

          {loading ? (
            <div className="grid min-h-80 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50">
              <div className="text-center">
                <Loader2 size={30} className="mx-auto animate-spin text-slate-400" />
                <p className="mt-3 text-sm font-bold text-slate-500">Đang tải dữ liệu kiểm duyệt...</p>
              </div>
            </div>
          ) : activeTab === 'reports' ? (
            <div className="space-y-3">
              {reports.map((report) => {
                const id = getId(report);
                return (
                  <article key={id} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:shadow-sm">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={'rounded-full px-3 py-1 text-xs font-black ' + statusBadgeClass(report.status)}>{statusLabel[report.status] || report.status}</span>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{targetLabel(report.targetType)}</span>
                          <span className="text-xs font-medium text-slate-400">{formatDateTime(report.createdAt)}</span>
                        </div>
                        <p className="mt-3 text-base font-black text-slate-950">{report.reason}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <span className="rounded-lg bg-slate-50 px-2 py-1 font-bold text-slate-600">Loại đối tượng: {targetLabel(report.targetType)}</span>
                          <span className="rounded-lg bg-slate-50 px-2 py-1 font-bold text-slate-600">Người gửi báo cáo đã được ghi nhận</span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button onClick={() => resolveReport(id, 'DISMISSED')} disabled={busyId === id} className={neutralButtonClass}>{renderActionIcon(id, <XCircle size={15} />)} Bỏ qua</button>
                        <button onClick={() => resolveReport(id, 'RESOLVED')} disabled={busyId === id} className={primaryButtonClass}>{renderActionIcon(id, <CheckCircle2 size={15} />)} Xử lý</button>
                      </div>
                    </div>
                  </article>
                );
              })}
              {reports.length === 0 && <EmptyState title="Không có tố cáo đang chờ" text="Những báo cáo mới từ sinh viên sẽ xuất hiện ở đây." />}
            </div>
          ) : activeTab === 'posts' ? (
            <div className="space-y-3">
              {!canModeratePosts ? (
                <EmptyState title="Chưa có quyền duyệt bài" text="Tài khoản này cần quyền CAN_APPROVE_POST để thao tác." />
              ) : (
                products.map((product) => {
                  const id = getId(product);
                  const imageUrl = product.imageUrls?.[0] || '';
                  const sellerLabel = product.sellerName || product.sellerEmail || 'Chưa có tên người bán';
                  return (
                    <article key={id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-blue-200 hover:shadow-sm">
                      <div className="grid gap-0 lg:grid-cols-[220px_1fr]">
                        <div className="relative aspect-[4/3] bg-slate-100 lg:aspect-auto lg:min-h-[190px]">
                          {imageUrl ? (
                            <img src={imageUrl} alt={product.title} className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full flex-col items-center justify-center text-slate-400">
                              <PackageX size={32} />
                              <span className="mt-2 text-xs font-bold">Chưa có ảnh</span>
                            </div>
                          )}
                          {product.imageUrls && product.imageUrls.length > 1 && (
                            <span className="absolute bottom-3 right-3 rounded-full bg-slate-950/80 px-2.5 py-1 text-xs font-black text-white">
                              {product.imageUrls.length} ảnh
                            </span>
                          )}
                        </div>

                        <div className="flex min-w-0 flex-col gap-4 p-4">
                          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700 ring-1 ring-blue-100">Chờ duyệt</span>
                                {product.category && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{product.category}</span>}
                                <span className="text-xs font-medium text-slate-400">{formatDateTime(product.createdAt)}</span>
                              </div>
                              <h3 className="mt-3 text-xl font-black tracking-tight text-slate-950">{product.title}</h3>
                              {product.description && <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{product.description}</p>}
                            </div>
                            <div className="text-left xl:text-right">
                              <div className="text-2xl font-black text-slate-950">{currency(product.price)}</div>
                              <div className="mt-1 text-xs font-bold text-slate-400">Giá niêm yết</div>
                            </div>
                          </div>

                          <div className="grid gap-3 md:grid-cols-3">
                            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3">
                              <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">Người bán</div>
                              <div className="mt-1 truncate text-sm font-black text-slate-800">{sellerLabel}</div>
                              <div className="mt-0.5 text-xs font-medium text-slate-500">{product.sellerStudentId || product.sellerEmail || 'Chưa cập nhật MSSV'}</div>
                            </div>
                            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3">
                              <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">Tình trạng</div>
                              <div className="mt-1 text-sm font-black text-slate-800">{conditionLabel(product.condition)}</div>
                              <div className="mt-0.5 text-xs font-medium text-slate-500">{product.location || 'Chưa có vị trí'}</div>
                            </div>
                            <div className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3">
                              <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">Hình ảnh</div>
                              <div className="mt-1 text-sm font-black text-slate-800">{product.imageUrls?.length || 0} ảnh</div>
                              <div className="mt-0.5 text-xs font-medium text-slate-500">Dùng để kiểm tra nội dung</div>
                            </div>
                          </div>

                          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                            <button onClick={() => resolveProduct(id, 'REJECT')} disabled={busyId === id} className={dangerButtonClass}>{renderActionIcon(id, <XCircle size={15} />)} Ẩn bài</button>
                            <button onClick={() => resolveProduct(id, 'APPROVE')} disabled={busyId === id} className={primaryButtonClass}>{renderActionIcon(id, <CheckCircle2 size={15} />)} Duyệt</button>
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
              {canModeratePosts && products.length === 0 && <EmptyState title="Không có bài chờ duyệt" text="Hàng đợi duyệt bài đang trống." />}
            </div>
          ) : activeTab === 'chat' ? (
            <div className="space-y-3">
              {messages.map((message) => {
                const id = getId(message);
                return (
                  <article key={id} className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-blue-200 hover:shadow-sm">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={'rounded-full px-3 py-1 text-xs font-black ' + statusBadgeClass(message.moderationStatus)}>{statusLabel[message.moderationStatus] || message.moderationStatus}</span>
                          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-mono font-bold text-slate-600">{shortId(message.senderId)} → {shortId(message.receiverId)}</span>
                        </div>
                        <p className="mt-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold leading-6 text-slate-800">{message.content}</p>
                        <div className="mt-3 space-y-1">
                          {(message.reports || []).map((report, index) => <p key={id + '-' + index} className="text-xs font-medium text-rose-600">Lý do: {report.reason}</p>)}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button onClick={() => resolveMessage(id, 'DISMISSED')} disabled={busyId === id} className={neutralButtonClass}>{renderActionIcon(id, <XCircle size={15} />)} Bỏ qua</button>
                        <button onClick={() => resolveMessage(id, 'REVIEWED')} disabled={busyId === id} className={primaryButtonClass}>{renderActionIcon(id, <CheckCircle2 size={15} />)} Đã xử lý</button>
                      </div>
                    </div>
                  </article>
                );
              })}
              {messages.length === 0 && <EmptyState title="Không có tin nhắn bị tố cáo" text="Tin nhắn vi phạm đang chờ xử lý sẽ hiển thị tại đây." />}
            </div>
          ) : (
            <div className="space-y-4">
              <label className="relative block max-w-xl">
                <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-medium outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" placeholder="Tìm sinh viên theo tên, email, MSSV" />
              </label>
              {!canBan ? (
                <EmptyState title="Chưa có quyền khóa" text="Tài khoản này cần quyền CAN_BAN để thao tác." />
              ) : (
                <div className="divide-y divide-slate-100 rounded-2xl border border-slate-100">
                  {visibleUsers.map((item) => {
                    const id = getId(item);
                    const locked = item.isActive === false;
                    const disabled = item.role === 'ADMIN' || busyId === id;
                    return (
                      <div key={id} className="flex flex-col gap-3 p-4 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <div className="truncate font-black text-slate-950">{item.name || item.email}</div>
                          <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                            <span>{item.email}</span>
                            <span>{item.studentId || 'Chưa có MSSV'}</span>
                            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-bold text-slate-600">{item.role}</span>
                            <span className={'rounded-full px-2 py-0.5 font-bold ' + (locked ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700')}>{locked ? 'Đang khóa' : 'Hoạt động'}</span>
                          </div>
                        </div>
                        <button onClick={() => toggleBan(item)} disabled={disabled} className={(locked ? primaryButtonClass : dangerButtonClass)}>
                          {renderActionIcon(id, locked ? <CheckCircle2 size={15} /> : <Ban size={15} />)}
                          {locked ? 'Mở khóa' : 'Khóa'}
                        </button>
                      </div>
                    );
                  })}
                  {visibleUsers.length === 0 && <EmptyState title="Không tìm thấy sinh viên" text="Thử thay đổi từ khóa tìm kiếm." />}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );

};

const EmptyState = ({ title = 'Chưa có dữ liệu', text }: { title?: string; text: string }) => (
  <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-8 text-center">
    <div>
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
        <PackageX size={24} />
      </div>
      <p className="mt-4 text-sm font-black text-slate-800">{title}</p>
      <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">{text}</p>
    </div>
  </div>
);

export default ModerationDashboard;
