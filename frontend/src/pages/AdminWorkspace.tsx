import React from 'react';
import { LogOut, Moon, ShieldCheck, Sun } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/authService';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';

interface AdminWorkspaceProps {
  children: React.ReactNode;
}

const AdminWorkspace: React.FC<AdminWorkspaceProps> = ({ children }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Admin logout failed', error);
    } finally {
      logout();
      navigate('/admin/login', { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-[1500px] items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-lg bg-slate-950 text-sm font-black text-white">IUH</div>
            <div>
              <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
                <ShieldCheck size={16} className="text-teal-600" />
                Admin Console
              </div>
              <div className="text-xs text-slate-500">Không gian quản trị độc lập</div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900 dark:hover:bg-slate-800"
              title={theme === 'light' ? 'Chế độ tối' : 'Chế độ sáng'}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>
            <div className="hidden text-right sm:block">
              <div className="text-sm font-semibold text-slate-800">{user?.name || 'Administrator'}</div>
              <div className="text-xs text-slate-500">{user?.email}</div>
            </div>
            <button
              onClick={handleLogout}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600"
              title="Đăng xuất"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1500px] px-0 sm:px-2">{children}</main>
    </div>
  );
};

export default AdminWorkspace;
