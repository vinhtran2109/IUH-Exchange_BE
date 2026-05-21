import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  BadgeCheck,
  MessageSquare,
  Package,
  Star,
  TrendingUp,
  UserCheck,
  Users,
} from 'lucide-react';
import api from '../services/api';
import { productService } from '../services/productService';
import type { Product } from '../services/productService';
import { chatService } from '../services/chatService';
import { useAuthStore } from '../store/authStore';
import { conditionLabel } from '../utils/enums';

const SellerProfile: React.FC = () => {
  const { sellerId } = useParams<{ sellerId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore() as any;

  const [seller, setSeller] = useState<any>(null);
  const [trust, setTrust] = useState<any>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [followBusy, setFollowBusy] = useState(false);

  useEffect(() => {
    if (!sellerId) return;
    setLoading(true);

    const fetchAll = async () => {
      try {
        const [userRes, trustRes, productsRes] = await Promise.all([
          api.get(`/users/${sellerId}`),
          productService.getSellerTrust(sellerId),
          productService.getProducts(1, 20),
        ]);
        if (userRes.data?.success) setSeller(userRes.data.data);
        if (trustRes.success) setTrust(trustRes.data);
        if (productsRes.success) {
          const all = productsRes.data?.content || [];
          setProducts(all.filter((p: Product) => p.sellerId === sellerId && p.status === 'AVAILABLE'));
        }
      } catch (err) {
        console.error('Failed to load seller profile', err);
      } finally {
        setLoading(false);
      }
    };

    fetchAll();

    if (user && user.id !== sellerId) {
      productService.checkSellerFollow(sellerId)
        .then((res) => { if (res.success) setFollowing(res.data.following); })
        .catch(() => {});
    }
  }, [sellerId, user]);

  const handleToggleFollow = async () => {
    if (!sellerId || !user) return;
    setFollowBusy(true);
    try {
      const res = await productService.toggleSellerFollow(sellerId);
      if (res.success) setFollowing(res.data.following);
    } catch {/* */} finally {
      setFollowBusy(false);
    }
  };

  const handleChat = () => {
    if (!seller) return;
    chatService.triggerOpenChat(sellerId!, seller.name || 'Người bán');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600" />
      </div>
    );
  }

  if (!seller) {
    return (
      <div className="py-40 text-center">
        <p className="text-slate-500">Không tìm thấy thông tin người bán.</p>
        <button onClick={() => navigate(-1)} className="mt-3 text-sm text-slate-700 hover:underline">Quay lại</button>
      </div>
    );
  }

  const avgRating = trust?.avgRating || 0;
  const starCount = Math.round(avgRating);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft size={16} /> Quay lại
      </button>

      {/* Header người bán */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 overflow-hidden rounded-2xl border border-slate-200 bg-white"
      >
        {/* Banner gradient */}
        <div className="h-28 bg-gradient-to-br from-slate-800 via-slate-700 to-slate-900" />

        <div className="relative px-6 pb-6">
          {/* Avatar */}
          <div className="relative -mt-12 mb-4 flex items-end justify-between">
            <div className="h-24 w-24 overflow-hidden rounded-2xl border-4 border-white bg-slate-100 shadow-lg">
              {seller.avatarUrl ? (
                <img src={seller.avatarUrl} alt={seller.name} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-slate-200 text-slate-500 text-3xl font-bold">
                  {(seller.name || 'U')[0].toUpperCase()}
                </div>
              )}
            </div>

            {/* Nút hành động */}
            {user && user.id !== sellerId && (
              <div className="flex gap-2 pt-14">
                <button
                  onClick={handleChat}
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all hover:bg-slate-50"
                >
                  <MessageSquare size={15} /> Nhắn tin
                </button>
                <button
                  onClick={handleToggleFollow}
                  disabled={followBusy}
                  className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium shadow-sm transition-all disabled:opacity-50 ${
                    following
                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  <UserCheck size={15} />
                  {following ? 'Đang theo dõi' : 'Theo dõi'}
                </button>
              </div>
            )}
          </div>

          {/* Tên + tích xác thực */}
          <div className="mb-1 flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">{seller.name || 'Người dùng IUH'}</h1>
            <BadgeCheck size={18} className="text-emerald-500" aria-label="Tài khoản đã xác thực IUH" />
          </div>
          <p className="mb-4 text-sm text-slate-500">MSSV: {seller.studentId || 'Chưa cập nhật'}</p>

          {/* Stars */}
          <div className="mb-5 flex items-center gap-1.5">
            {[1, 2, 3, 4, 5].map((s) => (
              <Star
                key={s}
                size={16}
                className={s <= starCount ? 'fill-amber-400 text-amber-400' : 'fill-slate-200 text-slate-200'}
              />
            ))}
            <span className="ml-1 text-sm font-semibold text-slate-700">{avgRating.toFixed(1)}</span>
            <span className="text-sm text-slate-400">({trust?.reviewCount || 0} đánh giá)</span>
          </div>

          {/* Stats grid */}
          {trust && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                <div className="text-lg font-black text-slate-900">{trust.soldCount || 0}</div>
                <div className="mt-0.5 flex items-center justify-center gap-1 text-xs text-slate-500">
                  <Package size={12} /> Đã bán
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                <div className="text-lg font-black text-slate-900">{trust.followerCount || 0}</div>
                <div className="mt-0.5 flex items-center justify-center gap-1 text-xs text-slate-500">
                  <Users size={12} /> Người theo dõi
                </div>
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                <div className="text-lg font-black text-slate-900">{trust.trustScore || 0}/100</div>
                <div className="mt-0.5 flex items-center justify-center gap-1 text-xs text-slate-500">
                  <TrendingUp size={12} /> Điểm uy tín
                </div>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-center">
                <div className="text-lg font-black text-emerald-700">{trust.badge || 'Mới'}</div>
                <div className="mt-0.5 text-xs text-emerald-600">Hạng</div>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Danh sách sản phẩm đang rao bán */}
      <div>
        <h2 className="mb-4 text-base font-bold text-slate-900">
          Sản phẩm đang rao bán ({products.length})
        </h2>

        {products.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-400">
            Người bán này chưa có sản phẩm nào đang bán.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <motion.button
                key={p.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                onClick={() => navigate(`/products/${p.id}`)}
                className="group overflow-hidden rounded-xl border border-slate-200 bg-white text-left transition-all hover:border-slate-300 hover:shadow-md"
              >
                <div className="aspect-square overflow-hidden bg-slate-100">
                  <img
                    src={p.imageUrls?.[0] || 'https://placehold.co/400x400/e2e8f0/94a3b8?text=IUH'}
                    alt={p.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="p-3">
                  <p className="mb-1 line-clamp-2 text-xs font-semibold text-slate-800">{p.title}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">
                      {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(p.price)}
                    </span>
                  </div>
                  <span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
                    {conditionLabel(p.condition)}
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default SellerProfile;
