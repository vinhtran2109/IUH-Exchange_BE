import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AlertCircle, ArrowRight, Lock, Moon, ShieldCheck, Sun, UserRound } from 'lucide-react';
import { authService } from '../services/authService';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';

const AdminLogin: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated, login } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adminOtp, setAdminOtp] = useState('');
  const [requiresTwoFactor, setRequiresTwoFactor] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Admin Login | IUH Exchange';
  }, []);

  if (isAuthenticated && user?.role === 'ADMIN') {
    return <Navigate to="/admin" replace />;
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await authService.adminLogin({
        email,
        password,
        adminOtp: requiresTwoFactor ? adminOtp : undefined,
      });
      if (!response?.success) {
        setError(response?.message || 'Không thể đăng nhập. Vui lòng kiểm tra lại thông tin.');
        return;
      }

      const data = response.data;
      if (data?.requiresTwoFactor) {
        setRequiresTwoFactor(true);
        setError('Mã OTP quản trị đã được gửi tới email của bạn.');
        return;
      }

      const loggedInUser = data.user || data;
      const role = data.role || loggedInUser?.role;

      if (role !== 'ADMIN') {
        try {
          await authService.logout();
        } catch {
          // Best effort: clear any refresh cookie/session created by the login endpoint.
        }
        setError('Khu vực này chỉ dành cho quản trị viên.');
        return;
      }

      login(
        {
          id: data.userId || loggedInUser.id,
          email: data.email || loggedInUser.email,
          name: data.name || loggedInUser.name,
          role,
          studentId: data.studentId || loggedInUser.studentId || '',
          karmaPoint: data.karmaPoint || loggedInUser.karmaPoint || 0,
          avatarUrl: loggedInUser.avatarUrl,
        },
        data.accessToken
      );
      navigate('/admin', { replace: true });
    } catch (err: any) {
      const apiError = err?.response?.data?.message || err?.response?.data?.error;
      setError(apiError || 'Không thể kết nối đến máy chủ quản trị.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-white grid lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden lg:flex flex-col justify-between overflow-hidden border-r border-slate-200 bg-white px-12 py-10 dark:border-white/10 dark:bg-slate-900">
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_25%_15%,rgba(20,184,166,0.25),transparent_32%),radial-gradient(circle_at_80%_20%,rgba(248,113,113,0.18),transparent_30%)]" />
        <div className="relative z-10 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-lg bg-slate-950 text-white grid place-items-center font-black dark:bg-white dark:text-slate-950">IUH</div>
            <div>
            <div className="text-sm font-semibold text-slate-950 dark:text-white">IUH Exchange</div>
            <div className="text-xs text-slate-400">Administration Console</div>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
            title={theme === 'light' ? 'Chế độ tối' : 'Chế độ sáng'}
          >
            {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
        </div>

        <div className="relative z-10 max-w-xl">
          <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-400/10 px-3 py-1 text-xs font-semibold text-teal-200">
            <ShieldCheck size={14} />
            Secure staff access
          </div>
          <h1 className="text-5xl font-black leading-tight tracking-normal text-slate-950 dark:text-white">
            Trung tâm vận hành riêng cho đội quản trị.
          </h1>
          <p className="mt-5 max-w-lg text-sm leading-6 text-slate-600 dark:text-slate-300">
            Theo dõi kiểm duyệt, tài khoản sinh viên, tố cáo, bài đăng và sức khỏe hệ thống trong một không gian tách biệt khỏi trải nghiệm người dùng.
          </p>
        </div>

        <div className="relative z-10 grid grid-cols-3 gap-3 text-xs text-slate-300">
          {['Moderation', 'User Trust', 'System Health'].map((item) => (
            <div key={item} className="rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3">
              <div className="font-semibold text-white">{item}</div>
              <div className="mt-1 text-slate-500">Admin only</div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-slate-950 text-white dark:bg-white dark:text-slate-950 grid place-items-center font-black">IUH</div>
            <div>
              <div className="font-semibold">IUH Exchange</div>
              <div className="text-xs text-slate-400">Administration Console</div>
            </div>
            </div>
            <button
              onClick={toggleTheme}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
              title={theme === 'light' ? 'Chế độ tối' : 'Chế độ sáng'}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-8 shadow-2xl shadow-slate-200/70 dark:border-white/10 dark:bg-white/[0.06] dark:shadow-black/30">
            <div className="mb-7">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-teal-400 text-slate-950">
                <ShieldCheck size={24} />
              </div>
              <h2 className="text-2xl font-bold text-slate-950 dark:text-white">Đăng nhập quản trị</h2>
              <p className="mt-2 text-sm text-slate-400">Sử dụng tài khoản có vai trò ADMIN để vào bảng điều khiển.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-300">Email quản trị</span>
                <span className="relative block">
                  <UserRound size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    type="email"
                    autoComplete="username"
                    className="w-full rounded-lg border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-950 outline-none transition focus:border-teal-500 dark:border-white/10 dark:bg-slate-950/70 dark:text-white dark:focus:border-teal-300"
                    placeholder="admin@iuh.edu.vn"
                  />
                </span>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-300">Mật khẩu</span>
                <span className="relative block">
                  <Lock size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    type="password"
                    autoComplete="current-password"
                    className="w-full rounded-lg border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-950 outline-none transition focus:border-teal-500 dark:border-white/10 dark:bg-slate-950/70 dark:text-white dark:focus:border-teal-300"
                    placeholder="••••••••"
                  />
                </span>
              </label>

              {requiresTwoFactor && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold text-slate-300">Mã OTP quản trị</span>
                  <span className="relative block">
                    <ShieldCheck size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      value={adminOtp}
                      onChange={(event) => setAdminOtp(event.target.value)}
                      required
                      inputMode="numeric"
                      maxLength={6}
                      className="w-full rounded-lg border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-950 outline-none transition focus:border-teal-500 dark:border-white/10 dark:bg-slate-950/70 dark:text-white dark:focus:border-teal-300"
                      placeholder="123456"
                    />
                  </span>
                </label>
              )}

              {error && (
                <div className="flex items-start gap-2 rounded-lg border border-rose-400/30 bg-rose-400/10 p-3 text-sm text-rose-100">
                  <AlertCircle size={17} className="mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-teal-400 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-teal-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? 'Đang xác thực...' : 'Vào trang quản trị'}
                {!loading && <ArrowRight size={17} />}
              </button>
            </form>

            <div className="mt-6 border-t border-white/10 pt-5 text-center text-xs text-slate-500">
              Khu người dùng ở <Link to="/login" className="font-semibold text-slate-300 hover:text-white">đăng nhập sinh viên</Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

export default AdminLogin;
