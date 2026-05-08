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
        login({ id: d.userId || d.user?.id, email: d.email || d.user?.email, name: d.name || d.user?.name, role: d.role || d.user?.role, studentId: d.studentId || d.user?.studentId || '', karmaPoint: d.karmaPoint || d.user?.karmaPoint || 0 }, d.accessToken);
        navigate('/');
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
    <div className="min-h-screen flex items-center justify-center bg-[radial-gradient(circle_at_top_left,_var(--tw-gradient-stops))] from-indigo-50 via-white to-sky-50 py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Decorative Blur Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-200/20 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-sky-200/20 rounded-full blur-[120px] pointer-events-none"></div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="max-w-md w-full space-y-8 relative z-10"
      >
        <div className="bg-white/70 backdrop-blur-2xl p-8 sm:p-10 rounded-[3rem] shadow-[0_32px_64px_-16px_rgba(79,70,229,0.15)] border border-white/80 relative overflow-hidden">
          {/* Top highlight line */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-gradient-to-r from-transparent via-indigo-500/30 to-transparent"></div>
          
          <div className="text-center mb-12">
            <motion.div 
              initial={{ scale: 0.8, rotate: -10 }}
              animate={{ scale: 1, rotate: -5 }}
              whileHover={{ rotate: 0, scale: 1.05 }}
              transition={{ type: "spring", stiffness: 200 }}
              className="inline-flex items-center justify-center w-24 h-24 rounded-[2rem] bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-2xl shadow-indigo-200 mb-8 cursor-pointer"
            >
              <LogIn size={44} className="ml-1" />
            </motion.div>
            <h1 className="text-4xl font-black text-slate-900 tracking-tight mb-3">Xin chào!</h1>
            <p className="text-slate-500 font-bold flex items-center justify-center gap-2 text-sm uppercase tracking-wider">
              <ShieldCheck size={18} className="text-indigo-500" />
              Portal Sinh Viên IUH
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div className="space-y-2">
              <label className="text-[13px] font-black text-slate-700 ml-1 uppercase tracking-widest">Tài khoản</label>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors duration-300">
                  <UserIcon size={20} />
                </div>
                <input 
                  type="text" 
                  required
                  placeholder="Email hoặc Mã số SV"
                  className="w-full pl-12 pr-5 py-4 rounded-2xl border border-slate-200 bg-white/50 focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 outline-none transition-all duration-300 placeholder:text-slate-300 font-semibold text-slate-700"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-[13px] font-black text-slate-700 uppercase tracking-widest">Mật khẩu</label>
                <Link to="/forgot-password" className="text-xs font-black text-indigo-600 hover:text-indigo-700 transition-colors uppercase tracking-wider">
                  Quên?
                </Link>
              </div>
              <div className="relative group">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-indigo-500 transition-colors duration-300">
                  <Lock size={20} />
                </div>
                <input 
                  type="password" 
                  required
                  placeholder="••••••••"
                  className="w-full pl-12 pr-5 py-4 rounded-2xl border border-slate-200 bg-white/50 focus:bg-white focus:border-indigo-500 focus:ring-8 focus:ring-indigo-500/5 outline-none transition-all duration-300 placeholder:text-slate-300 font-semibold text-slate-700"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </div>

            <AnimatePresence mode="wait">
              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="bg-red-50/50 border border-red-100 p-4 rounded-2xl"
                >
                  <p className="text-red-600 text-xs font-black flex items-center gap-2 italic">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"></span>
                    {error}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            <button 
              type="submit"
              disabled={loading}
              className="w-full relative py-4 bg-indigo-600 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-xl shadow-indigo-100 hover:shadow-indigo-200 active:scale-[0.98] transition-all duration-300 disabled:opacity-50 overflow-hidden group"
            >
              <div className="relative z-10 flex items-center justify-center gap-3">
                {loading ? (
                  <div className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin"></div>
                ) : (
                  <>
                    <span>Đăng nhập</span>
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-indigo-700 to-violet-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </button>
          </form>

          <div className="mt-12 pt-8 border-t border-slate-100 text-center">
            <p className="text-xs text-slate-500 font-black uppercase tracking-widest">
              Bạn mới đến?{' '}
              <Link to="/register" className="text-indigo-600 hover:text-indigo-700 transition-colors ml-1 border-b-2 border-indigo-100 hover:border-indigo-600 pb-0.5">
                Đăng ký ngay
              </Link>
            </p>
          </div>
        </div>
        
        <p className="text-center text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">
          &copy; {new Date().getFullYear()} IUH Exchange Hub • v1.0.2
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
