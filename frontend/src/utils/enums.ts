// ─── Condition (tình trạng sản phẩm) ──────────────────────────────────────────
export const CONDITION_LABEL: Record<string, string> = {
  NEW:       'Mới',
  LIKE_NEW:  'Như mới',
  GOOD:      'Còn tốt',
  FAIR:      'Trung bình',
  POOR:      'Cũ / Hỏng nhẹ',
};

export const conditionLabel = (v?: string) =>
  v ? (CONDITION_LABEL[v] ?? v) : '—';

export const CONDITION_CLASS: Record<string, string> = {
  NEW:       'bg-emerald-100 text-emerald-700',
  LIKE_NEW:  'bg-teal-100 text-teal-700',
  GOOD:      'bg-blue-100 text-blue-700',
  FAIR:      'bg-amber-100 text-amber-700',
  POOR:      'bg-red-100 text-red-700',
};

export const conditionClass = (v?: string) =>
  v ? (CONDITION_CLASS[v] ?? 'bg-slate-100 text-slate-600') : 'bg-slate-100 text-slate-600';

// ─── Offer / Đề xuất ──────────────────────────────────────────────────────────
export const OFFER_STATUS_LABEL: Record<string, string> = {
  PENDING:    'Đang chờ',
  ACCEPTED:   'Đã chấp nhận',
  REJECTED:   'Đã từ chối',
  COUNTERED:  'Đã phản hồi',
  CANCELLED:  'Đã hủy',
  EXPIRED:    'Hết hạn',
};

export const offerStatusLabel = (v?: string) =>
  v ? (OFFER_STATUS_LABEL[v] ?? v) : '—';

// ─── Offer status color ───────────────────────────────────────────────────────
export const OFFER_STATUS_CLASS: Record<string, string> = {
  PENDING:   'bg-amber-50 text-amber-700',
  ACCEPTED:  'bg-emerald-50 text-emerald-700',
  REJECTED:  'bg-red-50 text-red-600',
  COUNTERED: 'bg-blue-50 text-blue-700',
  CANCELLED: 'bg-slate-100 text-slate-500',
  EXPIRED:   'bg-slate-100 text-slate-400',
};

export const offerStatusClass = (v?: string) =>
  v ? (OFFER_STATUS_CLASS[v] ?? 'bg-slate-100 text-slate-500') : 'bg-slate-100 text-slate-500';

// ─── Category ─────────────────────────────────────────────────────────────────
export const CATEGORY_LABEL: Record<string, string> = {
  ELECTRONICS:  'Điện tử',
  BOOKS:        'Sách & Tài liệu',
  CLOTHING:     'Thời trang',
  FURNITURE:    'Nội thất',
  SPORTS:       'Thể thao',
  MUSIC:        'Nhạc cụ',
  FOOD:         'Đồ ăn',
  OTHER:        'Khác',
};

export const categoryLabel = (v?: string) =>
  v ? (CATEGORY_LABEL[v] ?? v) : '—';

export const CATEGORY_CLASS: Record<string, string> = {
  ELECTRONICS:  'bg-blue-100 text-blue-700',
  BOOKS:        'bg-amber-100 text-amber-700',
  CLOTHING:     'bg-pink-100 text-pink-700',
  FURNITURE:    'bg-orange-100 text-orange-700',
  SPORTS:       'bg-emerald-100 text-emerald-700',
  MUSIC:        'bg-purple-100 text-purple-700',
  FOOD:         'bg-red-100 text-red-700',
  OTHER:        'bg-slate-100 text-slate-700',
};

export const categoryClass = (v?: string) =>
  v ? (CATEGORY_CLASS[v] ?? 'bg-slate-100 text-slate-600') : 'bg-slate-100 text-slate-600';

// ─── Listing type ─────────────────────────────────────────────────────────────
export const LISTING_TYPE_LABEL: Record<string, string> = {
  SELL:      'Bán',
  GIVE_AWAY: 'Cho tặng',
  TRADE:     'Đổi đồ',
};

export const listingTypeLabel = (v?: string) =>
  v ? (LISTING_TYPE_LABEL[v] ?? v) : '—';

// ─── Product status ───────────────────────────────────────────────────────────
export const PRODUCT_STATUS_LABEL: Record<string, string> = {
  AVAILABLE:        'Đang bán',
  PENDING_APPROVAL: 'Chờ duyệt',
  SOLD:             'Đã bán',
  HIDDEN:           'Ẩn',
  REJECTED:         'Bị từ chối',
};

export const productStatusLabel = (v?: string) =>
  v ? (PRODUCT_STATUS_LABEL[v] ?? v) : '—';

// ─── Helper: format price ─────────────────────────────────────────────────────
export const formatPrice = (v: number | string) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(v));
