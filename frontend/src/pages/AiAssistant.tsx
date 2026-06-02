import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  ImagePlus,
  Loader2,
  MapPin,
  Send,
  Sparkles,
  Trash2,
  UploadCloud,
  UserRound,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { chatService } from '../services/chatService';
import { ItemType, lostFoundService } from '../services/lostFoundService';

type AiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
};

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

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
    content: 'Chào bạn, mình là trợ lý IUH Exchange. Mình có thể giúp viết mô tả đăng bán, tư vấn giá, tìm sản phẩm, kiểm tra đơn hàng hoặc tạo nhanh tin đồ thất lạc từ ảnh.',
  },
];

const AiAssistant: React.FC = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<AiMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [autoType, setAutoType] = useState<ItemType>(ItemType.LOST);
  const [autoTitle, setAutoTitle] = useState('');
  const [autoLocation, setAutoLocation] = useState('');
  const [autoContact, setAutoContact] = useState('');
  const [autoImage, setAutoImage] = useState<File | null>(null);
  const [autoPreview, setAutoPreview] = useState('');
  const [autoConsent, setAutoConsent] = useState(false);
  const [isCreatingPost, setIsCreatingPost] = useState(false);
  const [autoPostError, setAutoPostError] = useState('');
  const [autoPostSuccess, setAutoPostSuccess] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending]);
  const canCreateAutoPost = useMemo(
    () => autoTitle.trim().length > 0 && autoLocation.trim().length > 0 && !isCreatingPost && (!autoImage || autoConsent),
    [autoTitle, autoLocation, isCreatingPost, autoImage, autoConsent],
  );

  useEffect(() => {
    return () => {
      if (autoPreview) URL.revokeObjectURL(autoPreview);
    };
  }, [autoPreview]);

  const addAssistantMessage = (content: string) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content,
      },
    ]);
  };

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
      addAssistantMessage(response.data.answer);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'AI Assistant chưa phản hồi được. Vui lòng thử lại.');
      addAssistantMessage('Mình chưa trả lời được lúc này. Bạn thử gửi lại sau một chút nhé.');
    } finally {
      setIsSending(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  };

  const clearAutoImage = () => {
    if (autoPreview) URL.revokeObjectURL(autoPreview);
    setAutoImage(null);
    setAutoPreview('');
    setAutoConsent(false);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const handleAutoImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setAutoPostError('');

    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setAutoPostError('Vui lòng chọn tệp ảnh hợp lệ.');
      event.target.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setAutoPostError('Ảnh quá lớn. Vui lòng chọn ảnh tối đa 10MB.');
      event.target.value = '';
      return;
    }

    if (autoPreview) URL.revokeObjectURL(autoPreview);
    setAutoImage(file);
    setAutoPreview(URL.createObjectURL(file));
    setAutoConsent(true);
  };

  const uploadAutoImage = async () => {
    if (!autoImage) return [];
    const { data: uploadData } = await lostFoundService.getUploadUrl(autoImage.name, autoImage.type);
    const { presignedUrl, publicUrl } = uploadData || {};

    if (!presignedUrl || !publicUrl) {
      throw new Error('Không nhận được upload URL hợp lệ từ server.');
    }

    const uploadResponse = await fetch(presignedUrl, {
      method: 'PUT',
      body: autoImage,
      headers: { 'Content-Type': autoImage.type },
    });

    if (!uploadResponse.ok) {
      throw new Error('Upload ảnh thất bại. Vui lòng thử lại.');
    }

    return [publicUrl];
  };

  const createAutoPost = async () => {
    if (!canCreateAutoPost) return;

    setIsCreatingPost(true);
    setAutoPostError('');
    setAutoPostSuccess('');

    try {
      const imageUrls = await uploadAutoImage();
      const response = await lostFoundService.createAiAutoPost({
        type: autoType,
        title: autoTitle.trim(),
        location: autoLocation.trim(),
        contactInfo: autoContact.trim(),
        imageUrls,
        consentImageAnalysis: imageUrls.length > 0,
        consentMssvExtraction: imageUrls.length > 0,
      });

      const created = response?.data;
      const id = created?.id || created?._id;
      const title = created?.title || autoTitle.trim();
      setAutoPostSuccess(`Đã tạo tin "${title}".`);
      addAssistantMessage(`Mình đã tạo tin ${autoType === ItemType.FOUND ? 'nhặt được' : 'mất đồ'} "${title}". Bạn có thể mở chi tiết để kiểm tra lại nội dung trước khi chia sẻ.`);

      setAutoTitle('');
      setAutoLocation('');
      setAutoContact('');
      clearAutoImage();

      if (id) {
        window.setTimeout(() => navigate(`/lost-found/${id}`), 700);
      }
    } catch (err: any) {
      setAutoPostError(err?.response?.data?.message || err?.message || 'Không thể tạo tin tự động. Vui lòng thử lại.');
    } finally {
      setIsCreatingPost(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
            <Sparkles size={14} />
            AI Assistant
          </div>
          <h1 className="text-3xl font-black text-slate-900">Trợ lý IUH Exchange</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            Hỏi nhanh về đăng bán, định giá, giao dịch an toàn và tạo tin đồ thất lạc từ hình ảnh.
          </p>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[1fr_360px]">
        <section className="flex min-h-[620px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
              <Bot size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">IUH Assistant</h2>
              <p className="text-xs text-slate-500">Phản hồi bằng Gemini và dữ liệu IUH Exchange</p>
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

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <ImagePlus size={20} />
              </div>
              <div>
                <h2 className="text-sm font-black text-slate-900">Tạo tin mất / nhặt đồ bằng AI</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Thêm ảnh, vị trí và vài chữ mô tả. AI sẽ viết nội dung đăng phù hợp.
                </p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
              {[ItemType.LOST, ItemType.FOUND].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setAutoType(type)}
                  className={`rounded-lg px-3 py-2 text-xs font-black transition ${
                    autoType === type
                      ? type === ItemType.LOST
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-600 hover:bg-white'
                  }`}
                >
                  {type === ItemType.LOST ? 'Mất đồ' : 'Nhặt được'}
                </button>
              ))}
            </div>

            <div className="mt-4 space-y-3">
              <input
                value={autoTitle}
                onChange={(event) => setAutoTitle(event.target.value)}
                maxLength={200}
                placeholder="Ví dụ: mất ví da màu đen"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none transition focus:border-emerald-300 focus:bg-white"
              />
              <div className="relative">
                <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  value={autoLocation}
                  onChange={(event) => setAutoLocation(event.target.value)}
                  maxLength={300}
                  placeholder="Vị trí: thư viện, nhà H..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-9 pr-3 text-sm outline-none transition focus:border-emerald-300 focus:bg-white"
                />
              </div>
              <input
                value={autoContact}
                onChange={(event) => setAutoContact(event.target.value)}
                maxLength={200}
                placeholder="Thông tin liên hệ nếu muốn"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm outline-none transition focus:border-emerald-300 focus:bg-white"
              />

              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAutoImageChange}
              />

              {autoPreview ? (
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                  <div className="relative aspect-[4/3] bg-slate-100">
                    <img src={autoPreview} alt="Ảnh đồ thất lạc" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={clearAutoImage}
                      className="absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full bg-white/95 text-rose-600 shadow-sm hover:bg-rose-50"
                      title="Bỏ ảnh"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                  <label className="flex cursor-pointer items-start gap-2 px-3 py-3 text-xs leading-5 text-slate-600">
                    <input
                      type="checkbox"
                      checked={autoConsent}
                      onChange={(event) => setAutoConsent(event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600"
                    />
                    <span>Đồng ý cho hệ thống phân tích ảnh để gợi ý nội dung và tìm kết quả khớp.</span>
                  </label>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center transition hover:border-emerald-300 hover:bg-emerald-50"
                >
                  <UploadCloud size={24} className="text-emerald-600" />
                  <span className="mt-2 text-sm font-bold text-slate-800">Thêm ảnh đồ vật</span>
                  <span className="mt-1 text-xs text-slate-500">PNG, JPG, WEBP tối đa 10MB</span>
                </button>
              )}

              {autoPostError && <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-600">{autoPostError}</div>}
              {autoPostSuccess && (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">
                  <CheckCircle2 size={15} />
                  {autoPostSuccess}
                </div>
              )}

              <button
                type="button"
                onClick={createAutoPost}
                disabled={!canCreateAutoPost}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-3 text-sm font-black text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {isCreatingPost ? <Loader2 size={17} className="animate-spin" /> : <Sparkles size={17} />}
                Tạo tin bằng AI
              </button>
            </div>
          </section>

          <section className="space-y-3">
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
          </section>
        </aside>
      </div>
    </div>
  );
};

export default AiAssistant;
