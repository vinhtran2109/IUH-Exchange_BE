import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, ShoppingCart, MessageSquare, AlertCircle, Package, Trash2 } from 'lucide-react';
import { productService } from '../services/productService';
import { chatService } from '../services/chatService';
import { orderService } from '../services/orderService';
import type { Product } from '../services/productService';
import { useAuthStore } from '../store/authStore';

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore() as any;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [ordering, setOrdering] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        if (id) {
          const response = await productService.getProductById(id);
          if (response.success) {
            setProduct(response.data);
          }
        }
      } catch (error) {
        console.error("Failed to fetch product:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  const handleDelete = async () => {
    if (!id || !window.confirm("Bạn có chắc chắn muốn gỡ bài đăng này không? Hành động này không thể hoàn tác.")) return;

    try {
      setDeleting(true);
      const response = await productService.deleteProduct(id);
      if (response.success) {
        alert("Gỡ bài thành công!");
        navigate('/');
      }
    } catch (error) {
      console.error("Failed to delete product:", error);
      alert("Lỗi khi xóa bài. Bạn có phải là chủ bài đăng không?");
    } finally {
      setDeleting(false);
    }
  };

  const handleOrder = async () => {
    if (!product) return;
    if (!user) {
       alert("Bạn cần đăng nhập để đặt mua sản phẩm này!");
       navigate('/login');
       return;
    }
    const note = prompt("Bạn có lời nhắn gì cho người bán lúc nhận hàng không? (tùy chọn)");
    if (note === null) return; // User cancelled prompt

    try {
      setOrdering(true);
      const request = {
        productId: product.id,
        sellerId: product.sellerId || '',
        price: product.price,
        buyerNote: note,
        idempotencyKey: window.crypto.randomUUID()
      };
      await orderService.createOrder(request);
      if (product.sellerId) {
        chatService.triggerOpenChat(product.sellerId, `Người bán ${product.sellerId.substring(0, 6)}`);
      }
      alert("🎉 Đã gửi yêu cầu mua. Hệ thống đã báo người bán và mở khung chat để bạn nhắn tin trao đổi.");
    } catch (error: any) {
      console.error("Order failed:", error);
      alert("Lỗi tạo đơn: " + (error.response?.data?.message || "Có lỗi xảy ra"));
    } finally {
      setOrdering(false);
    }
  };


  if (loading) return (
    <div className="flex flex-col items-center justify-center py-40">
      <div className="w-16 h-16 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
      <p className="mt-4 text-slate-500 font-medium">Đang lấy thông tin sản phẩm...</p>
    </div>
  );

  if (!product) return (
    <div className="text-center py-40">
       <AlertCircle size={64} className="mx-auto text-rose-400 mb-4" />
       <h2 className="text-2xl font-black text-slate-900">Không tìm thấy sản phẩm</h2>
       <Link to="/" className="text-indigo-600 font-bold hover:underline mt-4 inline-block">Quay lại trang chủ</Link>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto py-10 px-4">
      <Link to="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-medium mb-8 transition-colors">
        <ArrowLeft size={18} />
        Quay lại mua sắm
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Images Area */}
        <motion.div 
           initial={{ opacity: 0, x: -20 }}
           animate={{ opacity: 1, x: 0 }}
           className="space-y-4"
        >
          <div className="aspect-square bg-white rounded-[2.5rem] border border-slate-100 overflow-hidden shadow-2xl shadow-indigo-100/50">
             <img 
               src={product.imageUrls[0] || 'https://placehold.co/800x800/indigo/white?text=IUH+Exchange'} 
               className="w-full h-full object-cover"
               alt={product.title}
             />
          </div>
          {/* Thumbnails if any */}
          {product.imageUrls.length > 1 && (
             <div className="flex gap-4 overflow-x-auto pb-2">
                {product.imageUrls.map((url, i) => (
                  <div key={i} className="w-24 h-24 rounded-2xl border border-slate-200 overflow-hidden cursor-pointer hover:border-indigo-500 transition-all shrink-0">
                    <img src={url} className="w-full h-full object-cover" />
                  </div>
                ))}
             </div>
          )}
        </motion.div>

        {/* Info Area */}
        <motion.div 
           initial={{ opacity: 0, x: 20 }}
           animate={{ opacity: 1, x: 0 }}
           className="flex flex-col"
        >
          <div className="mb-6">
            <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-black uppercase tracking-widest rounded-full border border-indigo-100">
               {product.category}
            </span>
          </div>

          <h1 className="text-4xl font-black text-slate-900 leading-tight mb-4">
            {product.title}
          </h1>

          <div className="flex items-center gap-4 mb-8">
             <div className="px-3 py-1 bg-rose-50 text-rose-600 rounded-lg text-xs font-bold uppercase border border-rose-100">
                {product.condition}
             </div>
             <span className="text-slate-400 text-sm">Đăng lúc: {new Date(product.createdAt).toLocaleDateString()}</span>
          </div>

          <div className="bg-indigo-50/50 p-6 rounded-3xl border border-indigo-100 mb-8">
             <div className="text-sm text-indigo-400 font-bold uppercase tracking-tighter mb-1">Giá sinh viên</div>
             <div className="text-4xl font-black text-indigo-700">
                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price)}
             </div>
          </div>

          <div className="space-y-4 mb-10">
             <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Package size={20} className="text-slate-400" /> Mô tả chi tiết
             </h3>
             <p className="text-slate-600 leading-relaxed text-lg whitespace-pre-line">
                {product.description}
             </p>
          </div>

          {/* Action Buttons */}
          <div className="mt-auto grid grid-cols-2 gap-4 pt-8">
             {user?.id === product.sellerId ? (
               <>
                 <button 
                   onClick={() => alert("Tính năng chỉnh sửa sẽ cập nhật ở Phase sau!")}
                   className="flex items-center justify-center gap-3 py-5 bg-indigo-50 text-indigo-600 border-2 border-indigo-100 rounded-2xl font-black text-lg hover:bg-indigo-100 transition-all hover:scale-[1.02] active:scale-95"
                 >
                    SỬA TIN
                 </button>
                 <button 
                   onClick={handleDelete}
                   disabled={deleting}
                   className="flex items-center justify-center gap-3 py-5 bg-rose-50 text-rose-600 border-2 border-rose-100 rounded-2xl font-black text-lg hover:bg-rose-100 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                 >
                    <Trash2 size={24} />
                    {deleting ? 'ĐANG GỠ...' : 'GỠ BÀI ĐĂNG'}
                 </button>
               </>
             ) : (
               <>
                 <button 
                   onClick={handleOrder}
                   disabled={ordering}
                   className="flex items-center justify-center gap-3 py-5 bg-slate-900 text-white rounded-2xl font-black text-lg hover:bg-slate-800 transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-slate-200 disabled:opacity-50"
                 >
                    <ShoppingCart size={24} />
                    {ordering ? 'ĐANG XỬ LÝ...' : 'MUA NGAY'}
                 </button>
                 <button 
                   onClick={() => chatService.triggerOpenChat(product.sellerId, `Người bán ${product.sellerId.substring(0, 6)}`)}
                   className="flex items-center justify-center gap-3 py-5 bg-white text-indigo-600 border-2 border-indigo-100 rounded-2xl font-black text-lg hover:bg-indigo-50 transition-all hover:border-indigo-300 hover:scale-[1.02] active:scale-95"
                 >
                    <MessageSquare size={24} />
                    CHAT VỚI NGƯỜI BÁN
                 </button>
               </>
             )}
          </div>

        </motion.div>
      </div>
    </div>
  );
};

export default ProductDetail;
