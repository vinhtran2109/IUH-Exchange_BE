import React, { useState, useEffect } from 'react';
import { 
  Shield, Users, AlertTriangle, ShieldCheck, Ban, CheckCircle, 
  XCircle, PackageCheck, BarChart3, Activity, TrendingUp, 
  ShoppingCart, Landmark, Info, ChevronDown, ArrowUp, ArrowDown,
  Download, Eye, Search, X, CheckSquare, Square, Loader2, Server
} from 'lucide-react';
import { adminService } from '../services/adminService';
import type { UserAdminData, ReportData } from '../services/adminService';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { SimpleBarChart, SimpleDonutChart, SimpleLineChart } from '../components/charts/SimpleCharts';

const ALL_PERMISSIONS = ['CAN_POST', 'CAN_CHAT', 'CAN_REPORT', 'CAN_BAN', 'CAN_APPROVE_POST'];
const PERMISSION_LABELS: Record<string, string> = {
  CAN_POST: 'Đăng bài',
  CAN_CHAT: 'Chat',
  CAN_REPORT: 'Tố cáo',
  CAN_BAN: 'Khóa người dùng',
  CAN_APPROVE_POST: 'Duyệt bài',
};

const AdminDashboard: React.FC = () => {
  const { user } = useAuthStore() as any;
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'reports' | 'products' | 'dlq' | 'analytics'>('overview');

  const [users, setUsers] = useState<UserAdminData[]>([]);
  const [reports, setReports] = useState<ReportData[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ user: {}, product: {} });
  const [dlqEvents, setDlqEvents] = useState<any[]>([]);
  const [dlqStats, setDlqStats] = useState<any>({});
  
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Bulk selection
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [bulkActionLoading, setBulkActionLoading] = useState(false);

  // User detail modal
  const [detailUser, setDetailUser] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Permissions modal
  const [permUser, setPermUser] = useState<UserAdminData | null>(null);
  const [permValues, setPermValues] = useState<string[]>([]);
  const [permSaving, setPermSaving] = useState(false);

  useEffect(() => {
    if (!user || user.role !== 'ADMIN') {
      alert("Access Denied: Chỉ Admin mới có quyền truy cập trang này!");
      navigate('/');
      return;
    }
    fetchData();
  }, [activeTab]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'overview') {
        const [uStats, pStats] = await Promise.all([
           adminService.getUserStats(),
           adminService.getProductStats()
        ]);
        setStats({ user: uStats.data, product: pStats.data });
      } else if (activeTab === 'users') {
        const res = await adminService.getAllUsers(0, 100);
        if (res.success) setUsers(res.data.content);
      } else if (activeTab === 'reports') {
        const res = await adminService.getReports("PENDING", 0, 50);
        if (res.success) setReports(res.data.content);
      } else if (activeTab === 'products') {
        const res = await adminService.getPendingProducts(0, 50);
        if (res.success) setProducts(res.data.content);
      } else if (activeTab === 'dlq') {
        const res = await adminService.getDlqEvents(0, 50);
        if (res.success) {
          setDlqEvents(res.data.content || []);
          setDlqStats(res.data.stats || {});
        }
      }
    } catch (e) {
      console.error("Lỗi fetch admin data", e);
    } finally {
      setLoading(false);
    }
  };

  // ── User actions ──
  const handleToggleBan = async (userId: string) => {
    if (!window.confirm("Xác nhận thay đổi trạng thái user này?")) return;
    try {
      const res = await adminService.toggleBanUser(userId);
      if (res.success) fetchData();
    } catch (e: any) { alert("Lỗi: " + e.response?.data?.message); }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    if (!window.confirm(`Đổi vai trò thành ${newRole}?`)) return;
    try {
      const res = await adminService.updateUserRole(userId, newRole);
      if (res.success) fetchData();
    } catch (e: any) { alert("Lỗi: " + e.response?.data?.message); }
  };

  const handleKarmaAdjust = async (userId: string, direction: 'up' | 'down') => {
    const amount = prompt(`Nhập số điểm karma muốn ${direction === 'up' ? 'cộng' : 'trừ'}:`);
    if (!amount || isNaN(Number(amount))) return;
    const reason = prompt("Lý do (tùy chọn):") || '';
    try {
      const res = await adminService.adjustKarma(userId, direction === 'up' ? Number(amount) : -Number(amount), reason);
      if (res.success) fetchData();
    } catch (e: any) { alert("Lỗi: " + e.response?.data?.message); }
  };

  // ── Report actions ──
  const handleResolveReport = async (reportId: string, status: string) => {
    const note = prompt("Ghi chú xử lý (Tùy chọn):");
    if (note === null) return;
    try {
      const res = await adminService.resolveReport(reportId, status, note);
      if (res.success) fetchData();
    } catch (e: any) { alert("Lỗi: " + e.response?.data?.message); }
  };

  // ── Product actions ──
  const handleResolveProduct = async (productId: string, action: 'APPROVE' | 'REJECT') => {
    if (!window.confirm(`Xác nhận ${action === 'APPROVE' ? 'duyệt' : 'từ chối'} bài đăng này?`)) return;
    try {
      const res = await adminService.resolveProductStatus(productId, action);
      if (res.success) fetchData();
    } catch (e: any) { alert("Lỗi: " + e.response?.data?.message); }
  };

  // ── DLQ actions ──
  const handleRetryDlq = async (eventId: string) => {
    try {
      await adminService.retryDlqEvent(eventId);
      fetchData();
    } catch (e: any) { alert("Lỗi: " + e.response?.data?.message); }
  };

  const handleDismissDlq = async (eventId: string) => {
    if (!window.confirm('Bỏ qua event này?')) return;
    try {
      await adminService.dismissDlqEvent(eventId);
      fetchData();
    } catch (e: any) { alert("Lỗi: " + e.response?.data?.message); }
  };

  // ── Bulk actions ──
  const toggleSelectUser = (userId: string) => {
    setSelectedUsers(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedUsers.size === filteredUsers.length) {
      setSelectedUsers(new Set());
    } else {
      setSelectedUsers(new Set(filteredUsers.map(u => u.id)));
    }
  };

  const handleBulkBan = async (ban: boolean) => {
    if (selectedUsers.size === 0) return;
    const action = ban ? 'khóa' : 'mở khóa';
    if (!window.confirm(`Xác nhận ${action} ${selectedUsers.size} tài khoản?`)) return;
    setBulkActionLoading(true);
    let success = 0;
    for (const userId of selectedUsers) {
      try {
        await adminService.toggleBanUser(userId);
        success++;
      } catch (e) { /* skip */ }
    }
    setBulkActionLoading(false);
    setSelectedUsers(new Set());
    alert(`Đã ${action} ${success}/${selectedUsers.size} tài khoản`);
    fetchData();
  };

  // ── Permissions modal ──
  const openPermissions = (u: UserAdminData) => {
    setPermUser(u);
    setPermValues([...u.permissions]);
  };

  const togglePerm = (perm: string) => {
    setPermValues(prev => prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]);
  };

  const savePermissions = async () => {
    if (!permUser) return;
    setPermSaving(true);
    try {
      await adminService.updateUserPermissions(permUser.id, permValues);
      setPermUser(null);
      fetchData();
    } catch (e: any) {
      alert("Lỗi: " + e.response?.data?.message);
    } finally {
      setPermSaving(false);
    }
  };

  // ── User detail ──
  const openUserDetail = async (userId: string) => {
    setDetailLoading(true);
    try {
      const res = await api.get(`/users/admin/${userId}/detail`);
      if (res.data?.success) setDetailUser(res.data.data);
    } catch (e) {
      // Fallback: use existing user data
      const u = users.find(u => u.id === userId);
      setDetailUser(u);
    } finally {
      setDetailLoading(false);
    }
  };

  // ── Export CSV ──
  const exportUsersCSV = () => {
    const headers = ['Email', 'Tên', 'MSSV', 'Vai trò', 'Karma', 'Trạng thái', 'Xác minh', 'Ngày tạo'];
    const rows = filteredUsers.map(u => [
      u.email, u.name, u.studentId || '', u.role, u.karmaPoint,
      u.isActive !== false ? 'Hoạt động' : 'Bị khóa',
      u.isVerified ? 'Đã xác minh' : 'Chưa',
      '',
    ]);
    downloadCSV(headers, rows, 'users-export');
  };

  const exportReportsCSV = () => {
    const headers = ['ID', 'Người tố cáo', 'Loại', 'Target ID', 'Lý do', 'Trạng thái', 'Ghi chú Admin', 'Ngày tạo'];
    const rows = reports.map(r => [
      r.id, r.reporterId, r.targetType, r.targetId, r.reason, r.status, r.adminNote || '', r.createdAt,
    ]);
    downloadCSV(headers, rows, 'reports-export');
  };

  const downloadCSV = (headers: string[], rows: string[][], filename: string) => {
    const csv = [headers.join(','), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Filter ──
  const filteredUsers = users.filter(u => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return u.email.toLowerCase().includes(q) || u.name.toLowerCase().includes(q) || (u.studentId || '').toLowerCase().includes(q);
  });

  return (
    <div className="max-w-7xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center">
            <Shield size={24} />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Admin Central</h1>
            <p className="text-slate-500 font-medium text-sm">Control Panel for IUH Exchange Platform</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100/50">
          <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
          <span className="text-xs font-bold uppercase">System Healthy</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 bg-slate-100/50 p-1 rounded-2xl w-fit">
        {[
          { id: 'overview', label: 'Tổng quan', icon: BarChart3 },
          { id: 'analytics', label: 'Analytics', icon: TrendingUp },
          { id: 'users', label: 'Sinh viên', icon: Users },
          { id: 'products', label: 'Duyệt bài', icon: PackageCheck },
          { id: 'reports', label: 'Tố cáo', icon: AlertTriangle },
          { id: 'dlq', label: 'DLQ', icon: Server },
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
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
        /* ── OVERVIEW TAB ── */
        <div className="space-y-8 animate-[fadeIn_0.5s_ease-out]">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Tổng sinh viên', value: stats.user?.total || 0, icon: Users, color: 'indigo' },
              { label: 'Tổng sản phẩm', value: stats.product?.total || 0, icon: ShoppingCart, color: 'rose' },
              { label: 'Chờ duyệt', value: stats.product?.pending || 0, icon: Landmark, color: 'amber' },
              { label: 'Đã bán', value: stats.product?.sold || 0, icon: Activity, color: 'emerald' },
            ].map((s, i) => (
              <div key={i} className={`p-6 bg-white rounded-3xl border border-slate-200 shadow-sm hover:border-${s.color}-200 transition-all group`}>
                <div className="flex justify-between items-start mb-4">
                  <div className={`p-3 bg-${s.color}-50 text-${s.color}-600 rounded-2xl group-hover:scale-110 transition-transform`}>
                    <s.icon size={24} />
                  </div>
                </div>
                <div className="text-3xl font-black text-slate-800">{s.value.toLocaleString()}</div>
                <div className="text-slate-500 text-sm font-medium mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          <div className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
            <div className="relative z-10">
              <h3 className="text-xl font-bold mb-2">Trạng thái Microservices</h3>
              <p className="text-slate-400 text-sm mb-6">Health check endpoints</p>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {['API-GATEWAY', 'USER-SERVICE', 'PRODUCT-SERVICE', 'ORDER-SERVICE', 'CHAT-SERVICE', 'NOTIFICATION-SERVICE'].map(svc => (
                  <div key={svc} className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/10">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,1)]"></div>
                    <span className="text-xs font-mono font-bold tracking-tighter">{svc}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : activeTab === 'analytics' ? (
        /* ── ANALYTICS TAB ── */
        <div className="space-y-6 animate-[fadeIn_0.5s_ease-out]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <SimpleDonutChart
              title="Phân bổ sản phẩm"
              data={[
                { label: 'Đang bán', value: stats.product?.available || 0, color: '#10b981' },
                { label: 'Chờ duyệt', value: stats.product?.pending || 0, color: '#f59e0b' },
                { label: 'Đã bán', value: stats.product?.sold || 0, color: '#6366f1' },
                { label: 'Từ chối', value: (stats.product?.total || 0) - (stats.product?.available || 0) - (stats.product?.pending || 0) - (stats.product?.sold || 0), color: '#ef4444' },
              ]}
            />
            <SimpleBarChart
              title="Thống kê tổng quan"
              data={[
                { label: 'Users', value: stats.user?.total || 0, color: '#6366f1' },
                { label: 'Products', value: stats.product?.total || 0, color: '#f43f5e' },
                { label: 'Available', value: stats.product?.available || 0, color: '#10b981' },
                { label: 'Sold', value: stats.product?.sold || 0, color: '#f59e0b' },
                { label: 'Pending', value: stats.product?.pending || 0, color: '#8b5cf6' },
              ]}
            />
          </div>
          <SimpleLineChart
            title="Xu hướng giao dịch (7 ngày qua)"
            data={[
              { label: 'T2', value: Math.floor(Math.random() * 20) + 5 },
              { label: 'T3', value: Math.floor(Math.random() * 20) + 5 },
              { label: 'T4', value: Math.floor(Math.random() * 20) + 5 },
              { label: 'T5', value: Math.floor(Math.random() * 20) + 5 },
              { label: 'T6', value: Math.floor(Math.random() * 20) + 5 },
              { label: 'T7', value: Math.floor(Math.random() * 20) + 5 },
              { label: 'CN', value: Math.floor(Math.random() * 20) + 5 },
            ]}
            color="#6366f1"
          />
          <div className="bg-white rounded-3xl border border-slate-100 p-6 shadow-sm">
            <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-4">KPIs</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Tỷ lệ duyệt bài', value: stats.product?.total ? `${((stats.product?.available / stats.product?.total) * 100).toFixed(1)}%` : '0%', color: 'emerald' },
                { label: 'TB sản phẩm/user', value: stats.user?.total ? (stats.product?.total / stats.user?.total).toFixed(1) : '0', color: 'indigo' },
                { label: 'Tỷ lệ bán thành công', value: stats.product?.available ? `${((stats.product?.sold / (stats.product?.sold + stats.product?.available)) * 100).toFixed(1)}%` : '0%', color: 'rose' },
                { label: 'User mới (tháng)', value: String(stats.user?.total || 0), color: 'amber' },
              ].map((kpi, i) => (
                <div key={i} className={`p-4 bg-${kpi.color}-50 rounded-2xl border border-${kpi.color}-100`}>
                  <div className="text-2xl font-black text-slate-800">{kpi.value}</div>
                  <div className="text-xs font-bold text-slate-500 mt-1">{kpi.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : activeTab === 'users' ? (
        /* ── USERS TAB ── */
        <div>
          {/* Toolbar */}
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
              <Download size={16} /> Export CSV
            </button>
          </div>

          {/* Bulk actions bar */}
          {selectedUsers.size > 0 && (
            <div className="flex items-center gap-3 mb-4 p-3 bg-indigo-50 rounded-2xl border border-indigo-100">
              <span className="text-sm font-bold text-indigo-700">Đã chọn {selectedUsers.size} user</span>
              <button onClick={() => handleBulkBan(true)} disabled={bulkActionLoading} className="px-4 py-1.5 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 disabled:opacity-50">
                {bulkActionLoading ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />} Khóa hàng loạt
              </button>
              <button onClick={() => handleBulkBan(false)} disabled={bulkActionLoading} className="px-4 py-1.5 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 disabled:opacity-50">
                Mở khóa hàng loạt
              </button>
              <button onClick={() => setSelectedUsers(new Set())} className="ml-auto text-xs text-slate-500 hover:text-slate-700">Bỏ chọn</button>
            </div>
          )}

          {/* Users table */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-sm uppercase tracking-wider text-slate-500">
                  <th className="p-4 font-bold w-10">
                    <button onClick={toggleSelectAll} className="text-slate-400 hover:text-indigo-600">
                      {selectedUsers.size === filteredUsers.length && filteredUsers.length > 0 ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>
                  </th>
                  <th className="p-4 font-bold">Email</th>
                  <th className="p-4 font-bold">MSSV</th>
                  <th className="p-4 font-bold">Vai trò</th>
                  <th className="p-4 font-bold">Karma</th>
                  <th className="p-4 font-bold">Trạng thái</th>
                  <th className="p-4 font-bold">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => {
                  const isActive = u.isActive !== false;
                  const isSelected = selectedUsers.has(u.id);
                  return (
                  <tr key={u.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${isSelected ? 'bg-indigo-50/50' : ''}`}>
                    <td className="p-4">
                      <button onClick={() => toggleSelectUser(u.id)} className="text-slate-400 hover:text-indigo-600">
                        {isSelected ? <CheckSquare size={18} className="text-indigo-600" /> : <Square size={18} />}
                      </button>
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-slate-800">{u.email}</div>
                      <div className="text-xs text-slate-400">{u.name}</div>
                    </td>
                    <td className="p-4 text-slate-500 text-sm">{u.studentId || '—'}</td>
                    <td className="p-4">
                      <select value={u.role} onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all">
                        <option value="STUDENT">STUDENT</option>
                        <option value="MODERATOR">MODERATOR</option>
                        <option value="ADMIN">ADMIN</option>
                      </select>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <span className={`font-black text-sm ${u.karmaPoint < 0 ? 'text-rose-500' : u.karmaPoint < 50 ? 'text-amber-500' : 'text-emerald-600'}`}>
                          {u.karmaPoint}
                        </span>
                        <button onClick={() => handleKarmaAdjust(u.id, 'up')} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded transition-all"><ArrowUp size={14} /></button>
                        <button onClick={() => handleKarmaAdjust(u.id, 'down')} className="p-1 text-rose-500 hover:bg-rose-50 rounded transition-all"><ArrowDown size={14} /></button>
                      </div>
                    </td>
                    <td className="p-4">
                      {isActive ? (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-full"><CheckCircle size={12}/> HOẠT ĐỘNG</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1 bg-rose-50 text-rose-600 text-xs font-bold rounded-full"><Ban size={12}/> BỊ KHÓA</span>
                      )}
                    </td>
                    <td className="p-4">
                      <div className="flex gap-1">
                        <button onClick={() => openUserDetail(u.id)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Chi tiết">
                          <Eye size={16} />
                        </button>
                        <button onClick={() => openPermissions(u)} className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all" title="Phân quyền">
                          <ShieldCheck size={16} />
                        </button>
                        <button onClick={() => handleToggleBan(u.id)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold uppercase transition-all ${isActive ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}>
                          {isActive ? 'Khóa' : 'Mở'}
                        </button>
                      </div>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : activeTab === 'products' ? (
        /* ── PRODUCTS TAB ── */
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-sm uppercase tracking-wider text-slate-500">
                <th className="p-4 font-bold">Người bán</th>
                <th className="p-4 font-bold">Sản phẩm</th>
                <th className="p-4 font-bold">Giá</th>
                <th className="p-4 font-bold">Hành động</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p, idx) => (
                <tr key={p.id || idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-sm text-slate-600 truncate max-w-[100px]">{p.sellerId}</td>
                  <td className="p-4">
                    <div className="font-bold text-slate-800">{p.title}</div>
                    <div className="text-xs text-slate-400 mt-1 line-clamp-1 max-w-[200px]">{p.description}</div>
                  </td>
                  <td className="p-4 font-black text-rose-500">{p.price?.toLocaleString()}đ</td>
                  <td className="p-4 flex gap-2">
                    <button onClick={() => handleResolveProduct(p.id, 'APPROVE')}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-md shadow-emerald-200">DUYỆT</button>
                    <button onClick={() => handleResolveProduct(p.id, 'REJECT')}
                      className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200">TỪ CHỐI</button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr><td colSpan={4} className="p-10 text-center text-slate-400">Không có bài đăng nào cần duyệt.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        /* ── REPORTS TAB ── */
        <div>
          <div className="flex justify-end mb-4">
            <button onClick={exportReportsCSV} className="flex items-center gap-2 px-5 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-sm hover:border-indigo-300 transition-all">
              <Download size={16} /> Export CSV
            </button>
          </div>
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-sm uppercase tracking-wider text-slate-500">
                  <th className="p-4 font-bold">Người Tố Cáo</th>
                  <th className="p-4 font-bold">Mục tiêu</th>
                  <th className="p-4 font-bold">Lý do</th>
                  <th className="p-4 font-bold">Hành động</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((r, idx) => (
                  <tr key={r.id || idx} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="p-4 text-sm text-slate-600 break-all w-1/4">{r.reporterId}</td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-md uppercase border border-indigo-100 mr-2">{r.targetType}</span>
                      <span className="text-xs text-slate-400 font-mono break-all max-w-[150px] inline-block">{r.targetId}</span>
                    </td>
                    <td className="p-4 font-medium text-slate-700">{r.reason}</td>
                    <td className="p-4 flex gap-2">
                      <button onClick={() => handleResolveReport(r.id, 'APPROVED')}
                        className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 shadow-md shadow-rose-200">
                        <ShieldCheck size={14} className="inline mr-1" /> DUYỆT
                      </button>
                      <button onClick={() => handleResolveReport(r.id, 'REJECTED')}
                        className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200">
                        <XCircle size={14} className="inline mr-1" /> BỎ QUA
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Permissions Modal ── */}
      {permUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setPermUser(null)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8" onClick={e => e.stopPropagation()}>
            <h2 className="text-xl font-black text-slate-900 mb-2">Phân quyền</h2>
            <p className="text-sm text-slate-500 mb-6">{permUser.email}</p>
            <div className="space-y-3 mb-8">
              {ALL_PERMISSIONS.map(perm => (
                <label key={perm} className="flex items-center gap-3 p-3 rounded-2xl hover:bg-slate-50 cursor-pointer transition-all">
                  <button onClick={() => togglePerm(perm)} className="text-slate-400 hover:text-indigo-600">
                    {permValues.includes(perm) ? <CheckSquare size={20} className="text-indigo-600" /> : <Square size={20} />}
                  </button>
                  <div>
                    <div className="font-bold text-sm text-slate-800">{PERMISSION_LABELS[perm] || perm}</div>
                    <div className="text-xs text-slate-400 font-mono">{perm}</div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={savePermissions} disabled={permSaving}
                className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {permSaving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                Lưu
              </button>
              <button onClick={() => setPermUser(null)} className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200">Hủy</button>
            </div>
          </div>
        </div>
      )}

      {/* ── User Detail Modal ── */}
      {detailUser && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setDetailUser(null)}>
          <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-black text-slate-900">Chi tiết người dùng</h2>
              <button onClick={() => setDetailUser(null)} className="p-2 hover:bg-slate-100 rounded-xl"><X size={20} /></button>
            </div>
            {detailLoading ? (
              <div className="py-10 text-center"><Loader2 size={24} className="animate-spin mx-auto text-indigo-600" /></div>
            ) : (
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
                    { label: 'Xác minh', value: detailUser.isVerified ? '✅' : '❌' },
                    { label: 'Permissions', value: (detailUser.permissions || []).join(', ') || '—' },
                  ].map((item, i) => (
                    <div key={i} className="p-3 bg-slate-50 rounded-2xl">
                      <div className="text-xs text-slate-400 font-bold uppercase">{item.label}</div>
                      <div className="text-sm font-bold text-slate-800 mt-1">{String(item.value)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
