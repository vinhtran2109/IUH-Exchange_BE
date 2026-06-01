import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ShoppingBag, ChevronRight, Package, TrendingUp, Timer, Lock, Users, Star, MapPin, CheckCircle2, ShieldCheck, Flag,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { productService } from '../services/productService';
import type { Product } from '../services/productService';
import ProductCard from '../components/ProductCard';
import SEO from '../components/SEO';
import { categoryLabel } from '../utils/enums';
import { lostFoundService, ItemType } from '../services/lostFoundService';
import type { LostFoundItem } from '../services/lostFoundService';

const Home: React.FC = () => {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [lostFoundItems, setLostFoundItems] = React.useState<LostFoundItem[]>([]);
  const [stats, setStats] = React.useState({ total: 0 });
  const [activityIndex, setActivityIndex] = React.useState(0);

  React.useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await productService.getProducts(1, 10);
        if (response.success) {
          setProducts(response.data.content);
          const total = response.data.totalElements ?? response.data.content.length;
          setStats({ total });
        }
      } catch (error) {
        console.error("Failed to fetch products:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, []);

  React.useEffect(() => {
    const fetchLostFound = async () => {
      try {
        const [lostResponse, foundResponse] = await Promise.all([
          lostFoundService.getItems(ItemType.LOST, 1, 4),
          lostFoundService.getItems(ItemType.FOUND, 1, 4),
        ]);
        const items = [
          ...(lostResponse?.data?.content || lostResponse?.content || []),
          ...(foundResponse?.data?.content || foundResponse?.content || []),
        ] as LostFoundItem[];
        setLostFoundItems(
          items
            .filter((item) => item.status !== 'CLOSED' && item.status !== 'RESOLVED')
            .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
            .slice(0, 4),
        );
      } catch (error) {
        console.error('Failed to fetch lost-found items:', error);
      }
    };
    fetchLostFound();
  }, []);

  const recentProducts = React.useMemo(() => products.slice(0, 3), [products]);
  const visibleActivityProducts = React.useMemo(() => {
    if (recentProducts.length <= 1) return recentProducts;
    return recentProducts.map((_, index) => recentProducts[(activityIndex + index) % recentProducts.length]);
  }, [activityIndex, recentProducts]);

  React.useEffect(() => {
    setActivityIndex(0);
  }, [recentProducts.map((product) => product.id).join('|')]);

  React.useEffect(() => {
    if (recentProducts.length <= 1) return;
    const interval = window.setInterval(() => {
      setActivityIndex((current) => (current + 1) % recentProducts.length);
    }, 3200);
    return () => window.clearInterval(interval);
  }, [recentProducts.length]);

  const formatActivityTime = (value?: string) => {
    if (!value) return 'Vừa đăng';
    const created = new Date(value).getTime();
    if (Number.isNaN(created)) return 'Vừa đăng';
    const minutes = Math.max(0, Math.floor((Date.now() - created) / 60000));
    if (minutes < 1) return 'Vừa đăng';
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    return `${Math.floor(hours / 24)} ngày trước`;
  };

  return (
    <div className="space-y-14 pb-5">
      <SEO title="Trang chủ" description="Nền tảng trao đổi, mua bán đồ dùng sinh viên IUH." />

      {/* ── Hero ── */}
      <section className="relative overflow-hidden rounded-3xl">
        {/* Background image (cover) + dark overlay for readability */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${encodeURI('/icons/ảnh bìa iuh.png')})` }}
        />
        <div className="absolute inset-0 bg-black/40" />
        {/* Decorative blobs */}
        <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-72 h-72 rounded-full bg-indigo-400/20 blur-2xl pointer-events-none" />

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 px-6 py-10 text-center sm:px-8 sm:py-12 md:py-14"
        >
          {/* Badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/15 px-4 py-1.5 text-xs font-semibold text-white/90 mb-4 sm:mb-5">
            <Star size={12} className="text-yellow-300" />
            Nền tảng trao đổi #2 của sinh viên IUH
          </div>

          <h1 className="mb-4 text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl md:text-5xl">
            Mua bán đồ cũ<br />
            <span className="text-indigo-200">an toàn tại campus</span>
          </h1>
          <p className="mx-auto mb-6 max-w-xl text-sm leading-relaxed text-indigo-100 sm:text-base md:text-lg">
            Kết nối sinh viên IUH — trao đổi tài liệu, đồ dùng cá nhân và thiết bị điện tử nhanh chóng, tiết kiệm.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              to="/products"
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-6 py-2.5 text-sm font-bold text-indigo-700 transition-all hover:bg-indigo-50 shadow-lg shadow-indigo-900/20 sm:w-auto"
            >
              <ShoppingBag size={18} />
              Khám phá ngay
            </Link>
            <Link
              to="/products/new"
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/30 bg-white/15 px-6 py-2.5 text-sm font-bold text-white transition-all hover:bg-white/25 sm:w-auto"
            >
              <Package size={18} />
              Đăng món đồ của bạn
            </Link>
          </div>

          {/* Live stats */}
          <div className="mt-7 flex items-center justify-center gap-6 sm:gap-8 md:gap-10">
            {[
              { label: 'Sản phẩm', value: loading ? '...' : `${stats.total > 0 ? stats.total.toLocaleString() : '--'}+` },
              { label: 'Sinh viên', value: '30+' },
              { label: 'Giao dịch', value: '15+' },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-lg font-black text-white sm:text-xl md:text-2xl">{s.value}</div>
                <div className="text-xs text-indigo-200 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Trust signals */}
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { icon: <ShieldCheck size={17} />, label: 'Xác thực email IUH' },
            { icon: <Users size={17} />, label: 'Chỉ sinh viên IUH mới tham gia' },
            { icon: <Star size={17} />, label: 'Hệ thống Karma uy tín' },
            { icon: <MapPin size={17} />, label: 'Hỗ trợ đồ thất lạc' },
            { icon: <Flag size={17} />, label: 'Báo cáo vi phạm' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
                {item.icon}
              </div>
              <div className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-slate-700">
                <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
                <span className="truncate">{item.label}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Feature cards ── */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: <Timer />, title: "Nhanh chóng", desc: "Đăng tin chỉ trong 1 phút, kết nối ngay với người mua tại trường.", color: 'bg-blue-100 text-blue-600' },
          { icon: <Lock />, title: "An toàn",     desc: "Hệ thống Karma minh bạch, tin đăng được kiểm duyệt chặt chẽ.", color: 'bg-emerald-100 text-emerald-600' },
          { icon: <Users />, title: "Tiết kiệm",  desc: "Nâng cao giá trị vòng đời sản phẩm, tiết kiệm tối đa cho sinh viên.", color: 'bg-purple-100 text-purple-600' },
        ].map((feat, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="rounded-2xl border border-(--border) bg-(--surface) p-6 transition-all hover:shadow-md"
          >
            <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-4 ${feat.color}`}>
              {React.cloneElement(feat.icon as React.ReactElement<{ size?: number }>, { size: 20 })}
            </div>
            <h3 className="mb-1.5 text-base font-bold text-(--foreground)">{feat.title}</h3>
            <p className="text-slate-500 text-sm leading-relaxed">{feat.desc}</p>
          </motion.div>
        ))}
      </section>

      {/* ── Recent activity ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-600">
              <Timer size={14} />
              <span>Hoạt động gần đây</span>
            </div>
            <h2 className="text-xl font-black text-slate-950">Những cập nhật mới trên chợ</h2>
          </div>
          <Link to="/products" className="hidden rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 sm:inline-flex">
            Xem chợ
          </Link>
        </div>

        <div className="overflow-hidden" aria-live="polite">
          {loading ? (
            <div className="grid gap-3 lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-2xl bg-slate-100" />
              ))}
            </div>
          ) : visibleActivityProducts.length > 0 ? (
            <div className="grid gap-3 lg:grid-cols-[1.35fr_1fr_1fr]">
              <AnimatePresence mode="wait">
                {visibleActivityProducts.map((product, index) => (
                  <motion.div
                    key={`${product.id}-${index}-${activityIndex}`}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.32, ease: 'easeOut', delay: index * 0.04 }}
                  >
                    <Link
                      to={`/products/${product.id}`}
                      className={`group flex h-full min-h-28 items-center gap-3 rounded-2xl border p-3 transition hover:border-indigo-200 hover:bg-white hover:shadow-sm ${
                        index === 0 ? 'border-indigo-100 bg-indigo-50/70 shadow-sm' : 'border-slate-100 bg-slate-50'
                      }`}
                    >
                      <div className={index === 0 ? 'relative h-20 w-24 shrink-0 overflow-hidden rounded-xl bg-white' : 'relative h-16 w-20 shrink-0 overflow-hidden rounded-xl bg-white'}>
                        <img
                          src={product.imageUrls?.[0] || 'https://placehold.co/160x120/e2e8f0/64748b?text=IUH'}
                          alt={product.title}
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="mb-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-black text-indigo-700 ring-1 ring-indigo-100">{categoryLabel(product.category)}</span>
                        </div>
                        <div className={index === 0 ? 'line-clamp-2 text-base font-black leading-snug text-slate-950' : 'line-clamp-2 text-sm font-black leading-snug text-slate-900'}>{product.title}</div>
                        <div className="mt-2 truncate text-xs font-semibold text-slate-500">
                          {product.sellerName || 'Sinh vien IUH'} - {formatActivityTime(product.createdAt)}
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>
              <div className="flex items-center justify-center gap-1.5 lg:col-span-3">
                {recentProducts.map((product, index) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setActivityIndex(index)}
                    className={`h-1.5 rounded-full transition-all ${index === activityIndex ? 'w-6 bg-indigo-600' : 'w-1.5 bg-slate-300 hover:bg-slate-400'}`}
                    aria-label={`Xem hoat dong ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm font-medium text-slate-400">
              Chua co hoat dong moi.
            </div>
          )}
        </div>
      </section>

      {/* Lost & found */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-cyan-700">
              <MapPin size={14} />
              <span>Đồ thất lạc</span>
            </div>
            <h2 className="text-xl font-black text-slate-950">Tin mất đồ và nhặt được gần đây</h2>
          </div>
          <Link to="/lost-found" className="hidden rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 transition hover:border-cyan-200 hover:bg-cyan-50 hover:text-cyan-700 sm:inline-flex">
            Xem tất cả
          </Link>
        </div>

        {lostFoundItems.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {lostFoundItems.map((item) => (
              <Link
                key={item.id}
                to={`/lost-found/${item.id}`}
                className="group overflow-hidden rounded-2xl border border-slate-100 bg-slate-50 transition hover:border-cyan-200 hover:bg-white hover:shadow-sm"
              >
                <div className="aspect-[4/3] overflow-hidden bg-slate-100">
                  <img
                    src={item.imageUrls?.[0] || 'https://placehold.co/480x360/e2e8f0/64748b?text=IUH'}
                    alt={item.title}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                  />
                </div>
                <div className="space-y-3 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${item.type === ItemType.LOST ? 'bg-rose-50 text-rose-700' : 'bg-sky-50 text-sky-700'}`}>
                      {item.type === ItemType.LOST ? 'Đồ mất' : 'Nhặt được'}
                    </span>
                    <span className="truncate text-[11px] font-bold text-slate-400">{formatActivityTime(item.createdAt)}</span>
                  </div>
                  <div>
                    <div className="line-clamp-1 text-sm font-black text-slate-950">{item.title}</div>
                    <div className="mt-1 flex items-center gap-1.5 truncate text-xs font-semibold text-slate-500">
                      <MapPin size={13} className="shrink-0 text-cyan-600" />
                      <span className="truncate">{item.location || 'Chưa rõ vị trí'}</span>
                    </div>
                  </div>
                  <div className="truncate rounded-xl bg-white px-3 py-2 text-xs font-bold text-slate-600 ring-1 ring-slate-100">
                    {item.userName || item.studentId || 'Sinh viên IUH'}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center">
            <MapPin size={34} className="mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-semibold text-slate-500">Chưa có tin thất lạc đang mở.</p>
            <Link to="/lost-found/new" className="mt-2 inline-flex text-sm font-bold text-cyan-700 hover:underline">
              Đăng tin mất đồ hoặc nhặt được
            </Link>
          </div>
        )}
      </section>

      {/* ── Latest products ── */}
      <section>
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 font-semibold text-xs uppercase tracking-widest mb-1">
              <TrendingUp size={14} />
              <span>Sản phẩm nổi bật</span>
            </div>
            <h2 className="text-2xl font-bold text-(--foreground)">Mới nhất hôm nay</h2>
          </div>
          <Link to="/products" className="text-sm text-slate-500 font-medium flex items-center gap-1 hover:text-slate-900 transition-colors">
            Xem tất cả <ChevronRight size={16} />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
          {loading ? (
            Array.from({ length: 10 }, (_, i) => i + 1).map((i) => (
              <div key={i} className="rounded-2xl border border-(--border) bg-(--surface) p-4 space-y-3 animate-pulse">
                <div className="aspect-square bg-slate-200 dark:bg-slate-700 rounded-xl w-full"></div>
                <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3"></div>
                <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/3"></div>
              </div>
            ))
          ) : products.length > 0 ? (
            products.map((product) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <ProductCard product={product} />
              </motion.div>
            ))
          ) : (
            <div className="col-span-full rounded-2xl border border-dashed border-(--border) bg-(--surface) py-16 text-center">
              <Package size={40} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 text-sm">Chưa có sản phẩm nào được đăng bán.</p>
              <Link to="/products/new" className="text-sm text-indigo-600 font-semibold hover:underline mt-1 inline-block">Trở thành người bán đầu tiên!</Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;
