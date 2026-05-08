import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, SlidersHorizontal, Package, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { productService } from '../services/productService';
import type { Product } from '../services/productService';
import ProductCard from '../components/ProductCard';

const CATEGORIES = [
  { label: 'Tất cả', value: '' },
  { label: 'Sách & Tài liệu', value: 'BOOKS' },
  { label: 'Điện tử', value: 'ELECTRONICS' },
  { label: 'Thời trang', value: 'FASHION' },
  { label: 'Đồ dùng học tập', value: 'TOOLS' },
  { label: 'Nhạc cụ', value: 'MUSIC' },
  { label: 'Thể thao', value: 'SPORTS' },
  { label: 'Khác', value: 'OTHERS' },
];
const CONDITIONS = [
  { label: 'Tất cả', value: '' },
  { label: 'Mới', value: 'NEW' },
  { label: 'Như mới', value: 'LIKE_NEW' },
  { label: 'Tốt', value: 'GOOD' },
  { label: 'Còn dùng được', value: 'FAIR' },
];
const SORT_OPTIONS = [
  { label: 'Mới nhất', value: 'createdAt:desc' },
  { label: 'Giá thấp nhất', value: 'price:asc' },
  { label: 'Giá cao nhất', value: 'price:desc' },
];

const PAGE_SIZE = 12;

const CATEGORY_MAP: Record<string, string> = {
  'BOOKS': 'Sách & Tài liệu',
  'ELECTRONICS': 'Điện tử',
  'FASHION': 'Thời trang',
  'TOOLS': 'Đồ dùng học tập',
  'MUSIC': 'Nhạc cụ',
  'SPORTS': 'Thể thao',
  'OTHERS': 'Khác',
};

const Products: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [debouncedSearch, setDebouncedSearch] = useState(searchParams.get('search') || '');
  const [selectedCategory, setSelectedCategory] = useState(searchParams.get('category') || '');
  const [selectedCondition, setSelectedCondition] = useState(searchParams.get('condition') || '');
  const [sortBy, setSortBy] = useState(searchParams.get('sort') || 'createdAt:desc');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '0', 10));

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (selectedCategory) params.set('category', selectedCategory);
    if (selectedCondition) params.set('condition', selectedCondition);
    if (sortBy !== 'createdAt:desc') params.set('sort', sortBy);
    if (page > 0) params.set('page', String(page));
    setSearchParams(params, { replace: true });
  }, [debouncedSearch, selectedCategory, selectedCondition, sortBy, page]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 400);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      let response;
      if (debouncedSearch) {
        response = await productService.searchProducts(debouncedSearch, page, PAGE_SIZE);
      } else {
        response = await productService.getProducts(page, PAGE_SIZE, selectedCategory || undefined, sortBy);
      }
      if (response.success) {
        let data: Product[] = response.data.content || [];
        if (selectedCondition && !debouncedSearch) {
          data = data.filter(p => p.condition === selectedCondition);
        }
        setProducts(data);
        setTotalPages(response.data.totalPages || 1);
      }
    } catch (e) {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, selectedCategory, selectedCondition, sortBy]);

  useEffect(() => {
    setPage(0);
  }, [debouncedSearch, selectedCategory, selectedCondition, sortBy]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const activeFiltersCount = [!!selectedCategory, !!selectedCondition].filter(Boolean).length;

  return (
    <div className="max-w-7xl mx-auto py-6 px-4">
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 mb-0.5">Khám phá sản phẩm</h1>
        <p className="text-slate-500 text-sm">Tìm món đồ ưng ý từ sinh viên IUH</p>
      </div>

      {/* Search + Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm sản phẩm..."
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:border-slate-400 transition-all text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>

        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1.5 px-4 py-2.5 rounded-lg font-medium text-sm transition-all border ${showFilters || activeFiltersCount > 0 ? 'bg-slate-900 text-white border-slate-900' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'}`}
        >
          <SlidersHorizontal size={16} />
          Lọc
          {activeFiltersCount > 0 && (
            <span className="bg-white text-slate-900 text-xs font-bold w-4 h-4 rounded-full flex items-center justify-center">
              {activeFiltersCount}
            </span>
          )}
        </button>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="px-3 py-2.5 bg-white border border-slate-200 rounded-lg font-medium text-sm text-slate-600 focus:outline-none focus:border-slate-400 cursor-pointer"
        >
          {SORT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Collapsible Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Danh mục</p>
                <div className="flex flex-wrap gap-1.5">
                  {CATEGORIES.map(cat => (
                    <button
                      key={cat.value}
                      onClick={() => setSelectedCategory(cat.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedCategory === cat.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Tình trạng</p>
                <div className="flex flex-wrap gap-1.5">
                  {CONDITIONS.map(cond => (
                    <button
                      key={cond.value}
                      onClick={() => setSelectedCondition(cond.value)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedCondition === cond.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {cond.label}
                    </button>
                  ))}
                </div>
              </div>
              {activeFiltersCount > 0 && (
                <button
                  onClick={() => { setSelectedCategory(''); setSelectedCondition(''); }}
                  className="text-xs font-medium text-red-500 hover:text-red-700 flex items-center gap-1"
                >
                  <X size={12} /> Xóa bộ lọc
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active filter tags */}
      {(selectedCategory || selectedCondition) && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {selectedCategory && (
            <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-medium flex items-center gap-1">
              {CATEGORY_MAP[selectedCategory] || selectedCategory}
              <button onClick={() => setSelectedCategory('')} className="hover:text-slate-900"><X size={11} /></button>
            </span>
          )}
          {selectedCondition && (
            <span className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-md text-xs font-medium flex items-center gap-1">
              {CONDITIONS.find(c => c.value === selectedCondition)?.label || selectedCondition}
              <button onClick={() => setSelectedCondition('')} className="hover:text-slate-900"><X size={11} /></button>
            </span>
          )}
        </div>
      )}

      {/* Results */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(PAGE_SIZE)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 overflow-hidden animate-pulse">
              <div className="aspect-square bg-slate-100" />
              <div className="p-4 space-y-2">
                <div className="h-3 bg-slate-100 rounded w-1/3" />
                <div className="h-4 bg-slate-100 rounded w-3/4" />
                <div className="h-5 bg-slate-100 rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-24 bg-white rounded-xl border border-dashed border-slate-200">
          <Package size={48} className="mx-auto text-slate-300 mb-3" />
          <h3 className="text-lg font-semibold text-slate-800 mb-1">Không tìm thấy sản phẩm</h3>
          <p className="text-slate-400 text-sm mb-4">Thử tìm kiếm với từ khóa khác hoặc xóa bộ lọc.</p>
          <Link to="/products/new" className="px-5 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-all inline-block">
            Đăng sản phẩm
          </Link>
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-400 font-medium mb-3">{products.length} sản phẩm</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {products.map((product, i) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.03 }}
              >
                <ProductCard product={product} />
              </motion.div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1.5 mt-8">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:border-slate-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={18} />
              </button>
              {(() => {
                const pages: (number | string)[] = [];
                const windowSize = 2;
                const start = Math.max(0, page - windowSize);
                const end = Math.min(totalPages - 1, page + windowSize);

                if (start > 0) {
                  pages.push(0);
                  if (start > 1) pages.push('...');
                }
                for (let i = start; i <= end; i++) pages.push(i);
                if (end < totalPages - 1) {
                  if (end < totalPages - 2) pages.push('...');
                  pages.push(totalPages - 1);
                }

                return pages.map((p, i) =>
                  typeof p === 'string' ? (
                    <span key={`dots-${i}`} className="w-8 h-8 flex items-center justify-center text-slate-400 text-sm">…</span>
                  ) : (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      className={`w-8 h-8 rounded-lg font-medium text-sm transition-all ${page === p ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-slate-300'}`}
                    >
                      {p + 1}
                    </button>
                  )
                );
              })()}
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="p-2 rounded-lg bg-white border border-slate-200 text-slate-500 hover:border-slate-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default Products;
