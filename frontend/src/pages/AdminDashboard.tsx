import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Ban,
  CheckCircle,
  Clock3,
  Download,
  Eye,
  Loader2,
  MapPin,
  PackageCheck,
  RefreshCw,
  Search,
  Server,
  Shield,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  adminService,
  type DlqEventData,
  type LostFoundAdminData,
  type ReportData,
  type UserAdminData,
} from '../services/adminService';
import { useAuthStore } from '../store/authStore';
import { SimpleBarChart, SimpleDonutChart, SimpleLineChart } from '../components/charts/SimpleCharts';

const ALL_PERMISSIONS = ['CAN_POST', 'CAN_CHAT', 'CAN_REPORT', 'CAN_BAN', 'CAN_APPROVE_POST'];
const PERMISSION_LABELS: Record<string, string> = {
  CAN_POST: 'Đăng bài',
  CAN_CHAT: 'Chat',
  CAN_REPORT: 'Tố cáo',
  CAN_BAN: 'Khóa người dùng',
  CAN_APPROVE_POST: 'Duyệt bài',
};

type AdminTab = 'overview' | 'users' | 'reports' | 'lostFound' | 'products' | 'dlq' | 'analytics';
type ProductFilter = 'ALL' | 'PENDING_APPROVAL' | 'AVAILABLE' | 'SOLD' | 'REJECTED';
type ReportFilter = 'ALL' | 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'DISMISSED';
type LostFoundTypeFilter = 'ALL' | 'LOST' | 'FOUND';
type DlqFilter = 'ALL' | 'PENDING' | 'RETRYING' | 'RETRY_FAILED';

const formatDate = (value?: string) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('vi-VN');
};

const currency = (value?: number) => `${Number(value || 0).toLocaleString('vi-VN')}d`;

const getEntityId = (value: any) => value?.id || value?._id || '';

const statusLabel = (status?: string) => {
  switch (status) {
    case 'ALL':
      return 'Tất cả';
    case 'PENDING':
      return 'Chờ xử lý';
    case 'PENDING_APPROVAL':
      return 'Chờ duyệt';
    case 'REVIEWED':
      return 'Đã xem';
    case 'RESOLVED':
      return 'Đã xử lý';
    case 'DISMISSED':
      return 'Bỏ qua';
    case 'AVAILABLE':
      return 'Đã duyệt';
    case 'SOLD':
      return 'Đã bán';
    case 'REJECTED':
      return 'Từ chối';
    case 'OPEN':
      return 'Đang mở';
    case 'CLAIMED':
      return 'Đã nhận';
    case 'CLOSED':
      return 'Đã đóng';
    case 'RETRYING':
      return 'Đang thử lại';
    case 'RETRY_FAILED':
      return 'Thử lại lỗi';
    default:
      return status || 'Không rõ';
  }
};

const reportTargetLabel = (targetType?: string) => {
  switch (targetType) {
    case 'ALL':
      return 'Tất cả';
    case 'USER':
      return 'Người dùng';
    case 'PRODUCT':
      return 'Sản phẩm';
    case 'LOST_FOUND':
      return 'Đồ thất lạc';
    default:
      return targetType || 'Không rõ';
  }
};

const lostFoundTypeLabel = (type?: string) => {
  switch (type) {
    case 'ALL':
      return 'Tất cả';
    case 'LOST':
      return 'Đồ thất lạc';
    case 'FOUND':
      return 'Nhặt được đồ';
    default:
      return type || 'Không rõ';
  }
};

const badgeClass = (status?: string) => {
  switch (status) {
    case 'PENDING':
    case 'PENDING_APPROVAL':
    case 'OPEN':
      return 'bg-amber-50 text-amber-700';
    case 'AVAILABLE':
    case 'RESOLVED':
    case 'REVIEWED':
    case 'SOLD':
      return 'bg-emerald-50 text-emerald-700';
    case 'REJECTED':
    case 'DISMISSED':
    case 'CLOSED':
      return 'bg-slate-100 text-slate-700';
    case 'CLAIMED':
    case 'RETRYING':
      return 'bg-sky-50 text-sky-700';
    case 'RETRY_FAILED':
      return 'bg-rose-50 text-rose-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
};

const AdminDashboard: React.FC = () => {
  const { user, isLoading } = useAuthStore() as any;
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [productFilter, setProductFilter] = useState<ProductFilter>('ALL');
  const [reportFilter, setReportFilter] = useState<ReportFilter>('ALL');
  const [reportTargetType, setReportTargetType] = useState<'ALL' | 'USER' | 'PRODUCT' | 'LOST_FOUND'>('ALL');
  const [lostFoundTypeFilter, setLostFoundTypeFilter] = useState<LostFoundTypeFilter>('ALL');
  const [dlqFilter, setDlqFilter] = useState<DlqFilter>('ALL');

  const [users, setUsers] = useState<UserAdminData[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [reports, setReports] = useState<ReportData[]>([]);
  const [lostFoundItems, setLostFoundItems] = useState<LostFoundAdminData[]>([]);
  const [dlqEvents, setDlqEvents] = useState<DlqEventData[]>([]);
  const [dlqStats, setDlqStats] = useState<Record<string, number>>({});
  const [stats, setStats] = useState<any>({ user: {}, product: {} });

  const [permUser, setPermUser] = useState<UserAdminData | null>(null);
  const [permValues, setPermValues] = useState<string[]>([]);
  const [permSaving, setPermSaving] = useState(false);

  const [detailUser, setDetailUser] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [productDetail, setProductDetail] = useState<any>(null);
  const [productDetailLoading, setProductDetailLoading] = useState(false);

  const [lostFoundDetail, setLostFoundDetail] = useState<any>(null);
  const [lostFoundDetailLoading, setLostFoundDetailLoading] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== 'ADMIN') {
      navigate('/');
      return;
    }
    void fetchData();
  }, [activeTab, productFilter, reportFilter, reportTargetType, lostFoundTypeFilter, dlqFilter, user, isLoading, navigate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'overview') {
        const [uStats, pStats, reportRes, productRes, lostFoundRes, dlqRes] = await Promise.all([
          adminService.getUserStats(),
          adminService.getProductStats(),
          adminService.getReports('PENDING', 1, 6),
          adminService.getAdminProducts('PENDING_APPROVAL', 1, 6),
          adminService.getAdminLostFoundItems('ALL', 'OPEN', 1, 6),
          adminService.getDlqEvents(1, 6),
        ]);
        setStats({ user: uStats.data, product: pStats.data });
        setReports(reportRes.data?.content || []);
        setProducts(productRes.data?.content || []);
        setLostFoundItems(lostFoundRes.data?.content || []);
        setDlqEvents(dlqRes.data?.content || []);
        setDlqStats(dlqRes.data?.stats || {});
        return;
      }

      if (activeTab === 'analytics') {
        const [uStats, pStats, reportRes, lostFoundRes, dlqRes] = await Promise.all([
          adminService.getUserStats(),
          adminService.getProductStats(),
          adminService.getReports('ALL', 1, 100),
          adminService.getAdminLostFoundItems('ALL', 'ALL', 1, 100),
          adminService.getDlqEvents(1, 100),
        ]);
        setStats({ user: uStats.data, product: pStats.data });
        setReports(reportRes.data?.content || []);
        setLostFoundItems(lostFoundRes.data?.content || []);
        setDlqEvents(dlqRes.data?.content || []);
        setDlqStats(dlqRes.data?.stats || {});
        return;
      }

      if (activeTab === 'users') {
        const res = await adminService.getAllUsers(1, 100);
        if (res.success) setUsers(res.data.content || []);
        return;
      }

      if (activeTab === 'products') {
        const res = await adminService.getAdminProducts(productFilter, 1, 100);
        if (res.success) setProducts(res.data.content || []);
        return;
      }

      if (activeTab === 'reports') {
        const reportRes = await adminService.getReports(reportFilter, 1, 100, reportTargetType);
        setReports(reportRes.data?.content || []);
        return;
      }

      if (activeTab === 'lostFound') {
        const lostFoundRes = await adminService.getAdminLostFoundItems(lostFoundTypeFilter, 'ALL', 1, 100);
        setLostFoundItems(lostFoundRes.data?.content || []);
        return;
      }

      if (activeTab === 'dlq') {
        const res = await adminService.getDlqEvents(1, 100, dlqFilter === 'ALL' ? undefined : dlqFilter);
        if (res.success) {
          setDlqEvents(res.data.content || []);
          setDlqStats(res.data.stats || {});
        }
      }
    } catch (error) {
      console.error('Không thể tải dữ liệu quản trị', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBan = async (userId: string) => {
    if (!window.confirm('Xác nhận đổi trạng thái tài khoản này?')) return;
    try {
      const res = await adminService.toggleBanUser(userId);
      if (res.success) await fetchData();
    } catch (e: any) {
      alert('Lỗi: ' + (e.response?.data?.message || 'Không thể cập nhật trạng thái'));
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (!window.confirm('Xác nhận xóa tài khoản người dùng này?')) return;
    try {
      const res = await adminService.deleteUser(userId);
      if (res.success) {
        if (getEntityId(detailUser) === userId) setDetailUser(null);
        await fetchData();
      }
    } catch (e: any) {
      alert('Lỗi: ' + (e.response?.data?.message || 'Không thể xóa tài khoản'));
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!window.confirm(`Đổi vai trò thành ${newRole}?`)) return;
    try {
      const res = await adminService.updateUserRole(userId, newRole);
      if (res.success) await fetchData();
    } catch (e: any) {
      alert('Lỗi: ' + (e.response?.data?.message || 'Không thể đổi vai trò'));
    }
  };

  const handleKarmaAdjust = async (userId: string, direction: 'up' | 'down') => {
    const amount = prompt(`Nhập số điểm karma muốn ${direction === 'up' ? 'cộng' : 'trừ'}:`);
    if (!amount || Number.isNaN(Number(amount))) return;
    const reason = prompt('Lý do (tùy chọn):') || '';
    try {
      const res = await adminService.adjustKarma(userId, direction === 'up' ? Number(amount) : -Number(amount), reason);
      if (res.success) await fetchData();
    } catch (e: any) {
      alert('Lỗi: ' + (e.response?.data?.message || 'Không thể cập nhật karma'));
    }
  };

  const openPermissions = (targetUser: UserAdminData) => {
    setPermUser(targetUser);
    setPermValues([...(targetUser.permissions || [])]);
  };

  const togglePerm = (perm: string) => {
    setPermValues((current) => (current.includes(perm) ? current.filter((item) => item !== perm) : [...current, perm]));
  };

  const savePermissions = async () => {
    if (!permUser) return;
    setPermSaving(true);
    try {
      await adminService.updateUserPermissions(permUser.id, permValues);
      setPermUser(null);
      await fetchData();
    } catch (e: any) {
      alert('Lỗi: ' + (e.response?.data?.message || 'Không thể lưu quyền'));
    } finally {
      setPermSaving(false);
    }
  };

  const openUserDetail = async (userId: string) => {
    setDetailLoading(true);
    setDetailUser(null);
    try {
      const res = await api.get(`/users/admin/${userId}/detail`);
      if (res.data?.success) setDetailUser(res.data.data);
    } catch {
      const fallback = users.find((item) => item.id === userId);
      setDetailUser(fallback || null);
    } finally {
      setDetailLoading(false);
    }
  };

  const openProductDetail = async (productId: string) => {
    setProductDetailLoading(true);
    setProductDetail(null);
    try {
      const res = await adminService.getProductDetail(productId);
      if (res.success) setProductDetail(res.data);
    } catch {
      const fallback = products.find((item) => getEntityId(item) === productId);
      setProductDetail(fallback || null);
    } finally {
      setProductDetailLoading(false);
    }
  };

  const openLostFoundDetail = async (itemId: string) => {
    setLostFoundDetailLoading(true);
    setLostFoundDetail(null);
    try {
      const res = await adminService.getLostFoundDetail(itemId);
      if (res.success) setLostFoundDetail(res.data);
    } catch {
      const fallback = lostFoundItems.find((item) => getEntityId(item) === itemId);
      setLostFoundDetail(fallback || null);
    } finally {
      setLostFoundDetailLoading(false);
    }
  };

  const handleResolveProduct = async (productId: string, action: 'APPROVE' | 'REJECT') => {
    if (!window.confirm(`Xác nhận ${action === 'APPROVE' ? 'duyệt' : 'từ chối'} bài đăng này?`)) return;
    try {
      const res = await adminService.resolveProductStatus(productId, action);
      if (res.success) {
        if (getEntityId(productDetail) === productId) setProductDetail(null);
        await fetchData();
      }
    } catch (e: any) {
      alert('Lỗi: ' + (e.response?.data?.message || 'Không thể cập nhật bài đăng'));
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm('Xác nhận gỡ bài đăng này?')) return;
    try {
      const res = await adminService.deleteProduct(productId);
      if (res.success) {
        if (getEntityId(productDetail) === productId) setProductDetail(null);
        await fetchData();
      }
    } catch (e: any) {
      alert('Lỗi: ' + (e.response?.data?.message || 'Không thể gỡ bài đăng'));
    }
  };

  const handleDeleteLostFound = async (itemId: string) => {
    if (!window.confirm('Xác nhận gỡ bài đồ thất lạc / nhặt được này?')) return;
    try {
      const res = await adminService.deleteLostFoundItem(itemId);
      if (res.success) {
        if (getEntityId(lostFoundDetail) === itemId) setLostFoundDetail(null);
        await fetchData();
      }
    } catch (e: any) {
      alert('Lỗi: ' + (e.response?.data?.message || 'Không thể gỡ bài đăng'));
    }
  };

  const handleResolveReport = async (reportId: string, status: 'REVIEWED' | 'RESOLVED' | 'DISMISSED') => {
    const adminNote = prompt('Ghi chú xử lý (tùy chọn):') || '';
    try {
      const res = await adminService.resolveReport(reportId, status, adminNote);
      if (res.success) await fetchData();
    } catch (e: any) {
      alert('Lỗi: ' + (e.response?.data?.message || 'Không thể xử lý tố cáo'));
    }
  };

  const handleRetryDlq = async (eventId: string) => {
    try {
      const res = await adminService.retryDlqEvent(eventId);
      if (res.success) await fetchData();
    } catch (e: any) {
      alert('Lỗi: ' + (e.response?.data?.message || 'Không thể thử lại sự kiện'));
    }
  };

  const handleDismissDlq = async (eventId: string) => {
    if (!window.confirm('Xác nhận bỏ qua sự kiện DLQ này?')) return;
    try {
      const res = await adminService.dismissDlqEvent(eventId);
      if (res.success) await fetchData();
    } catch (e: any) {
      alert('Lỗi: ' + (e.response?.data?.message || 'Không thể bỏ qua sự kiện'));
    }
  };

  const openReportTarget = async (report: ReportData) => {
    const targetId = report.targetId;
    if (!targetId) return;
    if (report.targetType === 'USER') {
      await openUserDetail(targetId);
      return;
    }
    if (report.targetType === 'PRODUCT') {
      await openProductDetail(targetId);
      return;
    }
    if (report.targetType === 'LOST_FOUND') {
      await openLostFoundDetail(targetId);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((targetUser) => {
      if (!searchQuery) return true;
      const normalized = searchQuery.toLowerCase();
      return (
        targetUser.email.toLowerCase().includes(normalized) ||
        targetUser.name.toLowerCase().includes(normalized) ||
        (targetUser.studentId || '').toLowerCase().includes(normalized)
      );
    });
  }, [users, searchQuery]);

  const reportCounts = useMemo(() => {
    return reports.reduce<Record<string, number>>((acc, report) => {
      acc[report.status] = (acc[report.status] || 0) + 1;
      return acc;
    }, {});
  }, [reports]);

  const lostFoundCounts = useMemo(() => {
    return lostFoundItems.reduce<Record<string, number>>((acc, item) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    }, {});
  }, [lostFoundItems]);

  const exportUsersCSV = () => {
    const headers = ['Email', 'Tên', 'MSSV', 'Vai trò', 'Karma', 'Trạng thái', 'Xác minh'];
    const rows = filteredUsers.map((targetUser) => [
      targetUser.email,
      targetUser.name,
      targetUser.studentId || '',
      targetUser.role,
      String(targetUser.karmaPoint),
      targetUser.isActive !== false ? 'Hoạt động' : 'Bị khóa',
      targetUser.isVerified ? 'Đã xác minh' : 'Chưa',
    ]);
    const csv = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `users-export-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const renderOverview = () => (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        {[
          { label: 'Tổng sinh viên', value: stats.user?.total || 0, icon: Users },
          { label: 'Bài chờ duyệt', value: stats.product?.pending || 0, icon: PackageCheck },
          { label: 'Tố cáo chờ xử lý', value: reports.length, icon: AlertTriangle },
          { label: 'Sự kiện DLQ', value: dlqEvents.length, icon: Server },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4">
              <item.icon size={22} />
            </div>
            <div className="text-3xl font-black text-slate-900">{item.value.toLocaleString('vi-VN')}</div>
            <div className="text-sm text-slate-500 mt-1">{item.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-black text-slate-900">Hàng đợi duyệt bài</h3>
              <p className="text-sm text-slate-500">Bài đăng sản phẩm cần xử lý sớm.</p>
            </div>
            <button onClick={() => setActiveTab('products')} className="text-sm font-bold text-indigo-600 hover:text-indigo-700">Mở tab</button>
          </div>
          <div className="space-y-3">
            {products.slice(0, 5).map((product) => (
              <div key={getEntityId(product)} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 p-4">
                <div>
                  <div className="font-bold text-slate-900">{product.title}</div>
                  <div className="text-sm text-slate-500 mt-1">{currency(product.price)} • {product.sellerId}</div>
                </div>
                <button onClick={() => openProductDetail(getEntityId(product))} className="p-2 rounded-xl hover:bg-indigo-50 text-slate-500 hover:text-indigo-600">
                  <Eye size={16} />
                </button>
              </div>
            ))}
            {products.length === 0 && <div className="text-sm text-slate-400">Không có bài sản phẩm nào đang chờ duyệt.</div>}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-black text-slate-900">Tố cáo mới</h3>
              <p className="text-sm text-slate-500">Danh sách các báo cáo đang chờ quản trị viên xử lý.</p>
            </div>
            <button onClick={() => setActiveTab('reports')} className="text-sm font-bold text-indigo-600 hover:text-indigo-700">Mở tab</button>
          </div>
          <div className="space-y-3">
            {reports.slice(0, 5).map((report) => (
              <div key={getEntityId(report)} className="rounded-2xl border border-slate-100 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-bold text-slate-900">{reportTargetLabel(report.targetType)}</div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold ${badgeClass(report.status)}`}>{statusLabel(report.status)}</span>
                </div>
                <p className="text-sm text-slate-600 mt-2 line-clamp-2">{report.reason}</p>
                <div className="text-xs text-slate-400 mt-2">{formatDate(report.createdAt)}</div>
              </div>
            ))}
            {reports.length === 0 && <div className="text-sm text-slate-400">Không có tố cáo nào đang chờ xử lý.</div>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-6">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-black text-slate-900">Tin thất lạc / nhặt được mới</h3>
              <p className="text-sm text-slate-500">Quản trị viên có thể mở chi tiết hoặc gỡ bài ngay từ đây.</p>
            </div>
            <button onClick={() => setActiveTab('lostFound')} className="text-sm font-bold text-indigo-600 hover:text-indigo-700">Mở tab</button>
          </div>
          <div className="space-y-3">
            {lostFoundItems.slice(0, 5).map((item) => (
              <div key={getEntityId(item)} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-100 p-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${item.type === 'LOST' ? 'bg-rose-50 text-rose-700' : 'bg-sky-50 text-sky-700'}`}>{lostFoundTypeLabel(item.type)}</span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${badgeClass(item.status)}`}>{statusLabel(item.status)}</span>
                  </div>
                  <div className="font-bold text-slate-900 mt-2">{item.title}</div>
                  <div className="text-sm text-slate-500 mt-1">{item.location || 'Không rõ vị trí'}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openLostFoundDetail(getEntityId(item))} className="p-2 rounded-xl hover:bg-indigo-50 text-slate-500 hover:text-indigo-600">
                    <Eye size={16} />
                  </button>
                  <button onClick={() => handleDeleteLostFound(getEntityId(item))} className="p-2 rounded-xl hover:bg-rose-50 text-slate-500 hover:text-rose-600">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {lostFoundItems.length === 0 && <div className="text-sm text-slate-400">Không có tin thất lạc / nhặt được nào.</div>}
          </div>
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
          <h3 className="text-lg font-black text-slate-900 mb-4">Sức khỏe hệ thống</h3>
          <div className="space-y-4">
            <div className="rounded-2xl bg-slate-50 p-4">
              <div className="text-xs uppercase font-bold text-slate-400 mb-1">DLQ</div>
              <div className="text-2xl font-black text-slate-900">{dlqEvents.length}</div>
              <div className="text-sm text-slate-500 mt-1">Sự kiện cần thử lại hoặc bỏ qua.</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {Object.entries(dlqStats).map(([key, value]) => (
                <div key={key} className="rounded-2xl border border-slate-100 p-4">
                  <div className="text-xs uppercase font-bold text-slate-400">{key}</div>
                  <div className="text-lg font-black text-slate-900 mt-1">{value}</div>
                </div>
              ))}
              {Object.keys(dlqStats).length === 0 && <div className="text-sm text-slate-400 col-span-2">Chưa có thống kê DLQ.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAnalytics = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SimpleDonutChart
          title="Phân bố sản phẩm"
          data={[
            { label: 'Đang bán', value: stats.product?.available || 0, color: '#10b981' },
            { label: 'Chờ duyệt', value: stats.product?.pending || 0, color: '#f59e0b' },
            { label: 'Đã bán', value: stats.product?.sold || 0, color: '#6366f1' },
            { label: 'Khac', value: Math.max(0, (stats.product?.total || 0) - (stats.product?.available || 0) - (stats.product?.pending || 0) - (stats.product?.sold || 0)), color: '#ef4444' },
          ]}
        />
        <SimpleBarChart
          title="Khối lượng kiểm duyệt"
          data={[
            { label: 'Tố cáo', value: reports.length, color: '#f43f5e' },
            { label: 'DLQ', value: dlqEvents.length, color: '#0ea5e9' },
            { label: 'Thất lạc', value: lostFoundCounts.LOST || 0, color: '#fb7185' },
            { label: 'Nhặt được', value: lostFoundCounts.FOUND || 0, color: '#38bdf8' },
            { label: 'Chờ duyệt', value: stats.product?.pending || 0, color: '#8b5cf6' },
          ]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SimpleBarChart
          title="Tổng quan hệ thống"
          data={[
            { label: 'Users', value: stats.user?.total || 0, color: '#6366f1' },
            { label: 'Products', value: stats.product?.total || 0, color: '#f59e0b' },
            { label: 'Available', value: stats.product?.available || 0, color: '#10b981' },
            { label: 'Sold', value: stats.product?.sold || 0, color: '#ef4444' },
          ]}
        />
        <SimpleDonutChart
          title="Trạng thái tố cáo"
          data={[
            { label: 'Chờ xử lý', value: reportCounts.PENDING || 0, color: '#f59e0b' },
            { label: 'Đã xem', value: reportCounts.REVIEWED || 0, color: '#0ea5e9' },
            { label: 'Đã xử lý', value: reportCounts.RESOLVED || 0, color: '#10b981' },
            { label: 'Bỏ qua', value: reportCounts.DISMISSED || 0, color: '#94a3b8' },
          ]}
        />
      </div>

      <SimpleLineChart
        title="Đường theo dõi nhanh"
        data={[
          { label: 'Users', value: stats.user?.total || 0 },
          { label: 'Products', value: stats.product?.total || 0 },
          { label: 'Reports', value: reports.length || 0 },
          { label: 'DLQ', value: dlqEvents.length || 0 },
          { label: 'Đồ thất lạc', value: lostFoundItems.length || 0 },
        ]}
        color="#6366f1"
      />
    </div>
  );

  const renderUsers = () => (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm email, tên, MSSV..."
            className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl focus:outline-none focus:ring-4 focus:ring-indigo-100 focus:border-indigo-300 transition-all font-medium text-sm"
          />
        </div>
        <button onClick={exportUsersCSV} className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-sm hover:border-indigo-300 transition-all">
          <Download size={16} /> Xuất CSV
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-sm uppercase tracking-wider text-slate-500">
              <th className="p-4 font-bold">Email</th>
              <th className="p-4 font-bold">MSSV</th>
              <th className="p-4 font-bold">Vai trò</th>
              <th className="p-4 font-bold">Karma</th>
              <th className="p-4 font-bold">Trạng thái</th>
              <th className="p-4 font-bold">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((targetUser) => {
              const isActive = targetUser.isActive !== false;
              return (
                <tr key={targetUser.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="font-medium text-slate-800">{targetUser.email}</div>
                    <div className="text-xs text-slate-400">{targetUser.name}</div>
                  </td>
                  <td className="p-4 text-slate-500 text-sm">{targetUser.studentId || '—'}</td>
                  <td className="p-4">
                    <select
                      value={targetUser.role}
                      onChange={(e) => handleRoleChange(targetUser.id, e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold"
                    >
                      <option value="STUDENT">STUDENT</option>
                      <option value="MODERATOR">MODERATOR</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1">
                      <span className={`font-black text-sm ${targetUser.karmaPoint < 0 ? 'text-rose-500' : targetUser.karmaPoint < 50 ? 'text-amber-500' : 'text-emerald-600'}`}>
                        {targetUser.karmaPoint}
                      </span>
                      <button onClick={() => handleKarmaAdjust(targetUser.id, 'up')} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded transition-all"><ArrowUp size={14} /></button>
                      <button onClick={() => handleKarmaAdjust(targetUser.id, 'down')} className="p-1 text-rose-500 hover:bg-rose-50 rounded transition-all"><ArrowDown size={14} /></button>
                    </div>
                  </td>
                  <td className="p-4">
                    {isActive ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-full"><CheckCircle size={12} /> Hoạt động</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-rose-50 text-rose-600 text-xs font-bold rounded-full"><Ban size={12} /> Bị khóa</span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-1">
                      <button onClick={() => openUserDetail(targetUser.id)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Chi tiết">
                        <Eye size={16} />
                      </button>
                      <button onClick={() => openPermissions(targetUser)} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all" title="Phân quyền">
                        <ShieldCheck size={16} />
                      </button>
                      <button onClick={() => handleToggleBan(targetUser.id)} className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all ${isActive ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}>
                        {isActive ? 'Khóa' : 'Mở'}
                      </button>
                      <button onClick={() => handleDeleteUser(targetUser.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all" title="Xóa tài khoản">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={6} className="p-10 text-center text-slate-400">Không có người dùng phù hợp.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderProducts = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {[
          { id: 'ALL', label: 'Tất cả' },
          { id: 'PENDING_APPROVAL', label: 'Chờ duyệt' },
          { id: 'AVAILABLE', label: 'Đã duyệt' },
          { id: 'SOLD', label: 'Đã bán' },
          { id: 'REJECTED', label: 'Từ chối' },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setProductFilter(item.id as ProductFilter)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${
              productFilter === item.id
                ? 'bg-slate-900 text-white'
                : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-sm uppercase tracking-wider text-slate-500">
              <th className="p-4 font-bold">Người bán</th>
              <th className="p-4 font-bold">Sản phẩm</th>
              <th className="p-4 font-bold">Trạng thái</th>
              <th className="p-4 font-bold">Giá</th>
              <th className="p-4 font-bold">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {products.map((product) => (
              <tr key={getEntityId(product)} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="p-4 text-sm text-slate-600 truncate max-w-[160px]">{product.sellerId}</td>
                <td className="p-4">
                  <div className="font-bold text-slate-800">{product.title}</div>
                  <div className="text-xs text-slate-400 mt-1 line-clamp-1 max-w-[260px]">{product.description}</div>
                </td>
                <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${badgeClass(product.status)}`}>{statusLabel(product.status)}</span>
                </td>
                <td className="p-4 font-black text-rose-500">{currency(product.price)}</td>
                <td className="p-4">
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => openProductDetail(getEntityId(product))} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Xem chi tiết">
                      <Eye size={16} />
                    </button>
                    {product.status === 'PENDING_APPROVAL' && (
                      <>
                        <button onClick={() => handleResolveProduct(getEntityId(product), 'APPROVE')} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700">Duyệt</button>
                        <button onClick={() => handleResolveProduct(getEntityId(product), 'REJECT')} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200">Từ chối</button>
                      </>
                    )}
                    <button onClick={() => handleDeleteProduct(getEntityId(product))} className="px-4 py-2 bg-rose-50 text-rose-700 rounded-xl text-xs font-bold hover:bg-rose-100">Gỡ bài</button>
                  </div>
                </td>
              </tr>
            ))}
            {products.length === 0 && (
              <tr>
                <td colSpan={5} className="p-10 text-center text-slate-400">Không có bài đăng phù hợp.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderReports = () => (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {['ALL', 'PENDING', 'REVIEWED', 'RESOLVED', 'DISMISSED'].map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setReportFilter(status as ReportFilter)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${reportFilter === status ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
          >
            {statusLabel(status)}
          </button>
        ))}
        {['ALL', 'USER', 'PRODUCT', 'LOST_FOUND'].map((target) => (
          <button
            key={target}
            type="button"
            onClick={() => setReportTargetType(target as 'ALL' | 'USER' | 'PRODUCT' | 'LOST_FOUND')}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${reportTargetType === target ? 'bg-indigo-600 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
          >
            {reportTargetLabel(target)}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-black text-slate-900">Danh sách tố cáo</h3>
          <p className="text-sm text-slate-500 mt-1">Mở đối tượng bị tố cáo, xử lý và ghi chú ngay tại đây.</p>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-sm uppercase tracking-wider text-slate-500">
              <th className="p-4 font-bold">Loại</th>
              <th className="p-4 font-bold">Lý do</th>
              <th className="p-4 font-bold">Trạng thái</th>
              <th className="p-4 font-bold">Tạo lúc</th>
              <th className="p-4 font-bold">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => {
              const reportId = getEntityId(report);
              return (
                <tr key={reportId} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-4">
                    <div className="font-bold text-slate-800">{reportTargetLabel(report.targetType)}</div>
                    <div className="text-xs text-slate-400 break-all">{report.targetId}</div>
                  </td>
                  <td className="p-4 max-w-[360px]">
                    <div className="text-sm text-slate-700 line-clamp-2">{report.reason}</div>
                    {report.adminNote && <div className="text-xs text-slate-400 mt-1">Ghi chú: {report.adminNote}</div>}
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${badgeClass(report.status)}`}>{statusLabel(report.status)}</span>
                  </td>
                  <td className="p-4 text-sm text-slate-500">{formatDate(report.createdAt)}</td>
                  <td className="p-4">
                    <div className="flex gap-2 flex-wrap">
                      <button onClick={() => openReportTarget(report)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Mở đối tượng">
                        <Eye size={16} />
                      </button>
                      {report.status === 'PENDING' && (
                        <>
                          <button onClick={() => handleResolveReport(reportId, 'REVIEWED')} className="px-3 py-2 bg-sky-50 text-sky-700 rounded-xl text-xs font-bold hover:bg-sky-100">Đã xem</button>
                          <button onClick={() => handleResolveReport(reportId, 'RESOLVED')} className="px-3 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700">Chấp nhận</button>
                          <button onClick={() => handleResolveReport(reportId, 'DISMISSED')} className="px-3 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200">Bỏ qua</button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {reports.length === 0 && (
              <tr>
                <td colSpan={5} className="p-10 text-center text-slate-400">Chưa có dữ liệu tố cáo cho bộ lọc hiện tại.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderLostFound = () => (
    <div className="space-y-6">
      <div className="flex gap-2 flex-wrap">
        {['ALL', 'LOST', 'FOUND'].map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setLostFoundTypeFilter(type as LostFoundTypeFilter)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${lostFoundTypeFilter === type ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
          >
            {lostFoundTypeLabel(type)}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">
        <div className="p-6 border-b border-slate-100">
          <h3 className="text-lg font-black text-slate-900">Danh sách đồ thất lạc và nhặt được</h3>
          <p className="text-sm text-slate-500 mt-1">Tách riêng khỏi mục tố cáo để admin theo dõi và gỡ bài dễ hơn.</p>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-sm uppercase tracking-wider text-slate-500">
              <th className="p-4 font-bold">Loại</th>
              <th className="p-4 font-bold">Tiêu đề</th>
              <th className="p-4 font-bold">Trạng thái</th>
              <th className="p-4 font-bold">Vị trí</th>
              <th className="p-4 font-bold">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {lostFoundItems.map((item) => {
              const itemId = getEntityId(item);
              return (
                <tr key={itemId} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${item.type === 'LOST' ? 'bg-rose-50 text-rose-700' : 'bg-sky-50 text-sky-700'}`}>{lostFoundTypeLabel(item.type)}</span>
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-slate-800">{item.title}</div>
                    <div className="text-xs text-slate-400">{formatDate(item.createdAt)}</div>
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${badgeClass(item.status)}`}>{statusLabel(item.status)}</span>
                  </td>
                  <td className="p-4 text-sm text-slate-500">{item.location || 'Không rõ'}</td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button onClick={() => openLostFoundDetail(itemId)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Xem chi tiết">
                        <Eye size={16} />
                      </button>
                      <button onClick={() => handleDeleteLostFound(itemId)} className="px-4 py-2 bg-rose-50 text-rose-700 rounded-xl text-xs font-bold hover:bg-rose-100">
                        Gỡ bài
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {lostFoundItems.length === 0 && (
              <tr>
                <td colSpan={5} className="p-10 text-center text-slate-400">Không có bài đồ thất lạc hoặc nhặt được phù hợp.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderDlq = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { label: 'Chờ xử lý', value: dlqStats.PENDING || 0 },
          { label: 'Đang thử lại', value: dlqStats.RETRYING || 0 },
          { label: 'Thử lại lỗi', value: dlqStats.RETRY_FAILED || 0 },
        ].map((item) => (
          <div key={item.label} className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
            <div className="text-xs uppercase text-slate-400 font-bold">{item.label}</div>
            <div className="text-3xl font-black text-slate-900 mt-2">{item.value}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {['ALL', 'PENDING', 'RETRYING', 'RETRY_FAILED'].map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setDlqFilter(status as DlqFilter)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${dlqFilter === status ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}
          >
            {statusLabel(status)}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200 text-sm uppercase tracking-wider text-slate-500">
              <th className="p-4 font-bold">Chủ đề</th>
              <th className="p-4 font-bold">Trạng thái</th>
              <th className="p-4 font-bold">Số lần thử</th>
              <th className="p-4 font-bold">Tạo lúc</th>
              <th className="p-4 font-bold">Hành động</th>
            </tr>
          </thead>
          <tbody>
            {dlqEvents.map((event) => {
              const eventId = getEntityId(event);
              return (
                <tr key={eventId} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-4">
                    <div className="font-bold text-slate-800">{event.topic}</div>
                    <div className="text-xs text-slate-400 break-all">{event.key || eventId}</div>
                  </td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-bold ${badgeClass(event.status)}`}>{statusLabel(event.status)}</span>
                  </td>
                  <td className="p-4 text-sm text-slate-500">{event.retryCount || 0}</td>
                  <td className="p-4 text-sm text-slate-500">{formatDate(event.createdAt)}</td>
                  <td className="p-4">
                    <div className="flex gap-2">
                      <button onClick={() => handleRetryDlq(eventId)} className="px-4 py-2 bg-sky-50 text-sky-700 rounded-xl text-xs font-bold hover:bg-sky-100 inline-flex items-center gap-2">
                        <RefreshCw size={14} /> Thử lại
                      </button>
                      <button onClick={() => handleDismissDlq(eventId)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200">
                        Bỏ qua
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {dlqEvents.length === 0 && (
              <tr>
                <td colSpan={5} className="p-10 text-center text-slate-400">Chưa có sự kiện DLQ cho bộ lọc hiện tại.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center">
            <Shield size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Trung tâm quản trị</h1>
            <p className="text-slate-500 font-medium text-sm">Kiểm duyệt, quản lý người dùng, tố cáo và sức khỏe hệ thống</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-8 bg-slate-100/50 p-1 rounded-2xl w-fit flex-wrap">
        {[
          { id: 'overview', label: 'Tổng quan', icon: TrendingUp },
          { id: 'analytics', label: 'Phân tích', icon: TrendingUp },
          { id: 'users', label: 'Sinh viên', icon: Users },
          { id: 'products', label: 'Duyệt bài', icon: PackageCheck },
          { id: 'reports', label: 'Tố cáo', icon: AlertTriangle },
          { id: 'lostFound', label: 'Đồ thất lạc', icon: MapPin },
          { id: 'dlq', label: 'DLQ', icon: Server },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as AdminTab)}
            className={`flex items-center gap-2 py-2 px-6 rounded-xl font-bold transition-all text-sm ${activeTab === tab.id ? 'bg-white text-indigo-600 shadow-sm border border-slate-200' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <tab.icon size={16} /> {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-400 font-medium">Đang xử lý dữ liệu...</p>
        </div>
      ) : activeTab === 'overview' ? (
        renderOverview()
      ) : activeTab === 'analytics' ? (
        renderAnalytics()
      ) : activeTab === 'users' ? (
        renderUsers()
      ) : activeTab === 'products' ? (
        renderProducts()
      ) : activeTab === 'reports' ? (
        renderReports()
      ) : activeTab === 'lostFound' ? (
        renderLostFound()
      ) : (
        renderDlq()
      )}

      {permUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setPermUser(null)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-black text-slate-900 mb-2">Phân quyền</h2>
            <p className="text-sm text-slate-500 mb-6">{permUser.email}</p>
            <div className="space-y-3 mb-8">
              {ALL_PERMISSIONS.map((perm) => (
                <label key={perm} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 cursor-pointer transition-all">
                  <input type="checkbox" checked={permValues.includes(perm)} onChange={() => togglePerm(perm)} />
                  <div>
                    <div className="font-bold text-sm text-slate-800">{PERMISSION_LABELS[perm] || perm}</div>
                    <div className="text-xs text-slate-400 font-mono">{perm}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={savePermissions} disabled={permSaving} className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {permSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                Lưu
              </button>
              <button onClick={() => setPermUser(null)} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200">Hủy</button>
            </div>
          </div>
        </div>
      )}

      {(detailUser || detailLoading) && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDetailUser(null)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-slate-900">Chi tiết người dùng</h2>
              <button onClick={() => setDetailUser(null)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={20} /></button>
            </div>
            {detailLoading ? (
              <div className="py-10 text-center"><Loader2 size={24} className="animate-spin mx-auto text-indigo-600" /></div>
            ) : detailUser ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center text-2xl font-black">
                    {detailUser.name?.charAt(0)?.toUpperCase() || '?'}
                  </div>
                  <div>
                    <div className="text-xl font-black text-slate-900">{detailUser.name}</div>
                    <div className="text-sm text-slate-500">{detailUser.email}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { label: 'MSSV', value: detailUser.studentId || '—' },
                    { label: 'Vai trò', value: detailUser.role },
                    { label: 'Karma', value: detailUser.karmaPoint },
                    { label: 'Trạng thái', value: detailUser.isActive !== false ? 'Hoạt động' : 'Bị khóa' },
                    { label: 'Xác minh', value: detailUser.isVerified ? 'Có' : 'Không' },
                  ].map((item) => (
                    <div key={item.label} className="p-3 bg-slate-50 rounded-2xl">
                      <div className="text-xs text-slate-400 font-bold uppercase">{item.label}</div>
                      <div className="text-sm font-bold text-slate-800 mt-1">{String(item.value)}</div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-end pt-2">
                  <button onClick={() => handleDeleteUser(getEntityId(detailUser))} className="px-4 py-2 bg-rose-50 text-rose-700 rounded-xl text-sm font-bold hover:bg-rose-100">
                    Xóa tài khoản
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {(productDetail || productDetailLoading) && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setProductDetail(null)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full p-8 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-slate-900">Chi tiết bài đăng</h2>
              <button onClick={() => setProductDetail(null)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={20} /></button>
            </div>
            {productDetailLoading ? (
              <div className="py-10 text-center"><Loader2 size={24} className="animate-spin mx-auto text-indigo-600" /></div>
            ) : productDetail ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-[1.2fr_1fr] gap-6">
                  <div className="space-y-3">
                    <div className="aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-slate-50">
                      <img src={productDetail.imageUrls?.[0] || 'https://placehold.co/800x800/e2e8f0/94a3b8?text=IUH'} alt={productDetail.title} className="w-full h-full object-cover" />
                    </div>
                    {productDetail.imageUrls?.length > 1 && (
                      <div className="grid grid-cols-4 gap-2">
                        {productDetail.imageUrls.map((url: string, index: number) => (
                          <div key={`${url}-${index}`} className="aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                            <img src={url} alt={`${productDetail.title} ${index + 1}`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="text-xs text-slate-400 font-bold uppercase">Tiêu đề</div>
                      <div className="text-xl font-black text-slate-900 mt-1">{productDetail.title}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-slate-50 rounded-2xl">
                        <div className="text-xs text-slate-400 font-bold uppercase">Giá</div>
                        <div className="text-sm font-bold text-slate-800 mt-1">{currency(productDetail.price)}</div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-2xl">
                        <div className="text-xs text-slate-400 font-bold uppercase">Trạng thái</div>
                      <div className="text-sm font-bold text-slate-800 mt-1">{statusLabel(productDetail.status)}</div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-2xl">
                        <div className="text-xs text-slate-400 font-bold uppercase">Danh mục</div>
                        <div className="text-sm font-bold text-slate-800 mt-1">{productDetail.category}</div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-2xl">
                        <div className="text-xs text-slate-400 font-bold uppercase">Tình trạng</div>
                        <div className="text-sm font-bold text-slate-800 mt-1">{productDetail.condition}</div>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-2xl">
                      <div className="text-xs text-slate-400 font-bold uppercase">Người bán</div>
                      <div className="text-sm font-bold text-slate-800 mt-1 break-all">{productDetail.sellerId}</div>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <div className="text-xs text-slate-400 font-bold uppercase mb-2">Mô tả</div>
                  <p className="text-sm text-slate-700 whitespace-pre-line">{productDetail.description}</p>
                </div>
                <div className="flex flex-wrap justify-end gap-2">
                  <button onClick={() => handleDeleteProduct(getEntityId(productDetail))} className="px-4 py-2 bg-rose-50 text-rose-700 rounded-xl text-sm font-bold hover:bg-rose-100">Gỡ bài</button>
                  {productDetail.status === 'PENDING_APPROVAL' && (
                    <>
                      <button onClick={() => handleResolveProduct(getEntityId(productDetail), 'REJECT')} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200">Từ chối</button>
                      <button onClick={() => handleResolveProduct(getEntityId(productDetail), 'APPROVE')} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700">Duyệt bài</button>
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {(lostFoundDetail || lostFoundDetailLoading) && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setLostFoundDetail(null)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full p-8 max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-slate-900">Chi tiết bài đồ thất lạc / nhặt được</h2>
              <button onClick={() => setLostFoundDetail(null)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={20} /></button>
            </div>
            {lostFoundDetailLoading ? (
              <div className="py-10 text-center"><Loader2 size={24} className="animate-spin mx-auto text-indigo-600" /></div>
            ) : lostFoundDetail ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-[1.1fr_0.9fr] gap-6">
                  <div className="space-y-3">
                    <div className="aspect-square rounded-2xl overflow-hidden border border-slate-200 bg-slate-50">
                      <img src={lostFoundDetail.imageUrls?.[0] || 'https://placehold.co/800x800/e2e8f0/94a3b8?text=IUH'} alt={lostFoundDetail.title} className="w-full h-full object-cover" />
                    </div>
                    {lostFoundDetail.imageUrls?.length > 1 && (
                      <div className="grid grid-cols-4 gap-2">
                        {lostFoundDetail.imageUrls.map((url: string, index: number) => (
                          <div key={`${url}-${index}`} className="aspect-square rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                            <img src={url} alt={`${lostFoundDetail.title} ${index + 1}`} className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="space-y-4">
                    <div className="flex gap-2 flex-wrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${lostFoundDetail.type === 'LOST' ? 'bg-rose-50 text-rose-700' : 'bg-sky-50 text-sky-700'}`}>{lostFoundTypeLabel(lostFoundDetail.type)}</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${badgeClass(lostFoundDetail.status)}`}>{statusLabel(lostFoundDetail.status)}</span>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 font-bold uppercase">Tiêu đề</div>
                      <div className="text-xl font-black text-slate-900 mt-1">{lostFoundDetail.title}</div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-2xl flex items-start gap-3">
                      <MapPin size={16} className="text-slate-400 mt-0.5" />
                      <div>
                        <div className="text-xs text-slate-400 font-bold uppercase">Vị trí</div>
                        <div className="text-sm font-bold text-slate-800 mt-1">{lostFoundDetail.location || 'Không rõ vị trí'}</div>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-2xl flex items-start gap-3">
                      <Clock3 size={16} className="text-slate-400 mt-0.5" />
                      <div>
                        <div className="text-xs text-slate-400 font-bold uppercase">Đăng lúc</div>
                        <div className="text-sm font-bold text-slate-800 mt-1">{formatDate(lostFoundDetail.createdAt)}</div>
                      </div>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-2xl">
                      <div className="text-xs text-slate-400 font-bold uppercase">Liên hệ</div>
                      <div className="text-sm font-bold text-slate-800 mt-1">{lostFoundDetail.contactInfo || 'Không có'}</div>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl">
                  <div className="text-xs text-slate-400 font-bold uppercase mb-2">Mô tả</div>
                  <p className="text-sm text-slate-700 whitespace-pre-line">{lostFoundDetail.description || 'Không có mô tả'}</p>
                </div>
                <div className="flex justify-end">
                  <button onClick={() => handleDeleteLostFound(getEntityId(lostFoundDetail))} className="px-4 py-2 bg-rose-50 text-rose-700 rounded-xl text-sm font-bold hover:bg-rose-100">
                    Gỡ bài
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
