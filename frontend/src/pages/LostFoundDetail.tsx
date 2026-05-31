import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  MapPin, 
  Calendar, 
  MessageCircle, 
  Trash2, 
  Package,
  User as UserIcon,
  Flag,
  Hand,
  ScanLine,
  BadgeCheck,
  ShieldCheck,
  Pencil
} from 'lucide-react';
import { lostFoundService, ItemType } from '../services/lostFoundService';
import type { LostFoundItem } from '../services/lostFoundService';
import { chatService } from '../services/chatService';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../components/Toast';
import { useConfirm, usePrompt } from '../components/Dialogs';
const LostFoundDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { success: toastSuccess, error: toastError } = useToast();
  const { confirm } = useConfirm();
  const { prompt } = usePrompt();
  
  const [item, setItem] = useState<LostFoundItem | null>(null);
  const [loading, setLoading] = useState(true);

  const [deleting, setDeleting] = useState(false);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    if (id) fetchDetail(id);
  }, [id]);

  useEffect(() => {
    if (!id) return;
    chatService.connect();
    const removeListener = chatService.addNotificationListener((notification: { targetId?: string; type?: string }) => {
      const targetId = String(notification?.targetId || '');
      const type = String(notification?.type || '').toUpperCase();
      if (targetId === String(id) && (type.includes('SYSTEM') || type.includes('LOST'))) {
        fetchDetail(id, true);
      }
    });
    return removeListener;
  }, [id]);

  const fetchDetail = async (itemId: string, silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await lostFoundService.getItemById(itemId);
      if (response.success) {
        setItem(response.data);
      }
    } catch {
      console.error("Failed to fetch details:");
    } finally {
      setLoading(false);
    }
  };

  const getErrorMessage = (error: unknown, fallback: string) => {
    if (typeof error === 'object' && error && 'response' in error) {
      const response = error as { response?: { data?: { message?: string } } };
      return response.response?.data?.message || fallback;
    }
    if (error instanceof Error && error.message) {
      return error.message;
    }
    return fallback;
  };

  const handleDelete = async () => {
    if (!item) return;
    const confirmed = await confirm({
      title: 'Gỡ bài đăng',
      message: 'Bạn có chắc chắn muốn gỡ bài đăng này không?',
      confirmText: 'Gỡ bài',
      cancelText: 'Hủy',
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      setDeleting(true);
      const response = await lostFoundService.deleteItem(item.id);
      if (response.success) {
        toastSuccess('Đã gỡ bài đăng thành công.');
        navigate('/lost-found');
      }
    } catch {
      toastError('Gỡ bài thất bại. Vui lòng thử lại.');
    } finally {
      setDeleting(false);
    }
  };

  const handleClaim = async () => {
    if (!item || !user) return;

    // Nếu item có câu hỏi xác minh → hiển thị prompt để user trả lời TRƯỚC khi confirm
    let answer = 'Tôi xác nhận đã tìm thấy đồ vật này';
    if (item.verificationQuestion) {
      // Dùng usePrompt hook (nhất quán với UX app) thay vì native window.prompt()
      const userAnswer = await prompt({
        title: 'Câu hỏi xác minh quyền sở hữu',
        message: item.verificationQuestion,
        placeholder: 'Nhập câu trả lời của bạn...',
        confirmText: 'Xác nhận',
        minLength: 2,
        rows: 2,
      });
      if (!userAnswer) return; // User bấm Cancel
      answer = userAnswer.trim();
    } else {
      // Không có câu hỏi → confirm đơn giản
      const confirmed = await confirm({
        title: 'Xác nhận tìm thấy',
        message: 'Xác nhận bạn đã tìm thấy đồ vật này?',
        confirmText: 'Xác nhận',
        cancelText: 'Hủy',
        variant: 'default',
      });
      if (!confirmed) return;
    }

    try {
      setClaiming(true);
      const res = await lostFoundService.claimItem(item.id, { answer });
      if (res.success) {
        setItem({ ...item, status: 'CLAIMED' });
        toastSuccess('Đã xác nhận tìm thấy đồ vật! Chủ sở hữu sẽ xem xét yêu cầu của bạn.');
      }
    } catch (err) {
      toastError('Lỗi: ' + getErrorMessage(err, 'Không thể xác nhận'));
    } finally {
      setClaiming(false);
    }
  };

  const handleReport = async () => {
    if (!user) { toastError('Bạn cần đăng nhập để tố cáo!'); return; }
    const reason = await prompt({
      title: 'Tố cáo bài đăng',
      message: 'Vui lòng cho chúng tôi biết lý do tố cáo bài đăng này.',
      placeholder: 'Nhập lý do tố cáo (ít nhất 5 ký tự)...',
      confirmText: 'Gửi tố cáo',
      minLength: 5,
      rows: 3,
    });
    if (!reason) return;
    try {
      await api.post('/reports', { targetType: 'LOST_FOUND', targetId: id, reason });
      toastSuccess('Đã gửi tố cáo. Admin sẽ xem xét sớm.');
    } catch (err) {
      toastError('Lỗi: ' + getErrorMessage(err, 'Không thể gửi tố cáo'));
    }
  };

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-32 text-center text-slate-400 font-bold">Đang tải dữ liệu...</div>;
  if (!item) return <div className="max-w-7xl mx-auto px-4 py-32 text-center text-slate-400 font-bold">Không tìm thấy thông tin.</div>;

  const isOwner = String(user?.id || user?.sub || '') === String(item.userId || '');

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <button 
        onClick={() => navigate('/lost-found')}
        className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-medium mb-8 transition-colors group"
      >
        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
        Quay lại danh sách
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        {/* Gallery */}
        <div className="space-y-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="aspect-4/3 bg-slate-100 rounded-[3rem] overflow-hidden border border-slate-100 shadow-2xl shadow-indigo-100/50"
          >
            {item.imageUrls && item.imageUrls.length > 0 ? (
              <img src={item.imageUrls[0]} className="w-full h-full object-cover" alt={item.title} />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-300">
                <Package size={120} strokeWidth={0.5} />
              </div>
            )}
          </motion.div>
        </div>

        {/* Content */}
        <div className="flex flex-col">
          <div className="mb-6 flex justify-between items-start gap-4">
            <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest ${
              item.type === ItemType.LOST 
              ? 'bg-rose-500 text-white' 
              : 'bg-emerald-500 text-white'
            }`}>
              {item.type === ItemType.LOST ? 'Tìm đồ rơi' : 'Nhặt được đồ'}
            </span>

            {isOwner && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate(`/lost-found/${item.id}/edit`)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 hover:text-slate-900"
                >
                  <Pencil size={15} /> Sửa tin
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600 transition-all hover:bg-red-100 disabled:opacity-50"
                  title="Gỡ bài đăng"
                >
                  <Trash2 size={15} /> {deleting ? 'Đang gỡ...' : 'Gỡ bài'}
                </button>
              </div>
            )}
          </div>

          <h1 className="text-4xl font-black text-slate-900 mb-4 leading-tight">{item.title}</h1>
          
          <div className="flex items-center gap-4 text-slate-400 text-sm font-medium mb-8">
            <div className="flex items-center gap-2">
              <Calendar size={18} className="text-indigo-500" />
              {new Date(item.createdAt).toLocaleDateString('vi-VN')}
            </div>
            <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
            <div className="flex items-center gap-2">
              <MapPin size={18} className="text-indigo-500" />
              {item.location}
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-100 rounded-3xl p-6 mb-8">
             <h3 className="text-sm font-black text-slate-400 uppercase tracking-widest mb-3">Mô tả chi tiết</h3>
             <p className="text-slate-700 leading-relaxed font-medium whitespace-pre-wrap">{item.description}</p>
          </div>

          {/* AI Analysis Results */}
          {item.analysisStatus === 'COMPLETED' && (item.detectedType || item.extracted?.studentId) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 mb-8 space-y-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-3xl border border-indigo-100 dark:border-indigo-700 text-indigo-700 dark:text-indigo-200"
            >
              <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-200 font-black text-sm uppercase">
                <ScanLine size={18} />
                Kết quả phân tích AI
              </div>
              {item.detectedType && item.detectedType !== 'unknown' && (
                <div className="flex items-center gap-2">
                  <BadgeCheck size={16} className="text-emerald-500 dark:text-emerald-300" />
                  <span className="text-sm text-slate-700 dark:text-slate-200">
                    <span className="font-bold">Loại đồ vật:</span> {item.detectedType}
                  </span>
                </div>
              )}
              {item.extracted?.studentId && (
                <div className="flex items-center gap-2">
                  <ShieldCheck size={16} className="text-indigo-500 dark:text-indigo-300" />
                  <span className="text-sm text-slate-700 dark:text-slate-200">
                    <span className="font-bold">MSSV phát hiện:</span>{' '}
                    <span className="font-mono bg-indigo-100 dark:bg-indigo-800 px-2 py-0.5 rounded text-indigo-900 dark:text-indigo-100">{item.extracted.studentId}</span>
                  </span>
                </div>
              )}
            </motion.div>
          )}

          {/* Hiển thị câu hỏi xác minh nếu có — chỉ hiển thị với người không phải chủ */}
          {!isOwner && item.verificationQuestion && item.status === 'OPEN' && (
            <div className="bg-amber-50 border border-amber-200 rounded-3xl p-5 mb-6 flex items-start gap-3">
              <span className="text-amber-500 text-xl mt-0.5">❓</span>
              <div>
                <h4 className="text-xs font-black text-amber-600 uppercase tracking-widest mb-1">Câu hỏi xác minh quyền sở hữu</h4>
                <p className="text-sm text-amber-900 font-medium">{item.verificationQuestion}</p>
                <p className="text-xs text-amber-600 mt-1">Bạn sẽ cần trả lời câu hỏi này khi xác nhận tìm thấy đồ vật.</p>
              </div>
            </div>
          )}

           <div className="mt-auto space-y-4">
              <div className="flex items-center gap-4 bg-indigo-50 border border-indigo-100 p-6 rounded-3xl">
                 <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm border border-indigo-100">
                    <MessageCircle size={24} />
                 </div>
                 <div>
                    <h4 className="text-xs font-black text-indigo-400 uppercase tracking-widest leading-none mb-1">Thông tin liên hệ</h4>
                    <p className="text-lg font-black text-indigo-900">{item.contactInfo}</p>
                 </div>
              </div>

              <div className="flex items-center gap-4 p-6 border border-slate-100 rounded-3xl mb-8">
                 <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400">
                    <UserIcon size={24} />
                 </div>
                 <div>
                    <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Sinh viên đăng bài</h4>
                    <p className="text-sm font-bold text-slate-700">Mã sinh viên: {item.studentId}</p>
                 </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                {!isOwner && item.status === 'OPEN' && item.type === 'FOUND' && (
                  <button 
                    onClick={handleClaim}
                    disabled={claiming}
                    className="flex-1 flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white transition-all hover:bg-slate-800 disabled:opacity-50"
                  >
                    <Hand size={16} />
                    {claiming ? 'ĐANG XỬ LÝ...' : 'TÔI TÌM THẤY ĐỒ NÀY'}
                  </button>
                )}
                <button 
                  onClick={() => chatService.triggerOpenChat(item.studentId, "Chủ bài đăng")}
                  disabled={isOwner}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed group"
                >
                  <MessageCircle size={16} className="group-hover:rotate-12 transition-transform" />
                  NHẮN TIN NGAY
                </button>
                
                <a 
                  href={`tel:${item.contactInfo}`}
                  className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 transition-all hover:border-slate-300 hover:bg-slate-50"
                >
                  GỌI ĐIỆN CHO CHỦ BÀI
                </a>
              </div>
              {!isOwner && (
                <button 
                  onClick={handleReport}
                  className="w-full mt-3 flex items-center justify-center gap-2 py-3 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-2xl font-bold text-sm transition-all"
                >
                  <Flag size={16} />
                  Tố cáo bài đăng
                </button>
              )}
           </div>
        </div>
      </div>
    </div>

  );
};


export default LostFoundDetail;
