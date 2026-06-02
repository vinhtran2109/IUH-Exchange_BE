import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  Loader2,
  Paperclip,
  Send,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { chatService } from '../services/chatService';
import { ItemType, lostFoundService } from '../services/lostFoundService';

type AiMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  imageUrl?: string;
  actionUrl?: string;
  actionLabel?: string;
};

type LostFoundDraft = {
  type?: ItemType;
  text?: string;
  image?: File | null;
  imagePreview?: string;
};

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

const suggestions = [
  'Viết mô tả bán laptop cũ cho sinh viên IUH',
  'Tìm giúp mình bài đăng mất ví gần nhà H',
  'Mình nhặt được thẻ sinh viên ở thư viện',
  'Gợi ý giá bán giáo trình Java cũ',
];

const initialMessages: AiMessage[] = [
  {
    id: 'welcome',
    role: 'assistant',
    content:
      'Chào bạn, mình là trợ lý IUH Exchange. Bạn có thể nhắn như bình thường, hoặc đính kèm ảnh rồi gõ “Mất ví ở nhà H” / “Nhặt được chìa khóa tầng hầm X”, mình sẽ tạo tin đồ thất lạc ngay trong chat.',
  },
];

const normalizeText = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const detectLostFoundType = (text: string): ItemType | undefined => {
  const normalized = normalizeText(text);
  if (/\b(nhat|tim thay|thay duoc|lượm|luom)\b/.test(normalized)) return ItemType.FOUND;
  if (/\b(mat|roi|that lac|that lac|bi roi)\b/.test(normalized)) return ItemType.LOST;
  return undefined;
};

const extractLocation = (text: string) => {
  const normalized = normalizeText(text);
  const patterns = [
    /\b(?:o|tai|khu|gan|quanh|loanh quanh|tang|nha)\s+(.{1,120})/i,
    /\b(?:can tin|canteen|thu vien|ham|san|bai xe|cong|sanh|phong|toa|lop)\b.{0,80}/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) return match[1].trim();
    if (match?.[0]) return match[0].trim();
  }

  return '';
};

const cleanTitle = (text: string, type?: ItemType) => {
  let title = text
    .replace(/\b(tôi|minh|mình|em|mới|vừa|có|muốn|đăng|tin|bài)\b/gi, ' ')
    .replace(/\b(mất|rơi|thất lạc|nhặt được|tìm thấy|thấy được|lượm được)\b/gi, ' ')
    .replace(/\b(ở|tại|gần|quanh|loanh quanh|khu|tầng|nhà)\b.+$/i, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!title) title = type === ItemType.FOUND ? 'Đồ nhặt được' : 'Đồ bị mất';
  return title.slice(0, 120);
};

const AiAssistant: React.FC = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<AiMessage[]>(initialMessages);
  const [input, setInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');
  const [attachedImage, setAttachedImage] = useState<File | null>(null);
  const [attachedPreview, setAttachedPreview] = useState('');
  const [selectedType, setSelectedType] = useState<ItemType | undefined>();
  const [draft, setDraft] = useState<LostFoundDraft | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const canSend = useMemo(
    () => (input.trim().length > 0 || attachedImage || draft) && !isSending,
    [input, attachedImage, draft, isSending],
  );

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isSending]);

  useEffect(() => {
    return () => {
      if (attachedPreview) URL.revokeObjectURL(attachedPreview);
      if (draft?.imagePreview) URL.revokeObjectURL(draft.imagePreview);
    };
  }, [attachedPreview, draft?.imagePreview]);

  const addMessage = (message: Omit<AiMessage, 'id'>) => {
    setMessages((prev) => [
      ...prev,
      {
        id: `${message.role}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        ...message,
      },
    ]);
  };

  const clearAttachment = () => {
    if (attachedPreview) URL.revokeObjectURL(attachedPreview);
    setAttachedImage(null);
    setAttachedPreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setError('');

    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Vui lòng chọn tệp ảnh hợp lệ.');
      event.target.value = '';
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setError('Ảnh quá lớn. Vui lòng chọn ảnh tối đa 10MB.');
      event.target.value = '';
      return;
    }

    clearAttachment();
    setAttachedImage(file);
    setAttachedPreview(URL.createObjectURL(file));
  };

  const uploadImage = async (image: File) => {
    const { data } = await lostFoundService.getUploadUrl(image.name, image.type);
    const { presignedUrl, publicUrl } = data || {};

    if (!presignedUrl || !publicUrl) {
      throw new Error('Không nhận được upload URL hợp lệ từ server.');
    }

    const uploadResponse = await fetch(presignedUrl, {
      method: 'PUT',
      body: image,
      headers: { 'Content-Type': image.type },
    });

    if (!uploadResponse.ok) {
      throw new Error('Upload ảnh thất bại. Vui lòng thử lại.');
    }

    return publicUrl as string;
  };

  const createLostFoundFromChat = async (text: string, type: ItemType, image?: File | null, preview?: string) => {
    const location = extractLocation(text);
    if (!location) {
      setDraft({ type, text, image, imagePreview: preview });
      addMessage({
        role: 'assistant',
        content: 'Mình cần thêm vị trí để tạo tin. Bạn nhắn tiếp kiểu: “ở nhà H”, “tầng hầm tòa X”, hoặc “gần thư viện”.',
      });
      return true;
    }

    const title = cleanTitle(text, type);
    const imageUrls = image ? [await uploadImage(image)] : [];
    const response = await lostFoundService.createAiAutoPost({
      type,
      title,
      location,
      imageUrls,
      contactInfo: '',
      consentImageAnalysis: imageUrls.length > 0,
      consentMssvExtraction: imageUrls.length > 0,
    });

    const created = response?.data;
    const id = created?.id || created?._id;
    const createdTitle = created?.title || title;
    const actionUrl = id ? `/lost-found/${id}` : undefined;

    addMessage({
      role: 'assistant',
      content: `Mình đã tạo tin ${type === ItemType.FOUND ? 'nhặt được' : 'mất đồ'}: “${createdTitle}”. Bạn mở chi tiết để kiểm tra lại trước khi chia sẻ nhé.`,
      actionUrl,
      actionLabel: 'Mở tin vừa tạo',
    });

    setDraft(null);
    if (preview && preview === attachedPreview) clearAttachment();
    if (id) window.setTimeout(() => navigate(`/lost-found/${id}`), 900);
    return true;
  };

  const handleDraftReply = async (reply: string) => {
    if (!draft) return false;
    const mergedText = `${draft.text || ''} ${reply}`.trim();
    const type = draft.type || selectedType || detectLostFoundType(mergedText);

    if (!type) {
      addMessage({
        role: 'assistant',
        content: 'Tin này là “mất đồ” hay “nhặt được”? Bạn chọn nút bên dưới hoặc nhắn rõ giúp mình nhé.',
      });
      return true;
    }

    return createLostFoundFromChat(mergedText, type, draft.image, draft.imagePreview);
  };

  const sendMessage = async (text = input) => {
    const trimmed = text.trim();
    if ((!trimmed && !attachedImage && !draft) || isSending) return;

    const imageForMessage = attachedPreview;
    const imageFile = attachedImage;
    const type = selectedType || detectLostFoundType(trimmed);

    addMessage({
      role: 'user',
      content: trimmed || 'Đã gửi một hình ảnh.',
      imageUrl: imageForMessage,
    });

    setInput('');
    setError('');
    setIsSending(true);

    try {
      if (draft) {
        await handleDraftReply(trimmed);
      } else if (imageFile || selectedType || type) {
        const resolvedType = type || selectedType;
        if (!resolvedType) {
          setDraft({ text: trimmed, image: imageFile, imagePreview: imageForMessage });
          addMessage({
            role: 'assistant',
            content: 'Bạn muốn tạo tin “mất đồ” hay “nhặt được”? Chọn một nút phía dưới rồi gửi lại thông tin nhé.',
          });
        } else {
          await createLostFoundFromChat(trimmed, resolvedType, imageFile, imageForMessage);
        }
      } else {
        const response = await chatService.askAiAssistant(trimmed);
        addMessage({ role: 'assistant', content: response.data.answer });
      }

      clearAttachment();
      setSelectedType(undefined);
    } catch (err: any) {
      const message = err?.response?.data?.message || err?.message || 'AI Assistant chưa phản hồi được. Vui lòng thử lại.';
      setError(message);
      addMessage({ role: 'assistant', content: message });
    } finally {
      setIsSending(false);
      requestAnimationFrame(() => textareaRef.current?.focus());
    }
  };

  const sendSuggestion = (suggestion: string) => {
    setInput(suggestion);
    requestAnimationFrame(() => sendMessage(suggestion));
  };

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-100 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
          <Sparkles size={14} />
          AI Assistant
        </div>
        <h1 className="text-3xl font-black text-slate-900">Trợ lý IUH Exchange</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Nhắn tin, tìm sản phẩm, hỏi đơn hàng hoặc gửi ảnh để tạo tin mất đồ / nhặt được ngay trong cuộc trò chuyện.
        </p>
      </div>

      <section className="flex min-h-[680px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
              <Bot size={20} />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">IUH Assistant</h2>
              <p className="text-xs text-slate-500">Chat với AI, có thể gửi kèm ảnh đồ thất lạc</p>
            </div>
          </div>
          <div className="hidden gap-2 sm:flex">
            {[ItemType.LOST, ItemType.FOUND].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedType((current) => (current === type ? undefined : type))}
                className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
                  selectedType === type
                    ? type === ItemType.LOST
                      ? 'bg-rose-600 text-white'
                      : 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {type === ItemType.LOST ? 'Mất đồ' : 'Nhặt được'}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto bg-slate-50 px-5 py-5">
          {messages.map((message) => (
            <div key={message.id} className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.role === 'assistant' && (
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
                  <Bot size={16} />
                </div>
              )}
              <div
                className={`max-w-[82%] overflow-hidden rounded-2xl text-sm leading-6 shadow-sm ${
                  message.role === 'user'
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-700'
                }`}
              >
                {message.imageUrl && (
                  <img src={message.imageUrl} alt="Ảnh đã gửi" className="max-h-72 w-full object-cover" />
                )}
                <div className="whitespace-pre-wrap px-4 py-3">{message.content}</div>
                {message.actionUrl && (
                  <button
                    type="button"
                    onClick={() => navigate(message.actionUrl!)}
                    className="mx-4 mb-4 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white transition hover:bg-slate-800"
                  >
                    <CheckCircle2 size={14} />
                    {message.actionLabel || 'Mở chi tiết'}
                  </button>
                )}
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
              Đang xử lý...
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        <div className="border-t border-slate-100 bg-white p-4">
          {error && (
            <div className="mb-3 flex items-start justify-between gap-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-600">
              <span>{error}</span>
              <button type="button" onClick={() => setError('')} className="text-red-500 hover:text-red-700">
                <X size={15} />
              </button>
            </div>
          )}

          <div className="mb-3 flex flex-wrap gap-2 sm:hidden">
            {[ItemType.LOST, ItemType.FOUND].map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setSelectedType((current) => (current === type ? undefined : type))}
                className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
                  selectedType === type
                    ? type === ItemType.LOST
                      ? 'bg-rose-600 text-white'
                      : 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {type === ItemType.LOST ? 'Mất đồ' : 'Nhặt được'}
              </button>
            ))}
          </div>

          {attachedPreview && (
            <div className="mb-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-2">
              <img src={attachedPreview} alt="Ảnh đính kèm" className="h-16 w-16 rounded-lg object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-800">{attachedImage?.name}</p>
                <p className="text-xs text-slate-500">Ảnh sẽ được gửi cùng tin nhắn này.</p>
              </div>
              <button
                type="button"
                onClick={clearAttachment}
                className="rounded-lg p-2 text-rose-500 transition hover:bg-rose-50"
                title="Bỏ ảnh"
              >
                <Trash2 size={17} />
              </button>
            </div>
          )}

          <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageChange} />

          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isSending}
              className="flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              title="Đính kèm ảnh"
            >
              <Paperclip size={19} />
            </button>
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
              placeholder={
                attachedImage
                  ? 'Ví dụ: Mất ví ở nhà H, hoặc Nhặt được chìa khóa tầng hầm X...'
                  : 'Nhắn cho AI, tìm sản phẩm, hỏi đơn hàng hoặc gửi ảnh đồ thất lạc...'
              }
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

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => sendSuggestion(suggestion)}
                disabled={isSending}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-left text-xs leading-5 text-slate-600 transition hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default AiAssistant;
