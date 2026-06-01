import React from 'react';
import { Tag, UserRound } from 'lucide-react';
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
    sellerName?: string;
    sellerStudentId?: string;
    sellerAvatarUrl?: string;
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
  const sellerLabel = product.sellerName?.trim()
    || (product.sellerId ? `Người bán ${product.sellerId.slice(0, 6)}` : 'Người bán IUH');
  const sellerMeta = product.sellerStudentId || 'Sinh viên IUH';

  return (
    <Link to={`/products/${product.id}`} className="group flex h-full flex-col overflow-hidden rounded-[12px] border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:border-indigo-200 hover:shadow-md">
      {/* Product Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-slate-50">
        <img 
          src={mainImage} 
          alt={product.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
        <div className="absolute top-3 left-3">
          <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wide rounded-md border border-white/20 shadow-sm ${conditionClass(product.condition)}`}>
            {conditionLabel(product.condition)}
          </span>
        </div>
      </div>

      {/* Product Info */}
      <div className="flex flex-1 flex-col p-4">
        <div className="mb-3 flex items-center gap-1.5">
          <div className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-black ${categoryClass(product.category)}`}>
             <Tag size={12} />
             {categoryLabel(product.category)}
          </div>
        </div>

        <h3 className="mb-3 line-clamp-2 min-h-11 flex-1 text-base font-black leading-snug text-slate-950 transition-colors group-hover:text-indigo-700">
          {product.title}
        </h3>

        <div className="mb-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white text-slate-400 ring-1 ring-slate-200">
            {product.sellerAvatarUrl ? (
              <img src={product.sellerAvatarUrl} alt={sellerLabel} className="h-full w-full object-cover" />
            ) : (
              <UserRound size={15} />
            )}
          </div>
          <div className="min-w-0">
            <div className="truncate text-xs font-black text-slate-700">{sellerLabel}</div>
            <div className="truncate text-[11px] font-medium text-slate-400">{sellerMeta}</div>
          </div>
        </div>

        <div className="mt-auto border-t border-slate-100 pt-3">
          <p className="text-lg font-black text-indigo-600">
            {formatPrice(product.price)}
          </p>
        </div>
      </div>
    </Link>
  );
};

export default ProductCard;
