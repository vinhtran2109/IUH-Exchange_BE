import React from 'react';
import { motion } from 'framer-motion';
import {
  ShoppingBag, ChevronRight, Package, TrendingUp, Timer, Lock, Users, Zap, Star,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { productService } from '../services/productService';
import type { Product } from '../services/productService';
import ProductCard from '../components/ProductCard';
import SEO from '../components/SEO';

const Home: React.FC = () => {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [stats, setStats] = React.useState({ total: 0 });

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
              { label: 'Sản phẩm đang bán', value: loading ? '...' : `${stats.total > 0 ? stats.total.toLocaleString() : '--'}+` },
              { label: 'Hệ thống Karma', value: <span className="flex items-center gap-1"><Zap size={14} className="text-yellow-300" />Minh bạch</span> },
              { label: 'Cộng đồng IUH', value: 'Tin cậy' },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="text-lg font-black text-white sm:text-xl md:text-2xl">{s.value}</div>
                <div className="text-xs text-indigo-200 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        </motion.div>
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
