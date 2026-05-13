import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  Flag,
  Heart,
  MessageSquare,
  Package,
  Pencil,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { productService } from '../services/productService';
import { chatService } from '../services/chatService';
import { orderService } from '../services/orderService';
import type { Product } from '../services/productService';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import ReviewSection from '../components/ReviewSection';
import { wishlistService } from '../services/wishlistService';

type PaymentChoice = 'VNPAY_MOCK' | 'CASH';

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
  const [selectedImage, setSelectedImage] = useState(0);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [buyerNote, setBuyerNote] = useState('');
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>('VNPAY_MOCK');
  const [purchaseMessage, setPurchaseMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        if (!id) return;
        const response = await productService.getProductById(id);
        if (response.success) {
          setProduct(response.data);
          setSelectedImage(0);
        }
      } catch (error) {
        console.error('Failed to fetch product:', error);
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
        const res = await api.get(`/orders?productId=${id}&status=COMPLETED&page=1&size=1`);
        if (res.data?.success && res.data?.data?.content?.length > 0) {
          const order = res.data.data.content[0];
          setCompletedOrderId(order.id || order._id);
        }
      } catch {
        // ignore
      }
    };
    checkOrder();
  }, [id, user]);

  useEffect(() => {
    if (!id || !user) return;
    const checkWish = async () => {
      try {
        const res = await wishlistService.check(id);
        if (res.success) setWishlisted(res.data.wishlisted);
      } catch {
        // ignore
      }
    };
    checkWish();
  }, [id, user]);

  const sellerLabel = useMemo(() => {
    if (!product?.sellerId) return 'người bán';
    return `người bán ${String(product.sellerId).substring(0, 6)}`;
  }, [product?.sellerId]);

  const handleToggleWishlist = async () => {
    if (!user) {
      alert('Bạn cần đăng nhập!');
      return;
    }
    try {
      const res = await wishlistService.toggle(id!);
      if (res.success) setWishlisted(res.data.wishlisted);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async () => {
    if (!id || !window.confirm('Bạn có chắc chắn muốn gỡ bài đăng này?')) return;
    try {
      setDeleting(true);
      const response = await productService.deleteProduct(id);
      if (response.success) {
        alert('Gỡ bài thành công!');
        navigate('/');
      }
    } catch {
      alert('Lỗi khi xóa bài.');
    } finally {
      setDeleting(false);
    }
  };

  const handleReport = async () => {
    if (!user) {
      alert('Bạn cần đăng nhập để tố cáo!');
      return;
    }
    const reason = prompt('Lý do tố cáo sản phẩm này:');
    if (!reason || reason.length < 5) return;
    try {
      await api.post('/reports', { targetType: 'PRODUCT', targetId: id, reason });
      alert('Đã gửi tố cáo. Admin sẽ xem xét sớm.');
    } catch (err: any) {
      alert('Lỗi: ' + (err.response?.data?.message || 'Không thể gửi tố cáo'));
    }
  };

  const openPurchaseFlow = () => {
    if (!product) return;
    if (!user) {
      alert('Bạn cần đăng nhập!');
      navigate('/login');
      return;
    }
    setPurchaseMessage(null);
    setPurchaseOpen(true);
  };

  const handleOrder = async () => {
    if (!product) return;
    try {
      setOrdering(true);
      setPurchaseMessage(null);

      const request = {
        productId: product.id,
        sellerId: product.sellerId || '',
        price: product.price,
        buyerNote: buyerNote.trim(),
        idempotencyKey: window.crypto.randomUUID(),
      };

      const orderResponse = await orderService.createOrder(request);
      const createdOrder = orderResponse.data;
      const orderId = createdOrder?.id || createdOrder?._id;

      if (!orderId) {
        throw new Error('Không lấy được mã đơn hàng');
      }

      if (product.sellerId) {
        chatService.triggerOpenChat(product.sellerId, sellerLabel);
      }

      setPurchaseOpen(false);
      setBuyerNote('');

      if (paymentChoice === 'VNPAY_MOCK') {
        const paymentResponse = await orderService.createPayment(orderId);
        const paymentUrl = paymentResponse.data?.paymentUrl;
        if (!paymentUrl) throw new Error('Không tạo được liên kết thanh toán');
        window.location.href = paymentUrl;
        return;
      }

      navigate(`/orders/${orderId}`, {
        state: { flashMessage: 'Đã tạo yêu cầu mua thành công. Bạn có thể theo dõi tiến độ đơn hàng tại đây.' },
      });
    } catch (error: any) {
      setPurchaseMessage(error.response?.data?.message || error.message || 'Có lỗi xảy ra khi tạo đơn hàng.');
    } finally {
      setOrdering(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="py-40 text-center">
        <AlertCircle size={40} className="mx-auto mb-3 text-slate-300" />
        <h2 className="text-lg font-semibold text-slate-800">Không tìm thấy sản phẩm</h2>
        <Link to="/" className="mt-2 inline-block text-sm text-slate-500 hover:text-slate-900">
          Quay lại trang chủ
        </Link>
      </div>
    );
  }

  const activeImage = product.imageUrls[selectedImage] || product.imageUrls[0] || 'https://placehold.co/800x800/e2e8f0/94a3b8?text=IUH';

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900">
          <ArrowLeft size={16} />
          Quay lại
        </Link>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <div className="aspect-square overflow-hidden rounded-xl border border-slate-200 bg-white">
              <img src={activeImage} className="h-full w-full object-cover" alt={product.title} />
            </div>
            {product.imageUrls.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {product.imageUrls.map((url, index) => (
                  <button
                    key={`${url}-${index}`}
                    type="button"
                    onClick={() => setSelectedImage(index)}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border transition-colors ${
                      selectedImage === index ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <img src={url} className="h-full w-full object-cover" alt={`${product.title} ${index + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col">
            <span className="mb-3 w-fit rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
              {product.category}
            </span>

            <h1 className="mb-3 text-2xl font-bold leading-tight text-slate-900">{product.title}</h1>

            {user && user.id !== product.sellerId && (
              <button onClick={handleToggleWishlist} className="mb-3 flex w-fit items-center gap-1.5 text-sm transition-all">
                <Heart size={16} className={wishlisted ? 'fill-red-500 text-red-500' : 'text-slate-400'} />
                <span className={wishlisted ? 'font-medium text-red-500' : 'text-slate-400'}>
                  {wishlisted ? 'Đã yêu thích' : 'Yêu thích'}
                </span>
              </button>
            )}

            <div className="mb-5 flex items-center gap-3">
              <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{product.condition}</span>
              <span className="text-xs text-slate-400">{new Date(product.createdAt).toLocaleDateString()}</span>
            </div>

            <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="mb-0.5 text-xs font-medium uppercase tracking-wide text-slate-500">Giá</div>
              <div className="text-3xl font-bold text-slate-900">
                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price)}
              </div>
            </div>

            <div className="mb-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-1 text-xs font-medium text-slate-500">Thanh toán</div>
                <div className="text-sm font-semibold text-slate-800">Online hoặc trực tiếp</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-1 text-xs font-medium text-slate-500">Trao đổi</div>
                <div className="text-sm font-semibold text-slate-800">Chat với người bán sau khi tạo đơn</div>
              </div>
            </div>

            <div className="mb-6">
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <Package size={16} className="text-slate-400" /> Mô tả
              </h3>
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{product.description}</p>
            </div>

            <div className="mt-auto space-y-2 border-t border-slate-100 pt-4">
              {user?.id === product.sellerId ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => navigate(`/products/${product.id}/edit`)}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50"
                  >
                    <Pencil size={15} /> Sửa tin
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 py-2.5 text-sm font-medium text-red-600 transition-all hover:bg-red-100 disabled:opacity-50"
                  >
                    <Trash2 size={15} /> {deleting ? 'Đang gỡ...' : 'Gỡ bài'}
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={openPurchaseFlow}
                      disabled={ordering}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white transition-all hover:bg-slate-800 disabled:opacity-50"
                    >
                      <ShoppingCart size={16} /> Mua sản phẩm
                    </button>
                    <button
                      onClick={() => chatService.triggerOpenChat(product.sellerId, sellerLabel)}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50"
                    >
                      <MessageSquare size={16} /> Chat người bán
                    </button>
                  </div>
                  <button onClick={handleReport} className="flex w-full items-center justify-center gap-1 py-2 text-xs font-medium text-slate-400 transition-colors hover:text-red-500">
                    <Flag size={12} /> Tố cáo sản phẩm
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>

        <ReviewSection productId={product.id} orderId={completedOrderId || undefined} />
      </div>

      {purchaseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Xác nhận mua sản phẩm</h2>
                <p className="mt-1 text-sm text-slate-500">Tạo yêu cầu mua và chọn bước thanh toán tiếp theo.</p>
              </div>
              <button onClick={() => setPurchaseOpen(false)} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 px-6 py-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-1 text-sm font-semibold text-slate-900">{product.title}</div>
                <div className="text-sm text-slate-500">Người bán: {sellerLabel}</div>
                <div className="mt-3 text-xl font-bold text-slate-900">
                  {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price)}
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Lời nhắn cho người bán</label>
                <textarea
                  value={buyerNote}
                  onChange={(e) => setBuyerNote(e.target.value)}
                  rows={4}
                  placeholder="Ví dụ: Mình muốn nhận hàng vào chiều mai ở khu A."
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none transition-colors focus:border-slate-400"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Wallet size={16} />
                  <span>Hình thức thanh toán</span>
                </div>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setPaymentChoice('VNPAY_MOCK')}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                      paymentChoice === 'VNPAY_MOCK' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-medium">Thanh toán online</div>
                    <div className={`mt-1 text-xs ${paymentChoice === 'VNPAY_MOCK' ? 'text-slate-200' : 'text-slate-500'}`}>
                      Tạo đơn xong sẽ chuyển sang bước thanh toán mock VNPay.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentChoice('CASH')}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                      paymentChoice === 'CASH' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-medium">Thanh toán khi gặp</div>
                    <div className={`mt-1 text-xs ${paymentChoice === 'CASH' ? 'text-slate-200' : 'text-slate-500'}`}>
                      Tạo đơn trước, trao đổi với người bán, rồi xác nhận hoàn tất sau khi giao dịch xong.
                    </div>
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">
                <div className="mb-1 flex items-center gap-2 font-medium">
                  <ShieldCheck size={16} />
                  <span>Luồng mua sau khi tạo đơn</span>
                </div>
                <ul className="space-y-1 text-blue-700/90">
                  <li>1. Hệ thống giữ sản phẩm cho đơn hàng của bạn.</li>
                  <li>2. Bạn chat với người bán để chốt thời gian và địa điểm.</li>
                  <li>3. Người bán xác nhận khi giao dịch hoàn tất.</li>
                </ul>
              </div>

              {purchaseMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {purchaseMessage}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-5 sm:flex-row">
              <button
                type="button"
                onClick={() => setPurchaseOpen(false)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Để sau
              </button>
              <button
                type="button"
                onClick={handleOrder}
                disabled={ordering}
                className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
              >
                {ordering ? 'Đang tạo đơn...' : paymentChoice === 'VNPAY_MOCK' ? 'Tạo đơn và thanh toán' : 'Tạo đơn hàng'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProductDetail;
