import React from 'react';
import { motion } from 'framer-motion';
import { ShoppingBag, ChevronRight, Package, TrendingUp, Timer, Lock, Users } from 'lucide-react';
import { Link } from 'react-router-dom';
import { productService } from '../services/productService';
import type { Product } from '../services/productService';
import ProductCard from '../components/ProductCard';

const Home: React.FC = () => {
  const [products, setProducts] = React.useState<Product[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await productService.getProducts(0, 8);
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
    <div className="space-y-16 pb-12">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-white/20 rounded-3xl border border-white/40 shadow-2xl shadow-indigo-100/40 p-12 md:p-20 text-center">
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/2 w-[400px] h-[400px] bg-indigo-200/20 blur-[100px] rounded-full"></div>
        <div className="absolute bottom-0 left-0 translate-y-1/2 -translate-x-1/2 w-[400px] h-[400px] bg-rose-200/20 blur-[100px] rounded-full"></div>
        
        <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="relative z-10 space-y-8"
        >
          <div className="flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-full w-fit mx-auto border border-indigo-100 mb-6">
            <span className="animate-pulse w-2 h-2 bg-indigo-500 rounded-full"></span>
            <span className="text-xs font-bold tracking-widest uppercase mb-0">Hơn 5000+ sinh viên IUH đang trao đổi</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-slate-900 tracking-tight leading-[1.1]">
            Mua bán <span className="bg-gradient-to-r from-indigo-600 to-indigo-400 bg-clip-text text-transparent">đồ cũ</span> <br />
            An toàn tại campus
          </h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed">
            Kết nối sinh viên IUH, trao đổi tài liệu, đồ dùng cá nhân và thiết bị điện tử nhanh chóng, an toàn và tiết kiệm.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link to="/products" className="w-full sm:w-auto px-10 py-4 bg-indigo-600 text-white rounded-2xl font-bold flex items-center justify-center gap-3 hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-indigo-200">
               <ShoppingBag size={22} />
               <span>Khám phá ngay</span>
            </Link>
            <Link to="/products/new" className="w-full sm:w-auto px-10 py-4 bg-white text-slate-700 border border-slate-200 rounded-2xl font-bold flex items-center justify-center gap-3 hover:border-indigo-300 hover:text-indigo-600 transition-all hover:bg-indigo-50/50">
               <Package size={22} />
               <span>Đăng món đồ của bạn</span>
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Feature Section */}
      <section className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {[
          { icon: <Timer />, title: "Nhanh chóng", desc: "Đăng tin chỉ trong 1 phút, kết nối ngay lập tức với người mua tại trường." },
          { icon: <Lock />, title: "An toàn", desc: "Hệ thống Karma minh bạch, tin đăng được kiểm duyệt chặt chẽ, an tâm giao dịch." },
          { icon: <Users />, title: "Tiết kiệm", desc: "Nâng cao giá trị vòng đời sản phẩm, giúp sinh viên tiết kiệm tối đa học phí." }
        ].map((feat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            whileHover={{ y: -5 }}
            className="p-8 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:shadow-indigo-500/5 transition-all group"
          >
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-indigo-600 group-hover:text-white transition-all">
              {React.cloneElement(feat.icon as React.ReactElement<{ size?: number }>, { size: 28 })}
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">{feat.title}</h3>
            <p className="text-slate-500 leading-relaxed text-sm">{feat.desc}</p>
          </motion.div>
        ))}
      </section>

      {/* Trending Section */}
      <section>
        <div className="flex items-end justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 font-bold tracking-widest uppercase text-xs mb-2">
              <TrendingUp size={14} />
              <span>Sản phẩm nổi bật</span>
            </div>
            <h2 className="text-4xl font-black text-slate-900">Mới nhất hôm nay</h2>
          </div>
          <Link to="/products" className="text-indigo-600 font-bold flex items-center gap-1 hover:gap-2 transition-all">
            Xem tất cả <ChevronRight size={20} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {loading ? (
            // Skeleton Loading
            [1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white rounded-3xl border border-slate-100 p-6 space-y-4 animate-pulse">
                <div className="aspect-square bg-slate-100 rounded-2xl w-full"></div>
                <div className="h-4 bg-slate-100 rounded w-2/3"></div>
                <div className="h-6 bg-slate-100 rounded w-1/3"></div>
              </div>
            ))
          ) : products.length > 0 ? (
            products.map((product) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4 }}
              >
                <ProductCard product={product} />
              </motion.div>
            ))
          ) : (
            <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
                <Package size={48} className="mx-auto text-slate-300 mb-4" />
                <p className="text-slate-500 font-medium">Chưa có sản phẩm nào được đăng bán.</p>
                <Link to="/products/new" className="text-indigo-600 font-bold hover:underline mt-2 inline-block">Trở thành người bán đầu tiên!</Link>
            </div>
          )}
        </div>

      </section>
    </div>
  );
};

export default Home;
