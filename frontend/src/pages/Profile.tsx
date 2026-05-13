import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Flag,
  Pencil,
  Save,
  ShieldCheck,
  ShoppingBag,
  Store,
  Trash2,
  User,
  UserCircle,
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
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
    } catch (error) {
      console.error(error);
    } finally {
      setProfileLoading(false);
    }
  };

  const fetchMyProducts = async () => {
    setProductsLoading(true);
    try {
      const res = await productService.getMyProducts();
      if (res.success) setMyProducts(res.data?.content ?? []);
    } catch (error) {
      console.error(error);
    } finally {
      setProductsLoading(false);
    }
  };

  const fetchMyOrders = async () => {
    setOrdersLoading(true);
    try {
      const res = await orderService.getMyOrders();
      if (res.success) setMyOrders(res.data ?? []);
    } catch (error) {
      console.error(error);
    } finally {
      setOrdersLoading(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!window.confirm('Bạn có chắc muốn gỡ bài đăng này?')) return;
    try {
      await productService.deleteProduct(id);
      fetchMyProducts();
    } catch {
      alert('Lỗi khi xóa sản phẩm');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxAvatarSize = 5 * 1024 * 1024;
    if (file.size > maxAvatarSize) {
      alert('Kích thước ảnh không được vượt quá 5MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file ảnh');
      return;
    }

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
        setProfile((prev) => (prev ? { ...prev, avatarUrl: publicUrl } : prev));
        updateUser({ avatarUrl: publicUrl });
      }
    } catch (err: any) {
      alert('Lỗi upload ảnh: ' + (err.message || 'Vui lòng thử lại'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const trimmedName = name.trim();
      const payload: Record<string, string> = {};

      if (trimmedName) payload.name = trimmedName;
      if (avatarUrl && /^https?:\/\//.test(avatarUrl)) payload.avatarUrl = avatarUrl;

      if (Object.keys(payload).length === 0) {
        setMessage({ type: 'error', text: 'Vui lòng nhập tên hợp lệ hoặc chọn ảnh đại diện.' });
        return;
      }

      const res = await api.patch('/users/me', payload);
      if (res.data.success) {
        const updated = res.data.data;
        setName(updated?.name || trimmedName);
        setAvatarUrl(updated?.avatarUrl || avatarUrl);
        setProfile((prev) =>
          prev ? { ...prev, name: updated?.name || trimmedName, avatarUrl: updated?.avatarUrl || avatarUrl } : prev
        );
        updateUser({ name: updated?.name || trimmedName, avatarUrl: updated?.avatarUrl || avatarUrl });
        setMessage({ type: 'success', text: 'Cập nhật thông tin thành công!' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Lỗi cập nhật hồ sơ' });
    } finally {
      setLoading(false);
    }
  };

  const buyerOrders = useMemo(() => {
    return myOrders.filter((order: any) => {
      const buyerId = String(order?.buyerId || order?.buyer?.id || order?.buyer?._id || '');
      return buyerId && buyerId === String(user?.id || '');
    });
  }, [myOrders, user?.id]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="mb-0.5 text-2xl font-bold text-slate-900">Tài khoản của tôi</h1>
        <p className="text-sm text-slate-500">Quản lý hồ sơ, đơn hàng và bài đăng của bạn.</p>
      </div>

      <div className="mb-6 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">MSSV</div>
          <div className="text-lg font-bold text-slate-900">{profileLoading ? '...' : profile?.studentId || 'Chưa cập nhật'}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">Đang bán</div>
          <div className="text-lg font-bold text-slate-900">{myProducts.length}</div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">Đã mua</div>
          <div className="text-lg font-bold text-slate-900">{buyerOrders.length}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        <div className="space-y-1 lg:col-span-1">
          {[
            { id: 'info', label: 'Hồ sơ cá nhân', icon: UserCircle },
            { id: 'products', label: 'Món đồ đang bán', icon: Store },
            { id: 'orders', label: 'Lịch sử mua hàng', icon: ShoppingBag },
            { id: 'reports', label: 'Báo cáo của tôi', icon: Flag, action: () => navigate('/my-reports') },
            { id: 'password', label: 'Bảo mật', icon: ShieldCheck },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                if ('action' in tab && tab.action) tab.action();
                else {
                  setActiveTab(tab.id as any);
                  setMessage(null);
                }
              }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                activeTab === tab.id ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
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
            className="min-h-[400px] rounded-xl border border-slate-200 bg-white p-6"
          >
            {message && (
              <div
                className={`mb-4 flex items-center gap-2 rounded-lg border p-3 text-sm ${
                  message.type === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-red-200 bg-red-50 text-red-700'
                }`}
              >
                {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                <span className="font-medium">{message.text}</span>
              </div>
            )}

            {activeTab === 'info' && (
              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    <div className="h-24 w-24 overflow-hidden rounded-full border-2 border-slate-200 bg-slate-100">
                      {avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-300">
                          <User size={36} />
                        </div>
                      )}
                    </div>
                    <label className="absolute -bottom-1 -right-1 cursor-pointer rounded-lg bg-slate-900 p-2 text-white shadow transition-all hover:bg-slate-800">
                      {uploadingAvatar ? (
                        <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                      ) : (
                        <Camera size={14} />
                      )}
                      <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={uploadingAvatar} />
                    </label>
                  </div>

                  <div className="text-center">
                    <div className="text-lg font-bold text-slate-800">{profile?.name || user?.name}</div>
                    <div className="mt-1 flex items-center justify-center gap-1.5">
                      <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        Karma: {profile?.karmaPoint ?? user?.karmaPoint ?? 0}
                      </span>
                      <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                        {profile?.role || user?.role}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">Họ và tên</label>
                    <input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm transition-all focus:border-slate-400 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">MSSV</label>
                    <input
                      value={profile?.studentId || user?.studentId || ''}
                      disabled
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-400"
                    />
                  </div>
                </div>

                <button
                  disabled={loading}
                  className="flex items-center gap-2 rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-slate-800 disabled:opacity-50"
                >
                  {loading ? (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white"></div>
                  ) : (
                    <>
                      <Save size={16} /> <span>Cập nhật</span>
                    </>
                  )}
                </button>
              </form>
            )}

            {activeTab === 'products' && (
              <div className="space-y-3">
                <h3 className="mb-4 text-base font-semibold text-slate-800">Món đồ đang rao bán</h3>
                {productsLoading ? (
                  <div className="py-16 text-center text-sm text-slate-400">Đang tải...</div>
                ) : (
                  myProducts.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-white">
                        <img src={p.imageUrls?.[0] || 'https://via.placeholder.com/160'} alt={p.title} className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-800">{p.title}</div>
                        <div className="text-sm font-bold text-slate-900">{p.price.toLocaleString()}đ</div>
                        <span
                          className={`mt-0.5 inline-block rounded px-1.5 py-0.5 text-[10px] font-medium ${
                            p.status === 'AVAILABLE'
                              ? 'bg-emerald-50 text-emerald-700'
                              : p.status === 'PENDING_APPROVAL'
                                ? 'bg-amber-50 text-amber-700'
                                : p.status === 'SOLD'
                                  ? 'bg-slate-100 text-slate-600'
                                  : 'bg-red-50 text-red-700'
                          }`}
                        >
                          {p.status === 'PENDING_APPROVAL' ? 'Chờ duyệt' : p.status === 'AVAILABLE' ? 'Đang bán' : p.status === 'SOLD' ? 'Đã bán' : p.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => navigate(`/products/${p.id}/edit`)} className="rounded-lg p-2 text-slate-400 transition-all hover:bg-white hover:text-slate-700">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => handleDeleteProduct(p.id)} className="rounded-lg p-2 text-slate-400 transition-all hover:bg-red-50 hover:text-red-500">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
                {!productsLoading && myProducts.length === 0 && <div className="py-16 text-center text-sm text-slate-400">Bạn chưa đăng bán món đồ nào.</div>}
              </div>
            )}

            {activeTab === 'orders' && (
              <div className="space-y-3">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-semibold text-slate-800">Lịch sử mua hàng</h3>
                    <p className="mt-1 text-xs text-slate-400">Chọn một đơn để xem chi tiết, trạng thái và thanh toán.</p>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                    {buyerOrders.length} đơn
                  </div>
                </div>

                {ordersLoading ? (
                  <div className="py-16 text-center text-sm text-slate-400">Đang tải...</div>
                ) : (
                  buyerOrders.map((o: any) => (
                    <button
                      key={o?.id || o?._id || o?.createdAt}
                      type="button"
                      onClick={() => navigate(`/orders/${o?.id || o?._id}`)}
                      className="w-full rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-slate-300 hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex min-w-0 items-start gap-3">
                          <div className="rounded-xl bg-slate-100 p-2.5 text-slate-500">
                            <ShoppingBag size={18} />
                          </div>
                          <div className="min-w-0">
                            <div className="text-[11px] font-medium text-slate-400">#{String(o?.id || o?._id || '').substring(0, 8) || '--------'}</div>
                            <div className="mt-1 truncate text-sm font-semibold text-slate-800">
                              {typeof o?.productId === 'string' ? o.productId : o?.productId?.title || o?.productId?.id || o?.productId?._id || 'Không rõ sản phẩm'}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                              <span className="flex items-center gap-1">
                                <Clock size={12} /> {new Date(o.createdAt).toLocaleDateString()}
                              </span>
                              <span
                                className={`rounded-full px-2 py-0.5 font-medium ${
                                  o.status === 'COMPLETED'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : o.status === 'CANCELLED'
                                      ? 'bg-red-50 text-red-600'
                                      : 'bg-amber-50 text-amber-700'
                                }`}
                              >
                                {o.status === 'COMPLETED' ? 'Thành công' : o.status === 'CANCELLED' ? 'Đã hủy' : 'Đang xử lý'}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="shrink-0 text-right">
                          <div className="text-base font-bold text-slate-900">{Number(o.price).toLocaleString()}đ</div>
                          <div className="mt-2 flex items-center justify-end gap-1 text-xs font-medium text-slate-500">
                            <Check size={12} /> Xem chi tiết
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}

                {!ordersLoading && buyerOrders.length === 0 && <div className="py-16 text-center text-sm text-slate-400">Bạn chưa có đơn mua nào.</div>}
              </div>
            )}

            {activeTab === 'password' && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (newPassword !== confirmPassword) {
                    setMessage({ type: 'error', text: 'Mật khẩu xác nhận không khớp!' });
                    return;
                  }
                  setLoading(true);
                  try {
                    const res = await api.put('/auth/change-password', { oldPassword, newPassword });
                    if (res.data.success) {
                      setMessage({ type: 'success', text: 'Đổi mật khẩu thành công!' });
                      setOldPassword('');
                      setNewPassword('');
                      setConfirmPassword('');
                    }
                  } catch {
                    setMessage({ type: 'error', text: 'Lỗi đổi mật khẩu' });
                  } finally {
                    setLoading(false);
                  }
                }}
                className="mx-auto max-w-sm space-y-4 py-6"
              >
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">Mật khẩu hiện tại</label>
                  <input
                    type="password"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm transition-all focus:border-slate-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">Mật khẩu mới</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm transition-all focus:border-slate-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">Xác nhận mật khẩu mới</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm transition-all focus:border-slate-400 focus:outline-none"
                  />
                </div>
                <button
                  disabled={loading}
                  className="rounded-lg bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition-all hover:bg-slate-800 disabled:opacity-50"
                >
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
