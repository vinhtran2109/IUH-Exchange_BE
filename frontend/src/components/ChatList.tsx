import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Search, User, MessageSquare, ArrowRight } from 'lucide-react';
import { chatService } from '../services/chatService';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

interface ChatListProps {
  onClose: () => void;
  onSelectUser: (id: string, name: string) => void;
}

/**
 * Thành phần phụ hiển thị từng người trong danh sách chat
 */
const ChatPartnerItem: React.FC<{ 
    partnerId: string; 
    onSelect: (id: string, name: string) => void 
}> = ({ partnerId, onSelect }) => {
  const [partnerInfo, setPartnerInfo] = useState<{name: string, avatarUrl?: string} | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (partnerId.startsWith('system')) {
        setPartnerInfo({ name: 'IUH Support' });
        setLoading(false);
        return;
    }

    // Gọi API lấy thông tin User từ User Service
    api.get(`/users/${partnerId}`)
      .then(res => {
        if (res.data.success) {
            setPartnerInfo(res.data.data);
        }
      })
      .catch(() => setPartnerInfo({ name: 'Người dùng IUH' })) // Fallback
      .finally(() => setLoading(false));
  }, [partnerId]);

  if (loading) {
    return (
        <div className="flex items-center gap-4 p-3 animate-pulse">
            <div className="w-12 h-12 rounded-2xl bg-slate-100"></div>
            <div className="flex-1 space-y-2">
                <div className="h-4 bg-slate-100 rounded w-1/2"></div>
                <div className="h-3 bg-slate-50 rounded w-1/4"></div>
            </div>
        </div>
    );
  }

  return (
    <button
      onClick={() => onSelect(partnerId, partnerInfo?.name || 'Khách hàng')}
      className="w-full flex items-center gap-4 p-3 hover:bg-indigo-50 rounded-[1.5rem] transition-all group"
    >
      <div className="w-12 h-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm overflow-hidden">
        {partnerInfo?.avatarUrl ? (
            <img src={partnerInfo.avatarUrl} alt="avt" className="w-full h-full object-cover" />
        ) : (
            <User size={24} />
        )}
      </div>
      <div className="flex-1 text-left min-w-0">
        <p className="text-sm font-bold text-slate-800 truncate">
          {partnerInfo?.name || 'Khách hàng'}
        </p>
        <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wider font-bold">
           {partnerId.startsWith('system') ? 'Official' : 'Thành viên'}
        </p>
      </div>
      <div className="p-2 bg-slate-50 rounded-xl text-slate-300 group-hover:bg-white group-hover:text-indigo-600 transition-all">
         <ArrowRight size={14} />
      </div>
    </button>
  );
}

const ChatList: React.FC<ChatListProps> = ({ onClose, onSelectUser }) => {
  const { user } = useAuthStore() as any;
  const [conversations, setConversations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      chatService.getConversations(user.id)
        .then(res => {
          if (res.success) setConversations(res.data);
        })
        .catch(err => console.error("Failed to load conversations:", err))
        .finally(() => setLoading(false));
    }
  }, [user?.id]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className="fixed bottom-6 right-6 w-96 h-[500px] bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col z-50 overflow-hidden"
    >
      {/* Header */}
      <div className="p-6 bg-gradient-to-r from-indigo-600 to-violet-600 text-white relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
        >
          <X size={20} />
        </button>
        <h3 className="text-xl font-black mb-1">Tin nhắn</h3>
        <p className="text-indigo-100 text-sm">Trao đổi & Giải đáp thắc mắc</p>
      </div>

      {/* Search */}
      <div className="p-4 bg-slate-50 border-b border-slate-100">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            placeholder="Tìm kiếm người dùng..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
            <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-xs font-medium">Đang tải hộp thư...</p>
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center gap-4">
             <div className="w-16 h-16 bg-slate-50 rounded-3xl flex items-center justify-center text-slate-300">
                <MessageSquare size={32} />
             </div>
             <div>
                <p className="font-bold text-slate-800">Chưa có tin nhắn</p>
                <p className="text-xs text-slate-400 mt-1">Bắt đầu trò chuyện với người bán hoặc liên hệ hỗ trợ.</p>
             </div>
             <button 
                onClick={() => onSelectUser('system-support-id', 'IUH Support')}
                className="mt-2 text-xs font-bold text-indigo-600 hover:text-indigo-700 underline underline-offset-4"
             >
                Liên hệ hỗ trợ IUH ngay
             </button>
          </div>
        ) : (
          <div className="space-y-1">
            {conversations.map((partnerId) => (
              <ChatPartnerItem 
                key={partnerId} 
                partnerId={partnerId} 
                onSelect={onSelectUser} 
              />
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ChatList;
