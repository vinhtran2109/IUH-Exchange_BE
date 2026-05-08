import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { MapPin, Calendar, Plus, Package, HelpCircle, CheckCircle2 } from 'lucide-react';
import { lostFoundService, ItemType } from '../services/lostFoundService';
import type { LostFoundItem } from '../services/lostFoundService';

const LostFoundCenter: React.FC = () => {
  const [items, setItems] = useState<LostFoundItem[]>([]);
  const [activeTab, setActiveTab] = useState<ItemType>(ItemType.LOST);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchItems(); }, [activeTab]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await lostFoundService.getItems(activeTab);
      if (response.success) setItems(response.data.content || []);
    } catch (error) { console.error("Failed to fetch items:", error); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 mb-0.5">Trung tâm thất lạc</h1>
          <p className="text-slate-500 text-sm">Giúp cộng đồng IUH tìm lại đồ dùng.</p>
        </div>
        <Link to="/lost-found/new" className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg text-sm font-medium hover:bg-slate-800 transition-all w-fit">
          <Plus size={16} /> Đăng tin mới
        </Link>
      </div>

      <div className="flex p-1 bg-slate-100 rounded-lg w-fit mb-6">
        <button onClick={() => setActiveTab(ItemType.LOST)} className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === ItemType.LOST ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <HelpCircle size={15} /> Tìm đồ rơi
        </button>
        <button onClick={() => setActiveTab(ItemType.FOUND)} className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === ItemType.FOUND ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
          <CheckCircle2 size={15} /> Nhặt được đồ
        </button>
      </div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map(i => <div key={i} className="h-48 bg-slate-50 animate-pulse rounded-xl border border-slate-200" />)}
          </motion.div>
        ) : (
          <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.length > 0 ? items.map((item) => (
              <Link key={item.id} to={`/lost-found/${item.id}`} className="block group">
                <div className="bg-white border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-colors h-full">
                  <div className="relative aspect-[4/3] bg-slate-50 overflow-hidden">
                    {item.imageUrls?.length > 0 ? (
                      <img src={item.imageUrls[0]} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-200"><Package size={36} /></div>
                    )}
                    <span className={`absolute top-2.5 left-2.5 px-2 py-0.5 rounded text-[10px] font-medium ${item.type === ItemType.LOST ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>
                      {item.type === ItemType.LOST ? 'Tìm đồ rơi' : 'Nhặt được'}
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-slate-800 text-sm truncate mb-1 group-hover:text-slate-900">{item.title}</h3>
                    <p className="text-slate-500 text-xs line-clamp-2 mb-3">{item.description}</p>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span className="flex items-center gap-1"><MapPin size={12} /> {item.location}</span>
                      <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(item.createdAt).toLocaleDateString('vi-VN')}</span>
                    </div>
                  </div>
                </div>
              </Link>
            )) : (
              <div className="col-span-full py-16 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
                <Package size={40} className="mx-auto text-slate-300 mb-3" />
                <p className="text-slate-400 text-sm">Chưa có bản tin nào.</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LostFoundCenter;
