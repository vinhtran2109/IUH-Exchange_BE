import React from 'react';
import { Tag, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { conditionLabel, conditionClass, categoryLabel, categoryClass } from '../utils/enums';

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
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(price);
  };

  const mainImage = product.imageUrls && product.imageUrls.length > 0
    ? product.imageUrls[0]
    : 'https://placehold.co/400x400/e2e8f0/94a3b8?text=IUH';

  return (
    <div className="group bg-white rounded-[12px] border border-slate-200 overflow-hidden shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-200 flex flex-col h-full">
      {/* Product Image */}
      <div className="relative aspect-square overflow-hidden bg-slate-50">
        <img 
          src={mainImage} 
          alt={product.title}
          className="w-full h-full object-cover"
        />
        <div className="absolute top-3 left-3">
          <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wide rounded-md border border-white/20 shadow-sm ${conditionClass(product.condition)}`}>
            {conditionLabel(product.condition)}
          </span>
        </div>
      </div>

      {/* Product Info */}
      <div className="p-4 flex flex-col flex-1">
        <div className="flex items-center gap-1.5 mb-2.5">
          <div className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 border border-white/20 ${categoryClass(product.category)}`}>
             <Tag size={10} />
             {categoryLabel(product.category)}
          </div>
        </div>

        <h3 className="text-sm font-semibold text-slate-800 group-hover:text-indigo-700 transition-colors line-clamp-2 leading-snug mb-3 flex-1">
          {product.title}
        </h3>

        <div className="flex items-center justify-between mt-auto pt-2 border-t border-slate-100">
          <p className="text-lg font-extrabold text-indigo-600">
            {formatPrice(product.price)}
          </p>
          
          <Link 
            to={`/products/${product.id}`}
            className="w-8 h-8 bg-slate-100 text-slate-500 rounded-lg flex items-center justify-center transition-all group-hover:bg-slate-900 group-hover:text-white"
          >
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
