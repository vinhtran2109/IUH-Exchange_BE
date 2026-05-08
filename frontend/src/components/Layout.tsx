import React, { useState, useEffect, useRef } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { 
  Bell, MessageSquare, Search, User as UserIcon, 
  Package, PlusCircle, LogOut, Shield, Clock,
  ShoppingCart, Info, AlertOctagon
} from 'lucide-react';

import { chatService } from '../services/chatService';
import { notificationService } from '../services/notificationService';
import type { Notification } from '../services/notificationService';

const Layout: React.FC = () => {
  const { user, isAuthenticated } = (useAuthStore as any)();
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
    fetchNotifs();

    // Real-time notification via WebSocket
    const removeNotifListener = chatService.addNotificationListener((notif: Notification) => {
      setNotifications(prev => [notif, ...prev]);
    });

    // Fallback polling every 2 minutes (in case WS disconnects)
    const interval = setInterval(fetchNotifs, 120000);
    return () => {
      clearInterval(interval);
      removeNotifListener();
    };
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
    try {
      await notificationService.markAsRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (e) { console.error(e); }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    } catch (e) { console.error(e); }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 selection:bg-indigo-100 selection:text-indigo-900">
      {/* Navigation Bar */}
      <nav className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white font-bold text-xl shadow-lg shadow-indigo-100 ring-2 ring-indigo-50">IUH</div>
            <span className="font-bold text-xl tracking-tight hidden sm:block bg-gradient-to-r from-indigo-700 to-indigo-500 bg-clip-text text-transparent">Campus Exchange</span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden lg:flex items-center gap-6 ml-8">
            <Link to="/" className="text-sm font-black text-slate-600 hover:text-indigo-600 transition-colors uppercase tracking-tight">Cửa hàng</Link>
            <Link to="/lost-found" className="text-sm font-black text-slate-600 hover:text-indigo-600 transition-colors uppercase tracking-tight">Đồ thất lạc</Link>
          </div>

          {/* Search Bar */}
          <div className="hidden md:flex flex-1 max-w-md mx-8">
            <div className="relative w-full group">
              <span className="absolute inset-y-0 left-3 flex items-center text-slate-400 group-focus-within:text-indigo-500 transition-colors">
                <Search size={18} />
              </span>
              <input
                type="text"
                placeholder="Tìm kiến sản phẩm..."
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    window.location.href = `/products?search=${encodeURIComponent(e.currentTarget.value)}`;
                  }
                }}
                className="w-full bg-slate-100 pl-10 pr-4 py-2 rounded-full border border-transparent focus:border-indigo-200 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-100/50 transition-all text-sm"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            {isAuthenticated ? (
              <>
                {/* Notification Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <button 
                    onClick={() => {
                        setShowNotifications(!showNotifications);
                        if (unreadCount > 0 && !showNotifications) {
                           // Option: fetch on open
                        }
                    }}
                    className={`p-2 rounded-full transition-all relative ${showNotifications ? 'bg-indigo-50 text-indigo-600' : 'text-slate-500 hover:text-indigo-600 hover:bg-slate-100'}`}
                  >
                      <Bell size={20} />
                      {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 w-4 h-4 bg-rose-500 text-white text-[10px] font-black rounded-full border-2 border-white flex items-center justify-center animate-bounce">
                           {unreadCount > 9 ? '9+' : unreadCount}
                        </span>
                      )}
                  </button>

                  {showNotifications && (
                    <div className="absolute right-0 mt-4 w-80 bg-white rounded-[2rem] border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 origin-top-right ring-4 ring-slate-100/50">
                       <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                          <h4 className="font-black text-slate-800 text-sm uppercase tracking-wider">Thông báo</h4>
                          <button onClick={handleMarkAllRead} className="text-[10px] font-black text-indigo-600 uppercase hover:underline">Đã đọc hết</button>
                       </div>
                       <div className="max-h-[350px] overflow-y-auto scrollbar-hide">
                          {notifications.length === 0 ? (
                            <div className="p-10 text-center text-slate-400 italic text-sm">Chưa có thông báo nào.</div>
                          ) : (
                            notifications.map(n => (
                              <div 
                                key={n.id} 
                                onMouseDown={(e) => {
                                  // Chặn đứng mọi sự kiện đóng cửa sổ khác
                                  e.stopPropagation();
                                  e.nativeEvent.stopImmediatePropagation();
                                  
                                  console.log("🔥 [CRITICAL DEBUG] Bắt được sự kiện MouseDown!", n.id);
                                  
                                  if (n.targetId && n.type && n.type.includes('ORDER')) {
                                    console.log("🚀 [FORCE] Chuyển hướng ngay lập tức:", n.targetId);
                                    window.location.href = `/orders/${n.targetId}`;
                                    setShowNotifications(false);
                                  } else {
                                    handleMarkRead(n.id);
                                    setShowNotifications(false);
                                  }
                                }}
                                className="block p-4 border-b border-slate-50 cursor-pointer transition-colors hover:bg-slate-100 bg-white relative"
                                style={{ pointerEvents: 'auto', zIndex: 10000, minHeight: '60px' }}
                              >
                                 <div className="flex gap-3 pointer-events-none">
                                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${n.type && n.type.includes('ORDER') ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                       {n.type === 'KARMA_UPDATE' ? <AlertOctagon size={16}/> : (n.type && n.type.includes('ORDER')) ? <ShoppingCart size={16}/> : <Info size={16}/>}
                                    </div>
                                    <div>
                                       <p className="text-xs font-bold text-slate-800 leading-tight mb-1">{n.message}</p>
                                       <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-medium tracking-tight">
                                          <Clock size={12}/> {n.createdAt ? new Date(n.createdAt).toLocaleString() : 'Vừa xong'}
                                          {!n.read && <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full"></span>}
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

                <button onClick={() => chatService.triggerOpenChat('list', 'Hộp thư')} className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all relative group">
                    <MessageSquare size={20} className="group-hover:scale-110 transition-transform" />
                    <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-indigo-600 rounded-full border border-white"></span>
                </button>

                <Link to="/products/new" className="hidden sm:flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-full font-medium hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 hover:-translate-y-0.5 active:translate-y-0">
                    <PlusCircle size={18} />
                    <span>Đăng bán</span>
                </Link>

                {user?.role === 'ADMIN' && (
                  <Link to="/admin" className="hidden sm:flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-600 border border-amber-200 rounded-full font-bold hover:bg-amber-100 hover:text-amber-700 transition-all shadow-sm">
                      <Shield size={18} />
                      <span>Admin</span>
                  </Link>
                )}
                
                <Link to="/profile" className="flex items-center gap-3 pl-4 border-l border-slate-200 ml-2 group cursor-pointer relative py-2">
                    <div className="text-right hidden sm:block">
                        <p className="text-sm font-semibold text-slate-800 line-clamp-1 leading-none mb-1 group-hover:text-indigo-600 transition-colors uppercase tracking-tight">{user?.name}</p>
                        <div className="flex items-center justify-end gap-1.5 px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100 group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-100 transition-all">
                            <Package size={12} strokeWidth={3} />
                            <span className="text-[10px] font-bold tracking-wider uppercase leading-none">{user?.karmaPoint} Karma</span>
                        </div>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-slate-200 border-2 border-white overflow-hidden shadow-sm group-hover:border-indigo-300 group-hover:ring-4 group-hover:ring-indigo-50 transition-all">
                        {user?.avatarUrl ? <img src={user.avatarUrl} alt="avatar" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-indigo-100 text-indigo-600"><UserIcon size={20} /></div>}
                    </div>
                </Link>

                <button 
                  onClick={() => { localStorage.clear(); window.location.href = '/login'; }}
                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-full transition-all"
                  title="Đăng xuất"
                >
                    <LogOut size={20} />
                </button>
              </>
            ) : (
              <Link to="/login" className="px-6 py-2 bg-indigo-600 text-white rounded-full font-semibold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100">Đăng nhập</Link>
            )}
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>

      <footer className="bg-white border-t border-slate-200 mt-auto py-12">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold text-sm">IUH</div>
              <span className="font-bold text-xl tracking-tight text-indigo-900">Exchange</span>
            </div>
            <p className="text-slate-500 max-w-sm mb-6 leading-relaxed">Nền tảng mua bán và trao đổi đồ cũ uy tín nhất dành cho cộng đồng sinh viên Đại học Công nghiệp TP.HCM (IUH).</p>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 mb-4">Dịch vụ</h4>
            <ul className="space-y-2 text-slate-600 text-sm">
                <li><Link to="/products" className="hover:text-indigo-600 transition-colors focus:outline-none">Tất cả sản phẩm</Link></li>
                <li><Link to="/lost-found" className="hover:text-indigo-600 transition-colors focus:outline-none">Đồ thất lạc</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="font-bold text-slate-900 mb-4">Hỗ trợ</h4>
            <ul className="space-y-2 text-slate-600 text-sm">
                <li><button onClick={() => alert("Trung tâm hỗ trợ đang được xây dựng")} className="hover:text-indigo-600 transition-colors focus:outline-none">Trung tâm hỗ trợ</button></li>
                <li><button onClick={() => alert("Chính sách bảo mật...")} className="hover:text-indigo-600 transition-colors focus:outline-none">Chính sách bảo mật</button></li>
            </ul>
          </div>
        </div>
        <div className="container mx-auto px-4 mt-8 pt-8 border-t border-slate-100 text-center text-slate-400 text-sm">&copy; 2026 IUH Campus Exchange. Designed for students by Team IUH.</div>
      </footer>
    </div>
  );
};

export default Layout;
