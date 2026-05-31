import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { MapPin, Calendar, Plus, Package, HelpCircle, CheckCircle2, Search, Filter, X } from 'lucide-react';
import { lostFoundService, ItemType } from '../services/lostFoundService';
import type { LostFoundItem } from '../services/lostFoundService';
import { useToast } from '../components/Toast';

const AREAS = [
  { label: 'Tất cả', value: '' },
  { label: 'Khu A', value: 'Khu A' },
  { label: 'Khu B', value: 'Khu B' },
  { label: 'Khu C', value: 'Khu C' },
  { label: 'Nhà xe', value: 'Nhà xe' },
  { label: 'Thư viện', value: 'Thư viện' },
  { label: 'Căng tin', value: 'Căng tin' },
  { label: 'Sảnh chính', value: 'Sảnh' },
];

const LostFoundCenter: React.FC = () => {
  const [items, setItems] = useState<LostFoundItem[]>([]);
  const [activeTab, setActiveTab] = useState<ItemType>(ItemType.LOST);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [areaFilter, setAreaFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const { error: toastError } = useToast();

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      const response = await lostFoundService.getItems(activeTab);
      if (response.success) setItems(response.data.content || []);
    } catch (error) {
      console.error("Failed to fetch items:", error);
      toastError('Không thể tải danh sách. Vui lòng thử lại.');
    }
    finally { setLoading(false); }
  }, [activeTab, toastError]);

  useEffect(() => { void fetchItems(); }, [fetchItems]);

  /* Client-side filtering (search + area) */
  const filtered = useMemo(() => {
    let result = items;
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q) ||
        i.location?.toLowerCase().includes(q)
      );
    }
    if (areaFilter) {
      result = result.filter(i =>
        i.location?.toLowerCase().includes(areaFilter.toLowerCase())
      );
    }
    return result;
  }, [items, search, areaFilter]);

  const hasActiveFilter = search.trim() || areaFilter;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-0.5">Trung tâm thất lạc</h1>
          <p className="text-slate-500 text-sm">Giúp cộng đồng IUH tìm lại đồ dùng.</p>
        </div>
        <Link
          to="/lost-found/new"
          className="flex items-center gap-1.5 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-all w-fit shadow-sm shadow-indigo-200"
        >
          <Plus size={16} /> Đăng tin mới
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex p-1 bg-slate-100 rounded-xl w-fit mb-4 gap-1">
        <button
          onClick={() => setActiveTab(ItemType.LOST)}
          className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === ItemType.LOST ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <HelpCircle size={15} /> Tìm đồ rơi
        </button>
        <button
          onClick={() => setActiveTab(ItemType.FOUND)}
          className={`flex items-center gap-1.5 px-5 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === ItemType.FOUND ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
        >
          <CheckCircle2 size={15} /> Nhặt được đồ
        </button>
      </div>

      {/* Search + Filter bar */}
      <div className="flex flex-col sm:flex-row gap-2 mb-5">
        {/* Search input */}
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo tên, mô tả, địa điểm..."
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-indigo-300 focus:outline-none text-sm transition-all"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Filter toggle */}
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${showFilters || areaFilter ? 'border-indigo-300 bg-indigo-50 text-indigo-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}
        >
          <Filter size={15} />
          Khu vực
          {areaFilter && <span className="bg-indigo-600 text-white text-[10px] font-bold px-1.5 rounded-full">{areaFilter}</span>}
        </button>
      </div>

      {/* Area filter chips */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-4"
          >
            <div className="flex flex-wrap gap-2 pb-2">
              {AREAS.map(area => (
                <button
                  key={area.value}
                  onClick={() => setAreaFilter(area.value)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    areaFilter === area.value
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  }`}
                >
                  {area.value && <MapPin size={11} />}
                  {area.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Results count */}
      {!loading && hasActiveFilter && (
        <div className="flex items-center gap-2 mb-4 text-sm text-slate-500">
          <span>Tìm thấy <strong className="text-slate-800">{filtered.length}</strong> kết quả</span>
          <button
            onClick={() => { setSearch(''); setAreaFilter(''); }}
            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
          >
            <X size={12} /> Xóa bộ lọc
          </button>
        </div>
      )}

      {/* Grid */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="h-52 bg-slate-100 animate-pulse rounded-2xl border border-slate-200" />)}
          </motion.div>
        ) : (
          <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.length > 0 ? filtered.map((item, idx) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                <Link to={`/lost-found/${item.id}`} className="block group h-full">
                  <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden hover:border-indigo-200 hover:shadow-md transition-all h-full">
                    <div className="relative bg-slate-50 overflow-hidden" style={{ aspectRatio: '4 / 3' }}>
                      {item.imageUrls?.length > 0 ? (
                        <img src={item.imageUrls[0]} alt={item.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-200"><Package size={40} /></div>
                      )}
                      {/* Type badge */}
                      <span className={`absolute top-2.5 left-2.5 px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide ${
                        item.type === ItemType.LOST ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
                      }`}>
                        {item.type === ItemType.LOST ? 'Tìm đồ rơi' : 'Nhặt được'}
                      </span>
                      {/* Status badge */}
                      {item.status && item.status !== 'OPEN' && (
                        <span className="absolute top-2.5 right-2.5 px-2 py-0.5 bg-slate-700/80 text-white text-[10px] font-semibold rounded-lg">
                          Đã giải quyết
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      <h3 className="font-semibold text-slate-800 text-sm truncate mb-1 group-hover:text-indigo-700 transition-colors">{item.title}</h3>
                      <p className="text-slate-500 text-xs line-clamp-2 mb-3">{item.description || ''}</p>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1"><MapPin size={12} className="text-indigo-400" /> {item.location}</span>
                        <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(item.createdAt).toLocaleDateString('vi-VN')}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            )) : (
              <div className="col-span-full py-20 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <Package size={40} className="mx-auto text-slate-300 mb-3" />
                <p className="text-slate-400 text-sm font-medium">
                  {hasActiveFilter ? 'Không tìm thấy kết quả phù hợp.' : 'Chưa có bản tin nào.'}
                </p>
                {hasActiveFilter && (
                  <button onClick={() => { setSearch(''); setAreaFilter(''); }} className="mt-2 text-sm text-indigo-600 font-semibold hover:underline">
                    Xóa bộ lọc
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LostFoundCenter;
