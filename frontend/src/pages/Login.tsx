import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, LogIn, ArrowRight, ShieldCheck, User as UserIcon } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await authService.login({ email, password });
      if (response && response.success) {
        const d = response.data;
        const role = d.role || d.user?.role;
        login({ id: d.userId || d.user?.id, email: d.email || d.user?.email, name: d.name || d.user?.name, role, studentId: d.studentId || d.user?.studentId || '', karmaPoint: d.karmaPoint || d.user?.karmaPoint || 0 }, d.accessToken);
        navigate(role === 'ADMIN' ? '/admin' : '/');
      } else {
        setError(response.message || 'Đăng nhập thất bại. Vui lòng thử lại!');
      }
    } catch (err: any) {
      const apiError = err?.response?.data?.message || err?.response?.data?.error || err?.response?.data || (typeof err === 'string' ? err : '');
      setError(apiError || 'Lỗi: Không thể kết nối tới máy chủ. Vui lòng thử lại sau!');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 py-12 px-4">
      <motion.div 
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="max-w-sm w-full"
      >
        <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-sm">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-slate-900 text-white mb-4">
              <LogIn size={24} />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-1">Xin chào!</h1>
            <p className="text-slate-500 text-sm flex items-center justify-center gap-1.5">
              <ShieldCheck size={14} className="text-slate-400" />
              Portal Sinh Viên IUH
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Tài khoản</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <UserIcon size={16} />
                </div>
                <input 
                  type="text" 
                  required
                  placeholder="Email hoặc Mã số SV"
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white focus:border-slate-400 focus:outline-none transition-all text-sm placeholder:text-slate-300"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-medium text-slate-600">Mật khẩu</label>
                <Link to="/forgot-password" className="text-xs font-medium text-slate-500 hover:text-slate-900 transition-colors">
                  Quên?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock size={16} />
                </div>
                <input 
                  type="password" 
                  required
                  placeholder="••••••••"
                  className="w-full pl-9 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white focus:border-slate-400 focus:outline-none transition-all text-sm placeholder:text-slate-300"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="bg-red-50 border border-red-200 p-3 rounded-lg"
                >
                  <p className="text-red-600 text-xs font-medium">{error}</p>
                </motion.div>
              )}
            </AnimatePresence>

            <button 
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-slate-900 text-white rounded-lg font-medium text-sm hover:bg-slate-800 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>Đăng nhập</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500">
              Bạn mới đến?{' '}
              <Link to="/register" className="text-slate-900 font-medium hover:underline">
                Đăng ký ngay
              </Link>
            </p>
          </div>
        </div>
        
        <p className="text-center text-[11px] text-slate-400 mt-4">
          &copy; {new Date().getFullYear()} IUH Campus Exchange
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
