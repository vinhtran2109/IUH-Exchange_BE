import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  BadgeCheck,
  Bookmark,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Flag,
  Pencil,
  Phone,
  Save,
  ShieldCheck,
  ShoppingBag,
  Star,
  Store,
  Trash2,
  TrendingUp,
  User,
  UserCircle,
  Users,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { productService } from '../services/productService';
import type { Product } from '../services/productService';
import { orderService } from '../services/orderService';
import { wishlistService } from '../services/wishlistService';
import type { User as ProfileUser } from '../types/api';
import { useToast } from '../components/Toast';
import { useConfirm } from '../components/Dialogs';

const Profile: React.FC = () => {
  const { user, updateUser } = useAuthStore() as any;
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();
  const { confirm } = useConfirm();

  const [activeTab, setActiveTab] = useState<'info' | 'password' | 'products' | 'orders' | 'wishlist' | 'history'>('info');
  const [profile, setProfile] = useState<ProfileUser | null>(user ?? null);

  const [name, setName] = useState(user?.name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || '');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [accountHolder, setAccountHolder] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [myProducts, setMyProducts] = useState<Product[]>([]);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [wishlistItems, setWishlistItems] = useState<any[]>([]);
  const [viewHistory, setViewHistory] = useState<any[]>([]);
  const [sellerTrust, setSellerTrust] = useState<any>(null);

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
    fetchWishlist();
    fetchHistory();
    // Fetch seller trust sau khi có user id
    if (user?.id) {
      productService.getSellerTrust(user.id)
        .then((res) => { if (res.success) setSellerTrust(res.data); })
        .catch(() => {});
    }
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
        setBankName((currentProfile as any).bankInfo?.bankName || '');
        setAccountNumber((currentProfile as any).bankInfo?.accountNumber || '');
        setAccountHolder((currentProfile as any).bankInfo?.accountHolder || '');
        setQrCodeUrl((currentProfile as any).bankInfo?.qrCodeUrl || '');
        setPhoneNumber((currentProfile as any).phoneNumber || '');
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

  const fetchWishlist = async () => {
    try {
      const res = await wishlistService.getMyWishlist(1, 50);
      if (res.success) setWishlistItems(res.data?.content ?? []);
    } catch (error) {
      console.error(error);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await productService.getViewHistory(1, 50);
      if (res.success) setViewHistory(res.data?.content ?? []);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    const confirmed = await confirm({
      title: 'Gỡ bài đăng',
      message: 'Bạn có chắc muốn gỡ bài đăng này khỏi danh sách?',
      confirmText: 'Gỡ bài',
      cancelText: 'Hủy',
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      await productService.deleteProduct(id);
      toastSuccess('Gỡ bài đăng thành công.');
      fetchMyProducts();
    } catch {
      toastError('Lỗi khi xóa sản phẩm. Vui lòng thử lại.');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxAvatarSize = 5 * 1024 * 1024;
    if (file.size > maxAvatarSize) {
      toastWarning('Kích thước ảnh không được vượt quá 5MB.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      toastWarning('Vui lòng chọn đúng định dạng file ảnh (jpg, png, webp...).');
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
        toastSuccess('Ảnh đại diện đã được cập nhật!');
      }
    } catch (err: any) {
      toastError('Lỗi upload ảnh: ' + (err.message || 'Vui lòng thử lại'));
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const trimmedName = name.trim();
      const payload: Record<string, unknown> = {};

      if (trimmedName) payload.name = trimmedName;
      if (avatarUrl && /^https?:\/\//.test(avatarUrl)) payload.avatarUrl = avatarUrl;
      if (phoneNumber.trim()) payload.phoneNumber = phoneNumber.trim();
      payload.bankInfo = {
        bankName: bankName.trim(),
        accountNumber: accountNumber.trim(),
        accountHolder: accountHolder.trim(),
        qrCodeUrl: qrCodeUrl.trim(),
      };

      if (Object.keys(payload).length === 0) {
        setMessage({ type: 'error', text: 'Vui lòng nhập tên hợp lệ hoặc chọn ảnh đại diện.' });
        return;
      }

      const res = await api.patch('/users/me', payload);
      if (res.data.success) {
        const updated = res.data.data;
        setName(updated?.name || trimmedName);
        setAvatarUrl(updated?.avatarUrl || avatarUrl);
        setBankName(updated?.bankInfo?.bankName || bankName);
        setAccountNumber(updated?.bankInfo?.accountNumber || accountNumber);
        setAccountHolder(updated?.bankInfo?.accountHolder || accountHolder);
        setQrCodeUrl(updated?.bankInfo?.qrCodeUrl || qrCodeUrl);
        setProfile((prev) =>
          prev ? { ...prev, name: updated?.name || trimmedName, avatarUrl: updated?.avatarUrl || avatarUrl, bankInfo: updated?.bankInfo } as any : prev
        );
        updateUser({ name: updated?.name || trimmedName, avatarUrl: updated?.avatarUrl || avatarUrl, bankInfo: updated?.bankInfo });
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
            { id: 'wishlist', label: 'Đã lưu', icon: Bookmark },
            { id: 'history', label: 'Đã xem', icon: Clock },
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

                {/* === AVATAR + TÊN — ĐẶT LÊN ĐẦU === */}
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

                {/* === CHỈ SỐ UY TÍN (xuống sau avatar) === */}
                {sellerTrust && (
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                    <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                      <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">
                        <ShieldCheck size={13} className="text-emerald-500" />
                        Uy tín của bạn
                      </div>
                      {sellerTrust.badge && (
                        <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                          {sellerTrust.badge}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-0 divide-x divide-slate-100 sm:grid-cols-4">
                      <div className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Star size={14} className="fill-amber-400 text-amber-400" />
                          <span className="text-lg font-black text-slate-900">{(sellerTrust.avgRating || 0).toFixed(1)}</span>
                        </div>
                        <div className="mt-0.5 text-[10px] font-medium text-slate-400">Đánh giá TB</div>
                      </div>
                      <div className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <ShoppingBag size={14} className="text-slate-600" />
                          <span className="text-lg font-black text-slate-900">{sellerTrust.soldCount || 0}</span>
                        </div>
                        <div className="mt-0.5 text-[10px] font-medium text-slate-400">Giao dịch</div>
                      </div>
                      <div className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <TrendingUp size={14} className="text-emerald-600" />
                          <span className="text-lg font-black text-slate-900">{sellerTrust.trustScore || 0}</span>
                        </div>
                        <div className="mt-0.5 text-[10px] font-medium text-slate-400">Uy tín/100</div>
                      </div>
                      <div className="px-4 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Users size={14} className="text-slate-600" />
                          <span className="text-lg font-black text-slate-900">{sellerTrust.followerCount || 0}</span>
                        </div>
                        <div className="mt-0.5 text-[10px] font-medium text-slate-400">Theo dõi</div>
                      </div>
                    </div>

                    {sellerTrust.reviewCount > 0 && (
                      <div className="border-t border-slate-100 px-4 py-3">
                        <p className="mb-2 text-xs font-semibold text-slate-600">Phân phối sao đánh giá</p>
                        <div className="space-y-1.5">
                          {[5, 4, 3, 2, 1].map((star) => {
                            const count = sellerTrust[`star${star}Count`] || 0;
                            const pct = sellerTrust.reviewCount > 0 ? (count / sellerTrust.reviewCount) * 100 : 0;
                            return (
                              <div key={star} className="flex items-center gap-2 text-xs">
                                <div className="flex w-8 shrink-0 items-center gap-0.5 justify-end">
                                  <span className="text-slate-500">{star}</span>
                                  <Star size={10} className="fill-amber-400 text-amber-400" />
                                </div>
                                <div className="flex-1 overflow-hidden rounded-full bg-slate-100 h-1.5">
                                  <div
                                    className="h-full rounded-full bg-amber-400 transition-all"
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="w-6 shrink-0 text-right text-[10px] text-slate-400">{count}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-end border-t border-slate-100 px-4 py-3">
                      <div className="flex items-center gap-1 text-xs">
                        <BadgeCheck size={13} className="text-emerald-500" />
                        <span className="font-medium text-emerald-700">Tài khoản sinh viên IUH</span>
                      </div>
                    </div>
                  </div>
                )}
                {/* === END CHỈ SỐ UY TÍN === */}


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
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500 flex items-center gap-1">
                      <Phone size={12} /> Số điện thoại <span className="text-slate-300">(tùy chọn)</span>
                    </label>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="VD: 0901234567"
                      className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm transition-all focus:border-slate-400 focus:outline-none"
                    />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-slate-800">Thông tin nhận chuyển khoản</h3>
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-500">Ngân hàng</label>
                      <input value={bankName} onChange={(e) => setBankName(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-slate-400 focus:outline-none" placeholder="VD: Vietcombank" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-500">Số tài khoản</label>
                      <input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-slate-400 focus:outline-none" placeholder="VD: 0123456789" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-500">Tên chủ tài khoản</label>
                      <input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-slate-400 focus:outline-none" placeholder="VD: NGUYEN VAN A" />
                    </div>
                    <div>
                      <label className="mb-1.5 block text-xs font-medium text-slate-500">Link QR chuyển khoản</label>
                      <input value={qrCodeUrl} onChange={(e) => setQrCodeUrl(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm focus:border-slate-400 focus:outline-none" placeholder="https://..." />
                    </div>
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
                              {/* Show product title if populated, otherwise show a friendly ID */}
                              {typeof o?.productId === 'object' && o?.productId?.title
                                ? o.productId.title
                                : o?.productTitle || o?.product?.title || `Sản phẩm #${String(o?.productId || '').slice(-6) || '--'}`}
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

            {(activeTab === 'wishlist' || activeTab === 'history') && (
              <div className="space-y-3">
                <h3 className="mb-4 text-base font-semibold text-slate-800">
                  {activeTab === 'wishlist' ? 'Món đồ đã lưu' : 'Món đồ đã xem'}
                </h3>
                {(activeTab === 'wishlist' ? wishlistItems : viewHistory).map((item: any) => {
                  const product = item.product;
                  if (!product) return null;
                  return (
                    <button
                      key={item.id || item.productId}
                      type="button"
                      onClick={() => navigate(`/products/${product.id || product._id}`)}
                      className="flex w-full items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3 text-left hover:bg-white"
                    >
                      <div className="h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg bg-white">
                        <img src={product.imageUrls?.[0] || 'https://via.placeholder.com/160'} alt={product.title} className="h-full w-full object-cover" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-slate-800">{product.title}</div>
                        <div className="text-sm font-bold text-slate-900">{Number(product.price || 0).toLocaleString()}đ</div>
                        <div className="text-xs text-slate-400">{product.location || product.category || 'IUH'}</div>
                      </div>
                    </button>
                  );
                })}
                {(activeTab === 'wishlist' ? wishlistItems : viewHistory).length === 0 && (
                  <div className="py-16 text-center text-sm text-slate-400">
                    {activeTab === 'wishlist' ? 'Bạn chưa lưu món đồ nào.' : 'Bạn chưa có lịch sử xem.'}
                  </div>
                )}
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
