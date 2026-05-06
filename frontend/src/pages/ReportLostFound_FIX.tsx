// @ts-nocheck
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  ArrowLeft, 
  Type, 
  MapPin, 
  MessageCircle, 
  Info,
  Send,
  Plus,
  AlertCircle,

  Clock,
  Camera
} from 'lucide-react';
import { lostFoundService, ItemType } from '../services/lostFoundService';

const ReportLostFound: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: ItemType.LOST as ItemType,
    location: '',
    contactInfo: '',
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setImagePreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.description || !formData.location || !formData.contactInfo) {
      setError('Vui lòng điền đầy đủ các thông tin bắt buộc');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      let finalImageUrl = '';

      // Upload ảnh nếu có
      if (imageFile) {
        const { data: uploadData } = await lostFoundService.getUploadUrl(imageFile.name, imageFile.type);
        const { presignedUrl, publicUrl } = uploadData;

        await fetch(presignedUrl, {
          method: 'PUT',
          body: imageFile,
          headers: { 'Content-Type': imageFile.type }
        });

        finalImageUrl = publicUrl;
      }

      const response = await lostFoundService.createItem({
        ...formData,
        imageUrls: finalImageUrl ? [finalImageUrl] : []
      });

      if (response.success) {
        alert("Đăng tin thành công! Hy vọng bạn sớm tìm thấy đồ.");
        navigate('/lost-found');
      }
    } catch (err: any) {

      setError(err.response?.data?.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-12 px-4">
      <button 
        onClick={() => navigate('/lost-found')}
        className="flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-medium mb-8 transition-colors group"
      >
        <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
        Quay lại Trung tâm Thất lạc
      </button>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 md:p-12 shadow-2xl shadow-indigo-100/50">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-black text-slate-900 mb-2">Đăng tin <span className="text-indigo-600">Thất lạc</span></h1>
          <p className="text-slate-500">Giúp cộng đồng IUH bằng cách cung cấp thông tin chính xác nhất.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Item Type Selector */}
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setFormData({...formData, type: ItemType.LOST})}
              className={`py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-2 border-2 ${
                formData.type === ItemType.LOST
                ? 'bg-rose-50 border-rose-200 text-rose-600'
                : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200 shadow-sm'
              }`}
            >
              <AlertCircle size={20} />
              TÔI BỊ MẤT ĐỒ
            </button>
            <button
              type="button"
              onClick={() => setFormData({...formData, type: ItemType.FOUND})}
              className={`py-4 rounded-2xl font-black transition-all flex items-center justify-center gap-2 border-2 ${
                formData.type === ItemType.FOUND
                ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                : 'bg-white border-slate-100 text-slate-400 hover:border-slate-200 shadow-sm'
              }`}
            >
              <Clock size={20} />
              TÔI NHẶT ĐƯỢC ĐỒ
            </button>
          </div>

          <div className="space-y-6">
            {/* Title */}
            <div className="space-y-2">
              <label className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-2 pl-1">
                <Type size={16} className="text-indigo-500" />
                Tiêu đề ngắn gọn
              </label>
              <input
                required
                type="text"
                placeholder="Ví dụ: Mất ví Sen nợ ở nhà xe H"
                className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 focus:ring-4 focus:ring-indigo-100 transition-all font-medium text-slate-800"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Location */}
              <div className="space-y-2">
                <label className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-2 pl-1">
                  <MapPin size={16} className="text-indigo-500" />
                  Khu vực / Tòa nhà
                </label>
                <input
                  required
                  type="text"
                  placeholder="Ví dụ: Tầng 4, Nhà V"
                  className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 focus:ring-4 focus:ring-indigo-100 transition-all font-medium text-slate-800"
                  value={formData.location}
                  onChange={(e) => setFormData({...formData, location: e.target.value})}
                />
              </div>

              {/* Contact Info */}
              <div className="space-y-2">
                <label className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-2 pl-1">
                  <MessageCircle size={16} className="text-indigo-500" />
                  Thông tin liên hệ
                </label>
                <input
                  required
                  type="text"
                  placeholder="SĐT hoặc Zalo của bạn"
                  className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 focus:ring-4 focus:ring-indigo-100 transition-all font-medium text-slate-800"
                  value={formData.contactInfo}
                  onChange={(e) => setFormData({...formData, contactInfo: e.target.value})}
                />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <label className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-2 pl-1">
                <Info size={16} className="text-indigo-500" />
                Mô tả chi tiết đồ vật
              </label>
              <textarea
                required
                rows={4}
                placeholder="Mô tả đặc điểm nhận dạng (màu sắc, nhãn hiệu...)"
                className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 focus:ring-4 focus:ring-indigo-100 transition-all font-medium text-slate-800 resize-none"
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
              />
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <label className="text-sm font-black text-slate-700 uppercase tracking-wider flex items-center gap-2 pl-1">
                <Camera size={16} className="text-indigo-500" />
                Hình ảnh minh họa (nếu có)
              </label>
              
              <div className="flex items-center gap-4">
                <label className="cursor-pointer flex flex-col items-center justify-center w-32 h-32 bg-slate-50 border-2 border-dashed border-slate-200 rounded-3xl hover:border-indigo-400 hover:bg-indigo-50 transition-all group">
                  <Plus size={24} className="text-slate-400 group-hover:text-indigo-500 transition-colors" />
                  <span className="text-[10px] font-bold text-slate-400 group-hover:text-indigo-500 mt-1 uppercase">Chọn ảnh</span>
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageChange} />
                </label>

                {imagePreview && (
                  <div className="relative w-32 h-32 rounded-3xl overflow-hidden shadow-md border border-slate-100">
                    <img src={imagePreview} className="w-full h-full object-cover" alt="Preview" />
                    <button 
                      type="button"
                      onClick={() => {setImageFile(null); setImagePreview(null);}}
                      className="absolute top-1 right-1 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-rose-600 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>


          {error && (
            <motion.div 
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              className="p-4 bg-rose-50 text-rose-600 rounded-2xl text-sm font-bold flex items-center gap-3 border border-rose-100"
            >
              <AlertCircle size={18} />
              {error}
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 shadow-b-4 hover:-translate-y-1 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-3"
          >
            {loading ? (
              <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <Send size={24} />
                ĐĂNG BẢN TIN NGAY
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ReportLostFound;
