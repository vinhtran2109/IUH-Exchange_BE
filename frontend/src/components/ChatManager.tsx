import React, { useEffect, useState } from 'react';
import { AnimatePresence } from 'framer-motion';
import ChatList from './ChatList';
import ChatWindow from './ChatWindow';
import { chatService } from '../services/chatService';
import type { ChatMessage, ProductContext } from '../services/chatService';
import { useAuthStore } from '../store/authStore';

const ChatManager: React.FC = () => {
  const [activeChat, setActiveChat] = useState<{
    recipientId: string;
    recipientName: string;
    productContext?: ProductContext;
  } | null>(null);
  const [showList, setShowList] = useState(false);
  const { user } = useAuthStore() as any;

  useEffect(() => {
    if (!user?.id) {
      chatService.disconnect();
      return;
    }

    chatService.connect();

    const removeMsgListener = chatService.addListener((msg: ChatMessage) => {
      if (msg.senderId !== user.id) {
        console.warn('[ChatManager] Global message received!', msg);
      }
    });

    const removeOpenChatListener = chatService.onOpenChat((id: string, name: string, product?: ProductContext) => {
      if (id === 'list') {
        setShowList(true);
        setActiveChat(null);
        return;
      }

      setActiveChat({
        recipientId: id,
        recipientName: name,
        productContext: product,
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
          productContext={activeChat.productContext}
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
