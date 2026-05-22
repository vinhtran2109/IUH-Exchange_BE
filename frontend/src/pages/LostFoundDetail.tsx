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
  Hand
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
  const { user } = useAuthStore() as any;
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
    const removeListener = chatService.addNotificationListener((notification: any) => {
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
    } catch (error) {
      console.error("Failed to fetch details:", error);
    } finally {
      setLoading(false);
    }
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
    } catch (error) {
      toastError('Gỡ bài thất bại. Vui lòng thử lại.');
    } finally {
      setDeleting(false);
    }
  };

  const handleClaim = async () => {
    if (!item || !user) return;
    const confirmed = await confirm({
      title: 'Xác nhận tìm thấy',
      message: 'Xác nhận bạn đã tìm thấy đồ vật này?',
      confirmText: 'Xác nhận',
      cancelText: 'Hủy',
      variant: 'default',
    });
    if (!confirmed) return;
    try {
      setClaiming(true);
      const res = await lostFoundService.claimItem(item.id);
      if (res.success) {
        setItem({ ...item, status: 'CLAIMED' as any });
        toastSuccess('Đã xác nhận tìm thấy đồ vật!');
      }
    } catch (err: any) {
      toastError('Lỗi: ' + (err.response?.data?.message || 'Không thể xác nhận'));
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
    } catch (err: any) {
      toastError('Lỗi: ' + (err.response?.data?.message || 'Không thể gửi tố cáo'));
    }
  };

  if (loading) return <div className="max-w-7xl mx-auto px-4 py-32 text-center text-slate-400 font-bold">Đang tải dữ liệu...</div>;
  if (!item) return <div className="max-w-7xl mx-auto px-4 py-32 text-center text-slate-400 font-bold">Không tìm thấy thông tin.</div>;

  const isOwner = user?.id === item.studentId;

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
            className="aspect-[4/3] bg-slate-100 rounded-[3rem] overflow-hidden border border-slate-100 shadow-2xl shadow-indigo-100/50"
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
              <button 
                onClick={handleDelete}
                disabled={deleting}
                className="p-3 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-600 hover:text-white transition-all shadow-sm"
                title="Gỡ bài đăng"
              >
                <Trash2 size={20} />
              </button>
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
                    className="flex-1 flex items-center justify-center gap-3 px-8 py-5 bg-emerald-600 text-white rounded-[1.75rem] font-black shadow-2xl shadow-emerald-200 hover:bg-emerald-700 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                  >
                    <Hand size={22} />
                    {claiming ? 'ĐANG XỬ LÝ...' : 'TÔI TÌM THẤY ĐỒ NÀY'}
                  </button>
                )}
                <button 
                  onClick={() => chatService.triggerOpenChat(item.studentId, "Chủ bài đăng")}
                  disabled={isOwner}
                  className="flex-1 flex items-center justify-center gap-3 px-8 py-5 bg-indigo-600 text-white rounded-[1.75rem] font-black shadow-2xl shadow-indigo-200 hover:bg-indigo-700 transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:grayscale disabled:cursor-not-allowed group"
                >
                  <MessageCircle size={22} className="group-hover:rotate-12 transition-transform" />
                  NHẮN TIN NGAY
                </button>
                
                <a 
                  href={`tel:${item.contactInfo}`}
                  className="flex-1 flex items-center justify-center gap-3 px-8 py-5 bg-white text-slate-900 border-2 border-slate-100 rounded-[1.75rem] font-black hover:border-indigo-600 hover:text-indigo-600 transition-all hover:scale-[1.02] active:scale-95"
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
