import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, ArrowLeft, Send, CheckCircle2 } from 'lucide-react';
import api from '../services/api';

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [step, setStep] = useState<'email' | 'reset'>('email');

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const res = await api.post('/auth/forgot-password', { email });
      if (res.data.success) setStep('reset');
      else setError(res.data.message || 'Không thể gửi mã OTP');
    } catch (err: any) { setError(err?.response?.data?.message || 'Lỗi kết nối server'); }
    finally { setLoading(false); }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault(); setLoading(true); setError('');
    try {
      const res = await api.post('/auth/reset-password', { email, otp, newPassword });
      if (res.data.success) setSent(true);
      else setError(res.data.message || 'Đặt lại mật khẩu thất bại');
    } catch (err: any) { setError(err?.response?.data?.message || 'Lỗi kết nối server'); }
    finally { setLoading(false); }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-sm w-full text-center">
          <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-lg flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 size={24} />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-1">Thành công!</h1>
            <p className="text-slate-500 text-sm mb-5">Mật khẩu đã được đặt lại. Hãy đăng nhập với mật khẩu mới.</p>
            <Link to="/login" className="inline-block w-full py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-all">Đăng nhập</Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="max-w-sm w-full">
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-lg bg-slate-900 text-white mb-3">
              <Mail size={20} />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-1">
              {step === 'email' ? 'Quên mật khẩu?' : 'Đặt lại mật khẩu'}
            </h1>
            <p className="text-slate-500 text-xs">
              {step === 'email' ? 'Nhập email để nhận mã OTP' : 'Nhập mã OTP và mật khẩu mới'}
            </p>
          </div>

          {step === 'email' ? (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">Email</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"><Mail size={16} /></div>
                  <input type="email" required placeholder="user@student.iuh.edu.vn" className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-slate-400 focus:outline-none text-sm" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              {error && <div className="bg-red-50 border border-red-200 p-2.5 rounded-lg"><p className="text-red-600 text-xs">{error}</p></div>}
              <button type="submit" disabled={loading} className="w-full py-2.5 bg-slate-900 text-white rounded-lg font-medium text-sm hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><Send size={14} /><span>Gửi mã OTP</span></>}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">Mã OTP</label>
                <input type="text" required maxLength={6} placeholder="• • • • • •" className="w-full px-4 py-2.5 text-center text-lg tracking-[0.5rem] rounded-lg border border-slate-200 focus:border-slate-400 focus:outline-none" value={otp} onChange={(e) => setOtp(e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 mb-1.5 block">Mật khẩu mới</label>
                <input type="password" required placeholder="••••••••" className="w-full px-3 py-2.5 rounded-lg border border-slate-200 focus:border-slate-400 focus:outline-none text-sm" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
              </div>
              {error && <div className="bg-red-50 border border-red-200 p-2.5 rounded-lg"><p className="text-red-600 text-xs">{error}</p></div>}
              <button type="submit" disabled={loading} className="w-full py-2.5 bg-slate-900 text-white rounded-lg font-medium text-sm hover:bg-slate-800 disabled:opacity-50">
                {loading ? 'Đang xử lý...' : 'Đặt lại mật khẩu'}
              </button>
            </form>
          )}

          <div className="mt-5 pt-4 border-t border-slate-100 text-center">
            <Link to="/login" className="text-xs text-slate-500 hover:text-slate-900 inline-flex items-center gap-1">
              <ArrowLeft size={12} /> Quay lại đăng nhập
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
