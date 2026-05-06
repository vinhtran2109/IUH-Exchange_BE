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
   type OrderStatusKey = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED';
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
          // Fetch product info
          const pRes = await productService.getProductById(res.data.productId);
          if (pRes.success) setProduct(pRes.data);
        }
      } catch (e) {
        console.error("Lỗi fetch chi tiết đơn hàng", e);
      } finally {
        setLoading(false);
      }
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
         console.error('Lỗi xác nhận đơn', e);
         alert('Không thể xác nhận đơn hàng lúc này.');
      } finally {
         setActing(false);
      }
   };

   const handleReject = async () => {
      if (!order) return;
      const reason = prompt('Lý do từ chối đơn hàng?') || 'Người bán từ chối đơn hàng';
      try {
         setActing(true);
         const res = await orderService.rejectOrder(order.id, reason);
         if (res.success) await refreshDetail();
      } catch (e) {
         console.error('Lỗi từ chối đơn', e);
         alert('Không thể từ chối đơn hàng lúc này.');
      } finally {
         setActing(false);
      }
   };

   const isSeller = user?.id && order?.sellerId && user.id === order.sellerId;
   const currentStatus = (order?.status || 'PENDING') as OrderStatusKey;
   const statusLabel = {
      PENDING: 'Đang chờ xử lý',
      CONFIRMED: 'Chờ người bán xác nhận',
      COMPLETED: 'Giao dịch thành công',
      CANCELLED: 'Đơn hàng đã bị hủy'
   }[currentStatus];

   const statusTone = {
      PENDING: 'bg-amber-50 text-amber-700 border-amber-100',
      CONFIRMED: 'bg-indigo-50 text-indigo-700 border-indigo-100',
      COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      CANCELLED: 'bg-rose-50 text-rose-700 border-rose-100'
   }[currentStatus];

  if (loading) return <div className="max-w-4xl mx-auto py-20 text-center text-slate-400 font-bold uppercase tracking-widest animate-pulse">Đang tải chi tiết giao dịch...</div>;

  if (!order) return (
    <div className="max-w-4xl mx-auto py-20 text-center">
       <div className="w-20 h-20 bg-rose-50 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-rose-100">
          <ShoppingBag size={40} />
       </div>
       <h2 className="text-2xl font-black text-slate-800 mb-4 tracking-tight uppercase italic">Giao dịch không tồn tại!</h2>
       <p className="text-slate-500 mb-8">Có vẻ như mã đơn hàng này đã bị gỡ hoặc bạn không có quyền xem.</p>
       <button onClick={() => navigate('/profile')} className="px-8 py-3 bg-slate-900 text-white rounded-2xl font-bold hover:bg-black transition-all">Quay lại trang cá nhân</button>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-black text-xs uppercase tracking-widest mb-8 transition-colors group">
         <ArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" /> Quay lại
      </button>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-[3rem] border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden"
      >
      <div className="p-8 md:p-12 bg-linear-to-br from-slate-900 to-indigo-950 text-white">
           <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
              <div>
                 <div className="flex items-center gap-3 mb-3">
                    <span className={`px-3 py-1 text-[10px] font-black rounded-lg border uppercase tracking-widest ${statusTone}`}>{statusLabel}</span>
                    <span className="text-white/40 text-xs font-medium">| {new Date(order.createdAt).toLocaleString()}</span>
                 </div>
                 <h1 className="text-3xl md:text-5xl font-black tracking-tighter">CHI TIẾT ĐƠN HÀNG</h1>
                 <div className="mt-2 text-indigo-300 font-bold tracking-tight">Mã đơn: #{order.id}</div>
              </div>
              <div className="bg-white/10 backdrop-blur-xl p-6 rounded-4xl border border-white/20 text-right min-w-50">
                 <div className="text-xs font-black text-indigo-300 uppercase tracking-widest mb-1">TỔNG THANH TOÁN</div>
                 <div className="text-4xl font-black tracking-tighter">{order.price.toLocaleString()}đ</div>
              </div>
           </div>
        </div>

        <div className="p-8 md:p-12 space-y-12">
           {/* Product Info */}
           <section>
              <div className="flex items-center gap-3 mb-8">
                 <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center"><Package size={20}/></div>
                 <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">Thông tin sản phẩm</h3>
              </div>
              
              <div className="flex flex-col md:flex-row gap-8 p-6 bg-slate-50 rounded-[2.5rem] border border-slate-100 items-center">
                 <div className="w-40 h-40 shrink-0 bg-white rounded-3xl overflow-hidden ring-4 ring-white shadow-xl">
                    {product?.imageUrls?.[0] ? <img src={product.imageUrls[0]} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-300"><ShoppingBag size={48} /></div>}
                 </div>
                 <div className="flex-1 text-center md:text-left">
                    <h4 className="text-2xl font-black text-slate-800 mb-2 leading-tight uppercase tracking-tight">{product?.title || 'Sản phẩm đang tải...'}</h4>
                    <p className="text-slate-500 text-sm mb-4 line-clamp-2">{product?.description}</p>
                    <button onClick={() => navigate(`/products/${order.productId}`)} className="inline-flex items-center gap-2 px-6 py-2 bg-white text-indigo-600 rounded-full font-bold text-sm border border-indigo-100 hover:bg-indigo-50 transition-all shadow-sm">
                       Xem bài đăng chính <ExternalLink size={14}/>
                    </button>
                 </div>
              </div>
           </section>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
              <section>
                 <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center"><User size={20}/></div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">Người nhận hàng</h3>
                 </div>
                 <div className="space-y-4 px-2">
                    <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
                       <span className="text-xs font-black text-slate-400 uppercase tracking-widest w-24">Họ và tên</span>
                       <span className="font-bold text-slate-700">{user?.name}</span>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl">
                       <span className="text-xs font-black text-slate-400 uppercase tracking-widest w-24">MSSV</span>
                       <span className="font-bold text-slate-700">{user?.studentId}</span>
                    </div>
                 </div>
              </section>

              <section>
                 <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center"><Clock size={20}/></div>
                    <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">Trạng thái xử lý</h3>
                 </div>
                 <div className="space-y-6 px-4">
                  <div className="relative pl-8 before:absolute before:left-2 before:top-2 before:bottom-0 before:w-0.5 before:bg-slate-100">
                     <div className="absolute left-0 top-1.5 w-4 h-4 bg-emerald-500 rounded-full ring-4 ring-emerald-50 z-10"></div>
                            <div className="font-black text-slate-800 text-sm italic uppercase tracking-tighter">Người mua đã gửi yêu cầu</div>
                     <div className="text-xs text-slate-400 font-medium">{new Date(order.createdAt).toLocaleString()}</div>
                  </div>
                        <div className="relative pl-8">
                            <div className={`absolute left-0 top-1.5 w-4 h-4 rounded-full ring-4 z-10 flex items-center justify-center ${currentStatus === 'COMPLETED' ? 'bg-emerald-500 ring-emerald-50' : currentStatus === 'CANCELLED' ? 'bg-rose-500 ring-rose-50' : 'bg-indigo-500 ring-indigo-50'}`}>
                               {currentStatus === 'COMPLETED' ? <CheckCircle2 size={10} className="text-white"/> : currentStatus === 'CANCELLED' ? <X size={10} className="text-white"/> : <Clock size={10} className="text-white"/>}
                            </div>
                            <div className="font-black text-slate-800 text-sm italic uppercase tracking-tighter">
                               {currentStatus === 'COMPLETED' ? 'Giao dịch thành công' : currentStatus === 'CANCELLED' ? 'Đơn bị hủy' : 'Chờ người bán xác nhận'}
                            </div>
                            <div className="text-xs text-slate-400 font-medium">
                               {currentStatus === 'COMPLETED' ? 'Người bán đã xác nhận đơn' : currentStatus === 'CANCELLED' ? 'Đơn đã bị từ chối hoặc hủy' : 'Người bán chưa chấp nhận đơn này'}
                            </div>
                  </div>
                 </div>
              </section>
           </div>

                {isSeller && currentStatus !== 'COMPLETED' && currentStatus !== 'CANCELLED' && (
                   <section className="pt-4 border-t border-slate-100">
                      <div className="flex items-center justify-between gap-4 flex-col md:flex-row">
                         <div>
                            <h3 className="text-xl font-black text-slate-800 tracking-tight uppercase">Duyệt đơn hàng</h3>
                            <p className="text-sm text-slate-500">Bạn là người bán của sản phẩm này. Hãy xác nhận hoặc từ chối yêu cầu mua.</p>
                         </div>
                         <div className="flex gap-3">
                            <button
                               onClick={handleReject}
                               disabled={acting}
                               className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-black bg-rose-50 text-rose-700 border border-rose-100 hover:bg-rose-100 transition-all disabled:opacity-50"
                            >
                               <X size={16} /> Từ chối
                            </button>
                            <button
                               onClick={handleConfirm}
                               disabled={acting}
                               className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl font-black bg-emerald-600 text-white hover:bg-emerald-700 transition-all disabled:opacity-50"
                            >
                               <Check size={16} /> Xác nhận
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
