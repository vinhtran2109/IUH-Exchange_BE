import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import { MessageCircle, X } from 'lucide-react';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';
import { chatService } from '../services/chatService';
import type { ChatMessage, ProductContext } from '../services/chatService';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

const ChatManager: React.FC = () => {
  const [activeChat, setActiveChat] = useState<{
    recipientId: string;
    recipientName: string;
    productContext?: ProductContext;
  } | null>(null);
  const [showList, setShowList] = useState(false);
  const [incomingToast, setIncomingToast] = useState<{
    senderId: string;
    senderName: string;
    content: string;
  } | null>(null);
  const activeChatRef = useRef<typeof activeChat>(null);
  const showListRef = useRef(false);
  const { user } = useAuthStore() as any;

  useEffect(() => {
    activeChatRef.current = activeChat;
  }, [activeChat]);

  useEffect(() => {
    showListRef.current = showList;
  }, [showList]);

  useEffect(() => {
    if (!user?.id) {
      chatService.disconnect();
      return;
    }

    chatService.connect();

    const removeMsgListener = chatService.addListener(async (msg: ChatMessage) => {
      const senderId = String(msg.senderId || '');
      const receiverId = String((msg as any).receiverId || msg.recipientId || '');
      if (!senderId || !receiverId || senderId === user.id || receiverId !== user.id) return;

      const content = msg.messageType === 'IMAGE' || msg.fileUrl ? 'Đã gửi một hình ảnh' : msg.content || 'Tin nhắn mới';
      let senderName = 'Tin nhắn mới';
      try {
        const res = await api.get(`/users/${senderId}`);
        senderName = res.data?.data?.name || senderName;
      } catch {
        // Keep generic sender name if profile lookup fails.
      }

      if (!activeChatRef.current || showListRef.current) {
        setActiveChat({ recipientId: senderId, recipientName: senderName });
        setShowList(false);
        setIncomingToast(null);
        return;
      }

      if (activeChatRef.current?.recipientId === senderId) return;

      setIncomingToast({ senderId, senderName, content });
      window.setTimeout(() => {
        setIncomingToast((current) => (current?.senderId === senderId && current.content === content ? null : current));
      }, 6000);
    });

    const removeOpenChatListener = chatService.onOpenChat((id: string, name: string, product?: ProductContext) => {
      if (id === 'list') {
        setShowList(true);
        setActiveChat(null);
        setIncomingToast(null);
        return;
      }

      setActiveChat({
        recipientId: id,
        recipientName: name,
        productContext: product,
      });
      setShowList(false);
      setIncomingToast(null);
    });

    return () => {
      removeMsgListener();
      removeOpenChatListener();
      chatService.disconnect();
    };
  }, [user?.id]);

  if (!user) return null;

  return (
    <>
      <AnimatePresence mode="wait">
        {showList && !activeChat && (
          <ChatList
            onClose={() => setShowList(false)}
            onSelectUser={(id, name) => {
              setActiveChat({ recipientId: id, recipientName: name });
              setShowList(false);
              setIncomingToast(null);
            }}
          />
        )}

        {activeChat && (
          <ChatWindow
            recipientId={activeChat.recipientId}
            recipientName={activeChat.recipientName}
            productContext={activeChat.productContext}
            onClose={() => setActiveChat(null)}
            onBack={() => {
              setActiveChat(null);
              setShowList(true);
            }}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {incomingToast && !showList && !activeChat && (
          <div className="fixed bottom-6 right-6 z-50 w-[340px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <button
              type="button"
              onClick={() => {
                setActiveChat({ recipientId: incomingToast.senderId, recipientName: incomingToast.senderName });
                setIncomingToast(null);
              }}
              className="flex w-full items-start gap-3 p-4 text-left transition hover:bg-slate-50"
            >
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-white shadow-sm">
                <MessageCircle size={20} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-black text-slate-900">{incomingToast.senderName}</p>
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black text-emerald-700">Mới</span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm text-slate-600">{incomingToast.content}</p>
              </div>
            </button>
            <button
              type="button"
              onClick={() => setIncomingToast(null)}
              className="absolute right-2 top-2 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Đóng thông báo chat"
            >
              <X size={15} />
            </button>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default ChatManager;
