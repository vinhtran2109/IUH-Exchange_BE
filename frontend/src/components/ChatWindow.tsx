import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { ChevronLeft, Image as ImageIcon, Loader2, Send, User, X } from 'lucide-react';
import { chatService } from '../services/chatService';
import type { ChatMessage } from '../services/chatService';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';

interface ChatWindowProps {
  recipientId: string;
  recipientName: string;
  onClose: () => void;
  onBack?: () => void;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ recipientId, recipientName, onClose, onBack }) => {
  const { user } = useAuthStore() as any;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [uploading, setUploading] = useState(false);
  const [recipientInfo, setRecipientInfo] = useState<{ name: string; avatarUrl?: string } | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const conversationId = useMemo(() => {
    if (!user?.id) return '';
    return chatService.buildConversationId(user.id, recipientId);
  }, [recipientId, user?.id]);

  const appendMessage = (incoming: ChatMessage) => {
    setMessages((prev) => {
      const list = Array.isArray(prev) ? prev : [];
      const incomingId = incoming.id || (incoming as any)._id;
      if (incomingId && list.some((msg) => (msg.id || (msg as any)._id) === incomingId)) {
        return list;
      }
      return [...list, incoming];
    });
  };

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        if (!user?.id) return;
        const res = await chatService.getHistory(user.id, recipientId);
        if (res.success) {
          const history = Array.isArray(res.data)
            ? res.data
            : Array.isArray(res.data?.content)
              ? res.data.content
              : [];
          setMessages(history);
        } else {
          setMessages([]);
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
        setMessages([]);
      }
    };

    fetchHistory();

    const removeQueueListener = chatService.addListener((msg) => {
      const messageRecipientId = (msg as any).recipientId || (msg as any).receiverId;
      const messageConversationId = (msg as any).conversationId;
      if (
        messageConversationId === conversationId ||
        msg.senderId === recipientId ||
        messageRecipientId === recipientId
      ) {
        appendMessage(msg);
      }
    });

    const removeTopicListener = conversationId
      ? chatService.subscribeToConversation(conversationId, appendMessage)
      : () => {};

    return () => {
      removeQueueListener();
      removeTopicListener();
    };
  }, [conversationId, recipientId, user?.id]);

  useEffect(() => {
    let ignore = false;

    if (!recipientId) return;
    if (recipientId.startsWith('system')) {
      setRecipientInfo({ name: 'Hỗ trợ IUH' });
      return;
    }

    api
      .get(`/users/${recipientId}`)
      .then((res) => {
        if (!ignore && res.data?.success) {
          setRecipientInfo(res.data.data);
        }
      })
      .catch(() => {
        if (!ignore) {
          setRecipientInfo({ name: recipientName });
        }
      });

    return () => {
      ignore = true;
    };
  }, [recipientId, recipientName]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim() || !user?.id) return;

    const chatMsg: ChatMessage = {
      senderId: user.id,
      recipientId,
      content: inputValue.trim(),
      timestamp: new Date().toISOString(),
    };

    const success = chatService.sendMessage({
      ...chatMsg,
      ...(conversationId ? { conversationId } : {}),
    } as ChatMessage & { conversationId?: string });

    if (success) {
      setInputValue('');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('Ảnh tối đa 5MB');
      return;
    }

    setUploading(true);
    try {
      const uploadInfo = await chatService.getChatUploadUrl(file.name, file.type);
      if (!uploadInfo.success) throw new Error('Failed to get upload URL');

      const { presignedUrl, publicUrl } = uploadInfo.data;
      await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      chatService.sendImage(recipientId, publicUrl, file.name);
    } catch (err) {
      console.error('Image upload failed:', err);
      alert('Không thể gửi ảnh. Thử lại sau.');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="fixed bottom-6 right-6 z-50 flex h-[480px] w-[360px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {onBack && (
            <button
              onClick={onBack}
              className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
            >
              <ChevronLeft size={18} />
            </button>
          )}
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-slate-500">
            {recipientInfo?.avatarUrl ? (
              <img src={recipientInfo.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
            ) : (
              <User size={18} />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-slate-900">{recipientInfo?.name || recipientName}</h3>
            <p className="text-xs text-slate-400">Tin nhắn trực tiếp</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
        >
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 px-4 py-4">
        {(Array.isArray(messages) ? messages : []).map((msg, index) => {
          const isMe = msg.senderId === user?.id;
          const isImage = (msg as any).messageType === 'IMAGE' || (msg as any).fileUrl;

          return (
            <div
              key={(msg.id || (msg as any)._id || `${msg.timestamp}-${index}`) as string}
              className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex max-w-[82%] items-end gap-2 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                {!isMe && (
                  <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-slate-200 text-slate-500">
                    {recipientInfo?.avatarUrl ? (
                      <img src={recipientInfo.avatarUrl} alt="avatar" className="h-full w-full object-cover" />
                    ) : (
                      <User size={14} />
                    )}
                  </div>
                )}
                <div
                  className={`rounded-2xl px-3 py-2 text-sm shadow-sm ${
                    isMe
                      ? 'rounded-br-md bg-slate-900 text-white'
                      : 'rounded-bl-md border border-slate-200 bg-white text-slate-800'
                  }`}
                >
                  {!isMe && (
                    <p className="mb-1 text-[11px] font-medium text-slate-400">
                      {recipientInfo?.name || recipientName}
                    </p>
                  )}
                  {isImage && (msg as any).fileUrl ? (
                    <a href={(msg as any).fileUrl} target="_blank" rel="noopener noreferrer">
                      <img
                        src={(msg as any).fileUrl}
                        alt="shared image"
                        className="max-h-56 max-w-full rounded-xl object-cover"
                      />
                    </a>
                  ) : (
                    <div>{msg.content}</div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-slate-200 bg-white px-3 py-3">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-2 py-2">
          <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 disabled:opacity-50"
            title="Gửi ảnh"
          >
            {uploading ? <Loader2 size={18} className="animate-spin" /> : <ImageIcon size={18} />}
          </button>
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Nhập tin nhắn..."
            className="flex-1 border-none bg-transparent px-1 text-sm text-slate-800 outline-none"
          />
          <button
            onClick={handleSend}
            className="rounded-lg bg-slate-900 p-2 text-white transition-colors hover:bg-slate-800"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ChatWindow;
