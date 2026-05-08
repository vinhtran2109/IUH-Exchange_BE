import React, { useState, useEffect } from 'react';
import { 
  Shield, Users, AlertTriangle, ShieldCheck, Ban, CheckCircle, 
  XCircle, PackageCheck, BarChart3, Activity, TrendingUp, 
  ShoppingCart, Landmark, Info, ChevronDown, ArrowUp, ArrowDown
} from 'lucide-react';
import { adminService } from '../services/adminService';
import type { UserAdminData, ReportData } from '../services/adminService';
import { useAuthStore } from '../store/authStore';
import { useNavigate } from 'react-router-dom';

const AdminDashboard: React.FC = () => {
  const { user } = useAuthStore() as any;
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'reports' | 'products'>('overview');

  const [users, setUsers] = useState<UserAdminData[]>([]);
  const [reports, setReports] = useState<ReportData[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({ user: {}, product: {} });
  
  const [loading, setLoading] = useState(false);

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
        const res = await adminService.getAllUsers(0, 50);
        if (res.success) setUsers(res.data.content);
      } else if (activeTab === 'reports') {
        const res = await adminService.getReports("PENDING", 0, 50);
        if (res.success) setReports(res.data.content);
      } else if (activeTab === 'products') {
        const res = await adminService.getPendingProducts(0, 50);
        if (res.success) setProducts(res.data.content);
      }
    } catch (e) {
      console.error("Lỗi fetch admin data", e);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBan = async (userId: string) => {
    if (!window.confirm("Xác nhận thay đổi trạng thái user này?")) return;
    try {
      const res = await adminService.toggleBanUser(userId);
      if (res.success) { fetchData(); }
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

  const handleResolveReport = async (reportId: string, status: string) => {
    const note = prompt("Ghi chú xử lý (Tùy chọn):");
    if (note === null) return;
    try {
      const res = await adminService.resolveReport(reportId, status, note);
      if (res.success) fetchData();
    } catch (e: any) { alert("Lỗi: " + e.response?.data?.message); }
  };

  const handleResolveProduct = async (productId: string, action: 'APPROVE' | 'REJECT') => {
    if (!window.confirm(`Xác nhận ${action === 'APPROVE' ? 'duyệt' : 'từ chối'} bài đăng này?`)) return;
    try {
      const res = await adminService.resolveProductStatus(productId, action);
      if (res.success) fetchData();
    } catch (e: any) { alert("Lỗi: " + e.response?.data?.message); }
  };

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

        <div className="flex gap-2">
           <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100/50">
              <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
              <span className="text-xs font-bold uppercase">System Healthy</span>
           </div>
        </div>
      </div>

      <div className="flex gap-2 mb-8 bg-slate-100/50 p-1 rounded-2xl w-fit">
        {[
          { id: 'overview', label: 'Tổng quan', icon: BarChart3 },
          { id: 'users', label: 'Sinh viên', icon: Users },
          { id: 'products', label: 'Duyệt bài', icon: PackageCheck },
          { id: 'reports', label: 'Tố cáo', icon: AlertTriangle },
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
        <div className="space-y-8 animate-in fade-in duration-500">
           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm hover:border-indigo-200 transition-all group">
                 <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl group-hover:scale-110 transition-transform">
                       <Users size={24} />
                    </div>
                    <TrendingUp size={16} className="text-emerald-500" />
                 </div>
                 <div className="text-3xl font-black text-slate-800">{(stats.user?.total || 0).toLocaleString()}</div>
                 <div className="text-slate-500 text-sm font-medium mt-1">Tổng sinh viên đăng ký</div>
              </div>

              <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm hover:border-rose-200 transition-all group">
                 <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl group-hover:scale-110 transition-transform">
                       <ShoppingCart size={24} />
                    </div>
                    <Activity size={16} className="text-indigo-400" />
                 </div>
                 <div className="text-3xl font-black text-slate-800">{(stats.product?.total || 0).toLocaleString()}</div>
                 <div className="text-slate-500 text-sm font-medium mt-1">Tổng sản phẩm đã đăng</div>
              </div>

              <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm hover:border-amber-200 transition-all group">
                 <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl group-hover:scale-110 transition-transform">
                       <Landmark size={24} />
                    </div>
                 </div>
                 <div className="text-3xl font-black text-slate-800">{(stats.product?.pending || 0).toLocaleString()}</div>
                 <div className="text-slate-500 text-sm font-medium mt-1">Bài đăng đang chờ duyệt</div>
              </div>

              <div className="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm hover:border-emerald-200 transition-all group">
                 <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl group-hover:scale-110 transition-transform">
                       <Activity size={24} />
                    </div>
                 </div>
                 <div className="text-3xl font-black text-slate-800">{(stats.product?.sold || 0).toLocaleString()}đ</div>
                 <div className="text-slate-500 text-sm font-medium mt-1">Lượng giao dịch thành công</div>
              </div>
           </div>

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden">
                 <div className="relative z-10">
                    <h3 className="text-xl font-bold mb-2">Trạng thái hạ tầng Microservices</h3>
                    <p className="text-slate-400 text-sm mb-6">Thời gian thực cập nhật từ Service Registry (Eureka)</p>
                    
                    <div className="grid grid-cols-2 gap-4">
                       {[
                         'API-GATEWAY', 'AUTH-SERVICE', 'PRODUCT-SERVICE', 
                         'ORDER-SERVICE', 'CHAT-SERVICE', 'NOTIFICATION-SERVICE'
                       ].map(svc => (
                        <div key={svc} className="flex items-center gap-3 bg-white/5 p-3 rounded-2xl border border-white/10">
                           <div className="w-2 h-2 bg-emerald-500 rounded-full shadow-[0_0_10px_rgba(16,185,129,1)]"></div>
                           <span className="text-xs font-mono font-bold tracking-tighter">{svc}</span>
                           <span className="ml-auto text-[10px] text-emerald-400 font-bold uppercase">Up</span>
                        </div>
                       ))}
                    </div>
                 </div>
                 <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl"></div>
              </div>

              <div className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm">
                 <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                    <Info size={20} className="text-indigo-600" />
                    Lưu ý vận hành
                 </h3>
                 <ul className="space-y-4">
                    {[
                      { icon: ShieldCheck, text: "Xác minh MSSV tự động qua email @student.iuh.edu.vn", color: 'text-indigo-600' },
                      { icon: AlertTriangle, text: "Điểm Karma < 0 sẽ tự động bị khóa quyền đăng bài", color: 'text-rose-500' },
                      { icon: Activity, text: "Saga Pattern đang quản lý tính nhất quán cho Order", color: 'text-emerald-600' }
                    ].map((item, i) => (
                      <li key={i} className="flex gap-3 text-sm font-medium text-slate-600">
                         <item.icon size={18} className={item.color + " shrink-0"} />
                         <span>{item.text}</span>
                      </li>
                    ))}
                 </ul>
              </div>
           </div>
        </div>
      ) : activeTab === 'users' ? (
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
              {users.map(u => {
                const isActive = u.isActive !== false && (u as any).active !== false;
                return (
                <tr key={u.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="p-4">
                    <div className="font-medium text-slate-800">{u.email}</div>
                    <div className="text-xs text-slate-400">{u.name}</div>
                  </td>
                  <td className="p-4 text-slate-500 text-sm">{u.studentId || '—'}</td>
                  <td className="p-4">
                    <select
                      value={u.role}
                      onChange={(e) => handleRoleChange(u.id, e.target.value)}
                      className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all"
                    >
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
                      <button onClick={() => handleKarmaAdjust(u.id, 'up')} className="p-1 text-emerald-500 hover:bg-emerald-50 rounded transition-all" title="Cộng karma">
                        <ArrowUp size={14} />
                      </button>
                      <button onClick={() => handleKarmaAdjust(u.id, 'down')} className="p-1 text-rose-500 hover:bg-rose-50 rounded transition-all" title="Trừ karma">
                        <ArrowDown size={14} />
                      </button>
                    </div>
                  </td>
                  <td className="p-4">
                    {isActive ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-emerald-50 text-emerald-600 text-xs font-bold rounded-full">
                         <CheckCircle size={12}/> HOẠT ĐỘNG
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 bg-rose-50 text-rose-600 text-xs font-bold rounded-full">
                         <Ban size={12}/> BỊ KHÓA
                      </span>
                    )}
                  </td>
                  <td className="p-4">
                    <button 
                      onClick={() => handleToggleBan(u.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold uppercase transition-all ${isActive ? 'bg-rose-100 text-rose-700 hover:bg-rose-200' : 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'}`}
                    >
                      {isActive ? 'Khóa TK' : 'Mở khóa'}
                    </button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : activeTab === 'products' ? (
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
                  <td className="p-4 font-black text-rose-500">{p.price.toLocaleString()}đ</td>
                  <td className="p-4 flex gap-2">
                    <button 
                      onClick={() => handleResolveProduct(p.id, 'APPROVE')}
                      className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold hover:bg-emerald-700 shadow-md shadow-emerald-200"
                    >
                       DUYỆT
                    </button>
                    <button 
                      onClick={() => handleResolveProduct(p.id, 'REJECT')}
                      className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold hover:bg-slate-200"
                    >
                       TỪ CHỐI
                    </button>
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
      ) : (
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
                    <span className="px-2 py-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-md uppercase border border-indigo-100 mr-2">
                       {r.targetType}
                    </span>
                    <br/><span className="text-xs text-slate-400 font-mono mt-1 inline-block break-all max-w-[150px]">{r.targetId}</span>
                  </td>
                  <td className="p-4 font-medium text-slate-700">{r.reason}</td>
                  <td className="p-4 flex gap-2">
                    <button 
                      onClick={() => handleResolveReport(r.id, 'APPROVED')}
                      className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 shadow-md shadow-rose-200 flex flex-col items-center justify-center leading-tight gap-1"
                      title="Duyệt Tố Cáo (Sẽ trừ KarmaPoint của người bị tố cáo)"
                    >
                       <ShieldCheck size={14}/> DUYỆT (PHẠT)
                    </button>
                    <button 
                      onClick={() => handleResolveReport(r.id, 'REJECTED')}
                      className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-200 flex flex-col items-center justify-center gap-1"
                    >
                       <XCircle size={14}/> BỎ QUA
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
