import React, { useEffect, useState } from 'react';
import {
  Shield,
  Users,
  PackageCheck,
  AlertTriangle,
  Server,
  TrendingUp,
  Search,
  Download,
  Eye,
  ShieldCheck,
  Ban,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  Loader2,
  Trash2,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { adminService } from '../services/adminService';
import type { ReportData, UserAdminData } from '../services/adminService';
import { useAuthStore } from '../store/authStore';
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

type AdminTab = 'overview' | 'users' | 'reports' | 'products' | 'dlq' | 'analytics';

const AdminDashboard: React.FC = () => {
  const { user, isLoading } = useAuthStore() as any;
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const [users, setUsers] = useState<UserAdminData[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [reports] = useState<ReportData[]>([]);
  const [stats, setStats] = useState<any>({ user: {}, product: {} });

  const [permUser, setPermUser] = useState<UserAdminData | null>(null);
  const [permValues, setPermValues] = useState<string[]>([]);
  const [permSaving, setPermSaving] = useState(false);

  const [detailUser, setDetailUser] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [productDetail, setProductDetail] = useState<any>(null);
  const [productDetailLoading, setProductDetailLoading] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== 'ADMIN') {
      alert('Access denied');
      navigate('/');
      return;
    }
    void fetchData();
  }, [activeTab, user, isLoading, navigate]);

  const fetchData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'overview' || activeTab === 'analytics') {
        const [uStats, pStats] = await Promise.all([
          adminService.getUserStats(),
          adminService.getProductStats(),
        ]);
        setStats({ user: uStats.data, product: pStats.data });
      }

      if (activeTab === 'users') {
        const res = await adminService.getAllUsers(1, 100);
        if (res.success) setUsers(res.data.content);
      }

      if (activeTab === 'products') {
        const res = await adminService.getPendingProducts(1, 50);
        if (res.success) setProducts(res.data.content);
      }
    } catch (error) {
      console.error('Failed to fetch admin data', error);
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
        if (detailUser?.id === userId) setDetailUser(null);
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
    setPermValues([...targetUser.permissions]);
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
      const fallback = products.find((item) => item.id === productId);
      setProductDetail(fallback || null);
    } finally {
      setProductDetailLoading(false);
    }
  };

  const handleResolveProduct = async (productId: string, action: 'APPROVE' | 'REJECT') => {
    if (!window.confirm(`Xác nhận ${action === 'APPROVE' ? 'duyệt' : 'từ chối'} bài đăng này?`)) return;
    try {
      const res = await adminService.resolveProductStatus(productId, action);
      if (res.success) {
        if (productDetail?.id === productId) setProductDetail(null);
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
        if (productDetail?.id === productId) setProductDetail(null);
        await fetchData();
      }
    } catch (e: any) {
      alert('Lỗi: ' + (e.response?.data?.message || 'Không thể gỡ bài đăng'));
    }
  };

  const filteredUsers = users.filter((targetUser) => {
    if (!searchQuery) return true;
    const normalized = searchQuery.toLowerCase();
    return (
      targetUser.email.toLowerCase().includes(normalized) ||
      targetUser.name.toLowerCase().includes(normalized) ||
      (targetUser.studentId || '').toLowerCase().includes(normalized)
    );
  });

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
    downloadCSV(headers, rows, 'users-export');
  };

  const downloadCSV = (headers: string[], rows: string[][], filename: string) => {
    const csv = [headers.join(','), ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const renderOverview = () => (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Tổng sinh viên', value: stats.user?.total || 0, icon: Users },
          { label: 'Tổng sản phẩm', value: stats.product?.total || 0, icon: PackageCheck },
          { label: 'Chờ duyệt', value: stats.product?.pending || 0, icon: AlertTriangle },
          { label: 'Đã bán', value: stats.product?.sold || 0, icon: TrendingUp },
        ].map((item) => (
          <div key={item.label} className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
              <item.icon size={22} />
            </div>
            <div className="text-3xl font-black text-slate-800">{item.value.toLocaleString()}</div>
            <div className="text-slate-500 text-sm font-medium mt-1">{item.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <SimpleDonutChart
          title="Phân bổ sản phẩm"
          data={[
            { label: 'Đang bán', value: stats.product?.available || 0, color: '#10b981' },
            { label: 'Chờ duyệt', value: stats.product?.pending || 0, color: '#f59e0b' },
            { label: 'Đã bán', value: stats.product?.sold || 0, color: '#6366f1' },
            { label: 'Khác', value: Math.max(0, (stats.product?.total || 0) - (stats.product?.available || 0) - (stats.product?.pending || 0) - (stats.product?.sold || 0)), color: '#ef4444' },
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
        title="Xu hướng mẫu"
        data={[
          { label: 'T2', value: 12 },
          { label: 'T3', value: 18 },
          { label: 'T4', value: 15 },
          { label: 'T5', value: 20 },
          { label: 'T6', value: 17 },
          { label: 'T7', value: 24 },
          { label: 'CN', value: 13 },
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
          <Download size={16} /> Export CSV
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
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
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
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-full"><CheckCircle size={12} /> HOẠT ĐỘNG</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-rose-50 text-rose-600 text-xs font-bold rounded-full"><Ban size={12} /> BỊ KHÓA</span>
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
          {products.map((product) => (
            <tr key={product.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
              <td className="p-4 text-sm text-slate-600 truncate max-w-[140px]">{product.sellerId}</td>
              <td className="p-4">
                <div className="font-bold text-slate-800">{product.title}</div>
                <div className="text-xs text-slate-400 mt-1 line-clamp-1 max-w-[260px]">{product.description}</div>
              </td>
              <td className="p-4 font-black text-rose-500">{product.price?.toLocaleString()}đ</td>
              <td className="p-4">
                <div className="flex gap-2 flex-wrap">
                  <button onClick={() => openProductDetail(product.id)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Xem chi tiết">
                    <Eye size={16} />
                  </button>
                  <button onClick={() => handleResolveProduct(product.id, 'APPROVE')} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-md shadow-emerald-200">DUYỆT</button>
                  <button onClick={() => handleResolveProduct(product.id, 'REJECT')} className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200">TỪ CHỐI</button>
                  <button onClick={() => handleDeleteProduct(product.id)} className="px-4 py-2 bg-rose-50 text-rose-700 rounded-xl text-xs font-bold hover:bg-rose-100">GỠ BÀI</button>
                </div>
              </td>
            </tr>
          ))}
          {products.length === 0 && (
            <tr>
              <td colSpan={4} className="p-10 text-center text-slate-400">Không có bài đăng nào cần duyệt.</td>
            </tr>
          )}
        </tbody>
      </table>
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
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">Admin Central</h1>
            <p className="text-slate-500 font-medium text-sm">Control Panel for IUH Exchange Platform</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 mb-8 bg-slate-100/50 p-1 rounded-2xl w-fit flex-wrap">
        {[
          { id: 'overview', label: 'Tổng quan', icon: TrendingUp },
          { id: 'analytics', label: 'Analytics', icon: TrendingUp },
          { id: 'users', label: 'Sinh viên', icon: Users },
          { id: 'products', label: 'Duyệt bài', icon: PackageCheck },
          { id: 'reports', label: 'Tố cáo', icon: AlertTriangle },
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
      ) : activeTab === 'overview' || activeTab === 'analytics' ? (
        renderOverview()
      ) : activeTab === 'users' ? (
        renderUsers()
      ) : activeTab === 'products' ? (
        renderProducts()
      ) : (
        <div className="p-10 text-center bg-white rounded-3xl border border-slate-200 text-slate-400">
          Tab này đang được giữ nguyên để làm tiếp sau.
          {reports.length > 0 ? ` (${reports.length})` : ''}
        </div>
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
                  <button onClick={() => handleDeleteUser(detailUser.id)} className="px-4 py-2 bg-rose-50 text-rose-700 rounded-xl text-sm font-bold hover:bg-rose-100">
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
                        <div className="text-sm font-bold text-slate-800 mt-1">{Number(productDetail.price || 0).toLocaleString()}đ</div>
                      </div>
                      <div className="p-3 bg-slate-50 rounded-2xl">
                        <div className="text-xs text-slate-400 font-bold uppercase">Trạng thái</div>
                        <div className="text-sm font-bold text-slate-800 mt-1">{productDetail.status}</div>
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
                  <button onClick={() => handleDeleteProduct(productDetail.id)} className="px-4 py-2 bg-rose-50 text-rose-700 rounded-xl text-sm font-bold hover:bg-rose-100">Gỡ bài</button>
                  <button onClick={() => handleResolveProduct(productDetail.id, 'REJECT')} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-200">Từ chối</button>
                  <button onClick={() => handleResolveProduct(productDetail.id, 'APPROVE')} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold hover:bg-emerald-700">Duyệt bài</button>
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
