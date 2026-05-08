import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  User, Camera, Save, ShieldCheck, UserCircle,
  CheckCircle2, AlertCircle, ShoppingBag, 
  Store, Trash2, Clock, Check, Flag
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { productService } from '../services/productService';
import type { Product } from '../services/productService';
import { orderService } from '../services/orderService';
import type { User as ProfileUser } from '../types/api';

const Profile: React.FC = () => {
  const { user, updateUser } = useAuthStore() as any;
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'info' | 'password' | 'products' | 'orders'>('info');
  const [profile, setProfile] = useState<ProfileUser | null>(user ?? null);
  
  const [name, setName] = useState(user?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [myProducts, setMyProducts] = useState<Product[]>([]);
  const [myOrders, setMyOrders] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [ordersLoading, setOrdersLoading] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  useEffect(() => {
    fetchProfile();
    fetchMyProducts();
    fetchMyOrders();
  }, []);

  const fetchProfile = async () => {
    setProfileLoading(true);
    try {
      const res = await api.get('/users/me');
      if (res.data?.success && res.data?.data) {
        const currentProfile: ProfileUser = res.data.data;
        setProfile(currentProfile);
        setName(currentProfile.name || '');
        setAvatarUrl(currentProfile.avatarUrl || '');
        updateUser(currentProfile);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setProfileLoading(false);
    }
  };

  const fetchMyProducts = async () => {
    setProductsLoading(true);
    try {
      const res = await productService.getMyProducts();
      if (res.success) setMyProducts(res.data?.content ?? []);
    } catch (e) { console.error(e); }
    finally { setProductsLoading(false); }
  };

  const fetchMyOrders = async () => {
    setOrdersLoading(true);
    try {
      const res = await orderService.getMyOrders();
      if (res.success) setMyOrders(res.data ?? []);
    } catch (e) { console.error(e); }
    finally { setOrdersLoading(false); }
  };

  const handleDeleteProduct = async (id: string) => {
    if(!window.confirm("Bạn có chắc muốn gỡ bài đăng này?")) return;
    try {
      await productService.deleteProduct(id);
      fetchMyProducts();
    } catch (e) { alert("Lỗi khi xóa sản phẩm"); }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const presignRes = await api.post('/users/avatar/presign', { contentType: file.type });
      if (!presignRes.data.success) throw new Error('Failed to get upload URL');
      const { uploadUrl, publicUrl } = presignRes.data.data;

      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      const updateRes = await api.patch('/users/me', { avatarUrl: publicUrl });
      if (updateRes.data.success) {
        setAvatarUrl(publicUrl);
        setProfile(prev => prev ? { ...prev, avatarUrl: publicUrl } : prev);
        updateUser({ avatarUrl: publicUrl });
      }
    } catch (err: any) {
      alert("Lỗi upload ảnh: " + (err.message || "Vui lòng thử lại"));
    } finally { setUploadingAvatar(false); }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await api.patch('/users/me', { name, avatarUrl });
      if (res.data.success) {
        const updated = res.data.data;
        setProfile(prev => prev ? { ...prev, name: updated?.name || name, avatarUrl: updated?.avatarUrl || avatarUrl } : prev);
        updateUser({ name: updated?.name || name, avatarUrl: updated?.avatarUrl || avatarUrl });
        setMessage({ type: 'success', text: 'Cập nhật thông tin thành công!' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Lỗi cập nhật profile' });
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-0.5">Tài khoản của tôi</h1>
        <p className="text-slate-500 text-sm">Quản lý tài khoản, đơn hàng và bài đăng.</p>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400 mb-1">MSSV</div>
          <div className="text-lg font-bold text-slate-900">{profileLoading ? '...' : (profile?.studentId || 'Chưa cập nhật')}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400 mb-1">Đang bán</div>
          <div className="text-lg font-bold text-slate-900">{myProducts.length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400 mb-1">Đã mua</div>
          <div className="text-lg font-bold text-slate-900">{myOrders.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-1">
            {[
              { id: 'info', label: 'Hồ sơ cá nhân', icon: UserCircle },
              { id: 'products', label: 'Món đồ đang bán', icon: Store },
              { id: 'orders', label: 'Lịch sử mua hàng', icon: ShoppingBag },
              { id: 'reports', label: 'Báo cáo của tôi', icon: Flag, action: () => navigate('/my-reports') },
              { id: 'password', label: 'Bảo mật', icon: ShieldCheck },
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => { if ('action' in tab && tab.action) { tab.action(); } else { setActiveTab(tab.id as any); setMessage(null); } }}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id 
                    ? 'bg-slate-900 text-white' 
                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                }`}
              >
                  <tab.icon size={16} />
                  <span>{tab.label}</span>
              </button>
            ))}
        </div>

        <div className="lg:col-span-3">
            <motion.div 
              key={activeTab}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-xl border border-slate-200 p-6 min-h-[400px]"
            >
                {message && (
                  <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm ${
                    message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                  }`}>
                    {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    <span className="font-medium">{message.text}</span>
                  </div>
                )}

                {activeTab === 'info' && (
                  <form onSubmit={handleUpdateProfile} className="space-y-6">
                    <div className="flex flex-col items-center gap-3">
                        <div className="relative">
                            <div className="w-24 h-24 rounded-full bg-slate-100 border-2 border-slate-200 overflow-hidden">
                                {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300"><User size={36} /></div>}
                            </div>
                            <label className="absolute -bottom-1 -right-1 p-2 bg-slate-900 text-white rounded-lg shadow cursor-pointer hover:bg-slate-800 transition-all">
                                {uploadingAvatar ? <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Camera size={14} />}
                                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={uploadingAvatar} />
                            </label>
                        </div>
                        <div className="text-center">
                          <div className="text-lg font-bold text-slate-800">{profile?.name || user?.name}</div>
                           <div className="flex items-center justify-center gap-1.5 mt-1">
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded border border-slate-200">Karma: {profile?.karmaPoint ?? user?.karmaPoint ?? 0}</span>
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded border border-slate-200">{profile?.role || user?.role}</span>
                           </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-medium text-slate-500 mb-1.5 block">Họ và tên</label>
                            <input value={name} onChange={e => setName(e.target.value)} className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-lg focus:border-slate-400 focus:outline-none transition-all text-sm" />
                        </div>
                        <div>
                            <label className="text-xs font-medium text-slate-500 mb-1.5 block">MSSV</label>
                          <input value={profile?.studentId || user?.studentId || ''} disabled className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-400 text-sm" />
                        </div>
                    </div>
                    <button disabled={loading} className="px-5 py-2.5 bg-slate-900 text-white rounded-lg font-medium text-sm hover:bg-slate-800 flex items-center gap-2 transition-all disabled:opacity-50">
                        {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><Save size={16} /> <span>Cập nhật</span></>}
                    </button>
                  </form>
                )}

                {activeTab === 'products' && (
                  <div className="space-y-3">
                    <h3 className="text-base font-semibold text-slate-800 mb-4">Món đồ đang rao bán</h3>
                    {productsLoading ? <div className="py-16 text-center text-slate-400 text-sm">Đang tải...</div> : (
                      myProducts.map(p => (
                        <div key={p.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100">
                           <div className="w-14 h-14 rounded-lg overflow-hidden bg-white flex-shrink-0">
                          <img src={p.imageUrls?.[0] || 'https://via.placeholder.com/160'} alt={p.title} className="w-full h-full object-cover" />
                           </div>
                           <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm text-slate-800 truncate">{p.title}</div>
                              <div className="text-sm font-bold text-slate-900">{p.price.toLocaleString()}đ</div>
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded mt-0.5 inline-block ${p.status === 'AVAILABLE' ? 'bg-emerald-50 text-emerald-700' : p.status === 'PENDING_APPROVAL' ? 'bg-amber-50 text-amber-700' : p.status === 'SOLD' ? 'bg-slate-100 text-slate-600' : 'bg-red-50 text-red-700'}`}>
                                {p.status === 'PENDING_APPROVAL' ? 'Chờ duyệt' : p.status === 'AVAILABLE' ? 'Đang bán' : p.status === 'SOLD' ? 'Đã bán' : p.status}
                              </span>
                           </div>
                           <button onClick={() => handleDeleteProduct(p.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16}/></button>
                        </div>
                      ))
                    )}
                    {!productsLoading && myProducts.length === 0 && <div className="py-16 text-center text-slate-400 text-sm">Bạn chưa đăng bán món đồ nào.</div>}
                  </div>
                )}

                {activeTab === 'orders' && (
                  <div className="space-y-3">
                    <h3 className="text-base font-semibold text-slate-800 mb-4">Lịch sử mua hàng</h3>
                    {ordersLoading ? <div className="py-16 text-center text-slate-400 text-sm">Đang tải...</div> : (
                      myOrders.map((o: any) => (
                        <div key={o.id} className="p-4 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
                           <div className="flex items-center gap-3">
                              <div className="p-2 bg-slate-100 text-slate-500 rounded-lg"><ShoppingBag size={18}/></div>
                              <div>
                                 <div className="text-[11px] font-medium text-slate-400">#{o.id.substring(0, 8)}</div>
                                 <div className="font-medium text-sm text-slate-800">SP: {o.productId}</div>
                                 <div className="text-xs text-slate-400 flex items-center gap-1"><Clock size={12}/> {new Date(o.createdAt).toLocaleDateString()}</div>
                              </div>
                           </div>
                           <div className="text-right">
                              <div className="text-base font-bold text-slate-900">{Number(o.price).toLocaleString()}đ</div>
                              <div className="flex items-center gap-1 text-emerald-600 text-xs font-medium justify-end mt-0.5"><Check size={12}/> Thành công</div>
                           </div>
                        </div>
                      ))
                    )}
                    {!ordersLoading && myOrders.length === 0 && <div className="py-16 text-center text-slate-400 text-sm">Bạn chưa thực hiện giao dịch nào.</div>}
                  </div>
                )}

                {activeTab === 'password' && (
                  <form onSubmit={async (e) => {
                    e.preventDefault();
                    if (newPassword !== confirmPassword) { setMessage({ type: 'error', text: 'Mật khẩu xác nhận không khớp!' }); return; }
                    setLoading(true);
                    try {
                      const res = await api.put('/auth/change-password', { oldPassword, newPassword });
                      if (res.data.success) {
                        setMessage({ type: 'success', text: 'Đổi mật khẩu thành công!' });
                        setOldPassword(''); setNewPassword(''); setConfirmPassword('');
                      }
                    } catch (err: any) { setMessage({ type: 'error', text: 'Lỗi đổi mật khẩu' }); }
                    finally { setLoading(false); }
                  }} className="space-y-4 max-w-sm mx-auto py-6">
                     <div>
                        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Mật khẩu hiện tại</label>
                        <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:border-slate-400 focus:outline-none transition-all text-sm" />
                     </div>
                     <div>
                        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Mật khẩu mới</label>
                        <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:border-slate-400 focus:outline-none transition-all text-sm" />
                     </div>
                     <div>
                        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Xác nhận mật khẩu mới</label>
                        <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:border-slate-400 focus:outline-none transition-all text-sm" />
                     </div>
                     <button disabled={loading} className="px-5 py-2.5 bg-slate-900 text-white rounded-lg font-medium text-sm hover:bg-slate-800 transition-all disabled:opacity-50">
                        {loading ? 'Đang xử lý...' : 'Cập nhật mật khẩu'}
                     </button>
                  </form>
                )}
            </motion.div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
