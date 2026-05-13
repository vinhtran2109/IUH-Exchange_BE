import React, { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';
import { chatService } from '../services/chatService';
import type { ChatMessage } from '../services/chatService';
import { useAuthStore } from '../store/authStore';

const ChatManager: React.FC = () => {
  const [activeChat, setActiveChat] = useState<{
    recipientId: string;
    recipientName: string;
  } | null>(null);
  const [showList, setShowList] = useState(false);
  const { user } = useAuthStore() as any;

  useEffect(() => {
    if (!user?.id) {
      chatService.disconnect();
      return;
    }

    console.log('[ChatManager] Global listener started for user:', user.id);
    chatService.connect();

    const removeMsgListener = chatService.addListener((msg: ChatMessage) => {
      if (msg.senderId !== user.id) {
        console.warn('[ChatManager] Global message received!', msg);
      }
    });

    const removeOpenChatListener = chatService.onOpenChat((id: string, name: string) => {
      if (id === 'list') {
        setShowList(true);
        setActiveChat(null);
        return;
      }

      setActiveChat({
        recipientId: id,
        recipientName: name,
      });
      setShowList(false);
    });

    return () => {
      removeMsgListener();
      removeOpenChatListener();
      chatService.disconnect();
    };
  }, [user?.id]);

  if (!user) return null;

  return (
    <AnimatePresence mode="wait">
      {showList && !activeChat && (
        <ChatList
          onClose={() => setShowList(false)}
          onSelectUser={(id, name) => {
            setActiveChat({ recipientId: id, recipientName: name });
            setShowList(false);
          }}
        />
      )}

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
