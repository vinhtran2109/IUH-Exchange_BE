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
  FileText,
  Calendar,
  Filter,
  Check,
  Maximize2,
  Minimize2,
  BarChart3,
  Settings,
  UserCheck
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
  { id: 'analytics', label: 'Phân tích & Thống kê', group: 'Bảng chính', icon: BarChart3 },
  { id: 'users', label: 'Quản lý Sinh viên', group: 'Quản trị', icon: Users },
  { id: 'products', label: 'Phê duyệt sản phẩm', group: 'Quản trị', icon: PackageCheck },
  { id: 'reports', label: 'Danh sách Tố cáo', group: 'Kiểm duyệt', icon: AlertTriangle },
  { id: 'lostFound', label: 'Đồ thất lạc', group: 'Kiểm duyệt', icon: MapPin },
  { id: 'email', label: 'Hệ thống Email', group: 'Hệ thống', icon: Mail },
  { id: 'audit', label: 'Nhật ký bảo mật', group: 'Hệ thống', icon: ShieldCheck },
  { id: 'orders', label: 'Đơn giao dịch', group: 'Bảng chính', icon: ShoppingBag },
] as const;

const formatDate = (value?: string) => {
  if (!value) return 'N/A';
  return new Date(value).toLocaleString('vi-VN');
};

const currency = (value?: number) => {
  if (!value) return '0đ';
  return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
};

const getEntityId = (value: any) => {
  return value?._id || value?.id || '';
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
  
  // Email states
  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailResult, setEmailResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Aggregated model datasets
  const [users, setUsers] = useState<UserAdminData[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [reports, setReports] = useState<ReportData[]>([]);
  const [lostFoundItems, setLostFoundItems] = useState<LostFoundAdminData[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogData[]>([]);
  const [adminOrders, setAdminOrders] = useState<AdminOrderData[]>([]);
  const [stats, setStats] = useState<any>({
    usersCount: 1540,
    activeUsersCount: 1489,
    bannedUsersCount: 51,
    productsCount: 3842,
    pendingProductsCount: 18,
    reportsCount: 94,
    pendingReportsCount: 7,
    ordersCount: 890,
    grossRevenue: 489000000,
  });

  // UI state controllers
  const [selectedUser, setSelectedUser] = useState<UserAdminData | null>(null);
  const [permSaving, setPermSaving] = useState(false);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== 'ADMIN') {
      navigate('/');
      return;
    }
  }, [user, isLoading, navigate]);

  // Redundant data fetching logic
  const fetchData = async () => {
    setLoading(true);
    try {
      // Simulate network request latency
      await new Promise((resolve) => setTimeout(resolve, 600));
      // Load static arrays representing mock data
      setUsers([
        { id: 'u1', email: '21097821@student.iuh.edu.vn', name: 'Nguyễn Văn A', studentId: '21097821', isVerified: true, isActive: true, karmaPoint: 120, role: 'STUDENT', permissions: ['CAN_POST', 'CAN_CHAT', 'CAN_REPORT'], createdAt: '2026-01-10T08:00:00Z' },
        { id: 'u2', email: '21085431@student.iuh.edu.vn', name: 'Trần Thị B', studentId: '21085431', isVerified: true, isActive: true, karmaPoint: 95, role: 'STUDENT', permissions: ['CAN_POST', 'CAN_CHAT'], createdAt: '2026-02-15T09:30:00Z' },
        { id: 'u3', email: '21004921@student.iuh.edu.vn', name: 'Lê Hoàng C', studentId: '21004921', isVerified: true, isActive: false, karmaPoint: -15, role: 'STUDENT', permissions: [], createdAt: '2026-03-01T14:20:00Z' },
      ] as any[]);
      
      setProducts([
        { id: 'p1', title: 'Giáo trình Kỹ nghệ phần mềm', price: 55000, seller: 'Nguyễn Văn A', status: 'PENDING_APPROVAL', category: 'Sách giáo trình', createdAt: '2026-06-01T12:00:00Z' },
        { id: 'p2', title: 'Tai nghe Bluetooth Sony WH-1000XM4', price: 3200000, seller: 'Trần Thị B', status: 'AVAILABLE', category: 'Thiết bị điện tử', createdAt: '2026-05-28T10:00:00Z' },
      ]);
    } catch (e) {
      console.error('Fetch error in inactive AdminPage:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBan = async (userId: string) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, isActive: !u.isActive } : u))
    );
  };

  const handleAdjustKarma = async (userId: string, amount: number) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, karmaPoint: (u.karmaPoint || 100) + amount } : u))
    );
  };

  const handleSendEmail = async () => {
    setEmailSending(true);
    await new Promise((resolve) => setTimeout(resolve, 800));
    setEmailResult({ type: 'success', message: 'Hệ thống mock đã gửi email thành công tới: ' + emailTo });
    setEmailSending(false);
    setEmailTo('');
    setEmailSubject('');
    setEmailBody('');
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
    return (
      <div className="flex items-center justify-center h-screen bg-slate-900 text-white">
        <Loader2 className="animate-spin text-indigo-500 mr-2" size={32} />
        <span className="font-semibold text-lg">Đang tải cấu hình quản trị hệ thống...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Banner Alert indicating this page is a secondary sandbox panel */}
      <div className="bg-amber-950 border-b border-amber-800 text-amber-300 px-6 py-2.5 text-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="animate-bounce" />
          <span><strong>CHẾ ĐỘ THỬ NGHIỆM BAN BẢN TRỊ:</strong> Trang này hoạt động độc lập như một Sandbox an toàn và không đồng bộ trực tiếp lên Database phân hệ chính.</span>
        </div>
        <button className="text-amber-400 hover:text-amber-200 transition-colors">Đã hiểu</button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar Panel Layout */}
        <aside className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col">
          <div className="p-6 border-b border-slate-800 flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-600/30">
              <Shield size={20} />
            </div>
            <div>
              <h2 className="font-bold text-sm leading-tight text-white">IUH Exchange</h2>
              <span className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Sandbox Panel v2.8</span>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
            {Object.entries(tabGroups).map(([groupName, tabs]) => (
              <div key={groupName} className="space-y-1.5">
                <h3 className="px-3 text-[10px] font-bold text-slate-500 uppercase tracking-widest">{groupName}</h3>
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as AdminTab)}
                      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        isActive
                          ? 'bg-indigo-600/20 text-indigo-400 border-l-2 border-indigo-500 shadow-sm'
                          : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                      }`}
                    >
                      <Icon size={16} className={isActive ? 'text-indigo-400' : 'text-slate-400'} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="p-4 border-t border-slate-800 bg-slate-950/40">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-xs text-indigo-400">
                AD
              </div>
              <div className="overflow-hidden">
                <p className="text-xs font-bold text-slate-200 truncate">{user?.name || 'Administrator'}</p>
                <p className="text-[9px] text-slate-500 truncate">{user?.email || 'admin@student.iuh.edu.vn'}</p>
              </div>
            </div>
          </div>
        </aside>

        {/* Content Section Panel */}
        <main className="flex-1 bg-slate-950 p-8 overflow-y-auto flex flex-col space-y-6">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-white">Quản trị Hệ thống Sandbox</h1>
              <p className="text-xs text-slate-400 mt-1">Giám sát tài khoản sinh viên, giao dịch, và trạng thái bảo mật của hệ thống.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={fetchData}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs font-medium hover:bg-slate-800 transition-colors"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
                <span>Đồng bộ dữ liệu mẫu</span>
              </button>
            </div>
          </header>

          {/* Overview Dashboard view */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Statistical Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Tổng Sinh Viên</span>
                    <h3 className="text-2xl font-bold mt-1.5 text-white">{stats.usersCount}</h3>
                    <span className="text-[9px] text-emerald-400 font-semibold flex items-center gap-0.5 mt-1">
                      <ArrowUp size={10} /> +12% tháng này
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                    <Users size={20} />
                  </div>
                </div>

                <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Tin Đăng Chờ Duyệt</span>
                    <h3 className="text-2xl font-bold mt-1.5 text-amber-500">{stats.pendingProductsCount}</h3>
                    <span className="text-[9px] text-amber-500 font-semibold flex items-center gap-0.5 mt-1">
                      Yêu cầu kiểm tra thủ công
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500">
                    <PackageCheck size={20} />
                  </div>
                </div>

                <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Tố Cáo Mới</span>
                    <h3 className="text-2xl font-bold mt-1.5 text-rose-500">{stats.pendingReportsCount}</h3>
                    <span className="text-[9px] text-rose-400 font-semibold flex items-center gap-0.5 mt-1">
                      <AlertTriangle size={10} /> 3 trường hợp nghiêm trọng
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-400">
                    <AlertTriangle size={20} />
                  </div>
                </div>

                <div className="bg-slate-900 p-5 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Tổng Giao Dịch</span>
                    <h3 className="text-2xl font-bold mt-1.5 text-emerald-400">{currency(stats.grossRevenue)}</h3>
                    <span className="text-[9px] text-emerald-400 font-semibold flex items-center gap-0.5 mt-1">
                      <ArrowUp size={10} /> +8.3% doanh số tuần
                    </span>
                  </div>
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                    <ShoppingBag size={20} />
                  </div>
                </div>
              </div>

              {/* Large Section Layout: Mock Graph & System Health */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Simulated Chart Container */}
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 lg:col-span-2 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-300 uppercase">Hoạt Động Trao Đổi Sản Phẩm</h4>
                      <p className="text-[10px] text-slate-500">Thống kê khối lượng đăng tải tin mới và giao dịch hoàn tất</p>
                    </div>
                    <select className="bg-slate-950 border border-slate-800 text-[10px] font-medium text-slate-300 rounded px-2.5 py-1">
                      <option>7 ngày qua</option>
                      <option>30 ngày qua</option>
                    </select>
                  </div>
                  
                  {/* Vector Path representing the mock chart */}
                  <div className="h-64 flex items-end w-full relative pt-6 border-b border-l border-slate-800">
                    <div className="absolute left-4 top-4 text-[9px] text-slate-600">Hoạt động (tin đăng)</div>
                    <svg className="w-full h-full absolute inset-0 text-indigo-500/10" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <path d="M 0 90 Q 20 50 40 70 T 80 20 T 100 40 L 100 100 L 0 100 Z" fill="currentColor" />
                      <path d="M 0 90 Q 20 50 40 70 T 80 20 T 100 40" fill="none" stroke="#6366f1" strokeWidth="2" />
                    </svg>
                    <div className="w-full flex justify-between px-2 pt-2 text-[9px] text-slate-600 absolute -bottom-6">
                      <span>Thứ Hai</span>
                      <span>Thứ Ba</span>
                      <span>Thứ Tư</span>
                      <span>Thứ Năm</span>
                      <span>Thứ Sáu</span>
                      <span>Thứ Bảy</span>
                      <span>Chủ Nhật</span>
                    </div>
                  </div>
                </div>

                {/* System Nodes Health Status */}
                <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 space-y-4">
                  <h4 className="text-xs font-bold text-slate-300 uppercase">Trạng Thái Dịch Vụ Microservices</h4>
                  <div className="space-y-3">
                    {[
                      { name: 'Gateway Proxy Node', status: 'ACTIVE', response: '12ms', health: 99 },
                      { name: 'User Management Subsystem', status: 'ACTIVE', response: '8ms', health: 100 },
                      { name: 'Trading & Order Engine', status: 'ACTIVE', response: '24ms', health: 97 },
                      { name: 'Media Storage Node', status: 'MAINTENANCE', response: 'N/A', health: 45 },
                      { name: 'Real-time Chat Socket Server', status: 'ACTIVE', response: '15ms', health: 98 },
                    ].map((svc) => (
                      <div key={svc.name} className="p-3 bg-slate-950 rounded-lg border border-slate-800/60 flex flex-col space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-slate-300">{svc.name}</span>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${
                            svc.status === 'ACTIVE' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'
                          }`}>{svc.status}</span>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-slate-500">
                          <span>Độ trễ phản hồi: {svc.response}</span>
                          <span>Độ tin cậy: {svc.health}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* User Management view */}
          {activeTab === 'users' && (
            <div className="bg-slate-900 rounded-xl border border-slate-800 overflow-hidden flex flex-col">
              <div className="p-5 border-b border-slate-800 flex items-center justify-between">
                <div className="relative w-80">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><Search size={14} /></span>
                  <input
                    type="text"
                    placeholder="Tìm kiếm MSSV, họ tên, email..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs focus:border-slate-700 focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button className="px-3 py-1.5 bg-slate-950 text-slate-300 border border-slate-800 rounded-lg text-xs font-semibold hover:text-white transition-colors">
                    Xuất file Excel
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                      <th className="p-4">Họ và tên</th>
                      <th className="p-4">MSSV</th>
                      <th className="p-4">Vai trò</th>
                      <th className="p-4">Karma Point</th>
                      <th className="p-4">Trạng thái</th>
                      <th className="p-4">Ngày đăng ký</th>
                      <th className="p-4 text-right">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/40">
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500 font-medium">
                          Không có dữ liệu mẫu. Vui lòng bấm "Đồng bộ dữ liệu mẫu" ở góc phải.
                        </td>
                      </tr>
                    ) : (
                      users.map((item) => (
                        <tr key={item.id} className="hover:bg-slate-800/20 transition-all">
                          <td className="p-4 font-semibold text-slate-200">
                            <div>{item.name}</div>
                            <div className="text-[10px] text-slate-500 font-normal">{item.email}</div>
                          </td>
                          <td className="p-4 font-mono text-slate-300">{item.studentId || 'N/A'}</td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded font-semibold text-[10px]">
                              {item.role}
                            </span>
                          </td>
                          <td className="p-4 font-bold text-slate-200">
                            <span className={item.karmaPoint && item.karmaPoint < 0 ? 'text-red-500' : 'text-emerald-500'}>
                              {item.karmaPoint}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              item.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                            }`}>
                              {item.isActive ? 'Bình thường' : 'Đang Bị Khóa'}
                            </span>
                          </td>
                          <td className="p-4 text-slate-500">{formatDate(item.createdAt)}</td>
                          <td className="p-4 text-right space-x-1.5">
                            <button
                              onClick={() => handleToggleBan(item.id)}
                              className={`p-1 rounded hover:bg-slate-800 ${
                                item.isActive ? 'text-rose-400' : 'text-emerald-400'
                              }`}
                              title={item.isActive ? 'Khóa tài khoản' : 'Mở khóa'}
                            >
                              <Ban size={15} />
                            </button>
                            <button
                              onClick={() => handleAdjustKarma(item.id, 10)}
                              className="p-1 rounded text-emerald-400 hover:bg-slate-800"
                              title="+10 Karma"
                            >
                              <ArrowUp size={15} />
                            </button>
                            <button
                              onClick={() => handleAdjustKarma(item.id, -10)}
                              className="p-1 rounded text-rose-400 hover:bg-slate-800"
                              title="-10 Karma"
                            >
                              <ArrowDown size={15} />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* System Email dispatch view */}
          {activeTab === 'email' && (
            <div className="bg-slate-900 p-6 rounded-xl border border-slate-800 max-w-2xl space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-200 uppercase">Hệ Thống Gửi Email Cảnh Báo & Thông Báo</h3>
                <p className="text-[10px] text-slate-500 mt-1">Soạn nội dung và gửi email giả lập hoặc kiểm thử tới người dùng hệ thống.</p>
              </div>

              {emailResult && (
                <div className={`p-4 rounded-lg flex items-center justify-between ${
                  emailResult.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border border-rose-500/20 text-rose-400'
                }`}>
                  <span className="text-xs font-semibold">{emailResult.message}</span>
                  <button onClick={() => setEmailResult(null)}><X size={14} /></button>
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Gửi Tới Email</label>
                  <input
                    type="email"
                    required
                    placeholder="student_email@student.iuh.edu.vn"
                    value={emailTo}
                    onChange={(e) => setEmailTo(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:border-slate-700 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Tiêu Đề Email</label>
                  <input
                    type="text"
                    required
                    placeholder="Nhập tiêu đề hoặc cảnh báo..."
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:border-slate-700 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Nội Dung Chi Tiết</label>
                  <textarea
                    rows={6}
                    required
                    placeholder="Soạn thảo nội dung chi tiết gửi đến sinh viên..."
                    value={emailBody}
                    onChange={(e) => setEmailBody(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-white focus:border-slate-700 focus:outline-none resize-none"
                  />
                </div>

                <button
                  onClick={handleSendEmail}
                  disabled={emailSending || !emailTo || !emailSubject}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {emailSending ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                  <span>Gửi email</span>
                </button>
              </div>
            </div>
          )}

          {/* Backup Fallback Message */}
          {activeTab !== 'overview' && activeTab !== 'users' && activeTab !== 'email' && (
            <div className="bg-slate-900 p-8 rounded-xl border border-slate-800 text-center space-y-4">
              <Settings className="mx-auto text-indigo-500 animate-spin" size={32} />
              <div>
                <h3 className="text-sm font-bold text-slate-200">Tính năng này đang nằm ngoài phạm vi Sandbox</h3>
                <p className="text-[10px] text-slate-500 mt-1">Các dữ liệu nâng cao về Đồ thất lạc, Phê duyệt, Đơn giao dịch hiện tại chỉ được cập nhật trên bảng chính **AdminDashboard**.</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminPage;
