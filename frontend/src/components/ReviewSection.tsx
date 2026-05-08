import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Star, MessageSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import { reviewService, type Review } from '../services/reviewService';
import { useAuthStore } from '../store/authStore';

interface ReviewSectionProps {
  productId: string;
  orderId?: string; // If provided, show review form
  onReviewSubmitted?: () => void;
}

const ReviewSection: React.FC<ReviewSectionProps> = ({ productId, orderId, onReviewSubmitted }) => {
  const { user } = useAuthStore() as any;
  const [reviews, setReviews] = useState<Review[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] = useState(false);

  useEffect(() => {
    fetchReviews();
  }, [productId, page]);

  useEffect(() => {
    if (orderId && user) {
      checkExistingReview();
    }
  }, [orderId, user]);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const res = await reviewService.getProductReviews(productId, page, 5);
      if (res.success) {
        setReviews(res.data.content || []);
        setAvgRating(res.data.avgRating || 0);
        setTotalReviews(res.data.totalReviews || 0);
        setTotalPages(res.data.totalPages || 0);
      }
    } catch (e) {
      console.error('Failed to fetch reviews', e);
    } finally {
      setLoading(false);
    }
  };

  const checkExistingReview = async () => {
    if (!orderId) return;
    try {
      const res = await reviewService.checkReview(productId, orderId);
      if (res.success && res.data.exists) {
        setAlreadyReviewed(true);
      }
    } catch (e) {
      // ignore
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orderId) return;
    setSubmitting(true);
    try {
      await reviewService.createReview(productId, { rating, comment, orderId });
      setShowForm(false);
      setAlreadyReviewed(true);
      fetchReviews();
      onReviewSubmitted?.();
    } catch (err: any) {
      alert(err?.response?.data?.message || 'Không thể gửi đánh giá');
    } finally {
      setSubmitting(false);
    }
  };

  const renderStars = (count: number, interactive = false) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map(i => (
          <button
            key={i}
            type="button"
            onClick={() => interactive && setRating(i)}
            className={`transition-colors ${interactive ? 'cursor-pointer hover:scale-110' : 'cursor-default'}`}
          >
            <Star
              size={interactive ? 24 : 16}
              className={i <= rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}
            />
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="mt-12">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black text-slate-900 flex items-center gap-3">
          <MessageSquare size={24} className="text-indigo-500" />
          Đánh giá ({totalReviews})
        </h2>
        {avgRating > 0 && (
          <div className="flex items-center gap-2 px-4 py-2 bg-amber-50 rounded-2xl border border-amber-100">
            <Star size={20} className="fill-amber-400 text-amber-400" />
            <span className="text-2xl font-black text-amber-700">{avgRating}</span>
            <span className="text-sm text-amber-500">/5</span>
          </div>
        )}
      </div>

      {/* Review Form */}
      {orderId && user && !alreadyReviewed && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="mb-6 px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 transition-all"
        >
          Viết đánh giá
        </button>
      )}

      {showForm && (
        <motion.form
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={handleSubmit}
          className="mb-8 p-6 bg-white rounded-3xl border border-slate-100 shadow-lg"
        >
          <h3 className="font-bold text-lg mb-4">Đánh giá sản phẩm</h3>
          <div className="mb-4">
            <label className="text-sm font-bold text-slate-600 mb-2 block">Sao</label>
            {renderStars(rating, true)}
          </div>
          <div className="mb-4">
            <label className="text-sm font-bold text-slate-600 mb-2 block">Nhận xét</label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Chia sẻ trải nghiệm của bạn..."
              className="w-full p-4 rounded-2xl border border-slate-200 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none resize-none"
              rows={3}
              maxLength={1000}
            />
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="px-6 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 disabled:opacity-50"
            >
              {submitting ? 'Đang gửi...' : 'Gửi đánh giá'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="px-6 py-3 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200"
            >
              Hủy
            </button>
          </div>
        </motion.form>
      )}

      {alreadyReviewed && (
        <div className="mb-6 p-4 bg-emerald-50 text-emerald-700 rounded-2xl border border-emerald-100 font-medium">
          ✅ Bạn đã đánh giá sản phẩm này
        </div>
      )}

      {/* Reviews List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-24 bg-slate-100 animate-pulse rounded-2xl" />)}
        </div>
      ) : reviews.length === 0 ? (
        <div className="text-center py-16 bg-slate-50 rounded-3xl border border-dashed border-slate-200">
          <Star size={48} className="mx-auto text-slate-200 mb-4" />
          <p className="text-slate-400">Chưa có đánh giá nào</p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {reviews.map((review, i) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="p-5 bg-white rounded-2xl border border-slate-100 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map(s => (
                      <Star key={s} size={14} className={s <= review.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'} />
                    ))}
                  </div>
                  <span className="text-xs text-slate-400">
                    {new Date(review.createdAt).toLocaleDateString('vi-VN')}
                  </span>
                </div>
                {review.comment && (
                  <p className="text-slate-700 text-sm leading-relaxed">{review.comment}</p>
                )}
              </motion.div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="p-2 rounded-xl bg-white border border-slate-200 disabled:opacity-30"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="text-sm text-slate-500 px-3">{page + 1} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="p-2 rounded-xl bg-white border border-slate-200 disabled:opacity-30"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ReviewSection;
