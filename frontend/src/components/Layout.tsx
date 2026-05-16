import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useThemeStore } from '../store/themeStore';
import { 
  Bell, MessageSquare, Search, User as UserIcon, 
  Package, PlusCircle, LogOut, Clock,
  ShoppingCart, Info, AlertOctagon, PackageCheck,
  Sun, Moon
} from 'lucide-react';

import ChatManager from './ChatManager';
import { chatService } from '../services/chatService';
import { normalizeNotification, notificationService } from '../services/notificationService';
import type { Notification } from '../services/notificationService';
import { authService } from '../services/authService';

const Layout: React.FC = () => {
  const { user, isAuthenticated, logout } = (useAuthStore as any)();
  const { theme, toggleTheme } = useThemeStore();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchNotifs = async () => {
    if (!isAuthenticated) return;
    try {
      const res = await notificationService.getNotifications();
      if (res.success) setNotifications(res.data);
    } catch (e) {
      console.error("Lỗi fetch thông báo", e);
    }
  };

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
    });

    const interval = setInterval(fetchNotifs, 120000);
    return () => {
      clearInterval(interval);
      removeNotifListener();
    };
  }, [isAuthenticated]);

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

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <ChatManager />
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white">
        <div className="container mx-auto px-4 h-14 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white font-bold text-xs">IUH</div>
            <span className="font-bold text-base tracking-tight hidden sm:block text-slate-900">Chợ IUH</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden lg:flex items-center gap-5 ml-6">
            <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">Cửa hàng</Link>
            <Link to="/lost-found" className="text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">Đồ thất lạc</Link>
          </div>

          {/* Search Bar */}
          <div className="hidden md:flex flex-1 max-w-sm mx-6">
            <div className="relative w-full">
              <span className="absolute inset-y-0 left-3 flex items-center text-slate-400">
                <Search size={16} />
              </span>
              <input
                type="text"
                placeholder="Tìm kiếm..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    window.location.href = `/products?search=${encodeURIComponent(e.currentTarget.value)}`;
                  }
                }}
                className="w-full bg-slate-50 pl-9 pr-4 py-2 rounded-lg border border-slate-200 focus:border-slate-400 focus:bg-white focus:outline-none transition-all text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Theme Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-50 transition-all"
              title={theme === 'light' ? 'Chế độ tối' : 'Chế độ sáng'}
            >
              {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
            </button>

            {isAuthenticated ? (
              <>
                {/* Notification Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button 
                    onClick={() => {
                        setShowNotifications(!showNotifications);
                    }}
                    className={`p-2 rounded-lg transition-all relative ${showNotifications ? 'bg-slate-100 text-slate-700' : 'text-slate-400 hover:text-slate-700 hover:bg-slate-50'}`}
                  >
                      <Bell size={18} />
                      {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 w-3.5 h-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                           {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                  </button>

                  {showNotifications && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl border border-slate-200 shadow-lg overflow-hidden origin-top-right">
                       <div className="p-3 border-b border-slate-100 flex items-center justify-between">
                          <h4 className="font-semibold text-slate-800 text-sm">Thông báo</h4>
                          <button onClick={handleMarkAllRead} className="text-xs font-medium text-slate-500 hover:text-slate-900">Đã đọc hết</button>
                       </div>
                       <div className="max-h-[350px] overflow-y-auto">
                          {notifications.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-sm">Chưa có thông báo nào.</div>
                          ) : (
                            notifications.map(n => (
                              <div 
                                key={n.id} 
                                onClick={() => {
                                  if (n.id) handleMarkRead(n.id);
                                  if (n.targetId && n.type && n.type.includes('ORDER')) {
                                    navigate(`/orders/${n.targetId}`);
                                  } else if (n.targetId && n.type === 'PRODUCT') {
                                    navigate(`/products/${n.targetId}`);
                                  }
                                  setShowNotifications(false);
                                }}
                                className="block p-3 border-b border-slate-50 cursor-pointer hover:bg-slate-50 transition-colors"
                              >
                                 <div className="flex gap-3">
                                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${n.type && n.type.includes('ORDER') ? 'bg-emerald-50 text-emerald-600' : n.type === 'PRODUCT' ? 'bg-amber-50 text-amber-600' : 'bg-slate-100 text-slate-500'}`}>
                                       {n.type === 'KARMA_UPDATE' ? <AlertOctagon size={14}/> : (n.type && n.type.includes('ORDER')) ? <ShoppingCart size={14}/> : n.type === 'PRODUCT' ? <PackageCheck size={14}/> : <Info size={14}/>}
                                    </div>
                                    <div className="min-w-0">
                                       <p className="text-xs font-medium text-slate-700 leading-snug mb-1 truncate">{n.message}</p>
                                       <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                                          <Clock size={11}/> {n.createdAt ? new Date(n.createdAt).toLocaleString() : 'Vừa xong'}
                                          {!n.isRead && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>}
                                       </div>
                                    </div>
                                 </div>
                              </div>
                            ))
                          )}
                       </div>
                    </div>
                  )}
                </div>

                <button onClick={() => chatService.triggerOpenChat('list', 'Hộp thư')} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-lg transition-all">
                    <MessageSquare size={18} />
                </button>

                <Link to="/products/new" className="hidden sm:flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-all">
                    <PlusCircle size={16} />
                    <span>Đăng bán</span>
                </Link>

                <Link to="/profile" className="flex items-center gap-2.5 pl-3 border-l border-slate-200 ml-1.5 group cursor-pointer py-1.5">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-medium text-slate-700 line-clamp-1 leading-none mb-0.5 group-hover:text-slate-900 transition-colors">{user?.name}</p>
                        <div className="flex items-center justify-end gap-1 px-1.5 py-0.5 bg-slate-50 text-slate-500 rounded text-[10px] font-medium border border-slate-100">
                            <Package size={10} strokeWidth={2.5} />
                            <span className="leading-none">{user?.karmaPoint} Karma</span>
                        </div>
                    </div>
                    <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 overflow-hidden">
                        {user?.avatarUrl ? <img src={user.avatarUrl} alt="avatar" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400"><UserIcon size={16} /></div>}
                    </div>
                </Link>

                <button 
                  onClick={handleLogout}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                  title="Đăng xuất"
                >
                    <LogOut size={18} />
                </button>
              </>
            ) : (
              <Link to="/login" className="px-5 py-1.5 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-all">Đăng nhập</Link>
            )}
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>

      <footer className="bg-white border-t border-slate-200 mt-auto py-10">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-7 h-7 bg-slate-900 rounded-md flex items-center justify-center text-white font-bold text-[10px]">IUH</div>
              <span className="font-bold text-base text-slate-900">Chợ IUH</span>
            </div>
            <p className="text-slate-500 text-sm max-w-sm leading-relaxed">Nền tảng mua bán và trao đổi đồ cũ dành cho cộng đồng sinh viên Đại học Công nghiệp TP.HCM.</p>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 text-sm mb-3">Dịch vụ</h4>
            <ul className="space-y-2 text-slate-500 text-sm">
                <li><Link to="/products" className="hover:text-slate-900 transition-colors">Tất cả sản phẩm</Link></li>
                <li><Link to="/lost-found" className="hover:text-slate-900 transition-colors">Đồ thất lạc</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-slate-900 text-sm mb-3">Hỗ trợ</h4>
            <ul className="space-y-2 text-slate-500 text-sm">
                <li><button onClick={() => alert("Trung tâm hỗ trợ đang được xây dựng")} className="hover:text-slate-900 transition-colors">Trung tâm hỗ trợ</button></li>
                <li><button onClick={() => alert("Chính sách bảo mật...")} className="hover:text-slate-900 transition-colors">Chính sách bảo mật</button></li>
            </ul>
          </div>
        </div>
        <div className="container mx-auto px-4 mt-6 pt-6 border-t border-slate-100 text-center text-slate-400 text-xs">&copy; 2026 Chợ IUH.</div>
      </footer>
    </div>
  );
};

export default Layout;
