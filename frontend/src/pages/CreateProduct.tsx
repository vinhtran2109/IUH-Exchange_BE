import React, { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Package, Camera, Tag, DollarSign, TextQuote, Send, ArrowLeft, Loader2, X, GripVertical } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { productService } from '../services/productService';

const MAX_IMAGES = 8;

const CreateProduct: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    price: '',
    description: '',
    category: 'ELECTRONICS',
    condition: 'NEW',
  });
  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    const total = images.length + newFiles.length;
    if (total > MAX_IMAGES) {
      alert(`Tối đa ${MAX_IMAGES} ảnh. Bạn đang chọn ${newFiles.length} ảnh mới, đã có ${images.length} ảnh.`);
      return;
    }
    const updated = [...images, ...newFiles];
    const newPreviews = newFiles.map(f => URL.createObjectURL(f));
    setImages(updated);
    setPreviews([...previews, ...newPreviews]);
    e.target.value = ''; // reset input
  };

  const removeImage = (index: number) => {
    URL.revokeObjectURL(previews[index]);
    setImages(images.filter((_, i) => i !== index));
    setPreviews(previews.filter((_, i) => i !== index));
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const newImages = [...images];
    const newPreviews = [...previews];
    const [draggedImg] = newImages.splice(dragIndex, 1);
    const [draggedPrev] = newPreviews.splice(dragIndex, 1);
    newImages.splice(index, 0, draggedImg);
    newPreviews.splice(index, 0, draggedPrev);
    setImages(newImages);
    setPreviews(newPreviews);
    setDragIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  const uploadSingleImage = async (file: File): Promise<string> => {
    const uploadInfo = await productService.getUploadUrl(file.name, file.type);
    if (!uploadInfo.success) throw new Error('Failed to get upload URL');
    const { presignedUrl, publicUrl } = uploadInfo.data;
    await fetch(presignedUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type },
    });
    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (images.length === 0) {
      alert('Vui lòng chọn ít nhất 1 ảnh sản phẩm');
      return;
    }
    setLoading(true);

    try {
      // Upload all images in parallel
      const uploadPromises = images.map(file => uploadSingleImage(file));
      const imageUrls = await Promise.all(uploadPromises);

      const productData = {
        ...formData,
        price: parseFloat(formData.price),
        imageUrls,
      };

      const response = await productService.createProduct(productData);
      if (response.success) {
        alert('🎉 Chúc mừng! Món đồ của bạn đã được đăng bán thành công.');
        navigate('/');
      }
    } catch (error: any) {
      alert('⚠️ Lỗi: ' + (error.response?.data?.message || error.message || 'Không thể đăng bài.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <Link to="/" className="inline-flex items-center gap-2 text-slate-500 hover:text-indigo-600 font-medium mb-8 transition-colors">
        <ArrowLeft size={18} />
        Quay lại trang chủ
      </Link>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-[2.5rem] border border-slate-100 shadow-2xl shadow-indigo-100/50 overflow-hidden"
      >
        <div className="grid grid-cols-1 md:grid-cols-2">
          {/* Left: Image Upload Area */}
          <div className="bg-slate-50 p-8 border-r border-slate-100 flex flex-col items-center justify-center text-center space-y-4">
            {/* Image Grid */}
            <div className="w-full grid grid-cols-2 gap-3">
              {previews.map((preview, i) => (
                <div
                  key={i}
                  draggable
                  onDragStart={() => handleDragStart(i)}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDragEnd={handleDragEnd}
                  className={`relative aspect-square rounded-2xl border-2 overflow-hidden group cursor-move transition-all ${
                    dragIndex === i ? 'border-indigo-500 scale-95 opacity-70' : 'border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  <img src={preview} alt={`Preview ${i + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute top-1 left-1 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center">
                    <GripVertical size={12} className="text-white" />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeImage(i); }}
                    className="absolute top-1 right-1 w-6 h-6 bg-rose-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-rose-600"
                  >
                    <X size={12} className="text-white" />
                  </button>
                  {i === 0 && (
                    <span className="absolute bottom-1 left-1 px-2 py-0.5 bg-indigo-600 text-white text-[10px] font-bold rounded-full">
                      Ảnh bìa
                    </span>
                  )}
                </div>
              ))}

              {/* Add Image Button */}
              {images.length < MAX_IMAGES && (
                <label className="aspect-square rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-indigo-300 hover:bg-white transition-all">
                  <Camera size={24} className="text-slate-400 mb-1" />
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    {images.length === 0 ? 'Tải ảnh' : 'Thêm ảnh'}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImageChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            <p className="text-xs text-slate-400 leading-relaxed px-6">
              Kéo thả để sắp xếp. Ảnh đầu tiên sẽ là ảnh bìa. Tối đa {MAX_IMAGES} ảnh ⚡
            </p>
          </div>

          {/* Right: Form Info */}
          <div className="p-10">
            <h1 className="text-3xl font-black text-slate-900 mb-8 flex items-center gap-3">
              <Package className="text-indigo-600" size={32} />
              Đăng bán đồ mới
            </h1>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                  <Tag size={14} /> Tiêu đề tin đăng
                </label>
                <input
                  required
                  name="title"
                  placeholder="Ví dụ: Giáo trình Kiến trúc Phần mềm"
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-medium"
                  value={formData.title}
                  onChange={handleChange}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                    <DollarSign size={14} /> Giá bán (VNĐ)
                  </label>
                  <input
                    required
                    type="number"
                    name="price"
                    placeholder="0"
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-bold text-indigo-600"
                    value={formData.price}
                    onChange={handleChange}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase text-slate-400 tracking-wider">Danh mục</label>
                  <select
                    name="category"
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-bold"
                    value={formData.category}
                    onChange={handleChange}
                  >
                    <option value="ELECTRONICS">Điện tử</option>
                    <option value="BOOKS">Sách & Tài liệu</option>
                    <option value="FASHION">Thời trang</option>
                    <option value="TOOLS">Đồ dùng học tập</option>
                    <option value="OTHERS">Khác</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-slate-400 tracking-wider">Tình trạng</label>
                <select
                  name="condition"
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-bold"
                  value={formData.condition}
                  onChange={handleChange}
                >
                  <option value="NEW">Mới</option>
                  <option value="LIKE_NEW">Như mới</option>
                  <option value="GOOD">Tốt</option>
                  <option value="FAIR">Còn dùng được</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                  <TextQuote size={14} /> Mô tả tình trạng
                </label>
                <textarea
                  required
                  name="description"
                  rows={4}
                  placeholder="Nói thêm về món đồ (Ví dụ: Còn mới 90%, không lỗi lầm...)"
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-indigo-100 focus:border-indigo-500 transition-all font-medium resize-none"
                  value={formData.description}
                  onChange={handleChange}
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-lg shadow-xl shadow-indigo-100 hover:bg-indigo-700 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {loading ? <Loader2 className="animate-spin" /> : <Send size={24} />}
                {loading ? 'Đang rao bán...' : 'ĐĂNG TIN NGAY'}
              </button>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default CreateProduct;
