import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { ArrowRight, MessageSquare, Search, User, X } from 'lucide-react';
import { chatService } from '../services/chatService';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

interface ChatListProps {
  onClose: () => void;
  onSelectUser: (id: string, name: string) => void;
}

const ChatPartnerItem: React.FC<{
  partnerId: string;
  onSelect: (id: string, name: string) => void;
  lastMessage?: string;
}> = ({ partnerId, onSelect, lastMessage }) => {
  const [partnerInfo, setPartnerInfo] = useState<{ name: string; avatarUrl?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (partnerId.startsWith('system')) {
      setPartnerInfo({ name: 'Hỗ trợ IUH' });
      setLoading(false);
      return;
    }

    api
      .get(`/users/${partnerId}`)
      .then((res) => {
        if (res.data.success) {
          setPartnerInfo(res.data.data);
        }
      })
      .catch(() => setPartnerInfo({ name: 'Người dùng IUH' }))
      .finally(() => setLoading(false));
  }, [partnerId]);

  if (loading) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-3 animate-pulse">
        <div className="h-11 w-11 rounded-full bg-slate-100" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-1/2 rounded bg-slate-100" />
          <div className="h-3 w-1/3 rounded bg-slate-50" />
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelect(partnerId, partnerInfo?.name || 'Người dùng IUH')}
      className="flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-white px-3 py-3 text-left transition-colors hover:border-slate-200 hover:bg-slate-50"
    >
      <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-500">
        {partnerInfo?.avatarUrl ? (
          <img src={partnerInfo.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
        ) : (
          <User size={20} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-slate-900">{partnerInfo?.name || 'Người dùng IUH'}</p>
        <p className="mt-0.5 truncate text-xs text-slate-500">{lastMessage || 'Bắt đầu cuộc trò chuyện'}</p>
      </div>
      <div className="rounded-lg p-2 text-slate-300">
        <ArrowRight size={14} />
      </div>
    </button>
  );
};

const ChatList: React.FC<ChatListProps> = ({ onClose, onSelectUser }) => {
  const { user } = useAuthStore() as any;
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageSize = 15;

  const fetchConversations = async (pageNum: number, append = false) => {
    if (!user?.id) return;
    if (pageNum === 0) setLoading(true);
    else setLoadingMore(true);

    try {
      const res = await chatService.getConversations(user.id, pageNum, pageSize);
      if (res.success) {
        const convos = res.data?.content || [];
        const partners = convos.map((c: any) => {
          const partnerId =
            c.lastMessage?.senderId === user.id ? c.lastMessage?.receiverId : c.lastMessage?.senderId;
          return {
            partnerId: partnerId || c._id,
            lastMessage: c.lastMessage?.content || '',
            conversationId: c._id,
          };
        });
        setConversations((prev) => (append ? [...prev, ...partners] : partners));
        setHasMore(!res.data?.last);
      }
    } catch (err) {
      console.error('Failed to load conversations:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      setPage(0);
      fetchConversations(0);
    }
  }, [user?.id]);

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchConversations(nextPage, true);
  };

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await chatService.searchMessages(searchQuery);
        if (res.success) {
          setSearchResults(res.data?.content || []);
        }
      } catch (_error) {
        setSearchResults([]);
      }
      setSearching(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="fixed bottom-6 right-6 z-50 flex h-[500px] w-[360px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-4">
        <div>
          <h3 className="text-base font-semibold text-slate-900">Tin nhắn</h3>
          <p className="mt-0.5 text-xs text-slate-500">Danh sách cuộc trò chuyện gần đây</p>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
        >
          <X size={18} />
        </button>
      </div>

      <div className="border-b border-slate-200 bg-white px-4 py-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm kiếm tin nhắn..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none transition-colors focus:border-slate-300 focus:bg-white"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50 px-3 py-3">
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-700" />
            <p className="text-xs font-medium">Đang tải cuộc trò chuyện...</p>
          </div>
        ) : searchQuery.trim().length >= 2 ? (
          searching ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
            </div>
          ) : searchResults.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-400">Không tìm thấy tin nhắn nào.</div>
          ) : (
            <div className="space-y-2">
              {searchResults.map((msg: any) => {
                const partnerId = msg.senderId === user?.id ? msg.receiverId : msg.senderId;
                return (
                  <button
                    key={msg._id}
                    onClick={() => {
                      onSelectUser(partnerId, partnerId);
                      setSearchQuery('');
                    }}
                    className="w-full rounded-xl border border-slate-100 bg-white p-3 text-left transition-colors hover:bg-slate-50"
                  >
                    <p className="mb-1 text-xs text-slate-400">{new Date(msg.createdAt).toLocaleString('vi-VN')}</p>
                    <p className="line-clamp-2 text-sm text-slate-700">{msg.content}</p>
                  </button>
                );
              })}
            </div>
          )
        ) : conversations.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white text-slate-300 shadow-sm">
              <MessageSquare size={28} />
            </div>
            <div>
              <p className="font-semibold text-slate-800">Chưa có cuộc trò chuyện</p>
              <p className="mt-1 text-xs text-slate-400">Hãy bắt đầu nhắn tin với người bán hoặc người mua.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conv) => (
              <ChatPartnerItem
                key={conv.partnerId}
                partnerId={conv.partnerId}
                lastMessage={conv.lastMessage}
                onSelect={onSelectUser}
              />
            ))}
            {hasMore && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="mt-1 flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
              >
                {loadingMore ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                ) : (
                  <>Xem thêm</>
                )}
              </button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default ChatList;
