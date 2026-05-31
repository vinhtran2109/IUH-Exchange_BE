import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
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
  Camera,
  ShieldCheck,
  ScanLine,
  BadgeCheck
} from 'lucide-react';
import { lostFoundService, ItemType } from '../services/lostFoundService';
import { useToast } from '../components/Toast';

const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

const ReportLostFound: React.FC = () => {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { success: toastSuccess, error: toastError } = useToast();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEditMode = Boolean(id);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: ItemType.LOST as ItemType,
    location: '',
    contactInfo: '',
  });
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);

  // Consent checkboxes for AI analysis
  const [consentImageAnalysis, setConsentImageAnalysis] = useState(false);
  const [consentMssvExtraction, setConsentMssvExtraction] = useState(false);

  // AI analysis result after submission
  const [analysisResult, setAnalysisResult] = useState<{
    detectedType?: string;
    studentId?: string;
    confidence?: number;
    matchCount?: number;
  } | null>(null);

  // BUG FIX #1: Tách trạng thái "submit thành công" ra riêng.
  // Không navigate ngay mà render kết quả AI trước, để user thấy.
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditMode || !id) return;

    const loadItem = async () => {
      try {
        setLoading(true);
        const response = await lostFoundService.getItemById(id);
        if (response.success && response.data) {
          const item = response.data;
          setFormData({
            title: item.title || '',
            description: item.description || '',
            type: item.type || ItemType.LOST,
            location: item.location || '',
            contactInfo: item.contactInfo || '',
          });
          setExistingImageUrls(item.imageUrls || []);
          setImagePreview(item.imageUrls?.[0] || null);
          setConsentImageAnalysis(Boolean(item.consentImageAnalysis));
          setConsentMssvExtraction(Boolean(item.consentMssvExtraction));
        }
      } catch (err) {
        setError('Không thể tải bài đăng để chỉnh sửa.');
      } finally {
        setLoading(false);
      }
    };

    loadItem();
  }, [id, isEditMode]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;

    const file = e.target.files[0];
    if (!file.type.startsWith('image/')) {
      setError('File không hợp lệ. Vui lòng chọn tệp ảnh.');
      setImageFile(null);
      e.target.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setError('Ảnh quá lớn. Vui lòng chọn ảnh <= 10MB.');
      setImageFile(null);
      e.target.value = '';
      return;
    }

    setError(null);
    setImageFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const uploadImageToPresignedUrl = async (presignedUrl: string, file: File) => {
    const attempts = 2;
    let lastError: Error | null = null;

    for (let i = 1; i <= attempts; i += 1) {
      try {
        const uploadResponse = await fetch(presignedUrl, {
          method: 'PUT',
          body: file,
          headers: { 'Content-Type': file.type },
        });

        if (!uploadResponse.ok) {
          const responseText = await uploadResponse.text();
          throw new Error(`Upload S3 thất bại (HTTP ${uploadResponse.status}): ${responseText || 'No response body'}`);
        }

        return;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error('Upload ảnh thất bại');
      }
    }

    throw lastError || new Error('Upload ảnh thất bại');
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

      let finalImageUrls = existingImageUrls;

      // Upload ảnh nếu có
      if (imageFile) {
        const { data: uploadData } = await lostFoundService.getUploadUrl(imageFile.name, imageFile.type);
        const { presignedUrl, publicUrl } = uploadData;

        if (!presignedUrl || !publicUrl) {
          throw new Error('Không nhận được upload URL hợp lệ từ server');
        }

        await uploadImageToPresignedUrl(presignedUrl, imageFile);

        finalImageUrls = [publicUrl];
      }

      const payload = {
        ...formData,
        images: finalImageUrls,
        consentImageAnalysis,
        consentMssvExtraction,
      };

      const response = isEditMode && id
        ? await lostFoundService.updateItem(id, payload)
        : await lostFoundService.createItem(payload);

      if (response.success) {
        if (isEditMode && id) {
          toastSuccess('Cập nhật bài đăng thành công!');
          navigate(`/lost-found/${id}`);
          return;
        }

        const data = response.data;

        // BUG FIX #1: Set result TRƯỚC, KHÔNG navigate ngay.
        // BUG FIX #12: Đọc `extracted.studentId` đúng field từ backend response.
        if (data?.detectedType || data?.extracted?.studentId || data?.matches?.length > 0) {
          setAnalysisResult({
            detectedType: data.detectedType,
            studentId: data.extracted?.studentId || data.studentId,
            confidence: data.analysisConfidence || data.confidence,
            matchCount: data.matches?.length ?? 0,
          });
        }

        toastSuccess('Đăng tin thành công! Hy vọng bạn sớm tìm thấy đồ.');
        setSubmitSuccess(true); // ← Hiển thị panel kết quả, KHÔNG navigate
      }
    } catch (err: any) {
      const errorMessage = err?.response?.data?.message || err?.message || 'Đã có lỗi xảy ra. Vui lòng thử lại.';
      setError(errorMessage);
      toastError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // BUG FIX #1: Hiển thị kết quả sau submit thay vì render form
  if (submitSuccess) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-100 dark:border-slate-700 p-8 md:p-12 shadow-2xl shadow-indigo-100/50 text-center space-y-6">
          <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/20 rounded-full flex items-center justify-center mx-auto">
            <BadgeCheck size={40} className="text-emerald-500 dark:text-emerald-400" />
          </div>
          <div>
            <h1 className="text-3xl font-black text-slate-900 mb-2">Đăng tin <span className="text-emerald-600">thành công!</span></h1>
            <p className="text-slate-500">Tin của bạn đã được đăng lên hệ thống IUH Exchange.</p>
          </div>

          {/* Kết quả AI nếu có */}
          {analysisResult && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-5 bg-indigo-50 dark:bg-indigo-900/20 rounded-2xl border border-indigo-100 dark:border-indigo-700 text-left space-y-2 text-indigo-700 dark:text-indigo-200"
            >
              <div className="flex items-center gap-2 text-indigo-700 dark:text-indigo-200 font-black text-sm uppercase mb-3">
                <ScanLine size={16} />
                Kết quả phân tích AI
              </div>
              {analysisResult.detectedType && analysisResult.detectedType !== 'unknown' && (
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  <span className="font-bold">Loại đồ vật:</span> {analysisResult.detectedType}
                  {analysisResult.confidence && (
                    <span className="ml-2 text-xs text-slate-500 dark:text-slate-400">({Math.round(analysisResult.confidence * 100)}% tin cậy)</span>
                  )}
                </p>
              )}
              {analysisResult.studentId && (
                <p className="text-sm text-slate-700 dark:text-slate-200">
                  <span className="font-bold">MSSV phát hiện:</span>{' '}
                  <span className="font-mono bg-indigo-100 dark:bg-indigo-800 px-2 py-0.5 rounded">{analysisResult.studentId}</span>
                </p>
              )}
              {(analysisResult.matchCount ?? 0) > 0 && (
                <p className="text-sm text-emerald-700 dark:text-emerald-300 font-bold">
                  🎯 Tìm thấy {analysisResult.matchCount} tin có thể khớp!
                </p>
              )}
            </motion.div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => navigate('/lost-found')}
              className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
            >
              Xem danh sách tin
            </button>
            <button
              onClick={() => { setSubmitSuccess(false); setAnalysisResult(null); setImageFile(null); setImagePreview(null); setFormData({ title: '', description: '', type: 'LOST' as ItemType, location: '', contactInfo: '' }); }}
              className="px-6 py-4 border-2 border-slate-200 text-slate-600 rounded-2xl font-bold hover:border-indigo-300 transition-all"
            >
              Đăng thêm
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          <h1 className="text-4xl font-black text-slate-900 mb-2">
            {isEditMode ? 'Chỉnh sửa' : 'Đăng tin'} <span className="text-indigo-600">Thất lạc</span>
          </h1>
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

                {(imagePreview || (isEditMode && existingImageUrls.length > 0)) && (
                  <div className="relative w-32 h-32 rounded-3xl overflow-hidden shadow-md border border-slate-100">
                    <img src={imagePreview || existingImageUrls[0]} className="w-full h-full object-cover" alt="Preview" />
                    <button
                      type="button"
                      onClick={() => { setImageFile(null); setImagePreview(null); setExistingImageUrls([]); }}
                      className="absolute top-1 right-1 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center shadow-lg hover:bg-rose-600 transition-colors"
                    >
                      ×
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* AI Consent Checkboxes */}
            {imageFile && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-3 p-5 bg-indigo-50/50 rounded-2xl border border-indigo-100"
              >
                <div className="flex items-center gap-2 mb-2">
                  <ScanLine size={18} className="text-indigo-500" />
                  <span className="text-sm font-black text-indigo-700 uppercase tracking-wider">Phân tích AI (tùy chọn)</span>
                </div>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={consentImageAnalysis}
                    onChange={(e) => {
                      setConsentImageAnalysis(e.target.checked);
                      if (!e.target.checked) setConsentMssvExtraction(false);
                    }}
                    className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                      <ShieldCheck size={14} />
                      Cho phép nhận diện đồ vật bằng AI
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Hệ thống sẽ phân tích ảnh để tự động phân loại đồ vật và gợi ý khớp với tin đối chiếu.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={consentMssvExtraction}
                    onChange={(e) => setConsentMssvExtraction(e.target.checked)}
                    disabled={!consentImageAnalysis}
                    className="mt-1 w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 disabled:opacity-40"
                  />
                  <div>
                    <span className="text-sm font-bold text-slate-700 group-hover:text-indigo-600 transition-colors flex items-center gap-1.5">
                      <BadgeCheck size={14} />
                      Cho phép trích xuất MSSV từ ảnh
                    </span>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Nếu ảnh chứa thẻ sinh viên, hệ thống sẽ OCR để tìm MSSV và tự động thông báo cho chủ nhân.
                    </p>
                  </div>
                </label>
              </motion.div>
            )}
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
                {isEditMode ? 'LƯU THAY ĐỔI' : 'ĐĂNG BẢN TIN NGAY'}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ReportLostFound;
