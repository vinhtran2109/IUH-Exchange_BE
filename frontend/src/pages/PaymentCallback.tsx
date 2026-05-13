import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Receipt, XCircle } from 'lucide-react';
import { orderService } from '../services/orderService';

const PaymentCallback: React.FC = () => {
  const [params] = useSearchParams();
  const orderId = params.get('orderId') || '';
  const transactionId = params.get('transactionId') || '';
  const status = params.get('status') === 'success' ? 'success' : 'failed';

  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [message, setMessage] = useState('Đang xác nhận thanh toán...');

  useEffect(() => {
    const run = async () => {
      if (!orderId || !transactionId) {
        setSuccess(false);
        setMessage('Thiếu thông tin thanh toán.');
        setLoading(false);
        return;
      }

      try {
        const res = await orderService.confirmPaymentCallback(orderId, { transactionId, status });
        setSuccess(status === 'success' && !!res.success);
        setMessage(
          status === 'success'
            ? res.message || 'Thanh toán thành công.'
            : res.message || 'Thanh toán chưa hoàn tất.'
        );
      } catch (error: any) {
        setSuccess(false);
        setMessage(error?.response?.data?.message || 'Không thể xác nhận thanh toán.');
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [orderId, status, transactionId]);

  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex items-center gap-3">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-full ${
              loading ? 'bg-slate-100 text-slate-500' : success ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'
            }`}
          >
            {loading ? <Loader2 size={22} className="animate-spin" /> : success ? <CheckCircle2 size={22} /> : <XCircle size={22} />}
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">
              {loading ? 'Đang xử lý thanh toán' : success ? 'Thanh toán thành công' : 'Thanh toán chưa hoàn tất'}
            </h1>
            <p className="mt-1 text-sm text-slate-500">{message}</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <div className="mb-2 flex items-center gap-2 font-medium text-slate-700">
            <Receipt size={16} />
            <span>Thông tin giao dịch</span>
          </div>
          <div className="space-y-2 text-slate-600">
            <div className="flex items-center justify-between gap-4">
              <span>Mã đơn hàng</span>
              <span className="font-medium text-slate-900">{orderId || '---'}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span>Mã giao dịch</span>
              <span className="font-medium text-slate-900">{transactionId || '---'}</span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            to={orderId ? `/orders/${orderId}` : '/profile'}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800"
          >
            Xem đơn hàng
          </Link>
          <Link
            to="/profile"
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            Về tài khoản
          </Link>
        </div>
      </div>
    </div>
  );
};

export default PaymentCallback;
