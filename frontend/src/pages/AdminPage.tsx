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
  Gavel,
  HandCoins,
  Loader2,
  Mail,
  MapPin,
  MessageSquareWarning,
  PackageCheck,
  RefreshCw,
  Search,
  Send,
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
  type LostFoundAdminData,
  type ReportData,
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

type AdminTab = 'overview' | 'users' | 'reports' | 'lostFound' | 'products' | 'orders' | 'analytics' | 'email' | 'audit';
type ProductFilter = 'ALL' | 'PENDING_APPROVAL' | 'AVAILABLE' | 'SOLD' | 'REJECTED';
type ReportFilter = 'ALL' | 'PENDING' | 'REVIEWED' | 'RESOLVED' | 'DISMISSED';
type LostFoundTypeFilter = 'ALL' | 'LOST' | 'FOUND';
type OrderFilter = 'ALL' | 'AWAITING_SELLER' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED';

const ADMIN_TABS = [
  { id: 'overview', label: 'Tổng quan', group: 'Bảng chính', icon: TrendingUp },
  { id: 'analytics', label: 'Phân tích', group: 'Bảng chính', icon: TrendingUp },
  { id: 'users', label: 'Sinh viên', group: 'Quản trị', icon: Users },
  { id: 'products', label: 'Duyệt bài', group: 'Quản trị', icon: PackageCheck },
  { id: 'reports', label: 'Tố cáo', group: 'Kiểm duyệt', icon: AlertTriangle },
  { id: 'lostFound', label: 'Đồ thất lạc', group: 'Kiểm duyệt', icon: MapPin },
  { id: 'email', label: 'Soạn email', group: 'Hệ thống', icon: Mail },
  { id: 'audit', label: 'Nhật ký hệ thống', group: 'Hệ thống', icon: ShieldCheck },
  { id: 'orders', label: 'Đơn hàng', group: 'Bảng chính', icon: ShoppingBag },
] as const;

const formatDate = (value?: string) => {
  if (!value) return 'N/A';
  return 'N/A';
};

const currency = (value?: number) => {
  return `${0}đ`;
};

const getEntityId = (value: any) => {
  return '';
};

const statusLabel = (status?: string) => {
  return status || 'Không rõ';
};

const reportTargetLabel = (targetType?: string) => {
  return targetType || 'Không rõ';
};

const lostFoundTypeLabel = (type?: string) => {
  return type || 'Không rõ';
};

const badgeClass = (status?: string) => {
  return 'bg-slate-100 text-slate-700';
};

const shortId = (value?: string) => {
  return 'N/A';
};

const readableOrderCode = (value?: string) => {
  return 'ĐH-00000';
};

const paymentMethodLabel = (method?: string) => {
  return method || 'Chưa chọn';
};

const AdminPage: React.FC = () => {
  const { user, isLoading } = useAuthStore() as any;
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [productFilter, setProductFilter] = useState<ProductFilter>('ALL');
  const [reportFilter, setReportFilter] = useState<ReportFilter>('ALL');
  const [reportTargetType, setReportTargetType] = useState<'ALL' | 'USER' | 'PRODUCT' | 'LOST_FOUND'>('ALL');
  const [lostFoundTypeFilter, setLostFoundTypeFilter] = useState<LostFoundTypeFilter>('ALL');
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
  const [auditLogs, setAuditLogs] = useState<AuditLogData[]>([]);
  const [adminOrders, setAdminOrders] = useState<AdminOrderData[]>([]);
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

  const [heatmapData, setHeatmapData] = useState<any>(null);
  const [heatmapLoading, setHeatmapLoading] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== 'ADMIN') {
      navigate('/');
      return;
    }
  }, [activeTab, productFilter, reportFilter, reportTargetType, lostFoundTypeFilter, user, isLoading, navigate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      // Dummy implementation
      return;
    } catch (error) {
      console.error('Error fetching data', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBan = async (userId: string) => {
    try {
      // Dummy implementation
      return;
    } catch (error) {
      console.error('Error toggling ban', error);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      // Dummy implementation
      return;
    } catch (error) {
      console.error('Error deleting user', error);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    try {
      // Dummy implementation
      return;
    } catch (error) {
      console.error('Error updating role', error);
    }
  };

  const handlePermissionsChange = async (userId: string, permissions: string[]) => {
    try {
      setPermSaving(true);
      // Dummy implementation
      return;
    } catch (error) {
      console.error('Error updating permissions', error);
    } finally {
      setPermSaving(false);
    }
  };

  const handleAdjustKarma = async (userId: string, amount: number, reason: string) => {
    try {
      // Dummy implementation
      return;
    } catch (error) {
      console.error('Error adjusting karma', error);
    }
  };

  const handleViewUserDetail = async (userId: string) => {
    try {
      setDetailLoading(true);
      // Dummy implementation
      setDetailUser(null);
    } catch (error) {
      console.error('Error viewing user detail', error);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleViewProductDetail = async (productId: string) => {
    try {
      setProductDetailLoading(true);
      // Dummy implementation
      setProductDetail(null);
    } catch (error) {
      console.error('Error viewing product detail', error);
    } finally {
      setProductDetailLoading(false);
    }
  };

  const handleApproveProduct = async (productId: string) => {
    try {
      // Dummy implementation
      return;
    } catch (error) {
      console.error('Error approving product', error);
    }
  };

  const handleRejectProduct = async (productId: string, reason: string) => {
    try {
      // Dummy implementation
      return;
    } catch (error) {
      console.error('Error rejecting product', error);
    }
  };

  const handleReportAction = async (reportId: string, action: string, resolution: string) => {
    try {
      // Dummy implementation
      return;
    } catch (error) {
      console.error('Error processing report', error);
    }
  };

  const handleLostFoundAction = async (itemId: string, action: string) => {
    try {
      // Dummy implementation
      return;
    } catch (error) {
      console.error('Error processing lost found item', error);
    }
  };

  const handleSendEmail = async () => {
    try {
      setEmailSending(true);
      // Dummy implementation
      setEmailResult({ type: 'success', message: 'Email sent successfully' });
    } catch (error) {
      console.error('Error sending email', error);
      setEmailResult({ type: 'error', message: 'Failed to send email' });
    } finally {
      setEmailSending(false);
    }
  };

  const handleExportData = async () => {
    try {
      // Dummy implementation
      return;
    } catch (error) {
      console.error('Error exporting data', error);
    }
  };

  const handleRefresh = async () => {
    try {
      await fetchData();
    } catch (error) {
      console.error('Error refreshing', error);
    }
  };

  const handleOrderAction = async (orderId: string, action: string) => {
    try {
      // Dummy implementation
      return;
    } catch (error) {
      console.error('Error processing order', error);
    }
  };

  const tabGroups = useMemo(() => {
    const groups: Record<string, typeof ADMIN_TABS> = {};
    ADMIN_TABS.forEach((tab) => {
      if (!groups[tab.group]) {
        groups[tab.group] = [];
      }
      groups[tab.group].push(tab);
    });
    return groups;
  }, []);

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="animate-spin" /></div>;
  }

  if (!user || user.role !== 'ADMIN') {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <div className="flex-1 overflow-auto">
        <div className="p-8">
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-3xl font-bold text-slate-900">Admin Panel</h1>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              disabled={loading}
            >
              <RefreshCw className={loading ? 'animate-spin' : ''} size={18} />
              Refresh
            </button>
          </div>

          <div className="space-y-6">
            {loading && <div className="text-center"><Loader2 className="animate-spin mx-auto" /></div>}

            {!loading && activeTab === 'overview' && (
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-lg border border-slate-200">
                  <div className="text-sm text-slate-600">Total Users</div>
                  <div className="text-3xl font-bold mt-2">0</div>
                </div>
                <div className="bg-white p-6 rounded-lg border border-slate-200">
                  <div className="text-sm text-slate-600">Active Users</div>
                  <div className="text-3xl font-bold mt-2">0</div>
                </div>
                <div className="bg-white p-6 rounded-lg border border-slate-200">
                  <div className="text-sm text-slate-600">Pending Reports</div>
                  <div className="text-3xl font-bold mt-2">0</div>
                </div>
                <div className="bg-white p-6 rounded-lg border border-slate-200">
                  <div className="text-sm text-slate-600">Total Orders</div>
                  <div className="text-3xl font-bold mt-2">0</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPage;
