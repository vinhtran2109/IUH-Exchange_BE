import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, LogIn, ArrowRight, ShieldCheck, Mail, Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';

const Login: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();
  const { login } = useAuthStore();

  // Load saved email on mount
  useEffect(() => {
    const saved = localStorage.getItem('iuh_remembered_email');
    if (saved) {
      setEmail(saved);
      setRememberMe(true);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      const response = await authService.login({ email, password });
      if (response && response.success) {
        const d = response.data;
        const role = d.role || d.user?.role;
        if (role === 'ADMIN') {
          try {
            await authService.logout();
          } catch {
            // Ignore logout errors here; the admin session is not stored in this client state.
          }
          setError('Tài khoản quản trị vui lòng đăng nhập tại /admin/login.');
          return;
        }
        // Save or clear remembered email
        if (rememberMe) {
          localStorage.setItem('iuh_remembered_email', email);
        } else {
          localStorage.removeItem('iuh_remembered_email');
        }
        login({ id: d.userId || d.user?.id, email: d.email || d.user?.email, name: d.name || d.user?.name, role, studentId: d.studentId || d.user?.studentId || '', karmaPoint: d.karmaPoint || d.user?.karmaPoint || 0 }, d.accessToken);
        navigate('/');
      } else {
        setError(response.message || 'Đăng nhập thất bại. Vui lòng thử lại!');
      }
    } catch (err: any) {
      const status = err?.response?.status;
      const apiMessage = err?.response?.data?.message || err?.response?.data?.error || err?.response?.data;

      if (status === 401 || status === 404) {
        setError('Email hoặc mật khẩu không đúng');
      } else if (typeof apiMessage === 'string' && apiMessage.trim()) {
        setError(apiMessage);
      } else {
        setError('Lỗi: Không thể kết nối tới máy chủ. Vui lòng thử lại sau!');
      }
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
              <label className="text-xs font-medium text-slate-600 mb-1.5 block">Email</label>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Mail size={16} />
                </div>
                <input 
                  type="email" 
                  required
                  placeholder="email@student.iuh.edu.vn"
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
                  Quên mật khẩu?
                </Link>
              </div>
              <div className="relative">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock size={16} />
                </div>
                <input 
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="••••••••"
                  className="w-full pl-9 pr-10 py-2.5 rounded-lg border border-slate-200 bg-white focus:border-slate-400 focus:outline-none transition-all text-sm placeholder:text-slate-300"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <div className="relative">
                  <input
                    id="remember-me"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                    rememberMe ? 'bg-slate-900 border-slate-900' : 'border-slate-300 bg-white'
                  }`}>
                    {rememberMe && (
                      <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                </div>
                <span className="text-xs text-slate-600">Ghi nhớ đăng nhập</span>
              </label>
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
              disabled={loading || !email.trim() || password.length < 6}
              className="w-full py-2.5 bg-slate-900 text-white rounded-lg font-medium text-sm hover:bg-slate-800 active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
          &copy; {new Date().getFullYear()} Chợ IUH
        </p>
      </motion.div>
    </div>
  );
};

export default Login;
