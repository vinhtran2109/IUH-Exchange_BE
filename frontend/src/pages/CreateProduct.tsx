import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Package, Camera, Tag, DollarSign, TextQuote, Send, ArrowLeft, Loader2, X, GripVertical } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { productService } from '../services/productService';

const MAX_IMAGES = 8;

const CreateProduct: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ title: '', price: '', description: '', category: 'ELECTRONICS', condition: 'NEW' });
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    if (images.length + newFiles.length > MAX_IMAGES) { alert(`Tối đa ${MAX_IMAGES} ảnh.`); return; }
    setImages([...images, ...newFiles]);
    setPreviews([...previews, ...newFiles.map(f => URL.createObjectURL(f))]);
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setImages(images.filter((_, i) => i !== index));
    setPreviews(previews.filter((_, i) => i !== index));
  };

  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const newImages = [...images]; const newPreviews = [...previews];
    const [draggedImg] = newImages.splice(dragIndex, 1); const [draggedPrev] = newPreviews.splice(dragIndex, 1);
    newImages.splice(index, 0, draggedImg); newPreviews.splice(index, 0, draggedPrev);
    setImages(newImages); setPreviews(newPreviews); setDragIndex(index);
  };
  const handleDragEnd = () => setDragIndex(null);

  const uploadSingleImage = async (file: File): Promise<string> => {
    const uploadInfo = await productService.getUploadUrl(file.name, file.type);
    if (!uploadInfo.success) throw new Error('Failed to get upload URL');
    const { presignedUrl, publicUrl } = uploadInfo.data;
    await fetch(presignedUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } });
    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (images.length === 0) { alert('Vui lòng chọn ít nhất 1 ảnh'); return; }
    setLoading(true);
    try {
      const imageUrls = await Promise.all(images.map(f => uploadSingleImage(f)));
      const response = await productService.createProduct({ ...formData, price: parseFloat(formData.price), imageUrls });
      if (response.success) { alert('Đăng bán thành công!'); navigate('/'); }
    } catch (error: any) {
      alert('Lỗi: ' + (error.response?.data?.message || error.message || 'Không thể đăng bài.'));
    } finally { setLoading(false); }
  };

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Link to="/" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-900 text-sm font-medium mb-6 transition-colors">
        <ArrowLeft size={16} /> Quay lại
      </Link>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-5">
          {/* Left: Image Upload */}
          <div className="md:col-span-2 bg-slate-50 p-5 border-r border-slate-200 flex flex-col items-center justify-center">
            <div className="w-full grid grid-cols-2 gap-2">
              {previews.map((preview, i) => (
                <div key={i} draggable onDragStart={() => handleDragStart(i)} onDragOver={(e) => handleDragOver(e, i)} onDragEnd={handleDragEnd}
                  className={`relative aspect-square rounded-lg border overflow-hidden group cursor-move transition-all ${dragIndex === i ? 'border-slate-400 scale-95' : 'border-slate-200 hover:border-slate-400'}`}>
                  <img src={preview} alt={`Preview ${i + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute top-1 left-1 w-5 h-5 bg-black/40 rounded flex items-center justify-center"><GripVertical size={10} className="text-white" /></div>
                  <button type="button" onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <X size={10} className="text-white" />
                  </button>
                  {i === 0 && <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-slate-900 text-white text-[9px] font-medium rounded">Ảnh bìa</span>}
                </div>
              ))}
              {images.length < MAX_IMAGES && (
                <label className="aspect-square rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-slate-400 transition-colors">
                  <Camera size={20} className="text-slate-400 mb-0.5" />
                  <span className="text-[10px] font-medium text-slate-400">{images.length === 0 ? 'Tải ảnh' : 'Thêm'}</span>
                  <input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
                </label>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-2 text-center">Kéo thả để sắp xếp. Tối đa {MAX_IMAGES} ảnh.</p>
          </div>

          {/* Right: Form */}
          <div className="md:col-span-3 p-6">
            <h1 className="text-xl font-bold text-slate-900 mb-5 flex items-center gap-2">
              <Package size={20} className="text-slate-500" /> Đăng bán đồ mới
            </h1>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Tiêu đề</label>
                <input required name="title" placeholder="Giáo trình, laptop,..." className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:border-slate-400 focus:outline-none text-sm" value={formData.title} onChange={handleChange} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">Giá (VNĐ)</label>
                  <input required type="number" name="price" placeholder="0" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:border-slate-400 focus:outline-none text-sm font-medium" value={formData.price} onChange={handleChange} />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">Danh mục</label>
                  <select name="category" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:border-slate-400 focus:outline-none text-sm" value={formData.category} onChange={handleChange}>
                    <option value="ELECTRONICS">Điện tử</option>
                    <option value="BOOKS">Sách & Tài liệu</option>
                    <option value="FASHION">Thời trang</option>
                    <option value="TOOLS">Đồ dùng học tập</option>
                    <option value="OTHERS">Khác</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Tình trạng</label>
                <select name="condition" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:border-slate-400 focus:outline-none text-sm" value={formData.condition} onChange={handleChange}>
                  <option value="NEW">Mới</option>
                  <option value="LIKE_NEW">Như mới</option>
                  <option value="GOOD">Tốt</option>
                  <option value="FAIR">Còn dùng được</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Mô tả</label>
                <textarea required name="description" rows={3} placeholder="Tình trạng, mô tả chi tiết..." className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:border-slate-400 focus:outline-none text-sm resize-none" value={formData.description} onChange={handleChange} />
              </div>

              <button type="submit" disabled={loading} className="w-full py-2.5 bg-slate-900 text-white rounded-lg font-medium text-sm hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {loading ? 'Đang đăng...' : 'Đăng tin'}
              </button>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default CreateProduct;
