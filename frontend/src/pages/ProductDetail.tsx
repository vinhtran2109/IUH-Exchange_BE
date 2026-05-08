import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ShoppingCart, MessageSquare, AlertCircle, Package, Trash2, Flag, Heart } from 'lucide-react';
import { productService } from '../services/productService';
import { chatService } from '../services/chatService';
import { orderService } from '../services/orderService';
import type { Product } from '../services/productService';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import ReviewSection from '../components/ReviewSection';
import { wishlistService } from '../services/wishlistService';

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore() as any;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [completedOrderId, setCompletedOrderId] = useState<string | null>(null);
  const [wishlisted, setWishlisted] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        if (id) {
          const response = await productService.getProductById(id);
          if (response.success) setProduct(response.data);
        }
      } catch (error) {
        console.error("Failed to fetch product:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  useEffect(() => {
    if (!id || !user) return;
    const checkOrder = async () => {
      try {
        const res = await api.get(`/orders?productId=${id}&status=COMPLETED&page=0&size=1`);
        if (res.data?.success && res.data?.data?.content?.length > 0) {
          setCompletedOrderId(res.data.data.content[0].id);
        }
      } catch (e) { /* ignore */ }
    };
    checkOrder();
  }, [id, user]);

  useEffect(() => {
    if (!id || !user) return;
    const checkWish = async () => {
      try {
        const res = await wishlistService.check(id);
        if (res.success) setWishlisted(res.data.wishlisted);
      } catch (e) { /* ignore */ }
    };
    checkWish();
  }, [id, user]);

  const handleToggleWishlist = async () => {
    if (!user) { alert('Bạn cần đăng nhập!'); return; }
    try {
      const res = await wishlistService.toggle(id!);
      if (res.success) setWishlisted(res.data.wishlisted);
    } catch (e) { console.error(e); }
  };

  const handleDelete = async () => {
    if (!id || !window.confirm("Bạn có chắc chắn muốn gỡ bài đăng này?")) return;
    try {
      setDeleting(true);
      const response = await productService.deleteProduct(id);
      if (response.success) { alert("Gỡ bài thành công!"); navigate('/'); }
    } catch (error) {
      alert("Lỗi khi xóa bài.");
    } finally { setDeleting(false); }
  };

  const handleReport = async () => {
    if (!user) { alert("Bạn cần đăng nhập để tố cáo!"); return; }
    const reason = prompt("Lý do tố cáo sản phẩm này:");
    if (!reason || reason.length < 5) return;
    try {
      await api.post('/reports', { targetType: 'PRODUCT', targetId: id, reason });
      alert("Đã gửi tố cáo. Admin sẽ xem xét sớm.");
    } catch (err: any) {
      alert("Lỗi: " + (err.response?.data?.message || "Không thể gửi tố cáo"));
    }
  };

  const handleOrder = async () => {
    if (!product) return;
    if (!user) { alert("Bạn cần đăng nhập!"); navigate('/login'); return; }
    const note = prompt("Lời nhắn cho người bán? (tùy chọn)");
    if (note === null) return;
    try {
      setOrdering(true);
      const request = { productId: product.id, sellerId: product.sellerId || '', price: product.price, buyerNote: note, idempotencyKey: window.crypto.randomUUID() };
      await orderService.createOrder(request);
      if (product.sellerId) chatService.triggerOpenChat(product.sellerId, `Người bán ${product.sellerId.substring(0, 6)}`);
      alert("Đã gửi yêu cầu mua. Chat với người bán để trao đổi.");
    } catch (error: any) {
      alert("Lỗi tạo đơn: " + (error.response?.data?.message || "Có lỗi xảy ra"));
    } finally { setOrdering(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center py-40">
      <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin"></div>
    </div>
  );

  if (!product) return (
    <div className="text-center py-40">
       <AlertCircle size={40} className="mx-auto text-slate-300 mb-3" />
       <h2 className="text-lg font-semibold text-slate-800">Không tìm thấy sản phẩm</h2>
       <Link to="/" className="text-sm text-slate-500 hover:text-slate-900 mt-2 inline-block">Quay lại trang chủ</Link>
    </div>
  );

  return (
    <div className="max-w-5xl mx-auto py-8 px-4">
      <Link to="/" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-900 text-sm font-medium mb-6 transition-colors">
        <ArrowLeft size={16} />
        Quay lại
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Images */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <div className="aspect-square bg-white rounded-xl border border-slate-200 overflow-hidden">
             <img src={product.imageUrls[0] || 'https://placehold.co/800x800/e2e8f0/94a3b8?text=IUH'} className="w-full h-full object-cover" alt={product.title} />
          </div>
          {product.imageUrls.length > 1 && (
             <div className="flex gap-2 overflow-x-auto">
                {product.imageUrls.map((url, i) => (
                  <div key={i} className="w-16 h-16 rounded-lg border border-slate-200 overflow-hidden cursor-pointer hover:border-slate-400 transition-colors shrink-0">
                    <img src={url} className="w-full h-full object-cover" />
                  </div>
                ))}
             </div>
          )}
        </motion.div>

        {/* Info */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col">
          <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded w-fit mb-3 border border-slate-200">
             {product.category}
          </span>

          <h1 className="text-2xl font-bold text-slate-900 leading-tight mb-3">
            {product.title}
          </h1>

          {user && user.id !== product.sellerId && (
            <button onClick={handleToggleWishlist} className="mb-3 flex items-center gap-1.5 text-sm transition-all w-fit">
              <Heart size={16} className={wishlisted ? 'fill-red-500 text-red-500' : 'text-slate-400'} />
              <span className={wishlisted ? 'text-red-500 font-medium' : 'text-slate-400'}>{wishlisted ? 'Đã yêu thích' : 'Yêu thích'}</span>
            </button>
          )}

          <div className="flex items-center gap-3 mb-5">
             <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-medium rounded border border-slate-200">{product.condition}</span>
             <span className="text-slate-400 text-xs">{new Date(product.createdAt).toLocaleDateString()}</span>
          </div>

          <div className="bg-slate-50 p-5 rounded-xl border border-slate-200 mb-5">
             <div className="text-xs text-slate-500 font-medium uppercase tracking-wide mb-0.5">Giá</div>
             <div className="text-3xl font-bold text-slate-900">
                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price)}
             </div>
          </div>

          <div className="mb-6">
             <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-1.5 mb-2">
                <Package size={16} className="text-slate-400" /> Mô tả
             </h3>
             <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-line">
                {product.description}
             </p>
          </div>

          {/* Action Buttons */}
          <div className="mt-auto space-y-2 pt-4">
             {user?.id === product.sellerId ? (
               <div className="grid grid-cols-2 gap-2">
                 <button onClick={() => alert("Tính năng chỉnh sửa sẽ cập nhật sau!")} className="py-2.5 bg-white text-slate-700 border border-slate-200 rounded-lg font-medium text-sm hover:bg-slate-50 transition-all">
                    Sửa tin
                 </button>
                 <button onClick={handleDelete} disabled={deleting} className="py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-lg font-medium text-sm hover:bg-red-100 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5">
                    <Trash2 size={15} /> {deleting ? 'Đang gỡ...' : 'Gỡ bài'}
                 </button>
               </div>
             ) : (
               <>
                 <div className="grid grid-cols-2 gap-2">
                   <button onClick={handleOrder} disabled={ordering} className="py-2.5 bg-slate-900 text-white rounded-lg font-medium text-sm hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5">
                      <ShoppingCart size={16} /> {ordering ? 'Đang xử lý...' : 'Mua ngay'}
                   </button>
                   <button onClick={() => chatService.triggerOpenChat(product.sellerId, `Người bán ${product.sellerId.substring(0, 6)}`)} className="py-2.5 bg-white text-slate-700 border border-slate-200 rounded-lg font-medium text-sm hover:bg-slate-50 transition-all flex items-center justify-center gap-1.5">
                      <MessageSquare size={16} /> Chat người bán
                   </button>
                 </div>
                 <button onClick={handleReport} className="w-full py-2 text-slate-400 hover:text-red-500 text-xs font-medium transition-colors flex items-center justify-center gap-1">
                    <Flag size={12} /> Tố cáo sản phẩm
                 </button>
               </>
             )}
          </div>
        </motion.div>
      </div>

      <ReviewSection productId={product.id} orderId={completedOrderId || undefined} />
    </div>
  );
};

export default ProductDetail;
