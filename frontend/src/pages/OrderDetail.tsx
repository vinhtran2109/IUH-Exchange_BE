import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
   ArrowLeft, ShoppingBag, Clock, CheckCircle2, 
   User, Package, ExternalLink, Check, X
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { orderService } from '../services/orderService';
import { productService } from '../services/productService';

const OrderDetail: React.FC = () => {
   type OrderStatusKey = 'PENDING' | 'AWAITING_SELLER' | 'COMPLETED' | 'CANCELLED';
  const { user } = useAuthStore() as any;
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<any>(null);
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    const fetchDetail = async () => {
      if (!id) return;
      try {
        const res = await orderService.getOrderById(id);
        if (res.success) {
          setOrder(res.data);
          const pRes = await productService.getProductById(res.data.productId);
          if (pRes.success) setProduct(pRes.data);
        }
      } catch (e) { console.error("Lỗi fetch chi tiết đơn hàng", e); }
      finally { setLoading(false); }
    };
    fetchDetail();
  }, [id]);

  const refreshDetail = async () => {
    if (!id) return;
    const res = await orderService.getOrderById(id);
    if (res.success) {
      setOrder(res.data);
      const pRes = await productService.getProductById(res.data.productId);
      if (pRes.success) setProduct(pRes.data);
    }
  };

  const handleConfirm = async () => {
    if (!order) return;
    try {
      setActing(true);
      const res = await orderService.confirmOrder(order.id);
      if (res.success) await refreshDetail();
    } catch (e) {
      alert('Không thể xác nhận đơn hàng lúc này.');
    } finally { setActing(false); }
  };

  const handleReject = async () => {
    if (!order) return;
    const reason = prompt('Lý do từ chối đơn hàng?') || 'Người bán từ chối đơn hàng';
    try {
      setActing(true);
      const res = await orderService.rejectOrder(order.id, reason);
      if (res.success) await refreshDetail();
    } catch (e) {
      alert('Không thể từ chối đơn hàng lúc này.');
    } finally { setActing(false); }
  };

  const isSeller = user?.id && order?.sellerId && user.id === order.sellerId;
  const currentStatus = (order?.status || 'PENDING') as OrderStatusKey;
  const statusLabel: Record<OrderStatusKey, string> = {
    PENDING: 'Đang chờ xử lý',
    AWAITING_SELLER: 'Chờ người bán xác nhận',
    COMPLETED: 'Giao dịch thành công',
    CANCELLED: 'Đã hủy'
  };
  const statusTone: Record<OrderStatusKey, string> = {
    PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
    AWAITING_SELLER: 'bg-blue-50 text-blue-700 border-blue-200',
    COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    CANCELLED: 'bg-red-50 text-red-700 border-red-200'
  };

  if (loading) return <div className="flex items-center justify-center py-40"><div className="w-8 h-8 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin"></div></div>;

  if (!order) return (
    <div className="max-w-3xl mx-auto py-20 text-center">
       <ShoppingBag size={40} className="mx-auto text-slate-300 mb-3" />
       <h2 className="text-lg font-semibold text-slate-800 mb-1">Giao dịch không tồn tại</h2>
       <p className="text-slate-500 text-sm mb-4">Đơn hàng đã bị gỡ hoặc bạn không có quyền xem.</p>
       <button onClick={() => navigate('/profile')} className="px-5 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800">Quay lại</button>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1.5 text-slate-500 hover:text-slate-900 text-sm font-medium mb-6 transition-colors">
         <ArrowLeft size={16} /> Quay lại
      </button>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white">
           <div className="flex items-center justify-between mb-3">
              <span className={`px-2 py-0.5 text-[10px] font-medium rounded border ${statusTone[currentStatus]} bg-white`}>{statusLabel[currentStatus]}</span>
              <span className="text-white/50 text-xs">{new Date(order.createdAt).toLocaleString()}</span>
           </div>
           <h1 className="text-xl font-bold mb-0.5">Chi tiết đơn hàng</h1>
           <div className="text-slate-400 text-sm">#{order.id}</div>
           <div className="mt-3 text-2xl font-bold">{order.price.toLocaleString()}đ</div>
        </div>

        <div className="p-6 space-y-6">
           {/* Product Info */}
           <section>
              <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 mb-3">
                 <Package size={16} className="text-slate-400" /> Sản phẩm
              </h3>
              <div className="flex gap-4 p-4 bg-slate-50 rounded-lg border border-slate-100 items-center">
                 <div className="w-16 h-16 shrink-0 bg-white rounded-lg overflow-hidden border border-slate-200">
                    {product?.imageUrls?.[0] ? <img src={product.imageUrls[0]} alt={product?.title} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-300"><ShoppingBag size={24} /></div>}
                 </div>
                 <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-slate-800 text-sm truncate">{product?.title || 'Đang tải...'}</h4>
                    <p className="text-slate-500 text-xs truncate">{product?.description}</p>
                    <button onClick={() => navigate(`/products/${order.productId}`)} className="text-xs text-slate-500 hover:text-slate-900 mt-1 flex items-center gap-1">
                       Xem bài đăng <ExternalLink size={11}/>
                    </button>
                 </div>
              </div>
           </section>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <section>
                 <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 mb-3">
                    <User size={16} className="text-slate-400" /> Người nhận
                 </h3>
                 <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-sm">
                       <span className="text-slate-500">Họ tên</span>
                       <span className="font-medium text-slate-700">{user?.name}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg text-sm">
                       <span className="text-slate-500">MSSV</span>
                       <span className="font-medium text-slate-700">{user?.studentId}</span>
                    </div>
                 </div>
              </section>

              <section>
                 <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5 mb-3">
                    <Clock size={16} className="text-slate-400" /> Trạng thái
                 </h3>
                 <div className="space-y-4 pl-2">
                  <div className="relative pl-6 before:absolute before:left-[7px] before:top-3 before:bottom-0 before:w-px before:bg-slate-200">
                     <div className="absolute left-0 top-1 w-3.5 h-3.5 bg-emerald-500 rounded-full ring-2 ring-white z-10"></div>
                     <div className="text-sm font-medium text-slate-700">Gửi yêu cầu mua</div>
                     <div className="text-xs text-slate-400">{new Date(order.createdAt).toLocaleString()}</div>
                  </div>
                  <div className="relative pl-6">
                     <div className={`absolute left-0 top-1 w-3.5 h-3.5 rounded-full ring-2 ring-white z-10 ${currentStatus === 'COMPLETED' ? 'bg-emerald-500' : currentStatus === 'CANCELLED' ? 'bg-red-500' : 'bg-blue-500'}`}>
                       {currentStatus === 'COMPLETED' ? <CheckCircle2 size={8} className="text-white m-auto mt-[3px]"/> : currentStatus === 'CANCELLED' ? <X size={8} className="text-white m-auto mt-[3px]"/> : <Clock size={8} className="text-white m-auto mt-[3px]"/>}
                     </div>
                     <div className="text-sm font-medium text-slate-700">
                       {currentStatus === 'COMPLETED' ? 'Hoàn thành' : currentStatus === 'CANCELLED' ? 'Đã hủy' : 'Chờ người bán'}
                     </div>
                     <div className="text-xs text-slate-400">
                       {currentStatus === 'COMPLETED' ? 'Người bán đã xác nhận' : currentStatus === 'CANCELLED' ? 'Đơn đã bị từ chối' : 'Đang chờ xác nhận'}
                     </div>
                  </div>
                 </div>
              </section>
           </div>

           {isSeller && currentStatus !== 'COMPLETED' && currentStatus !== 'CANCELLED' && (
              <section className="pt-4 border-t border-slate-100">
                 <div className="flex items-center justify-between gap-3 flex-col sm:flex-row">
                    <div>
                       <h3 className="text-sm font-semibold text-slate-800">Duyệt đơn hàng</h3>
                       <p className="text-xs text-slate-500">Bạn là người bán. Xác nhận hoặc từ chối yêu cầu mua.</p>
                    </div>
                    <div className="flex gap-2">
                       <button onClick={handleReject} disabled={acting} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-50 text-red-600 border border-red-200 hover:bg-red-100 transition-all disabled:opacity-50 flex items-center gap-1.5">
                          <X size={14} /> Từ chối
                       </button>
                       <button onClick={handleConfirm} disabled={acting} className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700 transition-all disabled:opacity-50 flex items-center gap-1.5">
                          <Check size={14} /> Xác nhận
                       </button>
                    </div>
                 </div>
              </section>
           )}
        </div>
      </motion.div>
    </div>
  );
};

export default OrderDetail;
