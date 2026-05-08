import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Send, User, ChevronLeft, Image as ImageIcon, Loader2 } from 'lucide-react';
import { chatService } from '../services/chatService';
import type { ChatMessage } from '../services/chatService';
import { useAuthStore } from '../store/authStore';

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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        if (user?.id) {
          const res = await chatService.getHistory(user.id, recipientId);
          if (res.success) setMessages(res.data);
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
      }
    };
    fetchHistory();

    const removeListener = chatService.addListener((msg) => {
      if (msg.senderId === recipientId || msg.recipientId === recipientId) {
        setMessages((prev) => [...prev, msg]);
      }
    });
    return () => removeListener();
  }, [recipientId, user?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim() || !user?.id) return;
    const chatMsg: ChatMessage = {
      senderId: user.id,
      recipientId,
      content: inputValue.trim(),
    };
    const success = chatService.sendMessage(chatMsg);
    if (success) {
      setMessages((prev) => [...prev, { ...chatMsg, timestamp: new Date().toISOString() }]);
      setInputValue('');
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    // Max 5MB
    if (file.size > 5 * 1024 * 1024) {
      alert('Ảnh tối đa 5MB');
      return;
    }

    setUploading(true);
    try {
      // Get presigned URL
      const uploadInfo = await chatService.getChatUploadUrl(file.name, file.type);
      if (!uploadInfo.success) throw new Error('Failed to get upload URL');

      const { presignedUrl, publicUrl } = uploadInfo.data;

      // Upload to S3
      await fetch(presignedUrl, {
        method: 'PUT',
        body: file,
        headers: { 'Content-Type': file.type },
      });

      // Send image message via WebSocket
      chatService.sendImage(recipientId, publicUrl, file.name);

      // Optimistic add to local messages
      setMessages((prev) => [
        ...prev,
        {
          senderId: user.id,
          recipientId,
          content: file.name,
          messageType: 'IMAGE',
          fileUrl: publicUrl,
          timestamp: new Date().toISOString(),
        } as any,
      ]);
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
      initial={{ opacity: 0, scale: 0.9, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 20 }}
      className="fixed bottom-6 right-6 w-96 h-[500px] bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 flex flex-col z-50 overflow-hidden"
    >
      <div className="p-5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          {onBack && (
            <button onClick={onBack} className="mr-1 p-1.5 hover:bg-white/20 rounded-xl transition-colors">
              <ChevronLeft size={20} />
            </button>
          )}
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/30">
            <User size={20} />
          </div>
          <div className="text-left">
            <h3 className="font-black text-sm leading-tight">{recipientName}</h3>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-bold text-indigo-100 italic uppercase">online</span>
            </div>
          </div>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-full transition-all">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50 custom-scrollbar">
        {messages.map((msg, index) => {
          const isMe = msg.senderId === user?.id;
          const isImage = (msg as any).messageType === 'IMAGE' || (msg as any).fileUrl;
          return (
            <div key={index} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] text-sm rounded-2xl ${
                isMe ? 'bg-indigo-600 text-white shadow-md rounded-br-none' : 'bg-white text-slate-800 border border-slate-100 shadow-sm rounded-bl-none'
              }`}>
                {isImage && (msg as any).fileUrl ? (
                  <a href={(msg as any).fileUrl} target="_blank" rel="noopener noreferrer">
                    <img
                      src={(msg as any).fileUrl}
                      alt="shared image"
                      className="max-w-full rounded-2xl cursor-pointer hover:opacity-90 transition-opacity"
                      style={{ maxHeight: 240 }}
                    />
                  </a>
                ) : (
                  <div className="p-3">{msg.content}</div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-slate-100 bg-white">
        <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-100">
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all disabled:opacity-50"
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
            className="flex-1 bg-transparent border-none outline-none px-2 py-1 text-sm text-slate-800"
          />
          <button onClick={handleSend} className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg shadow-indigo-100 transition-all active:scale-95">
            <Send size={18} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

export default ChatWindow;
