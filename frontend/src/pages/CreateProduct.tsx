import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Package, Camera, Tag, DollarSign, TextQuote, Send, ArrowLeft, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { productService } from '../services/productService';

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
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setImage(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let finalImageUrl = "https://placehold.co/600x400/indigo/white?text=Product+Image";

      if (image) {
        // 1. Lấy Pre-signed URL từ Backend
        const uploadInfo = await productService.getUploadUrl(image.name, image.type);
        
        if (uploadInfo.success) {
          // ✅ FIX: Backend trả về presignedUrl và publicUrl
          const { presignedUrl, publicUrl } = uploadInfo.data;
          
          // 2. Đẩy ảnh trực tiếp lên S3 (Dùng fetch/axios chay)
          await fetch(presignedUrl, {
            method: 'PUT',
            body: image,
            headers: {
              'Content-Type': image.type
            }
          });
          
          finalImageUrl = publicUrl;
        }

      }

      // 3. Gửi toàn bộ dữ liệu (kèm URL ảnh thật) lên Backend để lưu vào MongoDB
      const productData = {
        ...formData,
        price: parseFloat(formData.price),
        imageUrls: [finalImageUrl]
      };

      const response = await productService.createProduct(productData);

      
      if (response.success) {
        alert("🎉 Chúc mừng! Món đồ của bạn đã được đăng bán thành công.");
        navigate('/');
      }
    } catch (error: any) {
      alert("⚠️ Lỗi: " + (error.response?.data?.message || "Không thể đăng bài. Vui lòng kiểm tra lại."));
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
             <div className="w-full aspect-square rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center overflow-hidden bg-white relative group cursor-pointer hover:border-indigo-300 transition-all">
                {preview ? (
                  <>
                    <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Camera className="text-white" size={32} />
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center text-slate-400">
                    <Camera size={48} className="mb-2" />
                    <p className="text-xs font-bold uppercase tracking-widest">Tải ảnh sản phẩm</p>
                  </div>
                )}
                <input 
                  type="file" 
                  accept="image/*" 
                  onChange={handleImageChange}
                  className="absolute inset-0 opacity-0 cursor-pointer"
                />
             </div>
             <p className="text-xs text-slate-400 leading-relaxed px-6">
                Chụp ảnh rõ nét, đầy đủ ánh sáng sẽ giúp món đồ của bạn "bay" nhanh hơn ⚡
             </p>
          </div>

          {/* Right: Form Info */}
          <div className="p-10">
            <h1 className="text-3xl font-black text-slate-900 mb-8 flex items-center gap-3">
               <Package className="text-indigo-600" size={32} />
               Đăng bán đồ mới
            </h1>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Tiêu đề */}
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
                {/* Giá tiền */}
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
                {/* Danh mục */}
                <div className="space-y-1.5">
                  <label className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                    Danh mục
                  </label>
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
                <label className="text-xs font-black uppercase text-slate-400 tracking-wider flex items-center gap-2">
                  Tình trạng
                </label>
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

              {/* Mô tả */}
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

              {/* Submit Button */}
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
