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

  useEffect(() => {
    fetchItems();
  }, [activeTab]);

  const fetchItems = async () => {
    try {
      setLoading(true);
      const response = await lostFoundService.getItems(activeTab);
      if (response.success) {
        setItems(response.data.content || []);
      }
    } catch (error) {
      console.error("Failed to fetch lost & found items:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
        <div className="space-y-2">
          <motion.h1 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl font-black text-slate-900 tracking-tight"
          >
            Trung tâm <span className="text-indigo-600 italic">Thất lạc</span>
          </motion.h1>
          <p className="text-slate-500 font-medium text-lg">Giúp cộng đồng IUH tìm lại những vật dụng quý giá.</p>
        </div>

        <Link to="/lost-found/new" className="flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white rounded-2xl font-black shadow-xl shadow-indigo-200 hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95 group">
          <Plus size={24} className="group-hover:rotate-90 transition-transform duration-300" />
          ĐĂNG TIN MỚI
        </Link>
      </div>


      {/* Tabs System */}
      <div className="flex p-1.5 bg-slate-100 rounded-2xl w-fit mb-10">
        <button
          onClick={() => setActiveTab(ItemType.LOST)}
          className={`flex items-center gap-2 px-8 py-3 rounded-xl font-black transition-all ${
            activeTab === ItemType.LOST 
            ? 'bg-white text-rose-600 shadow-sm' 
            : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <HelpCircle size={18} />
          ĐANG TÌM ĐỒ
        </button>
        <button
          onClick={() => setActiveTab(ItemType.FOUND)}
          className={`flex items-center gap-2 px-8 py-3 rounded-xl font-black transition-all ${
            activeTab === ItemType.FOUND 
            ? 'bg-white text-emerald-600 shadow-sm' 
            : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          <CheckCircle2 size={18} />
          NHẶT ĐƯỢC
        </button>
      </div>

      {/* Grid Content */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div 
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {[1, 2, 3].map(i => (
              <div key={i} className="h-64 bg-slate-100 animate-pulse rounded-[2.5rem]" />
            ))}
          </motion.div>
        ) : (
          <motion.div 
            key="content"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {items.length > 0 ? items.map((item) => (
              <Link
                key={item.id}
                to={`/lost-found/${item.id}`}
                className="block group"
              >
                <motion.div
                  whileHover={{ y: -12 }}
                  className="bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm hover:shadow-2xl hover:shadow-indigo-100/50 transition-all overflow-hidden h-full"
                >
                  {/* Image Section */}
                  <div className="relative aspect-[4/3] -mx-6 -mt-6 mb-6 bg-slate-100 overflow-hidden">
                     {item.imageUrls && item.imageUrls.length > 0 ? (
                        <img 
                          src={item.imageUrls[0]} 
                          alt={item.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                     ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                           <Package size={48} strokeWidth={1} />
                        </div>
                     )}
                     <div className="absolute top-4 left-4">
                        <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider shadow-lg ${
                          item.type === ItemType.LOST 
                          ? 'bg-rose-500 text-white' 
                          : 'bg-emerald-500 text-white'
                        }`}>
                          {item.type === ItemType.LOST ? 'Tìm đồ rơi' : 'Nhặt được đồ'}
                        </span>
                     </div>
                  </div>

                  <h3 className="text-xl font-bold text-slate-800 mb-2 truncate group-hover:text-indigo-600 transition-colors">
                    {item.title}
                  </h3>
                  <p className="text-slate-500 text-sm line-clamp-2 mb-6">
                    {item.description}
                  </p>
                  <div className="flex flex-col gap-2 pt-4 border-t border-slate-50">
                     <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                        <MapPin size={14} className="text-indigo-400" />
                        {item.location}
                     </div>
                     <div className="flex items-center gap-2 text-slate-400 text-xs font-medium">
                        <Calendar size={14} className="text-indigo-400" />
                        {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                     </div>
                  </div>
                </motion.div>
              </Link>
            )) : (
              <div className="col-span-full py-20 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                 <Package size={48} className="mx-auto text-slate-300 mb-4" />
                 <p className="text-slate-400 font-bold">Chưa có bản tin nào ở khu vực này.</p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default LostFoundCenter;
