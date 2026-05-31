import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { 
  Bell, MessageSquare, Search, User as UserIcon, 
  Package, PlusCircle, LogOut, Clock,
  ShoppingCart, Info, AlertOctagon, PackageCheck,
  Sun, Moon, Star, Zap, Bot
} from 'lucide-react';

import ChatManager from './ChatManager';
import { chatService } from '../services/chatService';
import { normalizeNotification, notificationService } from '../services/notificationService';
import type { Notification } from '../services/notificationService';
import { authService } from '../services/authService';
import api, { refreshAccessToken } from '../services/api';

const Layout: React.FC = () => {
  const { user, isAuthenticated, logout, updateUser } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifs = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const res = await notificationService.getNotifications();
      if (res.success) setNotifications(res.data);
    } catch (e) {
      console.error('Lỗi fetch thông báo', e);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) return;
    chatService.connect();
    fetchNotifs();

    const removeNotifListener = chatService.addNotificationListener((notif: Notification) => {
      const normalized = normalizeNotification(notif);
      setNotifications(prev => {
        const notificationId = normalized.id;
        if (notificationId && prev.some(n => n.id === notificationId)) return prev;
        return [normalized, ...prev];
      });
      if (String(normalized.type || '').toUpperCase().includes('KARMA')) {
        refreshAccessToken()
          .then(() => api.get('/users/me'))
          .then((res) => {
            if (res.data?.success && res.data?.data) updateUser(res.data.data);
          })
          .catch((error) => console.error('Failed to refresh user after karma update', error));
      }
    });

    const interval = setInterval(fetchNotifs, 120000);
    return () => {
      clearInterval(interval);
      removeNotifListener();
    };
  }, [fetchNotifs, updateUser, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated) {
      setNotifications([]);
      setShowNotifications(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkRead = async (id: string) => {
    if (!id) return;
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch (e) { console.error(e); }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (e) { console.error(e); }
  };

  const handleLogout = async () => {
    try {
      await authService.logout();
    } catch (e) {
      console.error('Logout request failed', e);
    } finally {
      logout();
      navigate('/login', { replace: true });
    }
  };

  /* Helper to get notif icon color */
  const notifIconBg = (type?: string) => {
    const t = type?.toUpperCase() || '';
    if (t.includes('ORDER'))   return 'bg-emerald-50 text-emerald-600';
    if (t.includes('PRODUCT')) return 'bg-amber-50 text-amber-600';
    if (t.includes('KARMA'))   return 'bg-purple-50 text-purple-600';
    return 'bg-slate-100 text-slate-500';
  };
  const notifIcon = (type?: string) => {
    const t = type?.toUpperCase() || '';
    if (t.includes('KARMA'))   return <AlertOctagon size={13}/>;
    if (t.includes('ORDER'))   return <ShoppingCart size={13}/>;
    if (t.includes('PRODUCT')) return <PackageCheck size={13}/>;
    if (t.includes('REVIEW'))  return <Star size={13}/>;
    return <Info size={13}/>;
  };

  const getNotifRoute = (n: Notification): string | null => {
    if (n.link) return n.link;
    if (!n.targetId) return null;
    const t = n.type?.toUpperCase() || '';
    if (t.includes('ORDER'))   return `/orders/${n.targetId}`;
    if (t.includes('PRODUCT')) return `/products/${n.targetId}`;
    if (t.includes('LOST'))    return `/lost-found/${n.targetId}`;
    if (t.includes('KARMA'))   return '/karma-history';
    if (t.includes('REPORT'))  return '/my-reports';
    return null;
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="min-h-screen bg-(--background) text-(--foreground)">
      <ChatManager />
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 w-full border-b border-(--border) bg-(--background)">
        <div className="container mx-auto px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 shrink-0">
            <img
              src={encodeURI('/icons/Logo chính thức.png')}
              alt="Chợ IUH"
              className="h-9 w-auto rounded-xl object-contain shadow-md shadow-indigo-200"
              onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/icons/icon-192.png'; }}
            />
            <span className="font-bold text-base tracking-tight hidden sm:block text-slate-900">Chợ IUH</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden lg:flex items-center gap-6 ml-2">
            <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">Trang chủ</Link>
            <Link to="/products" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">Cửa hàng</Link>
            <Link to="/lost-found" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">Đồ thất lạc</Link>
            <Link to="/ai-assistant" className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
              <Bot size={15} />
              AI
            </Link>
          </div>

          {/* Search Bar */}
          <div className="hidden md:flex flex-1 max-w-md mx-4">
            <div className="relative w-full">
              <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                placeholder="Tìm kiếm sản phẩm..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    navigate(`/products?search=${encodeURIComponent(e.currentTarget.value)}`);
                  }
                }}
                className="w-full bg-slate-50 pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-indigo-300 focus:bg-white focus:outline-none transition-all text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-1">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2.5 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
              title={theme === 'light' ? 'Chế độ tối' : 'Chế độ sáng'}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            {isAuthenticated ? (
              <>
                {/* Notification Bell → dropdown + link to /notifications */}
                <div className="relative" ref={dropdownRef}>
                  <button 
                    onClick={() => setShowNotifications(!showNotifications)}
                    className={`p-2.5 rounded-xl transition-all relative ${showNotifications ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-100'}`}
                  >
                    <Bell size={18} />
                    {unreadCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        {unreadCount > 9 ? '9+' : unreadCount}
                      </span>
                    )}
                  </button>

                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-80 bg-(--background) rounded-2xl border border-(--border) shadow-xl overflow-hidden origin-top-right">
                      <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                        <h4 className="font-semibold text-slate-800 text-sm">Thông báo</h4>
                        <div className="flex items-center gap-2">
                          <button onClick={handleMarkAllRead} className="text-xs font-medium text-slate-500 hover:text-slate-900">Đọc hết</button>
                          <span className="text-slate-200">|</span>
                          <button
                            onClick={() => { setShowNotifications(false); navigate('/notifications'); }}
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
                          >
                            Xem tất cả
                          </button>
                        </div>
                      </div>
                      <div className="max-h-90 overflow-y-auto divide-y divide-slate-50">
                        {notifications.length === 0 ? (
                          <div className="p-8 text-center text-slate-400 text-sm">Chưa có thông báo nào.</div>
                        ) : (
                          notifications.slice(0, 8).map(n => (
                            <div 
                              key={n.id} 
                              onClick={() => {
                                if (n.id) handleMarkRead(n.id);
                                const route = getNotifRoute(n);
                                if (route) navigate(route);
                                setShowNotifications(false);
                              }}
                              className={`block p-3 cursor-pointer hover:bg-slate-50 transition-colors ${!n.isRead ? 'bg-indigo-50/40' : ''}`}
                            >
                              <div className="flex gap-2.5">
                                <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${notifIconBg(n.type)}`}>
                                  {notifIcon(n.type)}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-xs font-medium text-slate-700 leading-snug mb-1 line-clamp-2">{n.message}</p>
                                  {getNotifRoute(n) && (
                                    <div className="mt-1 text-[11px] font-semibold text-indigo-600">
                                      Xem chi tiết →
                                    </div>
                                  )}
                                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                    <Clock size={10}/> {n.createdAt ? new Date(n.createdAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : 'Vừa xong'}
                                    {!n.isRead && <span className="ml-1 w-1.5 h-1.5 bg-indigo-500 rounded-full"></span>}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      {notifications.length > 8 && (
                        <div className="p-2.5 border-t border-slate-100 text-center">
                          <button
                            onClick={() => { setShowNotifications(false); navigate('/notifications'); }}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                          >
                            Xem thêm {notifications.length - 8} thông báo →
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <button onClick={() => chatService.triggerOpenChat('list', 'Hộp thư')} className="p-2.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-all">
                  <MessageSquare size={18} />
                </button>

                <Link to="/products/new" className="hidden sm:flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-200">
                  <PlusCircle size={16} />
                  <span>Đăng bán</span>
                </Link>

                {/* User menu */}
                <div className="relative group">
                  <Link to="/profile" className="flex items-center gap-2.5 pl-3 border-l border-slate-200 ml-1 cursor-pointer py-1.5">
                    <div className="text-right hidden sm:block">
                      <p className="text-sm font-semibold text-slate-700 line-clamp-1 leading-none mb-0.5 group-hover:text-slate-900 transition-colors">{user?.name}</p>
                      <div className="flex items-center justify-end gap-1 px-1.5 py-0.5 bg-linear-to-r from-amber-50 to-yellow-50 text-amber-700 rounded text-[10px] font-bold border border-amber-100">
                        <Zap size={9} strokeWidth={2.5} />
                        <span className="leading-none">{user?.karmaPoint} Karma</span>
                      </div>
                    </div>
                    <div className="w-9 h-9 rounded-full bg-linear-to-br from-indigo-100 to-violet-100 border-2 border-white shadow-sm overflow-hidden">
                      {user?.avatarUrl ? <img src={user.avatarUrl} alt="avatar" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-indigo-400"><UserIcon size={18} /></div>}
                    </div>
                  </Link>
                  {/* Dropdown on hover */}
                  <div className="absolute right-0 top-full pt-2 hidden group-hover:block z-50">
                    <div className="bg-(--background) rounded-xl border border-(--border) shadow-lg py-1.5 w-44">
                      <Link to="/profile" className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
                        <UserIcon size={14} /> Hồ sơ
                      </Link>
                      <Link to="/karma-history" className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
                        <Zap size={14} /> Lịch sử Karma
                      </Link>
                      <Link to="/notifications" className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
                        <Bell size={14} /> Thông báo {unreadCount > 0 && <span className="ml-auto text-[10px] font-bold bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full">{unreadCount}</span>}
                      </Link>
                      <Link to="/my-reports" className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors">
                        <Package size={14} /> Báo cáo của tôi
                      </Link>
                      <div className="my-1 border-t border-slate-100" />
                      <button 
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <LogOut size={14} /> Đăng xuất
                      </button>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <Link to="/login" className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all shadow-sm">Đăng nhập</Link>
            )}
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-6 py-8">
        <Outlet />
      </main>

      <footer className="bg-(--surface) border-t border-(--border) mt-auto py-12">
        <div className="container mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <img
                src={encodeURI('/icons/Logo chính thức.png')}
                alt="Chợ IUH"
                className="h-8 w-auto rounded-xl object-contain"
                onError={(e) => { (e.currentTarget as HTMLImageElement).src = '/icons/icon-192.png'; }}
              />
              <span className="font-bold text-base text-slate-900">Chợ IUH</span>
            </div>
            <p className="text-slate-500 text-sm max-w-sm leading-relaxed">Nền tảng mua bán và trao đổi đồ cũ dành cho cộng đồng sinh viên Đại học Công nghiệp TP.HCM.</p>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 text-sm mb-3">Dịch vụ</h4>
            <ul className="space-y-2 text-slate-500 text-sm">
              <li><Link to="/products" className="hover:text-slate-900 transition-colors">Tất cả sản phẩm</Link></li>
              <li><Link to="/lost-found" className="hover:text-slate-900 transition-colors">Đồ thất lạc</Link></li>
              <li><Link to="/products/new" className="hover:text-slate-900 transition-colors">Đăng bán</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 text-sm mb-3">Tài khoản</h4>
            <ul className="space-y-2 text-slate-500 text-sm">
              <li><Link to="/profile" className="hover:text-slate-900 transition-colors">Hồ sơ</Link></li>
              <li><Link to="/karma-history" className="hover:text-slate-900 transition-colors">Lịch sử Karma</Link></li>
              <li><Link to="/notifications" className="hover:text-slate-900 transition-colors">Thông báo</Link></li>
              <li><Link to="/my-reports" className="hover:text-slate-900 transition-colors">Báo cáo của tôi</Link></li>
            </ul>
          </div>
        </div>
        <div className="container mx-auto px-6 mt-8 pt-6 border-t border-slate-200 text-center text-slate-400 text-xs">&copy; 2026 Chợ IUH — Nhóm 6 KTTKPM.</div>
      </footer>
    </div>
  );
};

export default Layout;
