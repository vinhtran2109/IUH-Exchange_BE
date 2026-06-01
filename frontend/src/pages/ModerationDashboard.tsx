import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Ban,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  PackageX,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
  UserRound,
  XCircle,
} from 'lucide-react';
import {
  adminService,
  type LostFoundAdminData,
  type ReportData,
  type UserAdminData,
} from '../services/adminService';
import { useAuthStore } from '../store/authStore';

type TabId = 'posts' | 'lostFound' | 'reports' | 'users';

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

const normalizeSearch = (value?: string | number) => String(value || '').toLowerCase();

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
  PENDING_APPROVAL: 'Chờ duyệt',
  AVAILABLE: 'Đang bán',
  SOLD: 'Đã bán',
  HIDDEN: 'Đã ẩn',
  REJECTED: 'Từ chối',
  REVIEWED: 'Đã xem',
  RESOLVED: 'Đã xử lý',
  DISMISSED: 'Bỏ qua',
  OPEN: 'Đang mở',
  CLAIMED: 'Có người nhận',
  CLOSED: 'Đã đóng',
};

const typeLabel: Record<string, string> = {
  LOST: 'Đồ thất lạc',
  FOUND: 'Nhặt được',
};

const ModerationDashboard: React.FC = () => {
  const user = useAuthStore((state) => state.user);
  const [activeTab, setActiveTab] = useState<TabId>('posts');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reports, setReports] = useState<ReportData[]>([]);
  const [products, setProducts] = useState<ProductModerationData[]>([]);
  const [lostFoundItems, setLostFoundItems] = useState<LostFoundAdminData[]>([]);
  const [users, setUsers] = useState<UserAdminData[]>([]);
  const [search, setSearch] = useState('');
  const [busyId, setBusyId] = useState('');

  const canBan = user?.role === 'ADMIN' || user?.permissions?.includes('CAN_BAN');
  const canModeratePosts = user?.role === 'ADMIN' || user?.permissions?.includes('CAN_APPROVE_POST');

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return products;
    return products.filter((item) =>
      [
        item.title,
        item.description,
        item.category,
        item.condition,
        item.location,
        item.status,
        item.sellerName,
        item.sellerStudentId,
        item.sellerEmail,
      ].some((value) => normalizeSearch(value).includes(query))
    );
  }, [products, search]);

  const filteredLostFoundItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return lostFoundItems;
    return lostFoundItems.filter((item) =>
      [
        item.title,
        item.description,
        item.type,
        item.status,
        item.location,
        item.contactInfo,
        item.studentId,
        item.userName,
        item.category,
      ].some((value) => normalizeSearch(value).includes(query))
    );
  }, [lostFoundItems, search]);

  const filteredReports = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return reports;
    return reports.filter((item) =>
      [item.reason, item.targetType, item.status].some((value) => normalizeSearch(value).includes(query))
    );
  }, [reports, search]);

  const visibleUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return users;
    return users.filter((item) =>
      [item.name, item.email, item.studentId, item.role].some((value) => normalizeSearch(value).includes(query))
    );
  }, [search, users]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [reportRes, productRes, lostFoundRes, userRes] = await Promise.all([
        adminService.getReports('PENDING', 1, 100),
        canModeratePosts ? adminService.getAdminProducts('ALL', 1, 100) : Promise.resolve({ data: { content: [] } }),
        adminService.getAdminLostFoundItems('ALL', 'ALL', 1, 100),
        canBan ? adminService.getAllUsers(1, 100) : Promise.resolve({ data: { content: [] } }),
      ]);

      const productItems = getList<ProductModerationData>(productRes);
      setReports(getList<ReportData>(reportRes));
      setProducts(await enrichProductsWithSellerProfiles(productItems));
      setLostFoundItems(getList<LostFoundAdminData>(lostFoundRes));
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

  const resolveProduct = async (productId: string, action: 'APPROVE' | 'REJECT') => {
    setBusyId(productId);
    try {
      await adminService.resolveProductStatus(productId, action);
      setProducts((current) =>
        current.map((item) =>
          getId(item) === productId
            ? { ...item, status: action === 'APPROVE' ? 'AVAILABLE' : 'REJECTED' }
            : item
        )
      );
    } finally {
      setBusyId('');
    }
  };

  const closeLostFoundItem = async (itemId: string) => {
    setBusyId(itemId);
    try {
      await adminService.bulkModerateLostFound([itemId], 'CLOSE');
      setLostFoundItems((current) =>
        current.map((item) => (getId(item) === itemId ? { ...item, status: 'CLOSED' } : item))
      );
    } finally {
      setBusyId('');
    }
  };

  const deleteLostFoundItem = async (itemId: string) => {
    setBusyId(itemId);
    try {
      await adminService.deleteLostFoundItem(itemId);
      setLostFoundItems((current) => current.filter((item) => getId(item) !== itemId));
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

  const pendingProducts = products.filter((item) => item.status === 'PENDING_APPROVAL').length;
  const openLostFound = lostFoundItems.filter((item) => item.status !== 'CLOSED' && item.status !== 'RESOLVED').length;
  const lockedUsers = users.filter((item) => item.isActive === false).length;
  const totalQueue = pendingProducts + reports.length + openLostFound;

  const tabs = [
    { id: 'posts' as const, label: 'Bài đăng sản phẩm', description: 'Quản lý tất cả sản phẩm', icon: PackageX, count: canModeratePosts ? products.length : 0 },
    { id: 'lostFound' as const, label: 'Mất / nhặt đồ', description: 'Tin mất đồ và tìm được đồ', icon: MapPin, count: lostFoundItems.length },
    { id: 'reports' as const, label: 'Tố cáo', description: 'Báo cáo từ sinh viên', icon: AlertTriangle, count: reports.length },
    { id: 'users' as const, label: 'Khóa người dùng', description: 'Tài khoản cần can thiệp', icon: UserRound, count: canBan ? users.length : 0 },
  ];

  const activeMeta = tabs.find((tab) => tab.id === activeTab) || tabs[0];

  const formatDateTime = (value?: string) => {
    if (!value) return 'N/A';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('vi-VN');
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
      case 'CLAIMED':
        return 'bg-amber-50 text-amber-700 ring-1 ring-amber-100';
      case 'OPEN':
      case 'REVIEWED':
        return 'bg-blue-50 text-blue-700 ring-1 ring-blue-100';
      case 'AVAILABLE':
      case 'RESOLVED':
        return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100';
      case 'SOLD':
        return 'bg-violet-50 text-violet-700 ring-1 ring-violet-100';
      case 'HIDDEN':
      case 'REJECTED':
      case 'CLOSED':
      case 'DISMISSED':
        return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
      default:
        return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
    }
  };

  const typeBadgeClass = (type?: string) =>
    type === 'FOUND'
      ? 'bg-cyan-50 text-cyan-700 ring-1 ring-cyan-100'
      : 'bg-rose-50 text-rose-700 ring-1 ring-rose-100';

  const primaryButtonClass = 'inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3.5 py-2.5 text-xs font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60';
  const dangerButtonClass = 'inline-flex items-center justify-center gap-2 rounded-xl bg-rose-50 px-3.5 py-2.5 text-xs font-black text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60';
  const neutralButtonClass = 'inline-flex items-center justify-center gap-2 rounded-xl bg-slate-100 px-3.5 py-2.5 text-xs font-black text-slate-700 transition hover:bg-slate-200 disabled:cursor-not-allowed disabled:opacity-60';

  const renderActionIcon = (id: string, fallback: React.ReactNode) =>
    busyId === id ? <Loader2 size={15} className="animate-spin" /> : fallback;

  const searchPlaceholder = {
    posts: 'Tìm sản phẩm, người bán, trạng thái...',
    lostFound: 'Tìm tin mất đồ, nhặt được, người đăng, vị trí...',
    reports: 'Tìm tố cáo theo lý do hoặc loại đối tượng...',
    users: 'Tìm sinh viên theo tên, email, MSSV...',
  }[activeTab];

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
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Quản lý bài đăng sản phẩm, tin mất đồ, tin tìm được đồ, tố cáo và tài khoản cần can thiệp.
            </p>
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
            { label: 'Cần xử lý', value: totalQueue, helper: 'Bài chờ duyệt, tin mở và tố cáo', icon: AlertTriangle, tone: 'border-amber-100 bg-amber-50 text-amber-700' },
            { label: 'Bài đăng', value: canModeratePosts ? products.length : 0, helper: `${pendingProducts.toLocaleString('vi-VN')} bài chờ duyệt`, icon: PackageX, tone: 'border-blue-100 bg-blue-50 text-blue-700' },
            { label: 'Mất / nhặt đồ', value: lostFoundItems.length, helper: `${openLostFound.toLocaleString('vi-VN')} tin đang mở`, icon: MapPin, tone: 'border-cyan-100 bg-cyan-50 text-cyan-700' },
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
          <div className="mb-5 flex flex-col gap-4 border-b border-slate-100 pb-5 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <h2 className="text-lg font-black text-slate-950">{activeMeta.label}</h2>
              <p className="mt-1 text-sm text-slate-500">{activeMeta.description}</p>
            </div>
            <div className="flex w-full flex-col gap-3 sm:flex-row xl:w-auto xl:items-center">
              <label className="relative block min-w-0 flex-1 xl:w-96 xl:flex-none">
                <Search size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm font-medium outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50"
                  placeholder={searchPlaceholder}
                />
              </label>
              <div className="self-start rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600 sm:self-center">
                {activeMeta.count.toLocaleString('vi-VN')} mục
              </div>
            </div>
          </div>

          {loading ? (
            <div className="grid min-h-80 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50">
              <div className="text-center">
                <Loader2 size={30} className="mx-auto animate-spin text-slate-400" />
                <p className="mt-3 text-sm font-bold text-slate-500">Đang tải dữ liệu kiểm duyệt...</p>
              </div>
            </div>
          ) : activeTab === 'posts' ? (
            <div className="space-y-3">
              {!canModeratePosts ? (
                <EmptyState title="Chưa có quyền duyệt bài" text="Tài khoản này cần quyền CAN_APPROVE_POST để thao tác." />
              ) : (
                filteredProducts.map((product) => {
                  const id = getId(product);
                  const imageUrl = product.imageUrls?.[0] || '';
                  const sellerLabel = product.sellerName || product.sellerEmail || 'Chưa có tên người bán';
                  const requiresAction = product.status === 'PENDING_APPROVAL';
                  return (
                    <article key={id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-blue-200 hover:shadow-sm">
                      <div className="grid gap-0 lg:grid-cols-[220px_1fr]">
                        <div className="relative aspect-[4/3] bg-slate-100 lg:aspect-auto lg:min-h-[190px]">
                          {imageUrl ? (
                            <img src={imageUrl} alt={product.title} className="h-full w-full object-cover" />
                          ) : (
                            <ImageFallback label="Chưa có ảnh" />
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
                                <span className={'rounded-full px-3 py-1 text-xs font-black ' + statusBadgeClass(product.status)}>{statusLabel[product.status] || product.status}</span>
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
                            <InfoTile label="Người bán" value={sellerLabel} helper={product.sellerStudentId || product.sellerEmail || 'Chưa cập nhật MSSV'} />
                            <InfoTile label="Tình trạng" value={conditionLabel(product.condition)} helper={product.location || 'Chưa có vị trí'} />
                            <InfoTile label="Hình ảnh" value={`${product.imageUrls?.length || 0} ảnh`} helper="Dùng để kiểm tra nội dung" />
                          </div>

                          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                            {requiresAction ? (
                              <>
                                <button onClick={() => resolveProduct(id, 'REJECT')} disabled={busyId === id} className={dangerButtonClass}>{renderActionIcon(id, <XCircle size={15} />)} Ẩn bài</button>
                                <button onClick={() => resolveProduct(id, 'APPROVE')} disabled={busyId === id} className={primaryButtonClass}>{renderActionIcon(id, <CheckCircle2 size={15} />)} Duyệt</button>
                              </>
                            ) : (
                              <span className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-3.5 py-2.5 text-xs font-black text-slate-500">
                                <CheckCircle2 size={15} />
                                Không có thao tác bắt buộc
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })
              )}
              {canModeratePosts && filteredProducts.length === 0 && <EmptyState title="Không có bài đăng phù hợp" text="Thử đổi từ khóa tìm kiếm hoặc làm mới dữ liệu." />}
            </div>
          ) : activeTab === 'lostFound' ? (
            <div className="space-y-3">
              {filteredLostFoundItems.map((item) => {
                const id = getId(item);
                const imageUrl = item.imageUrls?.[0] || item.images?.[0] || '';
                const ownerLabel = item.userName || item.contactInfo || 'Chưa có tên người đăng';
                const isClosed = item.status === 'CLOSED' || item.status === 'RESOLVED';
                return (
                  <article key={id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:border-blue-200 hover:shadow-sm">
                    <div className="grid gap-0 lg:grid-cols-[220px_1fr]">
                      <div className="relative aspect-[4/3] bg-slate-100 lg:aspect-auto lg:min-h-[190px]">
                        {imageUrl ? (
                          <img src={imageUrl} alt={item.title} className="h-full w-full object-cover" />
                        ) : (
                          <ImageFallback label="Chưa có ảnh" />
                        )}
                        {item.imageUrls && item.imageUrls.length > 1 && (
                          <span className="absolute bottom-3 right-3 rounded-full bg-slate-950/80 px-2.5 py-1 text-xs font-black text-white">
                            {item.imageUrls.length} ảnh
                          </span>
                        )}
                      </div>

                      <div className="flex min-w-0 flex-col gap-4 p-4">
                        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className={'rounded-full px-3 py-1 text-xs font-black ' + typeBadgeClass(item.type)}>{typeLabel[item.type] || item.type}</span>
                              <span className={'rounded-full px-3 py-1 text-xs font-black ' + statusBadgeClass(item.status)}>{statusLabel[item.status] || item.status}</span>
                              <span className="text-xs font-medium text-slate-400">{formatDateTime(item.createdAt)}</span>
                            </div>
                            <h3 className="mt-3 text-xl font-black tracking-tight text-slate-950">{item.title}</h3>
                            {item.description && <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">{item.description}</p>}
                          </div>
                          <div className="rounded-2xl border border-slate-100 bg-slate-50 px-3.5 py-3 text-left xl:min-w-44">
                            <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">Người đăng</div>
                            <div className="mt-1 text-sm font-black text-slate-800">{ownerLabel}</div>
                            <div className="mt-0.5 text-xs font-medium text-slate-500">{item.studentId || 'Chưa cập nhật MSSV'}</div>
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-3">
                          <InfoTile label="Vị trí" value={item.location || 'Chưa có vị trí'} helper="Nơi mất hoặc nhặt được" />
                          <InfoTile label="Liên hệ" value={item.contactInfo || item.studentId || 'Chưa có'} helper="Thông tin liên hệ" />
                          <InfoTile label="Phân loại" value={item.category || 'Khác'} helper={item.tags?.length ? item.tags.join(', ') : 'Chưa gắn thẻ'} />
                        </div>

                        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
                          {!isClosed && (
                            <button onClick={() => closeLostFoundItem(id)} disabled={busyId === id} className={neutralButtonClass}>{renderActionIcon(id, <Clock3 size={15} />)} Đóng tin</button>
                          )}
                          <button onClick={() => deleteLostFoundItem(id)} disabled={busyId === id} className={dangerButtonClass}>{renderActionIcon(id, <Trash2 size={15} />)} Gỡ tin</button>
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
              {filteredLostFoundItems.length === 0 && <EmptyState title="Không có tin mất / nhặt đồ phù hợp" text="Tin đồ thất lạc và tin tìm được đồ sẽ hiển thị tại đây." />}
            </div>
          ) : activeTab === 'reports' ? (
            <div className="space-y-3">
              {filteredReports.map((report) => {
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
              {filteredReports.length === 0 && <EmptyState title="Không có tố cáo đang chờ" text="Những báo cáo mới từ sinh viên sẽ xuất hiện ở đây." />}
            </div>
          ) : (
            <div className="space-y-4">
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

const ImageFallback = ({ label }: { label: string }) => (
  <div className="flex h-full w-full flex-col items-center justify-center text-slate-400">
    <PackageX size={32} />
    <span className="mt-2 text-xs font-bold">{label}</span>
  </div>
);

const InfoTile = ({ label, value, helper }: { label: string; value: string; helper: string }) => (
  <div className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3">
    <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">{label}</div>
    <div className="mt-1 truncate text-sm font-black text-slate-800">{value}</div>
    <div className="mt-0.5 truncate text-xs font-medium text-slate-500">{helper}</div>
  </div>
);

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
