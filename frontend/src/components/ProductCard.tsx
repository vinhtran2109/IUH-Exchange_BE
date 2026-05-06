import React from 'react';
import { Tag, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ProductCardProps {
  product: {
    id: string;
    title: string;
    price: number;
    category: string;
    condition: string;
    imageUrls: string[];
    sellerId?: string;
  };
}

const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  // Format giá tiền sang VNĐ
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  const mainImage = product.imageUrls && product.imageUrls.length > 0
    ? product.imageUrls[0]
    : 'https://placehold.co/400x400/indigo/white?text=IUH+Exchange';

  return (
    <div className="group bg-white rounded-[2rem] border border-slate-100 overflow-hidden hover:shadow-2xl hover:shadow-indigo-100 hover:border-indigo-100 transition-all duration-300 transform hover:-translate-y-2 relative">
      {/* Product Image */}
      <div className="relative aspect-square overflow-hidden bg-slate-50">
        <img 
          src={mainImage} 
          alt={product.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        
        {/* Condition Tag */}
        <div className="absolute top-4 left-4">
          <span className="px-3 py-1 bg-white/90 backdrop-blur-md text-indigo-600 text-[10px] font-bold uppercase tracking-wider rounded-full shadow-sm border border-indigo-50">
            {product.condition}
          </span>
        </div>
      </div>

      {/* Product Info */}
      <div className="p-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[10px] font-bold flex items-center gap-1">
             <Tag size={10} />
             {product.category}
          </div>
        </div>

        <h3 className="text-lg font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-tight mb-2 h-12">
          {product.title}
        </h3>

        <div className="flex items-end justify-between mt-4">
          <div>
            <p className="text-sm text-slate-400 font-medium mb-0.5 uppercase tracking-tighter scale-75 origin-left">Giá sinh viên</p>
            <p className="text-xl font-black text-indigo-600">
              {formatPrice(product.price)}
            </p>
          </div>
          
          <Link 
            to={`/products/${product.id}`}
            className="w-10 h-10 bg-slate-900 text-white rounded-xl flex items-center justify-center transition-all group-hover:bg-indigo-600 shadow-lg shadow-slate-100 group-hover:shadow-indigo-100"
          >
            <ArrowRight size={18} />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
