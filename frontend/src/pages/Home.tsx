import React from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, ChevronRight, Package, TrendingUp, Timer, Lock, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { productService } from '../services/productService';
import type { Product } from '../services/productService';
import ProductCard from '../components/ProductCard';
import SEO from '../components/SEO';

const Home: React.FC = () => {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await productService.getProducts(1, 8);
        if (response.success) {
          setProducts(response.data.content);
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
    <div className="space-y-12 pb-12">
      <SEO title="Trang chủ" description="Nền tảng trao đổi, mua bán đồ dùng sinh viên IUH." />

      {/* Hero Section */}
      <section className="bg-slate-50 rounded-2xl p-10 md:p-16 text-center border border-slate-100">
        <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
        >
          <p className="text-xs font-medium text-slate-500 tracking-wide uppercase">Hơn 5000+ sinh viên IUH đang trao đổi</p>
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight leading-tight">
            Mua bán đồ cũ<br />
            <span className="text-slate-500">An toàn tại campus</span>
          </h1>
          <p className="text-base text-slate-500 max-w-lg mx-auto leading-relaxed">
            Kết nối sinh viên IUH, trao đổi tài liệu, đồ dùng cá nhân và thiết bị điện tử nhanh chóng và tiết kiệm.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link to="/products" className="w-full sm:w-auto px-6 py-2.5 bg-slate-900 text-white rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-slate-800 transition-all text-sm">
               <ShoppingBag size={18} />
               <span>Khám phá ngay</span>
            </Link>
            <Link to="/products/new" className="w-full sm:w-auto px-6 py-2.5 bg-white text-slate-700 border border-slate-200 rounded-lg font-medium flex items-center justify-center gap-2 hover:bg-slate-50 transition-all text-sm">
               <Package size={18} />
               <span>Đăng món đồ của bạn</span>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Feature Section */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { icon: <Timer />, title: "Nhanh chóng", desc: "Đăng tin chỉ trong 1 phút, kết nối ngay với người mua tại trường." },
          { icon: <Lock />, title: "An toàn", desc: "Hệ thống Karma minh bạch, tin đăng được kiểm duyệt chặt chẽ." },
          { icon: <Users />, title: "Tiết kiệm", desc: "Nâng cao giá trị vòng đời sản phẩm, tiết kiệm tối đa cho sinh viên." }
        ].map((feat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="p-6 bg-white rounded-xl border border-slate-200 hover:border-slate-300 transition-colors"
          >
            <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-lg flex items-center justify-center mb-4">
              {React.cloneElement(feat.icon as React.ReactElement<{ size?: number }>, { size: 20 })}
            </div>
            <h3 className="text-base font-semibold text-slate-900 mb-1">{feat.title}</h3>
            <p className="text-slate-500 text-sm leading-relaxed">{feat.desc}</p>
          </motion.div>
        ))}
      </section>

      {/* Trending Section */}
      <section>
        <div className="flex items-end justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 text-slate-500 font-medium text-xs uppercase tracking-wide mb-1">
              <TrendingUp size={14} />
              <span>Sản phẩm nổi bật</span>
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Mới nhất hôm nay</h2>
          </div>
          <Link to="/products" className="text-sm text-slate-500 font-medium flex items-center gap-1 hover:text-slate-900 transition-colors">
            Xem tất cả <ChevronRight size={16} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {loading ? (
            // Bug #34 fix: Generate skeleton cards based on grid columns (responsive)
            Array.from({ length: 8 }, (_, i) => i + 1).map((i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3 animate-pulse">
                <div className="aspect-square bg-slate-100 rounded-lg w-full"></div>
                <div className="h-3 bg-slate-100 rounded w-2/3"></div>
                <div className="h-5 bg-slate-100 rounded w-1/3"></div>
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
            <div className="col-span-full py-16 text-center bg-white rounded-xl border border-dashed border-slate-200">
                <Package size={40} className="mx-auto text-slate-300 mb-3" />
                <p className="text-slate-500 text-sm">Chưa có sản phẩm nào được đăng bán.</p>
                <Link to="/products/new" className="text-sm text-slate-900 font-medium hover:underline mt-1 inline-block">Trở thành người bán đầu tiên!</Link>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};

export default Home;
