import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  User, Camera, Save, ShieldCheck, UserCircle,
  CheckCircle2, AlertCircle, ShoppingBag, 
  Store, Trash2, Clock, Check
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { productService } from '../services/productService';
import type { Product } from '../services/productService';
import { orderService } from '../services/orderService';
import type { User as ProfileUser } from '../types/api';

const Profile: React.FC = () => {
  const { user, updateUser } = useAuthStore() as any;
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
      // 1. Get presigned URL
      const presignRes = await api.post('/users/avatar/presign', { contentType: file.type });
      if (!presignRes.data.success) throw new Error('Failed to get upload URL');
      const { uploadUrl, publicUrl } = presignRes.data.data;

      // 2. Upload directly to S3
      await fetch(uploadUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      // 3. Update profile with new avatar URL
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
        setMessage({ type: 'success', text: 'Cập nhật thông tin thành công! ✨' });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Lỗi cập nhật profile' });
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-6xl mx-auto py-12 px-4">
      <div className="mb-10">
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-2 italic">DASHBOARD CỦA TÔI</h1>
        <p className="text-slate-500 font-medium">Trung tâm quản lý tài khoản, đơn hàng và bài niêm yết.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">MSSV</div>
          <div className="text-xl font-black text-slate-900">{profileLoading ? 'Đang tải...' : (profile?.studentId || 'Chưa cập nhật')}</div>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Món đồ đang bán</div>
          <div className="text-xl font-black text-slate-900">{myProducts.length}</div>
        </div>
        <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="text-xs font-black uppercase tracking-widest text-slate-400 mb-2">Lịch sử mua hàng</div>
          <div className="text-xl font-black text-slate-900">{myOrders.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-2">
            {[
              { id: 'info', label: 'Hồ sơ cá nhân', icon: UserCircle },
              { id: 'products', label: 'Món đồ đang bán', icon: Store },
              { id: 'orders', label: 'Lịch sử mua hàng', icon: ShoppingBag },
              { id: 'password', label: 'Bảo mật', icon: ShieldCheck },
            ].map(tab => (
              <button 
                key={tab.id}
                onClick={() => { setActiveTab(tab.id as any); setMessage(null); }}
                className={`w-full flex items-center gap-3 px-4 py-4 rounded-2xl font-bold transition-all ${
                  activeTab === tab.id 
                    ? 'bg-slate-900 text-white shadow-xl shadow-slate-200' 
                    : 'text-slate-500 hover:bg-slate-100'
                }`}
              >
                  <tab.icon size={20} />
                  <span>{tab.label}</span>
              </button>
            ))}
        </div>

        <div className="lg:col-span-3">
            <motion.div 
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-100/50 p-8 min-h-125"
            >
                {message && (
                  <div className={`mb-6 p-4 rounded-2xl flex items-center gap-3 ${
                    message.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'
                  }`}>
                    {message.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                    <span className="text-sm font-bold">{message.text}</span>
                  </div>
                )}

                {activeTab === 'info' && (
                  <form onSubmit={handleUpdateProfile} className="space-y-8">
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative">
                            <div className="w-40 h-40 rounded-[2.5rem] bg-slate-50 border-4 border-white shadow-2xl overflow-hidden ring-1 ring-slate-100">
                                {avatarUrl ? <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-200"><User size={64} /></div>}
                            </div>
                            <label className="absolute -bottom-2 -right-2 p-3 bg-indigo-600 text-white rounded-2xl shadow-xl hover:scale-110 active:scale-95 transition-all cursor-pointer">
                                {uploadingAvatar ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Camera size={20} />}
                                <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={uploadingAvatar} />
                            </label>
                        </div>
                        <div className="text-center">
                          <div className="text-2xl font-black text-slate-800 tracking-tight">{profile?.name || user?.name}</div>
                           <div className="flex items-center justify-center gap-2 mt-1">
                            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-black rounded-md border border-emerald-200">Karma: {profile?.karmaPoint ?? user?.karmaPoint ?? 0}</span>
                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-[10px] font-black rounded-md border border-indigo-200">{profile?.role || user?.role}</span>
                           </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">Họ và tên</label>
                            <input value={name} onChange={e => setName(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-100 transition-all font-bold" />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-black text-slate-400 uppercase tracking-widest px-2">MSSV</label>
                          <input value={profile?.studentId || user?.studentId || ''} disabled className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl text-slate-400 font-bold opacity-70" />
                        </div>
                    </div>
                    <button disabled={loading} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase tracking-widest hover:bg-black shadow-xl shadow-slate-200 flex items-center justify-center gap-2 transition-all">
                        {loading ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><Save size={20} /> <span>Cập nhật hồ sơ</span></>}
                    </button>
                  </form>
                )}

                {activeTab === 'products' && (
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-slate-800 mb-6">Món đồ bạn đang rao bán</h3>
                    {productsLoading ? <div className="py-20 text-center text-slate-400">Đang tải danh sách...</div> : (
                      myProducts.map(p => (
                        <div key={p.id} className="flex items-center gap-4 p-4 bg-slate-50 rounded-3xl border border-slate-100">
                           <div className="w-20 h-20 rounded-2xl overflow-hidden bg-white">
                          <img src={p.imageUrls?.[0] || 'https://via.placeholder.com/160'} alt={p.title} className="w-full h-full object-cover" />
                           </div>
                           <div className="flex-1">
                              <div className="font-bold text-slate-800">{p.title}</div>
                              <div className="text-rose-500 font-black text-sm">{p.price.toLocaleString()}đ</div>
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md mt-1 inline-block ${p.status === 'AVAILABLE' ? 'bg-emerald-100 text-emerald-700' : p.status === 'PENDING_APPROVAL' ? 'bg-amber-100 text-amber-700' : p.status === 'SOLD' ? 'bg-slate-100 text-slate-700' : 'bg-rose-100 text-rose-700'}`}>
                                {p.status === 'PENDING_APPROVAL' ? 'CHỜ DUYỆT' : p.status === 'AVAILABLE' ? 'ĐANG BÁN' : p.status === 'SOLD' ? 'ĐÃ BÁN' : p.status}
                              </span>
                           </div>
                           <button onClick={() => handleDeleteProduct(p.id)} className="p-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={20}/></button>
                        </div>
                      ))
                    )}
                    {!productsLoading && myProducts.length === 0 && <div className="py-20 text-center text-slate-400 italic">Bạn chưa đăng bán món đồ nào.</div>}
                  </div>
                )}

                {activeTab === 'orders' && (
                  <div className="space-y-4">
                    <h3 className="text-xl font-bold text-slate-800 mb-6">Lịch sử món đồ đã mua</h3>
                    {ordersLoading ? <div className="py-20 text-center text-slate-400">Đang tải lịch sử...</div> : (
                      myOrders.map((o: any) => (
                        <div key={o.id} className="p-5 bg-slate-50 rounded-3xl border border-slate-100 flex items-center justify-between">
                           <div className="flex items-center gap-4">
                              <div className="p-3 bg-indigo-100 text-indigo-600 rounded-2xl"><ShoppingBag size={24}/></div>
                              <div>
                                 <div className="text-xs font-black text-slate-400 uppercase tracking-tighter">Mã đơn: #{o.id.substring(0, 8)}</div>
                                 <div className="font-bold text-slate-800 mt-1">Sản phẩm ID: {o.productId}</div>
                                 <div className="text-sm font-medium text-slate-500 flex items-center gap-1"><Clock size={14}/> {new Date(o.createdAt).toLocaleDateString()}</div>
                              </div>
                           </div>
                           <div className="text-right">
                              <div className="text-lg font-black text-slate-900">{Number(o.price).toLocaleString()}đ</div>
                              <div className="flex items-center gap-1 text-emerald-600 text-xs font-bold justify-end mt-1"><Check size={14}/> THÀNH CÔNG</div>
                           </div>
                        </div>
                      ))
                    )}
                    {!ordersLoading && myOrders.length === 0 && <div className="py-20 text-center text-slate-400 italic">Bạn chưa thực hiện giao dịch nào.</div>}
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
                        setMessage({ type: 'success', text: 'Đổi mật khẩu thành công! ✨' });
                        setOldPassword(''); setNewPassword(''); setConfirmPassword('');
                      }
                    } catch (err: any) { setMessage({ type: 'error', text: 'Lỗi đổi mật khẩu' }); }
                    finally { setLoading(false); }
                  }} className="space-y-6 max-w-md mx-auto py-10">
                     <div className="space-y-4">
                        <div className="space-y-1">
                           <label className="text-xs font-black text-slate-400 ml-2">MẬT KHẨU HIỆN TẠI</label>
                           <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-rose-100 transition-all font-bold" />
                        </div>
                        <div className="space-y-1">
                           <label className="text-xs font-black text-slate-400 ml-2">MẬT KHẨU MỚI</label>
                           <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-100 transition-all font-bold" />
                        </div>
                        <div className="space-y-1">
                           <label className="text-xs font-black text-slate-400 ml-2">XÁC NHẬN MẬT KHẨU MỚI</label>
                           <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-100 transition-all font-bold" />
                        </div>
                     </div>
                     <button disabled={loading} className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase shadow-xl shadow-slate-200 hover:bg-black transition-all">
                        {loading ? 'ĐANG XỬ LÝ...' : 'CẬP NHẬT MẬT KHẨU'}
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
