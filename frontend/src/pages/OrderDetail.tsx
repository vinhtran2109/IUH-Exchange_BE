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
import { useToast } from '../components/Toast';
import { usePrompt } from '../components/Dialogs';

type OrderStatusKey = 'PENDING' | 'AWAITING_SELLER' | 'COMPLETED' | 'CANCELLED';
type PaymentStatusKey = 'UNPAID' | 'PAID' | 'REFUNDED';
type PaymentDisplayStatusKey = PaymentStatusKey | 'REPORTED';

const OrderDetail: React.FC = () => {
  const { user } = useAuthStore() as any;
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { error: toastError } = useToast();
  const { prompt } = usePrompt();

  const [order, setOrder] = useState<any>(null);
  const [product, setProduct] = useState<any>(null);
  const [payment, setPayment] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [flashMessage, setFlashMessage] = useState<string | null>((location.state as any)?.flashMessage || null);
  const [handoverLocation, setHandoverLocation] = useState('');
  const [handoverTime, setHandoverTime] = useState('');
  const [handoverNote, setHandoverNote] = useState('');
  const [handoverCode, setHandoverCode] = useState('');
  const [handoverProofUrl, setHandoverProofUrl] = useState('');
  const [handoverProofNote, setHandoverProofNote] = useState('');
  const [disputeReason, setDisputeReason] = useState('');
  const [evidenceUrl, setEvidenceUrl] = useState('');
  const [evidenceNote, setEvidenceNote] = useState('');
  const [paymentIssueReason, setPaymentIssueReason] = useState('');
  const [noShowReason, setNoShowReason] = useState('');
  const [noShowEvidenceUrl, setNoShowEvidenceUrl] = useState('');
  const initialOrder = (location.state as any)?.initialOrder || null;

  const fetchDetail = async (silent = false) => {
    if (!id) return;
    if (!silent) setLoading(true);
    try {
      let res: any = null;
      let lastError: any = null;

      for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
          res = await orderService.getOrderById(id);
          lastError = null;
          break;
        } catch (error: any) {
          lastError = error;
          const isTransientMissing = error?.response?.status === 404 && attempt < 3;
          if (!isTransientMissing) break;
          await new Promise((resolve) => window.setTimeout(resolve, 450 * (attempt + 1)));
        }
      }

      if (lastError) throw lastError;
      if (res.success) {
        const currentOrder = res.data;
        setOrder(currentOrder);

        const [productRes, paymentRes] = await Promise.allSettled([
          productService.getProductById(currentOrder.productId),
          orderService.getPaymentDetails(id),
        ]);

        if (productRes.status === 'fulfilled' && productRes.value.success) setProduct(productRes.value.data);
        if (paymentRes.status === 'fulfilled' && paymentRes.value.success) setPayment(paymentRes.value.data);
      }
    } catch (error) {
      if (!order && initialOrder) {
        setOrder(initialOrder);
      }
      console.error('Lỗi lấy chi tiết đơn hàng', error);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    if (initialOrder) {
      setOrder(initialOrder);
    }
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
      toastError('Không thể xác nhận đơn hàng lúc này.');
    } finally {
      setActing(false);
    }
  };

  const handleReject = async () => {
    if (!order) return;
    const reason = await prompt({
      title: 'Từ chối đơn hàng',
      message: 'Vui lòng cho biết lý do từ chối.',
      placeholder: 'Lý do từ chối...',
      confirmText: 'Từ chối đơn',
    });
    // Nếu người dùng thoát dialog (bấm Hủy), reason === null => dừng lại
    if (reason === null) return;
    try {
      setActing(true);
      const res = await orderService.rejectOrder(order.id || order._id, reason.trim() || 'Người bán từ chối đơn hàng');
      if (res.success) {
        await fetchDetail(true);
      }
    } catch {
      toastError('Không thể từ chối đơn hàng lúc này.');
    } finally {
      setActing(false);
    }
  };

  const handleCancel = async () => {
    if (!order) return;
    const reason = await prompt({
      title: 'Hủy đơn hàng',
      message: 'Vui lòng cho biết lý do hủy đơn hàng này.',
      placeholder: 'Nhập lý do hủy (ví dụ: Không còn nhu cầu, đổi ý...)...',
      confirmText: 'Hủy đơn',
    });
    // Nếu người dùng thoát dialog (bấm Hủy / nhấn ngoài), reason === null => không hủy đơn
    if (reason === null) return;
    try {
      setActing(true);
      const res = await orderService.cancelOrder(order.id || order._id, reason.trim() || 'Người mua hủy đơn hàng');
      if (res.success) {
        // Refetch để cập nhật trạng thái sản phẩm về Available
        await fetchDetail(true);
      }
    } catch {
      toastError('Không thể hủy đơn hàng lúc này.');
    } finally {
      setActing(false);
    }
  };

  const handleReportTransfer = async () => {
    if (!order) return;
    try {
      setActing(true);
      const res = await orderService.reportBankTransfer(order.id || order._id, {
        note: 'Người mua báo đã chuyển khoản trực tiếp từ chi tiết đơn',
      });
      if (res.success) {
        setFlashMessage('Đã ghi nhận báo chuyển khoản. Người bán sẽ xác nhận sau khi nhận tiền.');
        await fetchDetail(true);
      }
    } catch (error: any) {
      toastError(error?.response?.data?.message || 'Không thể báo đã chuyển khoản lúc này.');
    } finally {
      setActing(false);
    }
  };

  const handleConfirmTransfer = async () => {
    if (!order) return;
    try {
      setActing(true);
      const res = await orderService.confirmBankTransfer(order.id || order._id, {
        note: 'Người bán xác nhận đã nhận chuyển khoản trực tiếp',
      });
      if (res.success) {
        setFlashMessage('Đã xác nhận đã nhận tiền chuyển khoản.');
        await fetchDetail(true);
      }
    } catch (error: any) {
      toastError(error?.response?.data?.message || 'Không thể xác nhận nhận tiền lúc này.');
    } finally {
      setActing(false);
    }
  };

  const handleProposeHandover = async () => {
    if (!order || !handoverLocation || !handoverTime) return;
    try {
      setActing(true);
      const res = await orderService.proposeHandover(order.id || order._id, {
        location: handoverLocation,
        time: new Date(handoverTime).toISOString(),
        note: handoverNote,
      });
      if (res.success) {
        setHandoverLocation('');
        setHandoverTime('');
        setHandoverNote('');
        await fetchDetail(true);
      }
    } catch (error: any) {
      toastError(error?.response?.data?.message || 'Không thể đề xuất lịch hẹn.');
    } finally {
      setActing(false);
    }
  };

  const handleRespondHandover = async (proposalId: string, action: 'ACCEPT' | 'REJECT') => {
    if (!order) return;
    try {
      setActing(true);
      const res = await orderService.respondHandover(order.id || order._id, proposalId, action);
      if (res.success) await fetchDetail(true);
    } catch (error: any) {
      toastError(error?.response?.data?.message || 'Không thể phản hồi lịch hẹn.');
    } finally {
      setActing(false);
    }
  };

  const handleConfirmHandover = async () => {
    if (!order) return;
    try {
      setActing(true);
      const res = await orderService.confirmHandover(order.id || order._id, {
        code: handoverCode,
        evidenceUrl: handoverProofUrl,
        note: handoverProofNote,
      });
      if (res.success) {
        setHandoverCode('');
        setHandoverProofUrl('');
        setHandoverProofNote('');
        await fetchDetail(true);
      }
    } catch (error: any) {
      toastError(error?.response?.data?.message || 'Không thể xác nhận giao nhận.');
    } finally {
      setActing(false);
    }
  };

  const handleReportNoShow = async () => {
    if (!order) return;
    const reason = noShowReason.trim() || (isBuyer ? 'Người bán không đến điểm hẹn' : 'Người mua không đến điểm hẹn');
    try {
      setActing(true);
      const res = await orderService.reportNoShow(order.id || order._id, {
        reason,
        evidenceUrl: noShowEvidenceUrl.trim(),
      });
      if (res.success) {
        setNoShowReason('');
        setNoShowEvidenceUrl('');
        setFlashMessage('Đã ghi nhận báo không đến. Đơn đã được hủy và sản phẩm được trả lại trạng thái khả dụng.');
        await fetchDetail(true);
      }
    } catch (error: any) {
      toastError(error?.response?.data?.message || 'Không thể báo không đến lúc này.');
    } finally {
      setActing(false);
    }
  };

  const handleOpenPaymentIssue = async () => {
    if (!order || paymentIssueReason.trim().length < 10) return;
    try {
      setActing(true);
      const res = await orderService.openPaymentIssue(order.id || order._id, paymentIssueReason.trim());
      if (res.success) {
        setPaymentIssueReason('');
        setFlashMessage('Đã mở khiếu nại thanh toán. Admin sẽ xem bằng chứng và xử lý.');
        await fetchDetail(true);
      }
    } catch (error: any) {
      toastError(error?.response?.data?.message || 'Không thể mở khiếu nại thanh toán.');
    } finally {
      setActing(false);
    }
  };

  const handleRefundPayment = async () => {
    if (!order) return;
    try {
      setActing(true);
      const res = await orderService.refundPayment(order.id || order._id);
      if (res.success) {
        setFlashMessage('Đã xử lý hoàn tiền cho đơn hàng.');
        await fetchDetail(true);
      }
    } catch (error: any) {
      toastError(error?.response?.data?.message || 'Không thể hoàn tiền lúc này.');
    } finally {
      setActing(false);
    }
  };

  const handleOpenDispute = async () => {
    if (!order || disputeReason.trim().length < 10) return;
    try {
      setActing(true);
      const res = await orderService.openDispute(order.id || order._id, disputeReason.trim());
      if (res.success) {
        setDisputeReason('');
        await fetchDetail(true);
      }
    } catch (error: any) {
      toastError(error?.response?.data?.message || 'Không thể mở tranh chấp.');
    } finally {
      setActing(false);
    }
  };

  const handleAddEvidence = async () => {
    if (!order || !evidenceUrl.trim()) return;
    try {
      setActing(true);
      const res = await orderService.addDisputeEvidence(order.id || order._id, {
        type: 'OTHER',
        url: evidenceUrl.trim(),
        note: evidenceNote.trim(),
      });
      if (res.success) {
        setEvidenceUrl('');
        setEvidenceNote('');
        await fetchDetail(true);
      }
    } catch (error: any) {
      toastError(error?.response?.data?.message || 'Không thể thêm bằng chứng.');
    } finally {
      setActing(false);
    }
  };

  const isSeller = !!(user?.id && order?.sellerId && user.id === order.sellerId);
  const isBuyer = !!(user?.id && order?.buyerId && user.id === order.buyerId);

  const currentStatus = (order?.status || 'PENDING') as OrderStatusKey;
  const paymentMethod = payment?.paymentMethod || order?.paymentMethod;
  const rawPaymentStatus = (payment?.paymentStatus || order?.paymentStatus || 'UNPAID') as PaymentStatusKey;
  const isBankTransfer = paymentMethod === 'BANK_TRANSFER';
  const isCashPayment = paymentMethod === 'CASH';
  const paymentStatus = (isCashPayment && currentStatus === 'COMPLETED' && rawPaymentStatus === 'UNPAID' ? 'PAID' : rawPaymentStatus) as PaymentStatusKey;
  const transferReported = !!payment?.transferReportedAt;
  const transferConfirmed = !!payment?.transferConfirmedAt;
  const paymentDisplayStatus = (
    paymentStatus === 'UNPAID' && isBankTransfer && transferReported ? 'REPORTED' : paymentStatus
  ) as PaymentDisplayStatusKey;
  const isCompletedButPaymentPending = currentStatus === 'COMPLETED' && isBankTransfer && paymentStatus !== 'PAID';
  const canBuyerReportTransfer = isBuyer && isBankTransfer && currentStatus !== 'COMPLETED' && currentStatus !== 'CANCELLED' && paymentDisplayStatus === 'UNPAID';
  const canSellerConfirmTransfer = isSeller && isBankTransfer && currentStatus !== 'CANCELLED' && paymentDisplayStatus === 'REPORTED';
  const canSellerCompleteOrder = isSeller && currentStatus !== 'COMPLETED' && currentStatus !== 'CANCELLED';

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
  const orderStatusLabel = isCompletedButPaymentPending ? 'Chờ xác nhận thanh toán' : statusLabel[currentStatus];
  const orderStatusTone = isCompletedButPaymentPending
    ? 'bg-blue-50 text-blue-700 border-blue-200'
    : statusTone[currentStatus];

  const paymentLabel: Partial<Record<PaymentDisplayStatusKey, string>> = {
    UNPAID: 'Chưa thanh toán',
    PAID: 'Đã thanh toán',
    REFUNDED: 'Đã hoàn tiền',
  };

  const paymentTone: Partial<Record<PaymentDisplayStatusKey, string>> = {
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
        title: paymentDisplayStatus === 'PAID'
          ? (isCashPayment ? 'Đã thanh toán khi gặp' : 'Đã thanh toán')
          : paymentDisplayStatus === 'REPORTED'
            ? 'Đã báo chuyển khoản'
            : isCashPayment
              ? 'Thanh toán khi gặp'
              : 'Chờ thanh toán',
        subtitle:
          paymentDisplayStatus === 'PAID'
            ? payment?.paidAt
              ? new Date(payment.paidAt).toLocaleString()
              : 'Đã ghi nhận thanh toán'
            : transferReported && payment?.transferReportedAt
              ? `Người mua báo chuyển khoản lúc ${new Date(payment.transferReportedAt).toLocaleString()}`
              : isCashPayment
                ? 'Hai bên thanh toán trực tiếp khi bàn giao sản phẩm.'
                : 'Người mua chuyển khoản trực tiếp cho người bán rồi báo đã chuyển.',
        done: paymentDisplayStatus === 'PAID' || paymentDisplayStatus === 'REPORTED',
      },
      {
        title:
          currentStatus === 'COMPLETED'
            ? 'Người bán đã xác nhận'
            : currentStatus === 'CANCELLED'
              ? 'Đơn hàng đã dừng'
              : 'Chờ người bán xác nhận',
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
    [currentStatus, isCashPayment, order?.createdAt, payment?.paidAt, payment?.transferReportedAt, paymentDisplayStatus, transferReported]
  );

  const nextStep = useMemo(() => {
    if (currentStatus === 'CANCELLED') {
      return { title: 'Đơn đã hủy', body: 'Luồng giao dịch đã dừng. Nếu có vấn đề, hãy mở tranh chấp hoặc liên hệ admin.' };
    }
    if (isCompletedButPaymentPending) {
      return { title: 'Đang chờ người bán xác nhận tiền', body: 'Đơn đã bị đánh dấu hoàn tất nhưng tiền chuyển khoản chưa được xác nhận. Người bán cần bấm Đã nhận tiền để cập nhật thành Đã thanh toán.' };
    }
    if (currentStatus === 'COMPLETED') {
      return { title: 'Giao dịch hoàn tất', body: 'Bạn có thể xem biên nhận, đánh giá người bán/người mua hoặc mở tranh chấp nếu cần.' };
    }
    if (isBuyer && isBankTransfer && paymentDisplayStatus === 'UNPAID') {
      return { title: 'Bước tiếp theo: chuyển khoản', body: 'Chuyển khoản trực tiếp cho người bán, rồi bấm “Tôi đã chuyển khoản” để người bán xác nhận.' };
    }
    if (isSeller && isBankTransfer && paymentDisplayStatus === 'REPORTED') {
      return { title: 'Bước tiếp theo: xác nhận tiền', body: 'Kiểm tra tài khoản ngân hàng. Nếu đã nhận tiền, bấm “Đã nhận tiền”.' };
    }
    if (!order?.handoverLocation && !order?.meetingProposals?.length) {
      return { title: 'Bước tiếp theo: chốt lịch hẹn', body: 'Một trong hai bên đề xuất địa điểm và thời gian giao nhận trong trường.' };
    }
    if (isSeller) {
      return { title: 'Bước tiếp theo: hoàn tất giao dịch', body: 'Sau khi đã giao hàng và điều kiện thanh toán đã ổn, người bán xác nhận hoàn tất đơn.' };
    }
    return { title: 'Bước tiếp theo: theo dõi phản hồi', body: 'Theo dõi lịch hẹn, thanh toán và thông báo từ người bán tại trang này.' };
  }, [currentStatus, isBankTransfer, isBuyer, isSeller, isCompletedButPaymentPending, order?.handoverLocation, order?.meetingProposals?.length, paymentDisplayStatus]);

  const paymentGuide = useMemo(() => {
    if (paymentStatus === 'REFUNDED') {
      return { title: 'Đơn này đã hoàn tiền', body: 'Không cần thao tác thanh toán thêm.', tone: 'slate' };
    }
    if (paymentStatus === 'PAID') {
      return { title: 'Thanh toán đã xong', body: 'Hai bên chỉ cần hoàn tất bàn giao và người bán xác nhận hoàn tất đơn.', tone: 'emerald' };
    }
    if (paymentDisplayStatus === 'REPORTED') {
      return isSeller
        ? { title: 'Người mua đã báo chuyển khoản', body: 'Kiểm tra tài khoản. Nếu tiền đã vào, bấm Đã nhận tiền.', tone: 'blue' }
        : { title: 'Đã báo chuyển khoản', body: 'Chờ người bán kiểm tra tài khoản và xác nhận đã nhận tiền.', tone: 'blue' };
    }
    if (isBankTransfer) {
      return isBuyer
        ? { title: 'Chuyển khoản cho người bán', body: 'Chuyển đúng số tiền, sau đó bấm Tôi đã chuyển khoản. Bạn không cần làm gì thêm cho tới khi người bán xác nhận.', tone: 'amber' }
        : { title: 'Chờ người mua chuyển khoản', body: 'Khi người mua báo đã chuyển, bạn sẽ thấy nút Đã nhận tiền ở đây.', tone: 'amber' };
    }
    return { title: 'Thanh toán khi gặp', body: 'Hai bên gặp theo lịch hẹn, giao dịch xong thì người bán xác nhận hoàn tất đơn.', tone: 'slate' };
  }, [isBankTransfer, isBuyer, isSeller, paymentDisplayStatus, paymentStatus]);

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
            <span className={`rounded border px-2 py-0.5 text-[10px] font-medium ${orderStatusTone} bg-white`}>
              {orderStatusLabel}
            </span>
            <span className="text-xs text-white/50">{new Date(order.createdAt).toLocaleString()}</span>
          </div>
          <h1 className="mb-1 text-xl font-bold">Chi tiết đơn hàng</h1>
          <div className="text-sm text-slate-400">#{order.id || order._id}</div>
          <div className="mt-3 text-2xl font-bold">{Number(order.price).toLocaleString()}đ</div>
        </div>

        <div className="space-y-6 p-6">
          <section className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <div className="text-sm font-bold text-blue-900">{nextStep.title}</div>
            <p className="mt-1 text-sm text-blue-800">{nextStep.body}</p>
          </section>

          <section className={`rounded-xl border p-4 ${
            paymentGuide.tone === 'emerald'
              ? 'border-emerald-100 bg-emerald-50'
              : paymentGuide.tone === 'blue'
                ? 'border-blue-100 bg-blue-50'
                : paymentGuide.tone === 'amber'
                  ? 'border-amber-100 bg-amber-50'
                  : 'border-slate-200 bg-slate-50'
          }`}>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <div className="mb-1 flex items-center gap-2 text-sm font-black text-slate-900">
                  <CreditCard size={16} />
                  {paymentGuide.title}
                </div>
                <p className="text-sm text-slate-600">{paymentGuide.body}</p>
                {isBankTransfer && (
                  <div className="mt-2 text-xs text-slate-500">
                    {payment?.transferReportedAt && <>Người mua báo chuyển: {new Date(payment.transferReportedAt).toLocaleString()}</>}
                    {payment?.transferConfirmedAt && <> · Người bán xác nhận: {new Date(payment.transferConfirmedAt).toLocaleString()}</>}
                  </div>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {canBuyerReportTransfer && (
                  <button
                    onClick={handleReportTransfer}
                    disabled={acting}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-slate-800 disabled:opacity-50"
                  >
                    {acting ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                    Tôi đã chuyển khoản
                  </button>
                )}
                {canSellerConfirmTransfer && (
                  <button
                    onClick={handleConfirmTransfer}
                    disabled={acting}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-slate-800 disabled:opacity-50"
                  >
                    {acting ? <Loader2 size={14} className="animate-spin" /> : <CreditCard size={14} />}
                    Đã nhận tiền
                  </button>
                )}
                {canSellerCompleteOrder && (
                  <button
                    onClick={handleConfirm}
                    disabled={acting || (isBankTransfer && !transferConfirmed)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
                  >
                    <Check size={14} /> Hoàn tất đơn
                  </button>
                )}
              </div>
            </div>
          </section>

          <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-1 text-xs font-medium text-slate-500">Trạng thái đơn</div>
              <div className="text-sm font-semibold text-slate-800">{orderStatusLabel}</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-1 text-xs font-medium text-slate-500">Thanh toán</div>
              <div className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${paymentDisplayStatus === 'REPORTED' ? 'bg-blue-50 text-blue-700 border-blue-200' : paymentTone[paymentDisplayStatus] || paymentTone.UNPAID}`}>
                {paymentDisplayStatus === 'REPORTED' ? 'Đã báo chuyển khoản' : paymentLabel[paymentDisplayStatus]}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-1 text-xs font-medium text-slate-500">Phương thức</div>
              <div className="text-sm font-semibold text-slate-800">
                {paymentMethod === 'BANK_TRANSFER'
                  ? 'Chuyển khoản trực tiếp'
                  : paymentMethod === 'VNPAY_MOCK'
                  ? 'Thanh toán online'
                  : paymentMethod === 'CASH'
                    ? 'Thanh toán trực tiếp'
                    : 'Chưa chọn'}
              </div>
            </div>
          </section>

          {isBankTransfer && (
            <details className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-slate-800">
                Chi tiết chuyển khoản
              </summary>
              <div className="mt-3 grid gap-3 text-sm md:grid-cols-3">
                <div>
                  <div className="text-xs font-medium text-slate-500">Người mua báo chuyển</div>
                  <div className="font-semibold text-slate-800">
                    {payment?.transferReportedAt ? new Date(payment.transferReportedAt).toLocaleString() : 'Chưa báo'}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500">Người bán xác nhận</div>
                  <div className="font-semibold text-slate-800">
                    {payment?.transferConfirmedAt ? new Date(payment.transferConfirmedAt).toLocaleString() : 'Chưa xác nhận'}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500">Mã giao dịch</div>
                  <div className="break-all font-semibold text-slate-800">{payment?.paymentTransactionId || 'Đang cập nhật'}</div>
                </div>
              </div>
              {payment?.transferProofUrl && (
                <a
                  href={payment.transferProofUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Xem biên nhận chuyển khoản <ExternalLink size={12} />
                </a>
              )}
            </details>
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

          {(isBuyer || isSeller) && currentStatus !== 'CANCELLED' && (
            <section className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Lịch hẹn giao nhận</h3>
              <div className="mb-3 grid gap-2 md:grid-cols-3">
                <input value={handoverLocation} onChange={(e) => setHandoverLocation(e.target.value)} placeholder="Địa điểm trong trường" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <input value={handoverTime} onChange={(e) => setHandoverTime(e.target.value)} type="datetime-local" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <input value={handoverNote} onChange={(e) => setHandoverNote(e.target.value)} placeholder="Ghi chú" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </div>
              <details className="mb-3 rounded-lg border border-slate-200 bg-white p-3">
                <summary className="cursor-pointer text-sm font-bold text-slate-700">Xác nhận bàn giao bằng mã</summary>
                {order.handoverCode && (
                  <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-800">
                    <div className="text-xs font-bold uppercase">Mã bàn giao</div>
                    <div className="mt-1 font-mono text-2xl font-black tracking-widest">{order.handoverCode}</div>
                    <div className="mt-1 text-xs">Mã hết hạn: {order.handoverCodeExpiresAt ? new Date(order.handoverCodeExpiresAt).toLocaleString() : 'Chưa xác định'}</div>
                  </div>
                )}
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  <input value={handoverCode} onChange={(e) => setHandoverCode(e.target.value)} placeholder="Nhập mã bàn giao" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  <input value={handoverProofUrl} onChange={(e) => setHandoverProofUrl(e.target.value)} placeholder="URL ảnh/bằng chứng giao nhận" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  <input value={handoverProofNote} onChange={(e) => setHandoverProofNote(e.target.value)} placeholder="Ghi chú giao nhận" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </div>
              </details>
              <div className="mb-4 flex flex-wrap gap-2">
                <button onClick={handleProposeHandover} disabled={acting || !handoverLocation || !handoverTime} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Đề xuất lịch hẹn</button>
                <button onClick={handleConfirmHandover} disabled={acting || (!!order.handoverCode && !handoverCode)} className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-700 disabled:opacity-50">Tôi đã giao/nhận</button>
              </div>
              {(order.meetingProposals || []).slice(-3).map((proposal: any) => (
                <div key={proposal._id} className="mb-2 rounded-lg border border-slate-200 bg-white p-3 text-sm">
                  <div className="font-bold text-slate-800">{proposal.location} - {new Date(proposal.time).toLocaleString()}</div>
                  <div className="mt-1 text-xs text-slate-500">Trạng thái: {proposal.status}</div>
                  {proposal.note && <div className="mt-1 text-xs text-slate-500">{proposal.note}</div>}
                  {proposal.status === 'PENDING' && proposal.proposedBy !== user?.id && (
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => handleRespondHandover(proposal._id, 'ACCEPT')} className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white">Chấp nhận</button>
                      <button onClick={() => handleRespondHandover(proposal._id, 'REJECT')} className="rounded bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600">Từ chối</button>
                    </div>
                  )}
                </div>
              ))}
            </section>
          )}

          {(isBuyer || isSeller) && (
            <details className="rounded-xl border border-slate-200 bg-white p-4">
              <summary className="cursor-pointer text-sm font-bold text-slate-800">Hỗ trợ khi có vấn đề</summary>
              <div className="mt-4 space-y-4">
                {currentStatus !== 'CANCELLED' && currentStatus !== 'COMPLETED' && (
                  <div className="rounded-xl border border-rose-100 bg-rose-50 p-4">
                    <h3 className="mb-2 text-sm font-semibold text-rose-900">Báo không đến điểm hẹn</h3>
                    <p className="mb-3 text-xs text-rose-700">Chỉ dùng khi bên còn lại không đến theo lịch đã hẹn.</p>
                    <div className="mb-3 grid gap-2 md:grid-cols-2">
                      <input value={noShowReason} onChange={(e) => setNoShowReason(e.target.value)} placeholder="Lý do không đến" className="rounded-lg border border-rose-100 px-3 py-2 text-sm" />
                      <input value={noShowEvidenceUrl} onChange={(e) => setNoShowEvidenceUrl(e.target.value)} placeholder="URL bằng chứng nếu có" className="rounded-lg border border-rose-100 px-3 py-2 text-sm" />
                    </div>
                    <button onClick={handleReportNoShow} disabled={acting} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Báo không đến và hủy đơn</button>
                  </div>
                )}

                {(isBankTransfer || paymentStatus === 'PAID') && (
                  <div className="rounded-xl border border-amber-100 bg-amber-50 p-4">
                    <h3 className="mb-2 text-sm font-semibold text-amber-900">Khiếu nại thanh toán</h3>
                    {currentStatus === 'CANCELLED' && paymentStatus === 'PAID' && (
                      <button onClick={handleRefundPayment} disabled={acting} className="mb-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Hoàn tiền đơn đã hủy</button>
                    )}
                    {payment?.paymentIssueStatus === 'OPEN' || order.paymentIssueStatus === 'OPEN' ? (
                      <div className="rounded-lg bg-white/70 p-3 text-sm text-amber-800">
                        Khiếu nại đang mở: {payment?.paymentIssueReason || order.paymentIssueReason}
                      </div>
                    ) : (
                      <>
                        <textarea value={paymentIssueReason} onChange={(e) => setPaymentIssueReason(e.target.value)} rows={2} placeholder="Ví dụ: Người mua đã chuyển nhưng người bán chưa xác nhận, hoặc cần hoàn tiền..." className="mb-3 w-full rounded-lg border border-amber-100 px-3 py-2 text-sm" />
                        <button onClick={handleOpenPaymentIssue} disabled={acting || paymentIssueReason.trim().length < 10} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Mở khiếu nại thanh toán</button>
                      </>
                    )}
                  </div>
                )}

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="mb-3 text-sm font-semibold text-slate-800">Tranh chấp & bằng chứng</h3>
                  {order.disputeStatus === 'OPEN' ? (
                    <>
                      <div className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">Tranh chấp đang mở: {order.disputeReason}</div>
                      <div className="mb-3 grid gap-2 md:grid-cols-2">
                        <input value={evidenceUrl} onChange={(e) => setEvidenceUrl(e.target.value)} placeholder="URL bằng chứng" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                        <input value={evidenceNote} onChange={(e) => setEvidenceNote(e.target.value)} placeholder="Ghi chú bằng chứng" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                      </div>
                      <button onClick={handleAddEvidence} disabled={acting || !evidenceUrl} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">Thêm bằng chứng</button>
                      {(order.disputeEvidence || []).map((item: any) => (
                        <a key={item._id} href={item.url} target="_blank" rel="noreferrer" className="mt-2 block rounded-lg border border-slate-100 bg-slate-50 p-2 text-xs text-slate-600 hover:text-slate-900">{item.note || item.type}: {item.url}</a>
                      ))}
                    </>
                  ) : (
                    <>
                      <textarea value={disputeReason} onChange={(e) => setDisputeReason(e.target.value)} rows={2} placeholder="Lý do tranh chấp, tối thiểu 10 ký tự" className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                      <button onClick={handleOpenDispute} disabled={acting || disputeReason.trim().length < 10} className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-bold text-red-600 disabled:opacity-50">Mở tranh chấp</button>
                    </>
                  )}
                </div>
              </div>
            </details>
          )}

          {(isBuyer || isSeller) && currentStatus !== 'COMPLETED' && currentStatus !== 'CANCELLED' && (
            <section className="border-t border-slate-100 pt-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-slate-800">Hủy/từ chối đơn</h3>
                  <p className="text-xs text-slate-500">
                    {isSeller
                      ? 'Chỉ dùng khi hai bên thống nhất không tiếp tục giao dịch.'
                      : 'Chỉ dùng khi bạn chưa muốn tiếp tục giao dịch.'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isBuyer && (
                    <button
                      onClick={handleCancel}
                      disabled={acting}
                      className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition-all hover:bg-red-100 disabled:opacity-50"
                    >
                      <X size={14} /> Hủy đơn
                    </button>
                  )}

                  {isSeller && (
                    <>
                      <button
                        onClick={handleReject}
                        disabled={acting}
                        className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-600 transition-all hover:bg-red-100 disabled:opacity-50"
                      >
                        <X size={14} /> Từ chối
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
