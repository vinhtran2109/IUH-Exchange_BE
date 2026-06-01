import React from 'react';
import { motion } from 'framer-motion';
import {
  ShoppingBag, ChevronRight, Package, TrendingUp, Timer, Lock, Users, Zap, Star,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { productService } from '../services/productService';
import { useAuthStore } from '../store/authStore';
import type { Product } from '../services/productService';
import ProductCard from '../components/ProductCard';
import SEO from '../components/SEO';

const Home: React.FC = () => {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [stats, setStats] = React.useState({ total: 0 });
  const [page, setPage] = React.useState<number>(1);
  const [pageSize] = React.useState<number>(12);
  const [totalPages, setTotalPages] = React.useState<number>(1);  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  React.useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await productService.getProducts(page, pageSize);
        if (response.success) {
          setProducts(response.data.content);
          const total = response.data.totalElements ?? response.data.content.length;
          setStats({ total });
          setTotalPages(Math.max(1, Math.ceil((response.data.totalElements ?? response.data.content.length) / pageSize)));
        }
      } catch (error) {
        console.error("Failed to fetch products:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProducts();
  }, [page, pageSize]);

  React.useEffect(() => {
    if (!isAuthenticated && page !== 1) {
      setPage(1);
    }
  }, [isAuthenticated, page]);

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
          <div className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-full border border-white/20 bg-white/15 px-4 py-1.5 text-xs font-semibold text-white/90 sm:left-8 sm:top-8">
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


      {/* ── Latest products ── */}
      <section>
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 font-semibold text-xs uppercase tracking-widest mb-1">
              <TrendingUp size={14} />
              <span>Sản phẩm nổi bật</span>
            </div>
            <h2 className="text-2xl font-bold text-(--foreground)">Hàng loạt món hot đang chờ</h2>
            <p className="mt-1 text-sm text-slate-500">Khám phá các sản phẩm được cập nhật liên tục từ cộng đồng IUH.</p>
          </div>
          <Link to="/products" className="text-sm text-slate-500 font-medium flex items-center gap-1 hover:text-slate-900 transition-colors">
            Xem tất cả <ChevronRight size={16} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {loading ? (
            Array.from({ length: 8 }, (_, i) => i + 1).map((i) => (
              <div key={i} className="rounded-2xl border border-(--border) bg-(--surface) p-5 space-y-4 animate-pulse">
                <div className="aspect-square bg-slate-200 dark:bg-slate-700 rounded-3xl w-full"></div>
                <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
                <div className="h-5 bg-slate-200 dark:bg-slate-700 rounded w-1/2"></div>
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
        {totalPages > 1 && !isAuthenticated && (
          <div className="mt-6 rounded-3xl border border-dashed border-indigo-200 bg-indigo-50/70 p-6 text-center">
            <p className="text-sm text-slate-700 mb-3">Bạn đang xem trang đầu tiên. Đăng nhập để xem thêm các trang sản phẩm tiếp theo.</p>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-full bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:bg-indigo-700 transition-colors"
            >
              Đăng nhập để xem thêm
            </Link>
          </div>
        )}
        {totalPages > 1 && isAuthenticated && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded-lg border bg-(--surface) text-sm disabled:opacity-50"
            >
              Trước
            </button>

            <div className="flex flex-wrap items-center justify-center gap-1">
              {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((pn) => (
                <button
                  key={pn}
                  onClick={() => setPage(pn)}
                  className={`px-3 py-1 rounded-lg text-sm ${pn === page ? 'bg-indigo-600 text-white' : 'bg-(--surface)'} `}
                >
                  {pn}
                </button>
              ))}
              {totalPages > 10 && <span className="px-2 text-sm">...</span>}
            </div>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-3 py-1 rounded-lg border bg-(--surface) text-sm disabled:opacity-50"
            >
              Tiếp
            </button>
          </div>
        )}
      </section>

      {/* ── Community showcase ── */}
      <section className="rounded-3xl border border-(--border) bg-(--surface) p-6 md:p-8">
        <div className="grid gap-8 lg:grid-cols-[1.1fr,0.9fr] items-center">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 font-semibold text-xs uppercase tracking-widest mb-3">
              <Users size={14} />
              Cộng đồng IUH
            </div>
            <h2 className="text-3xl font-bold text-(--foreground) sm:text-4xl">
              Sàn thương mại điện tử dành cho sinh viên IUH.
            </h2>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Tạo dựng trải nghiệm mua sắm và trao đổi đáng tin cậy ngay trong nội bộ trường. Kết nối người bán, người mua và các hội nhóm học thuật trong một nền tảng chuyên nghiệp.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {[
                { icon: <Zap />, title: 'Tối ưu chi phí', text: 'Săn đồ dùng, sách vở, thiết bị học tập với giá sinh viên.' },
                { icon: <TrendingUp />, title: 'Giá trị bền vững', text: 'Tiếp sức nhau qua vòng đời sản phẩm tuần hoàn và thân thiện môi trường.' },
                { icon: <Package />, title: 'Nhiều danh mục', text: 'Thiết bị, văn phòng phẩm, quần áo, sách và đồ công nghệ dành cho học tập.' },
                { icon: <Lock />, title: 'Tin cậy', text: 'Minh bạch thông tin người bán và đánh giá của cộng đồng.' },
              ].map((item, index) => (
                <div key={index} className="flex items-start gap-3 rounded-3xl border border-(--border) bg-white/60 p-4 shadow-sm">
                  <div className="mt-1 flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                    {React.cloneElement(item.icon as React.ReactElement<{ size?: number }>, { size: 18 })}
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm text-(--foreground)">{item.title}</h3>
                    <p className="mt-1 text-sm text-slate-500 leading-relaxed">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl bg-gradient-to-br from-indigo-600 via-violet-600 to-sky-500 p-8 text-white shadow-xl">
            <div className="rounded-3xl bg-white/10 p-6">
              <div className="text-xs uppercase tracking-[0.3em] text-indigo-100/80">Nhiệm vụ của chúng tôi</div>
              <h3 className="mt-4 text-2xl font-bold">Xây dựng thị trường nội bộ tin cậy cho IUH.</h3>
              <p className="mt-4 text-sm leading-6 text-indigo-100/90">
                Hỗ trợ sinh viên giảm chi phí học tập, trao đổi đồ dùng còn giá trị và kết nối những người cùng chí hướng trong cộng đồng trường.
              </p>
              <div className="mt-6 space-y-4 text-sm">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/15 text-white">1</span>
                  <span>Khuyến khích mua bán an toàn, minh bạch.</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/15 text-white">2</span>
                  <span>Tạo cơ hội sưu tầm đồ cũ chất lượng.</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-white/15 text-white">3</span>
                  <span>Nâng cao giá trị cộng đồng thông qua chia sẻ và hỗ trợ.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
