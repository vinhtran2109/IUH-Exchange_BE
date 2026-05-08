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
    <div className="group bg-white rounded-xl border border-slate-200 overflow-hidden hover:border-slate-300 transition-all duration-200">
      {/* Product Image */}
      <div className="relative aspect-square overflow-hidden bg-slate-50">
        <img 
          src={mainImage} 
          alt={product.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute top-3 left-3">
          <span className="px-2 py-0.5 bg-white/90 text-slate-600 text-[10px] font-medium uppercase tracking-wide rounded-md border border-slate-200">
            {product.condition}
          </span>
        </div>
      </div>

      {/* Product Info */}
      <div className="p-4">
        <div className="flex items-center gap-1.5 mb-2">
          <div className="px-1.5 py-0.5 bg-slate-50 text-slate-500 rounded text-[10px] font-medium flex items-center gap-1 border border-slate-100">
             <Tag size={9} />
             {product.category}
          </div>
        </div>

        <h3 className="text-sm font-semibold text-slate-800 group-hover:text-slate-900 transition-colors line-clamp-2 leading-snug mb-3 h-10">
          {product.title}
        </h3>

        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-slate-900">
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
