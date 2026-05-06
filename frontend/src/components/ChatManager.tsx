import React, { useEffect, useState } from 'react';
import { chatService } from '../services/chatService';
import type { ChatMessage } from '../services/chatService';
import ChatWindow from './ChatWindow';
import ChatList from './ChatList'; 
import { useAuthStore } from '../store/authStore';
import { AnimatePresence } from 'framer-motion';

const ChatManager: React.FC = () => {
  const [activeChat, setActiveChat] = useState<{
    recipientId: string;
    recipientName: string;
  } | null>(null);
  
  const [showList, setShowList] = useState(false);
  const { user } = useAuthStore() as any;

  useEffect(() => {
    if (!user?.id) return;

    console.log("📡 [ChatManager] Global listener started for user:", user.id);
    chatService.connect();

    // 1. Lắng nghe tin nhắn mới toàn cục
    const removeMsgListener = chatService.addListener((msg: ChatMessage) => {
      // Nếu có tin nhắn mới mà đang không chat với người đó, có thể làm mới ChatList
      if (msg.senderId !== user.id) {
          console.warn("🔔 [ChatManager] Global message received!", msg);
      }
    });

    // 2. Lắng nghe lệnh mở chat (Header click hoặc Nút nhắn tin)
    const removeOpenChatListener = chatService.onOpenChat((id: string, name: string) => {
      if (id === 'list') {
        setShowList(true);
        setActiveChat(null);
      } else {
        setActiveChat({
          recipientId: id,
          recipientName: name
        });
        setShowList(false);
      }
    });

    return () => {
      removeMsgListener();
      removeOpenChatListener();
      // chatService.disconnect(); // Có thể giữ connect toàn cục
    };
  }, [user?.id]);

  if (!user) return null;

  return (
    <AnimatePresence mode="wait">
      {/* Hiển thị Danh sách Inbox */}
      {showList && !activeChat && (
        <ChatList 
          onClose={() => setShowList(false)} 
          onSelectUser={(id, name) => {
            setActiveChat({ recipientId: id, recipientName: name });
            setShowList(false);
          }}
        />
      )}

      {/* Hiển thị Khung Chat riêng */}
      {activeChat && (
        <ChatWindow
          recipientId={activeChat.recipientId}
          recipientName={activeChat.recipientName}
          onClose={() => setActiveChat(null)}
          onBack={() => {
             setActiveChat(null);
             setShowList(true);
          }}
        />
      )}
    </AnimatePresence>
  );
};

export default ChatManager;
