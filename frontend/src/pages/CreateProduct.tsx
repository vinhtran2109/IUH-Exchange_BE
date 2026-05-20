import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Package, Camera, Send, ArrowLeft, Loader2, X, GripVertical, Save } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { productService } from '../services/productService';
import type { ProductPayload } from '../services/productService';
import { useToast } from '../components/Toast';

const MAX_IMAGES = 5;

type ImageItem = {
  id: string;
  previewUrl: string;
  uploadedUrl?: string;
  file?: File;
};

const CreateProduct: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isEditMode = Boolean(id);
  const { success: toastSuccess, error: toastError, warning: toastWarning } = useToast();
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(isEditMode);
  const [formData, setFormData] = useState({
    title: '',
    price: '',
    description: '',
    category: 'ELECTRONICS',
    condition: 'NEW',
    listingType: 'SELL',
    tradeWanted: '',
    allowOffers: true
  });
  const [imageItems, setImageItems] = useState<ImageItem[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const pageTitle = useMemo(() => (isEditMode ? 'Chỉnh sửa tin đăng' : 'Đăng bán đồ mới'), [isEditMode]);

  useEffect(() => {
    if (!isEditMode || !id) return;

    const loadProduct = async () => {
      try {
        const response = await productService.getProductById(id);
        if (!response.success) throw new Error('Cannot load product');

        const product = response.data;
        setFormData({
          title: product.title || '',
          price: String(product.price ?? ''),
          description: product.description || '',
          category: product.category || 'ELECTRONICS',
          condition: product.condition || 'NEW',
          listingType: product.listingType || 'SELL',
          tradeWanted: product.tradeWanted || '',
          allowOffers: product.allowOffers !== false
        });
        setImageItems(
          (product.imageUrls || []).map((url: string, index: number) => ({
            id: `existing-${index}`,
            previewUrl: url,
            uploadedUrl: url
          }))
        );
      } catch {
        toastError('Không thể tải tin đăng để chỉnh sửa.');
        navigate(id ? `/products/${id}` : '/');
      } finally {
        setInitialLoading(false);
      }
    };

    loadProduct();
  }, [id, isEditMode, navigate]);

  useEffect(() => {
    return () => {
      imageItems.forEach((item) => {
        if (item.file) URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, [imageItems]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData((current) => ({ ...current, [e.target.name]: e.target.value }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const newFiles = Array.from(e.target.files);
    if (imageItems.length + newFiles.length > MAX_IMAGES) {
      toastWarning(`Tối đa ${MAX_IMAGES} ảnh. Vui lòng chọn lại.`);
      return;
    }

    const nextItems = newFiles.map((file, index) => ({
      id: `new-${Date.now()}-${index}`,
      file,
      previewUrl: URL.createObjectURL(file)
    }));

    setImageItems((current) => [...current, ...nextItems]);
    e.target.value = '';
  };

  const removeImage = (index: number) => {
    setImageItems((current) => {
      const target = current[index];
      if (target?.file) URL.revokeObjectURL(target.previewUrl);
      return current.filter((_, i) => i !== index);
    });
  };

  const handleDragStart = (index: number) => setDragIndex(index);

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;

    setImageItems((current) => {
      const nextItems = [...current];
      const [draggedItem] = nextItems.splice(dragIndex, 1);
      nextItems.splice(index, 0, draggedItem);
      return nextItems;
    });
    setDragIndex(index);
  };

  const handleDragEnd = () => setDragIndex(null);

  const uploadSingleImage = async (file: File): Promise<string> => {
    const uploadInfo = await productService.getUploadUrl(file.name, file.type);
    if (!uploadInfo.success) throw new Error('Failed to get upload URL');

    const { presignedUrl, publicUrl } = uploadInfo.data;
    await fetch(presignedUrl, {
      method: 'PUT',
      body: file,
      headers: { 'Content-Type': file.type }
    });

    return publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (imageItems.length === 0) {
      toastWarning('Vui lòng chọn ít nhất 1 ảnh cho sản phẩm.');
      return;
    }

    setLoading(true);
    try {
      const imageUrls = await Promise.all(
        imageItems.map((item) => {
          if (item.uploadedUrl) return item.uploadedUrl;
          if (!item.file) throw new Error('Ảnh không hợp lệ');
          return uploadSingleImage(item.file);
        })
      );

      const payload: ProductPayload = {
        title: formData.title,
        description: formData.description,
        price: parseFloat(formData.price),
        category: formData.category,
        condition: formData.condition,
        imageUrls,
        listingType: formData.listingType as any,
        tradeWanted: formData.tradeWanted,
        allowOffers: formData.allowOffers
      };

      const response = isEditMode && id
        ? await productService.updateProduct(id, payload)
        : await productService.createProduct(payload);

      if (response.success) {
        toastSuccess(isEditMode ? 'Cập nhật tin đăng thành công!' : 'Đăng bán thành công! Tin đăng đang chờ duyệt.');
        navigate(isEditMode && id ? `/products/${id}` : '/');
      }
    } catch (error: any) {
      toastError('Lỗi: ' + (error.response?.data?.message || error.message || 'Không thể lưu tin đăng.'));
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-40">
        <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <Link to={isEditMode && id ? `/products/${id}` : '/'} className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-900 text-sm font-medium mb-6 transition-colors">
        <ArrowLeft size={16} /> Quay lại
      </Link>

      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="grid grid-cols-1 md:grid-cols-5">
          <div className="md:col-span-2 bg-slate-50 p-5 border-r border-slate-200 flex flex-col items-center justify-center">
            <div className="w-full grid grid-cols-2 gap-2">
              {imageItems.map((item, index) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => handleDragStart(index)}
                  onDragOver={(e) => handleDragOver(e, index)}
                  onDragEnd={handleDragEnd}
                  className={`relative aspect-square rounded-lg border overflow-hidden group cursor-move transition-all ${
                    dragIndex === index ? 'border-slate-400 scale-95' : 'border-slate-200 hover:border-slate-400'
                  }`}
                >
                  <img src={item.previewUrl} alt={`Preview ${index + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute top-1 left-1 w-5 h-5 bg-black/40 rounded flex items-center justify-center">
                    <GripVertical size={10} className="text-white" />
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeImage(index);
                    }}
                    className="absolute top-1 right-1 w-5 h-5 bg-red-500 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X size={10} className="text-white" />
                  </button>
                  {index === 0 && <span className="absolute bottom-1 left-1 px-1.5 py-0.5 bg-slate-900 text-white text-[9px] font-medium rounded">Ảnh bìa</span>}
                </div>
              ))}

              {imageItems.length < MAX_IMAGES && (
                <label className="aspect-square rounded-lg border-2 border-dashed border-slate-200 flex flex-col items-center justify-center cursor-pointer hover:border-slate-400 transition-colors">
                  <Camera size={20} className="text-slate-400 mb-0.5" />
                  <span className="text-[10px] font-medium text-slate-400">{imageItems.length === 0 ? 'Tải ảnh' : 'Thêm'}</span>
                  <input type="file" accept="image/*" multiple onChange={handleImageChange} className="hidden" />
                </label>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-2 text-center">Kéo thả để sắp xếp. Tối đa {MAX_IMAGES} ảnh.</p>
          </div>

          <div className="md:col-span-3 p-6">
            <h1 className="text-xl font-bold text-slate-900 mb-5 flex items-center gap-2">
              <Package size={20} className="text-slate-500" /> {pageTitle}
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
                  {formData.price && Number(formData.price) > 0 && (
                    <p className="mt-1 text-xs text-indigo-600 font-medium">
                      {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(formData.price))}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">Danh mục</label>
                  <select name="category" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:border-slate-400 focus:outline-none text-sm" value={formData.category} onChange={handleChange}>
                    <option value="ELECTRONICS">Điện tử &amp; Công nghệ</option>
                    <option value="BOOKS">Sách &amp; Tài liệu</option>
                    <option value="CLOTHING">Thời trang</option>
                    <option value="FURNITURE">Nội thất &amp; Đồ gia dụng</option>
                    <option value="SPORTS">Thể thao</option>
                    <option value="MUSIC">Nhạc cụ</option>
                    <option value="FOOD">Đồ ăn &amp; Đồ uống</option>
                    <option value="OTHER">Khác</option>
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
                  <option value="POOR">Cũ</option>
                </select>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">Kiểu giao dịch</label>
                  <select name="listingType" className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:border-slate-400 focus:outline-none text-sm" value={formData.listingType} onChange={handleChange}>
                    <option value="SELL">Bán</option>
                    <option value="GIVE_AWAY">Cho tặng</option>
                    <option value="TRADE">Đổi đồ</option>
                  </select>
                </div>
                <label className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm text-slate-700">
                  <input type="checkbox" checked={formData.allowOffers} onChange={(e) => setFormData((current) => ({ ...current, allowOffers: e.target.checked }))} />
                  Nhận trả giá/đề xuất đổi
                </label>
              </div>

              {formData.listingType === 'TRADE' && (
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">Muốn đổi lấy</label>
                  <input name="tradeWanted" placeholder="Ví dụ: giáo trình KTPM, chuột không dây..." className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:border-slate-400 focus:outline-none text-sm" value={formData.tradeWanted} onChange={handleChange} />
                </div>
              )}

              <div>
                <label className="text-xs font-medium text-slate-500 mb-1.5 block">Mô tả</label>
                <textarea required name="description" rows={3} placeholder="Tình trạng, mô tả chi tiết..." className="w-full px-3 py-2.5 border border-slate-200 rounded-lg focus:border-slate-400 focus:outline-none text-sm resize-none" value={formData.description} onChange={handleChange} />
              </div>

              <button type="submit" disabled={loading} className="w-full py-2.5 bg-slate-900 text-white rounded-lg font-medium text-sm hover:bg-slate-800 disabled:opacity-50 flex items-center justify-center gap-2 transition-all">
                {loading ? <Loader2 size={16} className="animate-spin" /> : isEditMode ? <Save size={16} /> : <Send size={16} />}
                {loading ? (isEditMode ? 'Đang lưu...' : 'Đang đăng...') : (isEditMode ? 'Lưu thay đổi' : 'Đăng tin')}
              </button>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default CreateProduct;
