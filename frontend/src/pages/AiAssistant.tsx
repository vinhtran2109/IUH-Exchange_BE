import React, { useMemo, useRef, useState } from 'react';
import { Bot, Loader2, Send, Sparkles, UserRound } from 'lucide-react';
import { chatService } from '../services/chatService';

type AiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const suggestions = [
  'Viết mô tả bán laptop cũ cho sinh viên IUH',
  'Làm sao nhận biết một tin nhắn lừa đảo?',
  'Tôi nhặt được thẻ sinh viên thì nên đăng như thế nào?',
  'Gợi ý giá bán giáo trình Java cũ',
];

const initialMessages: AiMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content: 'Chào bạn, mình là trợ lý IUH Exchange. Mình có thể giúp viết mô tả đăng bán, tư vấn giá, kiểm tra dấu hiệu lừa đảo, hoặc gợi ý cách đăng tin đồ thất lạc.',
  },
];

const AiAssistant: React.FC = () => {
  const [messages, setMessages] = useState<AiMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending]);

  const sendMessage = async (text = input) => {
    const trimmed = text.trim();
    if (!trimmed || isSending) return;

    const userMessage: AiMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setError('');
    setIsSending(true);

    try {
      const response = await chatService.askAiAssistant(trimmed);
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.data.answer,
        },
      ]);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'AI Assistant chưa phản hồi được. Vui lòng thử lại.');
      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-error-${Date.now()}`,
          role: 'assistant',
          content: 'Mình chưa trả lời được lúc này. Bạn thử gửi lại sau một chút nhé.',
        },
      ]);
    } finally {
      setIsSending(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            <Sparkles size={14} />
            AI Assistant
          </div>
          <h1 className="text-3xl font-black text-slate-900">Trợ lý IUH Exchange</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Hỏi nhanh về đăng bán, định giá, giao dịch an toàn và đồ thất lạc trong khuôn viên trường.
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
        <section className="flex min-h-[620px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
              <Bot size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">IUH Assistant</h2>
              <p className="text-xs text-slate-500">Phản hồi bằng Gemini</p>
            </div>
          </div>

          <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 px-5 py-5">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                    <Bot size={16} />
                  </div>
                )}
                <div
                  className={`max-w-[78%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
                    message.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'border border-slate-200 bg-white text-slate-700'
                  }`}
                >
                  {message.content}
                </div>
                {message.role === 'user' && (
                  <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                    <UserRound size={16} />
                  </div>
                )}
              </div>
            ))}
            {isSending && (
              <div className="flex items-center gap-3 text-sm text-slate-500">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                  <Loader2 size={16} className="animate-spin" />
                </div>
                Đang suy nghĩ...
              </div>
            )}
          </div>

          <div className="border-t border-slate-100 bg-white p-4">
            {error && <div className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
            <div className="flex gap-3">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                rows={2}
                maxLength={2000}
                placeholder="Nhập câu hỏi cho AI..."
                className="min-h-[52px] flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-indigo-300 focus:bg-white"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!canSend}
                className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl bg-indigo-600 text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                title="Gửi"
              >
                {isSending ? <Loader2 size={19} className="animate-spin" /> : <Send size={19} />}
              </button>
            </div>
          </div>
        </section>

        <aside className="space-y-3">
          <h2 className="text-sm font-bold text-slate-800">Gợi ý nhanh</h2>
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => sendMessage(suggestion)}
              disabled={isSending}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left text-sm leading-5 text-slate-600 shadow-sm transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {suggestion}
            </button>
          ))}
        </aside>
      </div>
    </div>
  );
};

export default AiAssistant;
