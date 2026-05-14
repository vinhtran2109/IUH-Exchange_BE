import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  ExternalLink,
  Loader2,
  Package,
  Receipt,
  ShoppingBag,
  User,
  X,
} from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { orderService } from '../services/orderService';
import { productService } from '../services/productService';

type OrderStatusKey = 'PENDING' | 'AWAITING_SELLER' | 'COMPLETED' | 'CANCELLED';
type PaymentStatusKey = 'UNPAID' | 'PAID' | 'REFUNDED';

const OrderDetail: React.FC = () => {
  const { user } = useAuthStore() as any;
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const [order, setOrder] = useState<any>(null);
  const [product, setProduct] = useState<any>(null);
  const [payment, setPayment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [flashMessage, setFlashMessage] = useState<string | null>((location.state as any)?.flashMessage || null);

  const fetchDetail = async (silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);
    try {
      const res = await orderService.getOrderById(id);
      if (res.success) {
        const currentOrder = res.data;
        setOrder(currentOrder);

        const [productRes, paymentRes] = await Promise.all([
          productService.getProductById(currentOrder.productId),
          orderService.getPaymentDetails(id),
        ]);

        if (productRes.success) setProduct(productRes.data);
        if (paymentRes.success) setPayment(paymentRes.data);
      }
    } catch (error) {
      console.error('Lỗi lấy chi tiết đơn hàng', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDetail();
  }, [id]);

  useEffect(() => {
    if (!flashMessage) return;
    const timer = setTimeout(() => setFlashMessage(null), 5000);
    return () => clearTimeout(timer);
  }, [flashMessage]);

  useEffect(() => {
    if (!order) return;
    if (order.status === 'COMPLETED' || order.status === 'CANCELLED') return;

    const interval = window.setInterval(() => {
      fetchDetail(true);
    }, 7000);

    return () => window.clearInterval(interval);
  }, [order?.status, id]);

  const handleConfirm = async () => {
    if (!order) return;
    try {
      setActing(true);
      const res = await orderService.confirmOrder(order.id || order._id);
      if (res.success) await fetchDetail(true);
    } catch {
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
      const res = await orderService.rejectOrder(order.id || order._id, reason);
      if (res.success) await fetchDetail(true);
    } catch {
      alert('Không thể từ chối đơn hàng lúc này.');
    } finally {
      setActing(false);
    }
  };

  const handleCancel = async () => {
    if (!order) return;
    const reason = prompt('Lý do hủy đơn hàng?') || 'Người mua hủy đơn hàng';
    try {
      setActing(true);
      const res = await orderService.cancelOrder(order.id || order._id, reason);
      if (res.success) await fetchDetail(true);
    } catch {
      alert('Không thể hủy đơn hàng lúc này.');
    } finally {
      setActing(false);
    }
  };

  const handleReportTransfer = async () => {
    if (!order) return;
    try {
      setActing(true);
      const res = await orderService.reportBankTransfer(order.id || order._id, {
        note: 'Buyer reported a direct bank transfer from order detail',
      });
      if (res.success) {
        setFlashMessage('Da ghi nhan bao chuyen khoan. Nguoi ban se xac nhan sau khi nhan tien.');
        await fetchDetail(true);
      }
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Khong the bao da chuyen khoan luc nay.');
    } finally {
      setActing(false);
    }
  };

  const handleConfirmTransfer = async () => {
    if (!order) return;
    try {
      setActing(true);
      const res = await orderService.confirmBankTransfer(order.id || order._id, {
        note: 'Seller confirmed the direct bank transfer',
      });
      if (res.success) {
        setFlashMessage('Da xac nhan nhan tien chuyen khoan.');
        await fetchDetail(true);
      }
    } catch (error: any) {
      alert(error?.response?.data?.message || 'Khong the xac nhan nhan tien luc nay.');
    } finally {
      setActing(false);
    }
  };

  const isSeller = !!(user?.id && order?.sellerId && user.id === order.sellerId);
  const isBuyer = !!(user?.id && order?.buyerId && user.id === order.buyerId);

  const currentStatus = (order?.status || 'PENDING') as OrderStatusKey;
  const paymentStatus = (payment?.paymentStatus || order?.paymentStatus || 'UNPAID') as PaymentStatusKey;
  const isBankTransfer = payment?.paymentMethod === 'BANK_TRANSFER' || order?.paymentMethod === 'BANK_TRANSFER';
  const transferReported = !!payment?.transferReportedAt;
  const transferConfirmed = !!payment?.transferConfirmedAt;

  const statusLabel: Record<OrderStatusKey, string> = {
    PENDING: 'Đang tạo yêu cầu mua',
    AWAITING_SELLER: 'Chờ người bán xác nhận',
    COMPLETED: 'Giao dịch thành công',
    CANCELLED: 'Đã hủy',
  };

  const statusTone: Record<OrderStatusKey, string> = {
    PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
    AWAITING_SELLER: 'bg-blue-50 text-blue-700 border-blue-200',
    COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    CANCELLED: 'bg-red-50 text-red-700 border-red-200',
  };

  const paymentLabel: Record<PaymentStatusKey, string> = {
    UNPAID: 'Chưa thanh toán',
    PAID: 'Đã thanh toán',
    REFUNDED: 'Đã hoàn tiền',
  };

  const paymentTone: Record<PaymentStatusKey, string> = {
    UNPAID: 'bg-amber-50 text-amber-700 border-amber-200',
    PAID: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    REFUNDED: 'bg-slate-100 text-slate-700 border-slate-200',
  };

  const timeline = useMemo(
    () => [
      {
        title: 'Tạo yêu cầu mua',
        subtitle: order?.createdAt ? new Date(order.createdAt).toLocaleString() : 'Đang cập nhật',
        done: true,
      },
      {
        title: paymentStatus === 'PAID' ? 'Da thanh toan' : transferReported ? 'Da bao chuyen khoan' : 'Cho thanh toan',
        subtitle:
          paymentStatus === 'PAID'
            ? payment?.paidAt
              ? new Date(payment.paidAt).toLocaleString()
              : 'Da ghi nhan thanh toan'
            : transferReported && payment?.transferReportedAt
              ? `Buyer reported transfer at ${new Date(payment.transferReportedAt).toLocaleString()}`
              : 'Nguoi mua chuyen khoan truc tiep cho nguoi ban roi bao da chuyen.',
        done: paymentStatus === 'PAID' || transferReported,
      },
      {
        title:
          currentStatus === 'COMPLETED'
            ? 'Nguoi ban da xac nhan'
            : currentStatus === 'CANCELLED'
              ? 'Don hang da dung'
              : 'Cho nguoi ban xac nhan',
        subtitle:
          currentStatus === 'COMPLETED'
            ? 'Giao dịch đã hoàn tất.'
            : currentStatus === 'CANCELLED'
              ? 'Đơn hàng không tiếp tục.'
              : 'Sau khi trao đổi xong, người bán sẽ xác nhận hoàn tất.',
        done: currentStatus === 'COMPLETED',
        danger: currentStatus === 'CANCELLED',
      },
    ],
    [currentStatus, order?.createdAt, payment?.paidAt, payment?.transferReportedAt, paymentStatus, transferReported]
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-3xl py-20 text-center">
        <ShoppingBag size={40} className="mx-auto mb-3 text-slate-300" />
        <h2 className="mb-1 text-lg font-semibold text-slate-800">Giao dịch không tồn tại</h2>
        <p className="mb-4 text-sm text-slate-500">Đơn hàng đã bị gỡ hoặc bạn không có quyền xem.</p>
        <button
          onClick={() => navigate('/profile')}
          className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Quay lại
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <button
        onClick={() => navigate(-1)}
        className="mb-6 flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900"
      >
        <ArrowLeft size={16} /> Quay lại
      </button>

      {flashMessage && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {flashMessage}
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="overflow-hidden rounded-xl border border-slate-200 bg-white"
      >
        <div className="bg-slate-900 p-6 text-white">
          <div className="mb-3 flex items-center justify-between">
            <span className={`rounded border px-2 py-0.5 text-[10px] font-medium ${statusTone[currentStatus]} bg-white`}>
              {statusLabel[currentStatus]}
            </span>
            <span className="text-xs text-white/50">{new Date(order.createdAt).toLocaleString()}</span>
          </div>
          <h1 className="mb-1 text-xl font-bold">Chi tiết đơn hàng</h1>
          <div className="text-sm text-slate-400">#{order.id || order._id}</div>
          <div className="mt-3 text-2xl font-bold">{Number(order.price).toLocaleString()}đ</div>
        </div>

        <div className="space-y-6 p-6">
          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-1 text-xs font-medium text-slate-500">Trạng thái đơn</div>
              <div className="text-sm font-semibold text-slate-800">{statusLabel[currentStatus]}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-1 text-xs font-medium text-slate-500">Thanh toán</div>
              <div className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${paymentTone[paymentStatus]}`}>
                {paymentLabel[paymentStatus]}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-1 text-xs font-medium text-slate-500">Phương thức</div>
              <div className="text-sm font-semibold text-slate-800">
                {payment?.paymentMethod === 'BANK_TRANSFER'
                  ? 'Chuyen khoan truc tiep'
                  : payment?.paymentMethod === 'VNPAY_MOCK'
                  ? 'Thanh toán online'
                  : payment?.paymentMethod === 'CASH'
                    ? 'Thanh toán trực tiếp'
                    : 'Chưa chọn'}
              </div>
            </div>
          </section>

          {isBankTransfer && (
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                <CreditCard size={16} className="text-slate-400" /> Chuyen khoan truc tiep
              </h3>
              <div className="grid gap-3 text-sm md:grid-cols-3">
                <div>
                  <div className="text-xs font-medium text-slate-500">Buyer bao chuyen</div>
                  <div className="font-semibold text-slate-800">
                    {payment?.transferReportedAt ? new Date(payment.transferReportedAt).toLocaleString() : 'Chua bao'}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500">Seller xac nhan</div>
                  <div className="font-semibold text-slate-800">
                    {payment?.transferConfirmedAt ? new Date(payment.transferConfirmedAt).toLocaleString() : 'Chua xac nhan'}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500">Ma giao dich</div>
                  <div className="break-all font-semibold text-slate-800">{payment?.paymentTransactionId || 'Dang cap nhat'}</div>
                </div>
              </div>
              {payment?.transferProofUrl && (
                <a
                  href={payment.transferProofUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Xem bien nhan chuyen khoan <ExternalLink size={12} />
                </a>
              )}
            </section>
          )}

          <section>
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
              <Package size={16} className="text-slate-400" /> Sản phẩm
            </h3>
            <div className="flex items-center gap-4 rounded-lg border border-slate-100 bg-slate-50 p-4">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
                {product?.imageUrls?.[0] ? (
                  <img src={product.imageUrls[0]} alt={product?.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-slate-100 text-slate-300">
                    <ShoppingBag size={24} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="truncate text-sm font-semibold text-slate-800">{product?.title || 'Đang tải...'}</h4>
                <p className="truncate text-xs text-slate-500">{product?.description}</p>
                <button
                  onClick={() => navigate(`/products/${order.productId}`)}
                  className="mt-1 flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900"
                >
                  Xem bài đăng <ExternalLink size={11} />
                </button>
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <section>
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                <User size={16} className="text-slate-400" /> Người mua
              </h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm">
                  <span className="text-slate-500">Họ tên</span>
                  <span className="font-medium text-slate-700">{isBuyer ? user?.name : order.buyerId}</span>
                </div>
                <div className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm">
                  <span className="text-slate-500">Ghi chú</span>
                  <span className="max-w-[60%] text-right font-medium text-slate-700">{order.buyerNote || 'Không có'}</span>
                </div>
              </div>
            </section>

            <section>
              <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-800">
                <Receipt size={16} className="text-slate-400" /> Tiến trình
              </h3>
              <div className="space-y-4 pl-2">
                {timeline.map((item, index) => (
                  <div key={item.title} className={`relative pl-6 ${index < timeline.length - 1 ? 'before:absolute before:bottom-0 before:left-[7px] before:top-3 before:w-px before:bg-slate-200' : ''}`}>
                    <div
                      className={`absolute left-0 top-1 z-10 h-3.5 w-3.5 rounded-full ring-2 ring-white ${
                        item.danger ? 'bg-red-500' : item.done ? 'bg-emerald-500' : 'bg-blue-500'
                      }`}
                    >
                      {item.done ? (
                        <CheckCircle2 size={8} className="m-auto mt-[3px] text-white" />
                      ) : item.danger ? (
                        <X size={8} className="m-auto mt-[3px] text-white" />
                      ) : (
                        <Clock size={8} className="m-auto mt-[3px] text-white" />
                      )}
                    </div>
                    <div className="text-sm font-medium text-slate-700">{item.title}</div>
                    <div className="text-xs text-slate-400">{item.subtitle}</div>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {(isBuyer || isSeller) && (
            <section className="border-t border-slate-100 pt-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Hành động</h3>
                  <p className="text-xs text-slate-500">
                    {isSeller
                      ? 'Nguoi ban xac nhan khi da nhan tien hoac tu choi neu giao dich khong tiep tuc.'
                      : 'Nguoi mua chuyen khoan truc tiep cho nguoi ban, sau do bao da chuyen tren don hang.'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isBuyer && currentStatus !== 'COMPLETED' && currentStatus !== 'CANCELLED' && paymentStatus !== 'PAID' && (
                    <button
                      onClick={handleReportTransfer}
                      disabled={acting || transferReported}
                      className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-slate-800 disabled:opacity-50"
                    >
                      {acting ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                      {transferReported ? 'Da bao chuyen khoan' : 'Toi da chuyen khoan'}
                    </button>
                  )}

                  {isBuyer && currentStatus !== 'COMPLETED' && currentStatus !== 'CANCELLED' && (
                    <button
                      onClick={handleCancel}
                      disabled={acting}
                      className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition-all hover:bg-red-100 disabled:opacity-50"
                    >
                      <X size={14} /> Hủy đơn
                    </button>
                  )}

                  {isSeller && currentStatus !== 'COMPLETED' && currentStatus !== 'CANCELLED' && (
                    <>
                      {isBankTransfer && transferReported && paymentStatus !== 'PAID' && (
                        <button
                          onClick={handleConfirmTransfer}
                          disabled={acting}
                          className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-slate-800 disabled:opacity-50"
                        >
                          {acting ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                          Da nhan tien
                        </button>
                      )}
                      <button
                        onClick={handleReject}
                        disabled={acting}
                        className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition-all hover:bg-red-100 disabled:opacity-50"
                      >
                        <X size={14} /> Từ chối
                      </button>
                      <button
                        onClick={handleConfirm}
                        disabled={acting || (isBankTransfer && !transferConfirmed)}
                        className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
                      >
                        <Check size={14} /> Xác nhận hoàn tất
                      </button>
                    </>
                  )}
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
