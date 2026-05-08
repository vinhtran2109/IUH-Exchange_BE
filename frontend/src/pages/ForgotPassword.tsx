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
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/forgot-password', { email });
      if (res.data.success) {
        setStep('reset');
      } else {
        setError(res.data.message || 'Không thể gửi mã OTP');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Lỗi kết nối server');
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/auth/reset-password', { email, otp, newPassword });
      if (res.data.success) {
        setSent(true);
      } else {
        setError(res.data.message || 'Đặt lại mật khẩu thất bại');
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Lỗi kết nối server');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] from-indigo-50 via-white to-sky-50 px-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="max-w-md w-full text-center">
          <div className="bg-white/70 backdrop-blur-2xl p-10 rounded-[3rem] shadow-2xl border border-white/80">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 size={40} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 mb-3">Thành công!</h1>
            <p className="text-slate-500 mb-8">Mật khẩu đã được đặt lại. Hãy đăng nhập với mật khẩu mới.</p>
            <Link to="/login" className="inline-block w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all">
              Đăng nhập ngay
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] from-indigo-50 via-white to-sky-50 py-12 px-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-200/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-sky-200/20 rounded-full blur-[120px] pointer-events-none"></div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} className="max-w-md w-full space-y-8 relative z-10">
        <div className="bg-white/70 backdrop-blur-2xl p-8 sm:p-10 rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(79,70,229,0.15)] border border-white/80 relative overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent"></div>
          
          <div className="text-center mb-10">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-[2rem] bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-2xl shadow-indigo-200 mb-6">
              <Mail size={36} />
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight mb-2">
              {step === 'email' ? 'Quên mật khẩu?' : 'Đặt lại mật khẩu'}
            </h1>
            <p className="text-slate-500 text-sm">
              {step === 'email' ? 'Nhập email để nhận mã OTP đặt lại mật khẩu' : 'Nhập mã OTP đã gửi và mật khẩu mới'}
            </p>
          </div>

          {step === 'email' ? (
            <form onSubmit={handleSendOtp} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[13px] font-black text-slate-700 ml-1 uppercase tracking-widest">Email</label>
                <div className="relative group">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                    <Mail size={20} />
                  </div>
                  <input
                    type="email"
                    required
                    placeholder="user@student.iuh.edu.vn"
                    className="w-full pl-12 pr-5 py-4 rounded-2xl border border-slate-200 bg-white/50 focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 outline-none transition-all duration-300 placeholder:text-slate-300 font-semibold text-slate-700"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50/50 border border-red-100 p-4 rounded-2xl">
                  <p className="text-red-600 text-xs font-bold">{error}</p>
                </div>
              )}

              <button type="submit" disabled={loading} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-3">
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <><Send size={18} /><span>Gửi mã OTP</span></>}
              </button>
            </form>
          ) : (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[13px] font-black text-slate-700 ml-1 uppercase tracking-widest">Mã OTP</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="• • • • • •"
                  className="w-full px-5 py-4 text-center text-2xl tracking-[0.8rem] rounded-2xl border border-slate-200 bg-white/50 focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 outline-none transition-all"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <label className="text-[13px] font-black text-slate-700 ml-1 uppercase tracking-widest">Mật khẩu mới</label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full px-5 py-4 rounded-2xl border border-slate-200 bg-white/50 focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 outline-none transition-all font-semibold text-slate-700"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>

              {error && (
                <div className="bg-red-50/50 border border-red-100 p-4 rounded-2xl">
                  <p className="text-red-600 text-xs font-bold">{error}</p>
                </div>
              )}

              <button type="submit" disabled={loading} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 hover:bg-indigo-700 transition-all disabled:opacity-50 flex items-center justify-center gap-3">
                {loading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <span>Đặt lại mật khẩu</span>}
              </button>
            </form>
          )}

          <div className="mt-8 pt-6 border-t border-slate-100 text-center">
            <Link to="/login" className="text-xs text-slate-500 font-bold hover:text-indigo-600 transition-colors inline-flex items-center gap-1">
              <ArrowLeft size={14} /> Quay lại đăng nhập
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default ForgotPassword;
