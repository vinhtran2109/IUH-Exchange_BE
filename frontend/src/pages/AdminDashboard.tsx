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
  Mail,
  MapPin,
  MessageSquareWarning,
  PackageCheck,
  RefreshCw,
  Search,
  Send,
  Server,
  Shield,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import {
  adminService,
  type AdminOrderData,
  type AuditLogData,
  type DlqEventData,
  type LostFoundAdminData,
  type ReportData,
  type ReportedMessageData,
  type UserAdminData,
} from '../services/adminService';
import { useAuthStore } from '../store/authStore';

const ALL_PERMISSIONS = ['CAN_POST', 'CAN_CHAT', 'CAN_REPORT', 'CAN_BAN', 'CAN_APPROVE_POST'];
const PERMISSION_LABELS: Record<string, string> = {
  CAN_POST: 'Đăng bài',
  CAN_CHAT: 'Chat',
  CAN_REPORT: 'Tố cáo',
  CAN_BAN: 'Khóa người dùng',
  CAN_APPROVE_POST: 'Duyệt bài',
};

type AdminTab = 'overview' | 'users' | 'reports' | 'lostFound' | 'products' | 'orders' | 'chatReports' | 'dlq' | 'analytics' | 'email' | 'audit';
type ProductFilter = 'ALL' | 'PENDING_APPROVAL' | 'AVAILABLE' | 'SOLD' | 'REJECTED';
type ReportFilter = 'ALL' | 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'DISMISSED';
type LostFoundTypeFilter = 'ALL' | 'LOST' | 'FOUND';
type DlqFilter = 'ALL' | 'PENDING' | 'RETRYING' | 'RETRY_FAILED';
type OrderFilter = 'ALL' | 'AWAITING_SELLER' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';

const ADMIN_TABS = [
  { id: 'overview', label: 'Tổng quan', group: 'Bảng chính', icon: TrendingUp },
  { id: 'analytics', label: 'Phân tích', group: 'Bảng chính', icon: TrendingUp },
  { id: 'users', label: 'Sinh viên', group: 'Quản trị', icon: Users },
  { id: 'products', label: 'Duyệt bài', group: 'Quản trị', icon: PackageCheck },
  { id: 'reports', label: 'Tố cáo', group: 'Kiểm duyệt', icon: AlertTriangle },
  { id: 'lostFound', label: 'Đồ thất lạc', group: 'Kiểm duyệt', icon: MapPin },
  { id: 'email', label: 'Soạn email', group: 'Hệ thống', icon: Mail },
  { id: 'dlq', label: 'DLQ', group: 'Hệ thống', icon: Server },
  { id: 'audit', label: 'Nhật ký hệ thống', group: 'Hệ thống', icon: ShieldCheck },
  { id: 'orders', label: 'Đơn hàng', group: 'Bảng chính', icon: ShoppingBag },
  { id: 'chatReports', label: 'Tin nhắn', group: 'Bảng chính', icon: MessageSquareWarning },
] as const;

const formatDate = (value?: string) => {
  if (!value) return 'N/A';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('vi-VN');
};

const currency = (value?: number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

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
    case 'COMPLETED':
      return 'Hoàn tất';
    case 'CANCELLED':
      return 'Đã hủy';
    case 'AWAITING_SELLER':
      return 'Chờ người bán';
    case 'UNPAID':
      return 'Chưa thanh toán';
    case 'PAID':
      return 'Đã thanh toán';
    case 'REFUNDED':
      return 'Đã hoàn tiền';
    case 'REPORTED':
      return 'Đã báo chuyển khoản';
    case 'NONE':
      return 'Không có';
    case 'NO_SHOW':
      return 'Không đến';
    case 'PAYMENT_ISSUE':
      return 'Khiếu nại thanh toán';
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

const ACCOUNT_SUPPORT_PREFIX = '[Hỗ trợ tài khoản]';

const isAccountSupportReport = (report: ReportData) =>
  report.targetType === 'USER' &&
  report.targetId === report.reporterId &&
  report.reason.startsWith(ACCOUNT_SUPPORT_PREFIX);

const displayReportReason = (report: ReportData) =>
  isAccountSupportReport(report) ? report.reason.replace(ACCOUNT_SUPPORT_PREFIX, '').trim() : report.reason;

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
    case 'COMPLETED':
    case 'PAID':
      return 'bg-emerald-50 text-emerald-700';
    case 'REFUNDED':
      return 'bg-blue-50 text-blue-700';
    case 'CANCELLED':
    case 'REJECTED':
    case 'DISMISSED':
    case 'CLOSED':
      return 'bg-slate-100 text-slate-700';
    case 'CLAIMED':
    case 'RETRYING':
    case 'AWAITING_SELLER':
      return 'bg-sky-50 text-sky-700';
    case 'RETRY_FAILED':
      return 'bg-rose-50 text-rose-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
};

const shortId = (value?: string) => {
  if (!value) return 'N/A';
  return value.length > 12 ? `${value.slice(0, 6)}...${value.slice(-4)}` : value;
};

const readableOrderCode = (value?: string) => {
  if (!value) return 'ĐH-00000';
  const tail = value.replace(/[^a-fA-F0-9]/g, '').slice(-5).toUpperCase();
  return `ĐH-${tail.padStart(5, '0')}`;
};

const paymentMethodLabel = (method?: string) => {
  switch (method) {
    case 'BANK_TRANSFER':
      return 'Chuyển khoản';
    case 'CASH':
      return 'Tiền mặt';
    case 'VNPAY_MOCK':
      return 'VNPay thử nghiệm';
    case 'NONE':
    case undefined:
    case '':
      return 'Chưa chọn';
    default:
      return method;
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
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('ALL');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [users, setUsers] = useState<UserAdminData[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [reports, setReports] = useState<ReportData[]>([]);
  const [lostFoundItems, setLostFoundItems] = useState<LostFoundAdminData[]>([]);
  const [dlqEvents, setDlqEvents] = useState<DlqEventData[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogData[]>([]);
  const [adminOrders, setAdminOrders] = useState<AdminOrderData[]>([]);
  const [reportedMessages, setReportedMessages] = useState<ReportedMessageData[]>([]);
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

  // Heatmap data for lost-found analytics
  const [heatmapData, setHeatmapData] = useState<any>(null);
  const [heatmapLoading, setHeatmapLoading] = useState(false);

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

      if (activeTab === 'orders') {
        const res = await adminService.getAdminOrders(1, 100);
        if (res.success) setAdminOrders(res.data?.content || []);
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
        // Fetch heatmap data
        if (!heatmapData) {
          setHeatmapLoading(true);
          try {
            const heatmapRes = await adminService.getLostFoundHeatmap(30);
            if (heatmapRes.success) setHeatmapData(heatmapRes.data);
          } catch { /* non-fatal */ }
          setHeatmapLoading(false);
        }
        return;
      }

      if (activeTab === 'chatReports') {
        const res = await adminService.getReportedMessages('PENDING', 1, 100);
        if (res.success) setReportedMessages(res.data?.content || []);
        return;
      }

      if (activeTab === 'audit') {
        const res = await adminService.getAuditLogs(1, 100);
        if (res.success) setAuditLogs(res.data?.content || []);
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

  const handleResolveReportWithAction = async (
    report: ReportData,
    action: 'WARN_USER' | 'PENALIZE_USER' | 'REMOVE_PRODUCT' | 'REMOVE_LOST_FOUND' | 'DISMISS'
  ) => {
    const reportId = getEntityId(report);
    if (!reportId) return;

    const defaultNotes = {
      WARN_USER: 'Admin chấp nhận tố cáo và cảnh cáo người dùng.',
      PENALIZE_USER: 'Admin chấp nhận tố cáo và trừ karma người dùng.',
      REMOVE_PRODUCT: 'Admin chấp nhận tố cáo và gỡ sản phẩm vi phạm.',
      REMOVE_LOST_FOUND: 'Admin chấp nhận tố cáo và gỡ bài đồ thất lạc vi phạm.',
      DISMISS: 'Admin đã kiểm tra và bỏ qua tố cáo.',
    } as const;
    const adminNote = prompt('Ghi chú xử lý:', defaultNotes[action]) || defaultNotes[action];

    try {
      if (action === 'DISMISS') {
        await adminService.resolveReport(reportId, 'DISMISSED', adminNote);
        await fetchData();
        return;
      }

      if (action === 'WARN_USER' || action === 'PENALIZE_USER') {
        const amount = action === 'WARN_USER' ? -5 : -10;
        await adminService.adjustKarma(report.targetId, amount, `${adminNote} Lý do tố cáo: ${report.reason}`);
        await adminService.resolveReport(reportId, 'RESOLVED', adminNote, { skipKarmaPenalty: true });
        await fetchData();
        return;
      }

      if (action === 'REMOVE_PRODUCT') {
        if (!window.confirm('Gỡ sản phẩm bị tố cáo và đánh dấu tố cáo đã xử lý?')) return;
        await adminService.deleteProduct(report.targetId);
        await adminService.resolveReport(reportId, 'RESOLVED', adminNote);
        await fetchData();
        return;
      }

      if (action === 'REMOVE_LOST_FOUND') {
        if (!window.confirm('Gỡ bài đồ thất lạc bị tố cáo và đánh dấu tố cáo đã xử lý?')) return;
        await adminService.deleteLostFoundItem(report.targetId);
        await adminService.resolveReport(reportId, 'RESOLVED', adminNote);
        await fetchData();
      }
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

  const handleSendEmail = async (event: React.FormEvent) => {
    event.preventDefault();
    setEmailSending(true);
    setEmailResult(null);

    try {
      const res = await adminService.sendComposedEmail({
        to: emailTo,
        subject: emailSubject,
        body: emailBody,
      });
      if (res.success) {
        setEmailResult({ type: 'success', message: `Đã gửi email đến ${res.data?.recipients || 1} người nhận.` });
        setEmailTo('');
        setEmailSubject('');
        setEmailBody('');
      } else {
        setEmailResult({ type: 'error', message: res.message || 'Không thể gửi email.' });
      }
    } catch (e: any) {
      setEmailResult({ type: 'error', message: e.response?.data?.message || e.response?.data?.error || 'Không thể gửi email.' });
    } finally {
      setEmailSending(false);
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

  const overviewCardClass = 'rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md';
  const sectionCardClass = 'rounded-2xl border border-slate-200 bg-white shadow-sm';
  const iconButtonClass = 'inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700';
  const secondaryActionClass = 'inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700';

  const EmptyState = ({ icon: Icon, title, description }: { icon: React.ElementType; title: string; description: string }) => (
    <div className="flex min-h-[148px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-6 py-8 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm">
        <Icon size={22} />
      </div>
      <div className="text-sm font-bold text-slate-800">{title}</div>
      <p className="mt-1 max-w-sm text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );

  const HealthRow = ({ label, value, tone = 'emerald' }: { label: string; value: string | number; tone?: 'emerald' | 'amber' | 'blue' }) => {
    const toneClass = {
      emerald: 'bg-emerald-500',
      amber: 'bg-amber-500',
      blue: 'bg-blue-500',
    }[tone];

    return (
      <div className="flex items-center justify-between rounded-xl border border-slate-100 bg-white px-3.5 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${toneClass}`} />
          <span className="truncate text-sm font-semibold text-slate-700">{label}</span>
        </div>
        <span className="ml-3 rounded-lg bg-slate-50 px-2 py-1 text-xs font-black text-slate-700">{value}</span>
      </div>
    );
  };

  const renderOverview = () => (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Tổng sinh viên', value: stats.user?.total || 0, icon: Users },
          { label: 'Bài chờ duyệt', value: stats.product?.pending || 0, icon: PackageCheck },
          { label: 'Tố cáo chờ xử lý', value: reports.length, icon: AlertTriangle },
          { label: 'Sự kiện DLQ', value: dlqEvents.length, icon: Server },
        ].map((item) => (
          <div key={item.label} className={`${overviewCardClass} min-h-[156px] p-6`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
                <item.icon size={26} strokeWidth={2.2} />
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-500">Live</span>
            </div>
            <div className="mt-5 text-3xl font-black leading-none tracking-tight text-slate-950">{item.value.toLocaleString('vi-VN')}</div>
            <div className="mt-2 text-sm font-bold text-slate-700">{item.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className={`${sectionCardClass} p-6`}>
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-950">Hàng đợi duyệt bài</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">Bài đăng sản phẩm cần xử lý sớm.</p>
            </div>
            <button onClick={() => setActiveTab('products')} className={secondaryActionClass}>Mở tab</button>
          </div>
          <div className="space-y-3">
            {products.slice(0, 5).map((product) => (
              <div key={getEntityId(product)} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-blue-200 hover:bg-blue-50/30">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-black text-amber-700">Chờ duyệt</span>
                    <span className="truncate text-sm font-black text-slate-950">{product.title}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                    <span className="font-bold text-slate-700">{currency(product.price)}</span>
                    <span className="h-1 w-1 rounded-full bg-slate-300" />
                    <span className="font-mono text-xs">{product.sellerId}</span>
                  </div>
                </div>
                <button onClick={() => openProductDetail(getEntityId(product))} className={iconButtonClass} title="Xem chi tiết">
                  <Eye size={16} />
                </button>
              </div>
            ))}
            {products.length === 0 && <EmptyState icon={PackageCheck} title="Không có bài chờ duyệt" description="Hàng đợi đang trống. Các bài đăng mới cần duyệt sẽ xuất hiện tại đây." />}
          </div>
        </div>

        <div className={`${sectionCardClass} p-6`}>
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-950">Tố cáo mới</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">Danh sách báo cáo đang chờ quản trị viên xử lý.</p>
            </div>
            <button onClick={() => setActiveTab('reports')} className={secondaryActionClass}>Mở tab</button>
          </div>
          <div className="space-y-3">
            {reports.slice(0, 5).map((report) => (
              <div key={getEntityId(report)} className="rounded-2xl border border-amber-100 bg-amber-50/30 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-black text-slate-950">{reportTargetLabel(report.targetType)}</div>
                    <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-700">{report.reason}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ${badgeClass(report.status)}`}>{statusLabel(report.status)}</span>
                </div>
                <div className="mt-3 text-xs font-medium text-slate-500">{formatDate(report.createdAt)}</div>
              </div>
            ))}
            {reports.length === 0 && <EmptyState icon={MessageSquareWarning} title="Không có tố cáo đang chờ" description="Khi sinh viên gửi báo cáo mới, mục này sẽ nổi bật để quản trị viên xử lý nhanh." />}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className={`${sectionCardClass} p-6`}>
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-950">Tin thất lạc / nhặt được mới</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">Mở chi tiết hoặc gỡ bài ngay từ bảng tổng quan.</p>
            </div>
            <button onClick={() => setActiveTab('lostFound')} className={secondaryActionClass}>Mở tab</button>
          </div>
          <div className="space-y-3">
            {lostFoundItems.slice(0, 5).map((item) => (
              <div key={getEntityId(item)} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 transition-colors hover:border-blue-200 hover:bg-blue-50/30">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${item.type === 'LOST' ? 'bg-rose-50 text-rose-700 ring-1 ring-rose-100' : 'bg-blue-50 text-blue-700 ring-1 ring-blue-100'}`}>{lostFoundTypeLabel(item.type)}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-black ${badgeClass(item.status)}`}>{statusLabel(item.status)}</span>
                  </div>
                  <div className="mt-2 truncate font-black text-slate-950">{item.title}</div>
                  <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-500"><MapPin size={14} /> {item.location || 'Không rõ vị trí'}</div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => openLostFoundDetail(getEntityId(item))} className={iconButtonClass} title="Xem chi tiết">
                    <Eye size={16} />
                  </button>
                  <button onClick={() => handleDeleteLostFound(getEntityId(item))} className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700" title="Gỡ bài">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
            {lostFoundItems.length === 0 && <EmptyState icon={MapPin} title="Không có tin thất lạc mới" description="Các tin mất hoặc nhặt được gần đây sẽ được gom ở khu vực này." />}
          </div>
        </div>

        <div className={`${sectionCardClass} p-6`}>
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-950">Sức khỏe hệ thống</h3>
              <p className="mt-1 text-sm leading-6 text-slate-500">Trạng thái dịch vụ và hàng đợi lỗi.</p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700">Ổn định</span>
          </div>
          <div className="space-y-4">
            <HealthRow label="API Gateway" value="Online" tone="emerald" />
            <HealthRow label="WebSocket" value="Online" tone="emerald" />
            <HealthRow label="DLQ cần xử lý" value={dlqEvents.length} tone={dlqEvents.length > 0 ? 'amber' : 'emerald'} />
            <div className="grid grid-cols-2 gap-3 pt-1">
              {Object.entries(dlqStats).map(([key, value]) => (
                <HealthRow key={key} label={key} value={value} tone={Number(value) > 0 ? 'amber' : 'emerald'} />
              ))}
              {Object.keys(dlqStats).length === 0 && <div className="col-span-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">Chưa có thống kê DLQ.</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderAnalytics = () => {
    const productTotal = stats.product?.total || 0;
    const availableProducts = stats.product?.available || 0;
    const pendingProducts = stats.product?.pending || 0;
    const soldProducts = stats.product?.sold || 0;
    const otherProducts = Math.max(0, productTotal - availableProducts - pendingProducts - soldProducts);
    const totalReports = reports.length;
    const openReports = reportCounts.PENDING || 0;
    const reviewedReports = reportCounts.REVIEWED || 0;
    const resolvedReports = reportCounts.RESOLVED || 0;
    const ignoredReports = reportCounts.DISMISSED || 0;
    const lostCount = lostFoundCounts.LOST || 0;
    const foundCount = lostFoundCounts.FOUND || 0;
    const dlqCount = dlqEvents.length;

    const productDistribution = [
      { label: 'Đang bán', value: availableProducts, color: '#10b981', bg: 'bg-emerald-500' },
      { label: 'Chờ duyệt', value: pendingProducts, color: '#f59e0b', bg: 'bg-amber-500' },
      { label: 'Đã bán', value: soldProducts, color: '#6366f1', bg: 'bg-indigo-500' },
      { label: 'Khác', value: otherProducts, color: '#ef4444', bg: 'bg-rose-500' },
    ];

    const moderationLoad = [
      { label: 'Tố cáo', value: totalReports, color: 'bg-rose-500' },
      { label: 'DLQ', value: dlqCount, color: 'bg-sky-500' },
      { label: 'Thất lạc', value: lostCount, color: 'bg-pink-500' },
      { label: 'Nhặt được', value: foundCount, color: 'bg-cyan-500' },
      { label: 'Chờ duyệt', value: pendingProducts, color: 'bg-violet-500' },
    ];

    const systemOverview = [
      { label: 'Sinh viên', value: stats.user?.total || 0, helper: 'Tài khoản trong hệ thống', icon: Users, tone: 'text-blue-700 bg-blue-50 border-blue-100' },
      { label: 'Sản phẩm', value: productTotal, helper: 'Tổng bài đăng sản phẩm', icon: PackageCheck, tone: 'text-amber-700 bg-amber-50 border-amber-100' },
      { label: 'Tố cáo', value: totalReports, helper: 'Báo cáo trong chu kỳ hiện tại', icon: AlertTriangle, tone: 'text-rose-700 bg-rose-50 border-rose-100' },
      { label: 'DLQ', value: dlqCount, helper: 'Sự kiện cần theo dõi', icon: Server, tone: 'text-slate-700 bg-slate-50 border-slate-200' },
    ];

    const reportStatus = [
      { label: 'Chờ xử lý', value: openReports, color: 'bg-amber-500' },
      { label: 'Đã xem', value: reviewedReports, color: 'bg-sky-500' },
      { label: 'Đã xử lý', value: resolvedReports, color: 'bg-emerald-500' },
      { label: 'Bỏ qua', value: ignoredReports, color: 'bg-slate-400' },
    ];

    const maxModeration = Math.max(...moderationLoad.map((item) => item.value), 1);
    const maxSystem = Math.max(...systemOverview.map((item) => item.value), 1);
    const completionRate = productTotal > 0 ? Math.round((soldProducts / productTotal) * 100) : 0;
    const reviewBacklogRate = productTotal > 0 ? Math.round((pendingProducts / productTotal) * 100) : 0;
    const reportResolvedRate = totalReports > 0 ? Math.round(((reviewedReports + resolvedReports + ignoredReports) / totalReports) * 100) : 100;

    const DonutPanel = ({ title, subtitle, data, total }: { title: string; subtitle: string; data: Array<{ label: string; value: number; color: string; bg: string }>; total: number }) => {
      let accumulated = 0;
      const safeTotal = total || 1;
      const gradient = data.map((item) => {
        const start = (accumulated / safeTotal) * 360;
        accumulated += item.value;
        const end = (accumulated / safeTotal) * 360;
        return item.color + ' ' + start + 'deg ' + end + 'deg';
      }).join(', ');

      return (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-slate-950">{title}</h3>
              <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{total.toLocaleString('vi-VN')}</span>
          </div>
          <div className="grid gap-6 md:grid-cols-[180px_1fr] md:items-center">
            <div className="relative mx-auto h-44 w-44 rounded-full" style={{ background: total > 0 ? 'conic-gradient(' + gradient + ')' : '#e2e8f0' }}>
              <div className="absolute inset-8 flex flex-col items-center justify-center rounded-full bg-white text-center shadow-inner">
                <span className="text-3xl font-black text-slate-950">{total.toLocaleString('vi-VN')}</span>
                <span className="text-xs font-bold uppercase tracking-wide text-slate-400">Tổng</span>
              </div>
            </div>
            <div className="space-y-3">
              {data.map((item) => {
                const percent = total > 0 ? Math.round((item.value / total) * 100) : 0;
                return (
                  <div key={item.label}>
                    <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
                      <div className="flex min-w-0 items-center gap-2">
                        <span className={'h-2.5 w-2.5 shrink-0 rounded-full ' + item.bg} />
                        <span className="truncate font-bold text-slate-700">{item.label}</span>
                      </div>
                      <span className="font-black text-slate-950">{item.value.toLocaleString('vi-VN')} <span className="text-xs text-slate-400">{percent}%</span></span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className={'h-2 rounded-full ' + item.bg} style={{ width: percent + '%' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );
    };

    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-950">Phân tích hệ thống</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">Tập trung vào tải kiểm duyệt, trạng thái sản phẩm và những điểm cần quản trị viên chú ý.</p>
            </div>
            <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3.5 py-2 text-sm font-black text-emerald-700">
              <CheckCircle size={16} />
              Dữ liệu đang hoạt động
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              { label: 'Tỉ lệ bán xong', value: completionRate + '%', helper: soldProducts.toLocaleString('vi-VN') + ' / ' + productTotal.toLocaleString('vi-VN') + ' sản phẩm', icon: TrendingUp, tone: 'border-emerald-100 bg-emerald-50 text-emerald-700' },
              { label: 'Tồn đọng duyệt', value: reviewBacklogRate + '%', helper: pendingProducts.toLocaleString('vi-VN') + ' bài chờ duyệt', icon: Clock3, tone: 'border-amber-100 bg-amber-50 text-amber-700' },
              { label: 'Tố cáo đã xem', value: reportResolvedRate + '%', helper: totalReports.toLocaleString('vi-VN') + ' tố cáo trong mẫu', icon: ShieldCheck, tone: 'border-blue-100 bg-blue-50 text-blue-700' },
            ].map((item) => (
              <div key={item.label} className={'rounded-2xl border p-5 ' + item.tone}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-wide opacity-80">{item.label}</div>
                    <div className="mt-2 text-4xl font-black leading-none">{item.value}</div>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80">
                    <item.icon size={24} />
                  </div>
                </div>
                <div className="mt-3 text-sm font-semibold opacity-80">{item.helper}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
          <DonutPanel title="Phân bố sản phẩm" subtitle="Nhìn nhanh tỉ trọng bài đang bán, chờ duyệt và đã bán." data={productDistribution} total={productTotal} />

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h3 className="text-base font-black text-slate-950">Khối lượng kiểm duyệt</h3>
              <p className="mt-1 text-sm text-slate-500">Các hàng đợi mà quản trị viên cần theo dõi thường xuyên.</p>
            </div>
            <div className="space-y-4">
              {moderationLoad.map((item) => {
                const width = Math.max(4, Math.round((item.value / maxModeration) * 100));
                return (
                  <div key={item.label}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="font-bold text-slate-700">{item.label}</span>
                      <span className="font-black text-slate-950">{item.value.toLocaleString('vi-VN')}</span>
                    </div>
                    <div className="h-3 rounded-full bg-slate-100">
                      <div className={'h-3 rounded-full ' + item.color} style={{ width: width + '%' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h3 className="text-base font-black text-slate-950">Tổng quan hệ thống</h3>
              <p className="mt-1 text-sm text-slate-500">Các chỉ số lõi được đặt cùng một thang để dễ so sánh.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {systemOverview.map((item) => {
                const percent = Math.max(4, Math.round((item.value / maxSystem) * 100));
                return (
                  <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-slate-950">{item.label}</div>
                        <div className="mt-1 text-xs font-medium text-slate-500">{item.helper}</div>
                      </div>
                      <div className={'flex h-10 w-10 items-center justify-center rounded-xl border ' + item.tone}>
                        <item.icon size={20} />
                      </div>
                    </div>
                    <div className="mt-4 text-3xl font-black text-slate-950">{item.value.toLocaleString('vi-VN')}</div>
                    <div className="mt-3 h-2 rounded-full bg-white">
                      <div className="h-2 rounded-full bg-blue-600" style={{ width: percent + '%' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="mb-5">
              <h3 className="text-base font-black text-slate-950">Trạng thái tố cáo</h3>
              <p className="mt-1 text-sm text-slate-500">Theo dõi mức độ xử lý của đội ngũ quản trị.</p>
            </div>
            <div className="space-y-4">
              {reportStatus.map((item) => {
                const percent = totalReports > 0 ? Math.round((item.value / totalReports) * 100) : 0;
                return (
                  <div key={item.label} className="rounded-xl border border-slate-100 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3 text-sm">
                      <div className="flex items-center gap-2 font-bold text-slate-700">
                        <span className={'h-2.5 w-2.5 rounded-full ' + item.color} />
                        {item.label}
                      </div>
                      <span className="font-black text-slate-950">{item.value.toLocaleString('vi-VN')} <span className="text-xs text-slate-400">{percent}%</span></span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100">
                      <div className={'h-2 rounded-full ' + item.color} style={{ width: percent + '%' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  };

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
                      <option value="STUDENT">Sinh viên</option>
                      <option value="MODERATOR">Điều phối viên</option>
                      <option value="ADMIN">Quản trị viên</option>
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
              const isAccountSupport = isAccountSupportReport(report);
              const reason = displayReportReason(report);
              return (
                <tr key={reportId} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="p-4">
                    <div className="font-bold text-slate-800">{isAccountSupport ? 'Hỗ trợ tài khoản' : reportTargetLabel(report.targetType)}</div>
                    <div className="text-xs text-slate-400 break-all">{isAccountSupport ? 'Người gửi yêu cầu' : report.targetId}</div>
                  </td>
                  <td className="p-4 max-w-[360px]">
                    <div className="text-sm text-slate-700 line-clamp-2">{reason}</div>
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
                          {isAccountSupport && (
                            <button onClick={() => handleResolveReport(reportId, 'RESOLVED')} className="px-3 py-2 bg-emerald-50 text-emerald-700 rounded-xl text-xs font-bold hover:bg-emerald-100">Hoàn tất hỗ trợ</button>
                          )}
                          {report.targetType === 'USER' && !isAccountSupport && (
                            <>
                              <button onClick={() => handleResolveReportWithAction(report, 'WARN_USER')} className="px-3 py-2 bg-amber-50 text-amber-700 rounded-xl text-xs font-bold hover:bg-amber-100">Cảnh cáo -5</button>
                              <button onClick={() => handleResolveReportWithAction(report, 'PENALIZE_USER')} className="px-3 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700">Phạt -10</button>
                            </>
                          )}
                          {report.targetType === 'PRODUCT' && (
                            <button onClick={() => handleResolveReportWithAction(report, 'REMOVE_PRODUCT')} className="px-3 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700">Gỡ sản phẩm</button>
                          )}
                          {report.targetType === 'LOST_FOUND' && (
                            <button onClick={() => handleResolveReportWithAction(report, 'REMOVE_LOST_FOUND')} className="px-3 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700">Gỡ bài</button>
                          )}
                          <button onClick={() => handleResolveReportWithAction(report, 'DISMISS')} className="px-3 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200">Bỏ qua</button>
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
      {/* Heatmap Analytics Section */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-black text-slate-900">Bản đồ nhiệt & Phân tích</h3>
            <p className="text-sm text-slate-500 mt-1">Thống kê đồ thất lạc theo khu vực và thời gian (30 ngày gần nhất).</p>
          </div>
          <button
            onClick={async () => {
              setHeatmapLoading(true);
              try {
                const res = await adminService.getLostFoundHeatmap(30);
                if (res.success) setHeatmapData(res.data);
              } catch { /* ignore */ }
              setHeatmapLoading(false);
            }}
            className="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-all"
          >
            <RefreshCw size={12} className="inline mr-1" /> Làm mới
          </button>
        </div>

        {heatmapLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : heatmapData ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Location Stats */}
            <div>
              <h4 className="text-sm font-black text-slate-700 mb-3 uppercase tracking-wider">Khu vực nhiều đồ thất lạc nhất</h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {(heatmapData.locations || []).slice(0, 10).map((loc: any, idx: number) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                    <div className="flex-1">
                      <div className="text-sm font-bold text-slate-800">{loc.location}</div>
                      <div className="flex gap-3 mt-1">
                        <span className="text-xs font-bold text-rose-500">Mất: {loc.lost}</span>
                        <span className="text-xs font-bold text-sky-500">Nhặt: {loc.found}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-slate-900">{loc.total}</div>
                      <div className="text-[10px] text-slate-400 uppercase">tổng</div>
                    </div>
                    {/* Bar visualization */}
                    <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-indigo-500 rounded-full"
                        style={{ width: `${Math.min(100, (loc.total / (heatmapData.locations?.[0]?.total || 1)) * 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
                {(!heatmapData.locations || heatmapData.locations.length === 0) && (
                  <p className="text-sm text-slate-400 text-center py-4">Chưa có dữ liệu</p>
                )}
              </div>
            </div>

            {/* Analysis Stats */}
            <div>
              <h4 className="text-sm font-black text-slate-700 mb-3 uppercase tracking-wider">Trạng thái phân tích AI</h4>
              <div className="grid grid-cols-2 gap-3">
                {(heatmapData.analysisStats || []).map((stat: any, idx: number) => {
                  const colors: Record<string, string> = {
                    COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
                    PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
                    PROCESSING: 'bg-blue-50 text-blue-700 border-blue-200',
                    FAILED: 'bg-rose-50 text-rose-700 border-rose-200',
                    SKIPPED: 'bg-slate-50 text-slate-500 border-slate-200',
                  };
                  const labels: Record<string, string> = {
                    COMPLETED: 'Hoàn thành',
                    PENDING: 'Chờ xử lý',
                    PROCESSING: 'Đang xử lý',
                    FAILED: 'Thất bại',
                    SKIPPED: 'Bỏ qua',
                  };
                  return (
                    <div key={idx} className={`p-4 rounded-2xl border ${colors[stat.status] || 'bg-slate-50 text-slate-500 border-slate-200'}`}>
                      <div className="text-2xl font-black">{stat.count}</div>
                      <div className="text-xs font-bold uppercase mt-1">{labels[stat.status] || stat.status}</div>
                    </div>
                  );
                })}
              </div>

              {/* Timeline mini-chart */}
              {heatmapData.timeline && heatmapData.timeline.length > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-black text-slate-700 mb-3 uppercase tracking-wider">Xu hướng theo ngày</h4>
                  <div className="flex items-end gap-1 h-20">
                    {heatmapData.timeline.slice(-14).map((day: any, idx: number) => {
                      const maxVal = Math.max(...heatmapData.timeline.slice(-14).map((d: any) => d.lost + d.found), 1);
                      const height = ((day.lost + day.found) / maxVal) * 100;
                      return (
                        <div key={idx} className="flex-1 flex flex-col items-center gap-0.5" title={`${day.date}: Mất ${day.lost}, Nhặt ${day.found}`}>
                          <div className="w-full flex flex-col items-stretch" style={{ height: '64px' }}>
                            <div className="flex-1" />
                            <div
                              className="bg-indigo-400 rounded-t-sm min-h-[2px]"
                              style={{ height: `${height}%` }}
                            />
                          </div>
                          <span className="text-[8px] text-slate-400">{day.date.slice(5)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="text-sm text-slate-400 text-center py-4">Nhấn "Làm mới" để tải dữ liệu phân tích</p>
        )}
      </div>

      {/* Filter & Table */}
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

  const renderAuditLogs = () => (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900">Nhật ký hệ thống</h2>
          <p className="mt-1 text-sm text-slate-500">Theo dõi các thao tác nhạy cảm, đăng nhập và thay đổi dữ liệu quản trị.</p>
        </div>
        <button
          onClick={() => fetchData()}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw size={16} />
          Làm mới
        </button>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-100 bg-slate-50 text-xs uppercase text-slate-400">
            <tr>
              <th className="p-4">Thời gian</th>
              <th className="p-4">Hành động</th>
              <th className="p-4">Tài nguyên</th>
              <th className="p-4">Phương thức</th>
              <th className="p-4">Trạng thái</th>
              <th className="p-4">Người dùng</th>
              <th className="p-4">Đường dẫn</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {auditLogs.map((log) => (
              <tr key={log._id} className="hover:bg-slate-50/70">
                <td className="p-4 font-medium text-slate-700">{formatDate(log.createdAt)}</td>
                <td className="p-4">
                  <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">{log.action}</span>
                </td>
                <td className="p-4 text-slate-700">{log.resource}{log.resourceId ? ` / ${log.resourceId}` : ''}</td>
                <td className="p-4 font-black text-slate-700">{log.method}</td>
                <td className="p-4">
                  <span className={`rounded-full px-3 py-1 text-xs font-black ${(log.statusCode || 0) >= 400 ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {log.statusCode || 'N/A'}
                  </span>
                </td>
                <td className="p-4 text-slate-500">{log.userId || 'system'}</td>
                <td className="max-w-[280px] truncate p-4 text-slate-500" title={log.path}>{log.path}</td>
              </tr>
            ))}
            {auditLogs.length === 0 && (
              <tr>
                <td colSpan={7} className="p-10 text-center text-slate-400">Chưa có nhật ký phù hợp.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const renderAdminOrders = () => {
    const needsActionCount = adminOrders.filter((order) => order.disputeStatus === 'OPEN' || order.paymentIssueStatus === 'OPEN').length;
    const waitingSellerCount = adminOrders.filter((order) => order.status === 'AWAITING_SELLER').length;
    const completedCount = adminOrders.filter((order) => order.status === 'COMPLETED').length;

    const resolvePaymentIssue = async (
      order: AdminOrderData,
      action: 'CONFIRM_PAID' | 'REFUND' | 'REJECT',
      defaultResolution: string
    ) => {
      const resolution = window.prompt('Ghi chú xử lý thanh toán:', defaultResolution);
      if (resolution === null) return;
      try {
        await adminService.resolvePaymentIssue(order._id, action, resolution || defaultResolution);
        await fetchData();
      } catch (e: any) {
        alert('Lỗi: ' + (e.response?.data?.message || 'Không thể xử lý thanh toán'));
      }
    };

    const resolveDispute = async (
      order: AdminOrderData,
      status: 'RESOLVED' | 'REJECTED',
      defaultResolution: string,
      outcome: 'SELLER_FAULT' | 'BUYER_FAULT' | 'BOTH_FAULT' | 'NO_FAULT',
      remedy: 'NONE' | 'REFUND' = 'NONE'
    ) => {
      const resolution = window.prompt('Ghi chú xử lý tranh chấp:', defaultResolution);
      if (resolution === null) return;
      try {
        await adminService.resolveOrderDispute(order._id, status, resolution || defaultResolution, outcome, remedy);
        await fetchData();
      } catch (e: any) {
        alert('Lỗi: ' + (e.response?.data?.message || 'Không thể xử lý tranh chấp'));
      }
    };

    const orderCounts = {
      all: adminOrders.length,
      waiting: adminOrders.filter((order) => order.status === 'AWAITING_SELLER').length,
      completed: completedCount,
      cancelled: adminOrders.filter((order) => order.status === 'CANCELLED').length,
      disputed: needsActionCount,
    };

    const orderFilters: Array<{ value: OrderFilter; label: string; count: number }> = [
      { value: 'ALL', label: 'Tất cả', count: orderCounts.all },
      { value: 'AWAITING_SELLER', label: 'Đang chờ', count: orderCounts.waiting },
      { value: 'COMPLETED', label: 'Hoàn tất', count: orderCounts.completed },
      { value: 'CANCELLED', label: 'Đã hủy', count: orderCounts.cancelled },
      { value: 'DISPUTED', label: 'Có tranh chấp', count: orderCounts.disputed },
    ];

    const orderStatusBadgeClass = (order: AdminOrderData) => {
      if (order.paymentStatus === 'UNPAID') return 'bg-amber-50 text-amber-700 ring-1 ring-amber-100';
      if (order.status === 'COMPLETED') return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100';
      if (order.status === 'CANCELLED') return 'bg-rose-50 text-rose-700 ring-1 ring-rose-100';
      return 'bg-blue-50 text-blue-700 ring-1 ring-blue-100';
    };

    const disputeMeta = (order: AdminOrderData) => {
      if (order.paymentIssueStatus === 'OPEN') {
        return { label: 'Cần can thiệp', className: 'bg-amber-50 text-amber-700 ring-1 ring-amber-100', description: 'Khiếu nại thanh toán đang mở.' };
      }
      if (order.disputeStatus === 'OPEN') {
        return { label: 'Đang xem xét', className: 'bg-blue-50 text-blue-700 ring-1 ring-blue-100', description: 'Tranh chấp đang cần quản trị viên kết luận.' };
      }
      if (order.disputeStatus === 'RESOLVED' || order.paymentIssueStatus === 'RESOLVED') {
        return { label: 'Đã giải quyết', className: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100', description: 'Vụ việc đã có kết quả xử lý.' };
      }
      return { label: 'Không cần xử lý', className: 'bg-slate-100 text-slate-600 ring-1 ring-slate-200', description: 'Không có tranh chấp hoặc khiếu nại đang mở.' };
    };

    const visibleOrders = adminOrders.filter((order) => {
      const productTitle = order.productTitle || order.product?.title || '';
      const buyerName = order.buyerName || order.buyer?.name || '';
      const sellerName = order.sellerName || order.seller?.name || '';
      const matchesFilter =
        orderFilter === 'ALL' ||
        (orderFilter === 'DISPUTED' && (order.disputeStatus === 'OPEN' || order.paymentIssueStatus === 'OPEN')) ||
        order.status === orderFilter;

      const normalized = orderSearchQuery.trim().toLowerCase();
      if (!matchesFilter) return false;
      if (!normalized) return true;
      return [readableOrderCode(order._id), order._id, order.productId, productTitle, buyerName, sellerName, order.buyerId, order.sellerId]
        .some((value) => String(value || '').toLowerCase().includes(normalized));
    });

    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2 className="text-xl font-black text-slate-950">Đơn hàng và tranh chấp</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500">
                Theo dõi đơn có khiếu nại thanh toán, tranh chấp và trạng thái bàn giao. Ưu tiên hiển thị sản phẩm, giá và việc cần xử lý.
              </p>
            </div>
            <button type="button" onClick={fetchData} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
              <RefreshCw size={15} />
              Làm mới
            </button>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              { label: 'Cần xử lý', value: needsActionCount, helper: 'Tranh chấp hoặc thanh toán đang mở', icon: AlertTriangle, className: 'border-rose-100 bg-rose-50 text-rose-700' },
              { label: 'Đang chờ', value: waitingSellerCount, helper: 'Chờ người bán xác nhận', icon: Clock3, className: 'border-blue-100 bg-blue-50 text-blue-700' },
              { label: 'Hoàn tất', value: completedCount, helper: 'Đơn đã kết thúc thành công', icon: CheckCircle, className: 'border-emerald-100 bg-emerald-50 text-emerald-700' },
            ].map((item) => (
              <div key={item.label} className={'rounded-2xl border p-5 ' + item.className}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-wide opacity-80">{item.label}</div>
                    <div className="mt-2 text-4xl font-black leading-none">{item.value}</div>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/80">
                    <item.icon size={24} />
                  </div>
                </div>
                <div className="mt-3 text-sm font-semibold opacity-80">{item.helper}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input value={orderSearchQuery} onChange={(event) => setOrderSearchQuery(event.target.value)} placeholder="Tìm theo mã đơn, sản phẩm, người mua hoặc người bán..." className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm font-medium text-slate-700 outline-none transition focus:border-blue-300 focus:ring-4 focus:ring-blue-50" />
            </div>
            <div className="flex flex-wrap gap-2">
              {orderFilters.map((filter) => {
                const active = orderFilter === filter.value;
                return (
                  <button key={filter.value} type="button" onClick={() => setOrderFilter(filter.value)} className={'inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-bold transition-colors ' + (active ? 'bg-slate-950 text-white shadow-sm' : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700')}>
                    {filter.label}
                    <span className={'rounded-full px-2 py-0.5 text-[11px] font-black ' + (active ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-500')}>{filter.count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {visibleOrders.map((order) => {
            const hasPaymentIssue = order.paymentIssueStatus === 'OPEN';
            const hasDispute = order.disputeStatus === 'OPEN';
            const needsAction = hasPaymentIssue || hasDispute;
            const productTitle = order.productTitle || order.product?.title || 'Sản phẩm ' + shortId(order.productId);
            const buyerLabel = order.buyerName || order.buyer?.name || 'Người mua ' + shortId(order.buyerId);
            const sellerLabel = order.sellerName || order.seller?.name || 'Người bán ' + shortId(order.sellerId);
            const dispute = disputeMeta(order);

            return (
              <div key={order._id} className={'rounded-2xl border bg-white p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md ' + (needsAction ? 'border-amber-200' : 'border-slate-200')}>
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-lg bg-slate-100 px-2.5 py-1 font-mono text-xs font-black text-slate-700">{readableOrderCode(order._id)}</span>
                      <span className={'rounded-full px-3 py-1 text-xs font-black ' + orderStatusBadgeClass(order)}>{order.paymentStatus === 'UNPAID' ? 'Chưa thanh toán' : statusLabel(order.status)}</span>
                      <span className={'rounded-full px-3 py-1 text-xs font-black ' + dispute.className}>{dispute.label}</span>
                    </div>
                    <h3 className="truncate text-lg font-black tracking-tight text-slate-950" title={productTitle}>{productTitle}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
                      <span className="text-2xl font-black text-slate-950">{currency(order.price)}</span>
                      <span className="h-1 w-1 rounded-full bg-slate-300" />
                      <span>Tạo lúc {formatDate(order.createdAt)}</span>
                    </div>
                  </div>

                  <div className="grid w-full gap-3 sm:grid-cols-2 xl:w-[380px]">
                    <button type="button" onClick={() => openUserDetail(order.buyerId)} className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3 text-left transition-colors hover:border-blue-200 hover:bg-blue-50">
                      <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">Người mua</div>
                      <div className="mt-1 truncate text-sm font-black text-slate-800">{buyerLabel}</div>
                      <div className="mt-0.5 font-mono text-[11px] font-bold text-slate-400">{shortId(order.buyerId)}</div>
                    </button>
                    <button type="button" onClick={() => openUserDetail(order.sellerId)} className="rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-3 text-left transition-colors hover:border-blue-200 hover:bg-blue-50">
                      <div className="text-[11px] font-black uppercase tracking-wide text-slate-400">Người bán</div>
                      <div className="mt-1 truncate text-sm font-black text-slate-800">{sellerLabel}</div>
                      <div className="mt-0.5 font-mono text-[11px] font-bold text-slate-400">{shortId(order.sellerId)}</div>
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 border-t border-slate-100 pt-4 lg:grid-cols-[1fr_1fr_auto] lg:items-center">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={'rounded-full px-3 py-1 text-xs font-black ' + badgeClass(order.paymentStatus)}>{statusLabel(order.paymentStatus)}</span>
                    <span className="text-sm font-medium text-slate-500">{paymentMethodLabel(order.paymentMethod)}</span>
                    {order.cancellationCategory && <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-bold text-rose-700">Lý do hủy: {statusLabel(order.cancellationCategory)}</span>}
                  </div>

                  <div className="rounded-xl bg-slate-50 px-3.5 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={'rounded-full px-2.5 py-1 text-[11px] font-black ' + dispute.className}>{dispute.label}</span>
                      <span className="text-sm font-medium text-slate-600">{dispute.description}</span>
                    </div>
                    {(order.paymentIssueReason || order.disputeReason) && <p className="mt-2 line-clamp-2 text-sm text-slate-700">{order.paymentIssueReason || order.disputeReason}</p>}
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    {hasPaymentIssue ? (
                      <>
                        <button onClick={() => resolvePaymentIssue(order, 'CONFIRM_PAID', 'Admin xác nhận người bán đã nhận tiền.')} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700">Xác nhận tiền</button>
                        <button onClick={() => resolvePaymentIssue(order, 'REFUND', 'Admin duyệt hoàn tiền cho người mua.')} className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700 hover:bg-blue-100">Hoàn tiền</button>
                        <button onClick={() => resolvePaymentIssue(order, 'REJECT', 'Không đủ căn cứ để xử lý khiếu nại thanh toán.')} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-200">Từ chối</button>
                      </>
                    ) : hasDispute ? (
                      <>
                        <button onClick={() => resolveDispute(order, 'RESOLVED', 'Người bán có lỗi, admin xử lý có lợi cho người mua.', 'SELLER_FAULT', order.paymentStatus === 'PAID' ? 'REFUND' : 'NONE')} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white hover:bg-emerald-700">Bảo vệ người mua</button>
                        <button onClick={() => resolveDispute(order, 'REJECTED', 'Không đủ căn cứ, tranh chấp bị từ chối.', 'BUYER_FAULT')} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-200">Bảo vệ người bán</button>
                        <button onClick={() => resolveDispute(order, 'RESOLVED', 'Admin ghi nhận hai bên tự thỏa thuận, không áp dụng chế tài.', 'NO_FAULT')} className="rounded-xl bg-sky-50 px-3 py-2 text-xs font-black text-sky-700 hover:bg-sky-100">Đóng không phạt</button>
                      </>
                    ) : (
                      <span className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">Không có thao tác bắt buộc</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {visibleOrders.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
              <div className="text-sm font-black text-slate-700">Không tìm thấy đơn hàng phù hợp</div>
              <p className="mt-1 text-sm text-slate-400">Thử đổi từ khóa tìm kiếm hoặc chọn bộ lọc khác.</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderReportedMessages = () => (
    <div className="space-y-6">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-black text-slate-900">Kiểm duyệt tin nhắn</h2>
        <p className="mt-1 text-sm text-slate-500">Xử lý các tin nhắn bị người dùng báo cáo trong chat.</p>
      </div>
      <div className="grid gap-4">
        {reportedMessages.map((message) => (
          <div key={message._id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-xs font-bold uppercase text-slate-400">{message.senderId} {'->'} {message.receiverId}</div>
                <p className="mt-2 text-sm font-medium text-slate-800">{message.content}</p>
                <div className="mt-3 text-xs text-rose-600">
                  {(message.reports || []).map((report) => report.reason).join(' | ') || 'Đã báo cáo'}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={async () => {
                    await adminService.resolveReportedMessage(message._id, 'REVIEWED');
                    await fetchData();
                  }}
                  className="rounded-xl bg-indigo-50 px-4 py-2 text-xs font-black text-indigo-700"
                >
                  Đã xem
                </button>
                <button
                  onClick={async () => {
                    await adminService.resolveReportedMessage(message._id, 'DISMISSED');
                    await fetchData();
                  }}
                  className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-black text-slate-700"
                >
                  Bỏ qua
                </button>
              </div>
            </div>
          </div>
        ))}
        {reportedMessages.length === 0 && (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-400">Không có tin nhắn đang chờ xử lý.</div>
        )}
      </div>
    </div>
  );

  const renderEmailCompose = () => (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1fr_360px]">
      <form onSubmit={handleSendEmail} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-slate-100 pb-5">
          <div>
            <h2 className="text-xl font-black text-slate-900">Soạn email</h2>
            <p className="mt-1 text-sm text-slate-500">Gửi thông báo thủ công từ hệ thống quản trị IUH Exchange.</p>
          </div>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Mail size={20} />
          </div>
        </div>

        <div className="space-y-5">
          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-400">Người nhận</span>
            <textarea
              value={emailTo}
              onChange={(event) => setEmailTo(event.target.value)}
              required
              rows={3}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-slate-400"
              placeholder="student@student.iuh.edu.vn, another@student.iuh.edu.vn"
            />
            <span className="mt-2 block text-xs text-slate-400">Có thể nhập nhiều email, phân tách bằng dấu phẩy, chấm phẩy hoặc xuống dòng. Tối đa 50 người nhận.</span>
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-400">Tiêu đề</span>
            <input
              value={emailSubject}
              onChange={(event) => setEmailSubject(event.target.value)}
              required
              maxLength={160}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:border-slate-400"
              placeholder="Thông báo từ IUH Exchange"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-xs font-black uppercase tracking-wider text-slate-400">Nội dung</span>
            <textarea
              value={emailBody}
              onChange={(event) => setEmailBody(event.target.value)}
              required
              rows={12}
              maxLength={5000}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium leading-6 text-slate-800 outline-none transition focus:border-slate-400"
              placeholder="Nhập nội dung email..."
            />
          </label>

          {emailResult && (
            <div className={`rounded-xl border px-4 py-3 text-sm font-bold ${
              emailResult.type === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : 'border-rose-200 bg-rose-50 text-rose-700'
            }`}>
              {emailResult.message}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={emailSending}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {emailSending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
              {emailSending ? 'Đang gửi...' : 'Gửi email'}
            </button>
          </div>
        </div>
      </form>

      <aside className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-black uppercase tracking-wider text-slate-400">Thông tin gửi</h3>
        <div className="mt-5 space-y-4 text-sm">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs font-bold text-slate-400">Người gửi</div>
            <div className="mt-1 font-black text-slate-800">{user?.email || 'Quản trị viên'}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-xs font-bold text-slate-400">SMTP</div>
            <div className="mt-1 font-black text-slate-800">Cấu hình từ Notification Service</div>
          </div>
          <div className="rounded-2xl bg-amber-50 p-4 text-amber-800">
            <div className="font-black">Lưu ý</div>
            <p className="mt-1 text-xs leading-5">Email chỉ gửi được khi `.env` đã cấu hình SMTP. Nội dung được xử lý an toàn ở backend trước khi gửi.</p>
          </div>
        </div>
      </aside>
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
    <div className="min-h-[calc(100vh-4rem)] bg-white px-4 py-8 lg:pl-[292px] lg:pr-10">
      <aside className="mb-6 rounded-2xl border border-slate-200 bg-white shadow-sm lg:fixed lg:left-0 lg:top-16 lg:mb-0 lg:h-[calc(100vh-4rem)] lg:w-[264px] lg:rounded-none lg:border-y-0 lg:border-l-0 lg:shadow-none">
        <div className="flex h-full flex-col">
          <div className="border-b border-slate-100 px-6 py-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm">
                <Shield size={22} />
              </div>
              <div>
                <div className="text-sm font-black text-slate-950">Quản trị IUH</div>
                <div className="text-xs font-medium text-slate-400">IUH Exchange</div>
              </div>
            </div>
          </div>

          <nav className="flex-1 space-y-7 overflow-y-auto px-4 py-5">
            {['Bảng chính', 'Quản trị', 'Kiểm duyệt', 'Hệ thống'].map((group) => (
              <div key={group}>
                <div className="mb-2.5 px-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{group}</div>
                <div className="space-y-1.5">
                  {ADMIN_TABS.filter((tab) => tab.group === group).map((tab) => {
                    const active = activeTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as AdminTab)}
                        className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-left text-sm font-bold transition-colors ${
                          active
                            ? 'bg-slate-950 text-white shadow-sm ring-1 ring-slate-900'
                            : 'text-slate-500 hover:bg-blue-50 hover:text-slate-900'
                        }`}
                      >
                        <tab.icon size={18} strokeWidth={2} className={active ? 'text-blue-200' : 'text-slate-400'} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          <div className="border-t border-slate-100 p-4">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
              <div className="text-xs font-black uppercase tracking-wider text-slate-400">Trạng thái</div>
              <div className="mt-2 flex items-center gap-2 text-sm font-bold text-slate-700">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                Console hoạt động
              </div>
            </div>
          </div>
        </div>
      </aside>
      <div className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 ring-1 ring-blue-100">
            <Shield size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950">Trung tâm quản trị</h1>
            <p className="mt-1 text-sm font-medium text-slate-500">Kiểm duyệt, quản lý người dùng, tố cáo và sức khỏe hệ thống</p>
          </div>
        </div>
      </div>

      <div className="hidden">
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
      ) : activeTab === 'orders' ? (
        renderAdminOrders()
      ) : activeTab === 'reports' ? (
        renderReports()
      ) : activeTab === 'chatReports' ? (
        renderReportedMessages()
      ) : activeTab === 'lostFound' ? (
        renderLostFound()
      ) : activeTab === 'audit' ? (
        renderAuditLogs()
      ) : activeTab === 'email' ? (
        renderEmailCompose()
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
