import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  BadgeCheck,
  ChevronDown,
  Flag,
  Heart,
  MessageSquare,
  MoreHorizontal,
  Package,
  Pencil,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  User,
  Wallet,
  X,
  ZoomIn,
} from 'lucide-react';
import { productService } from '../services/productService';
import { chatService } from '../services/chatService';
import { orderService } from '../services/orderService';
import type { Product } from '../services/productService';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import ReviewSection from '../components/ReviewSection';
import { wishlistService } from '../services/wishlistService';
import { useToast } from '../components/Toast';
import { useConfirm, usePrompt } from '../components/Dialogs';
import { conditionLabel, categoryLabel, offerStatusLabel, offerStatusClass } from '../utils/enums';

type PaymentChoice = 'BANK_TRANSFER' | 'CASH';

const ARCHIVED_OFFER_STATUSES = new Set(['WITHDRAWN', 'CANCELLED', 'EXPIRED', 'REJECTED']);

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore() as any;
  const { success: toastSuccess, error: toastError } = useToast();
  const { confirm } = useConfirm();
  const { prompt } = usePrompt();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [completedOrderId, setCompletedOrderId] = useState<string | null>(null);
  const [wishlisted, setWishlisted] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [buyerNote, setBuyerNote] = useState('');
  const [sellerProfile, setSellerProfile] = useState<any>(null);
  const [sellerTrust, setSellerTrust] = useState<any>(null);
  const [followingSeller, setFollowingSeller] = useState(false);
  const [paymentChoice, setPaymentChoice] = useState<PaymentChoice>('BANK_TRANSFER');
  const [purchaseMessage, setPurchaseMessage] = useState<string | null>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [offerType, setOfferType] = useState<'PRICE' | 'TRADE'>('PRICE');
  const [offerAmount, setOfferAmount] = useState('');
  const [tradeItemTitle, setTradeItemTitle] = useState('');
  const [tradeItemDescription, setTradeItemDescription] = useState('');
  const [offerMessage, setOfferMessage] = useState('');
  const [offerBusy, setOfferBusy] = useState(false);
  const [offerOpen, setOfferOpen] = useState(false);
  const [offerHistoryOpen, setOfferHistoryOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        if (!id) return;
        const response = await productService.getProductById(id);
        if (response.success) {
          setProduct(response.data);
          setSelectedImage(0);
          if (user) void productService.recordView(id).catch(() => {});
        }
      } catch (error) {
        console.error('Failed to fetch product:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [id]);

  useEffect(() => {
    if (!product?.sellerId) return;
    api.get(`/users/${product.sellerId}`)
      .then((res) => {
        if (res.data?.success) setSellerProfile(res.data.data);
      })
      .catch(() => {});
    productService.getSellerTrust(product.sellerId)
      .then((res) => {
        if (res.success) setSellerTrust(res.data);
      })
      .catch(() => {});
    if (user && user.id !== product.sellerId) {
      productService.checkSellerFollow(product.sellerId)
        .then((res) => {
          if (res.success) setFollowingSeller(res.data.following);
        })
        .catch(() => {});
    }
  }, [product?.sellerId, user]);

  useEffect(() => {
    if (!id || !user) return;
    const checkOrder = async () => {
      try {
        const res = await api.get(`/orders?productId=${id}&status=COMPLETED&page=1&size=1`);
        if (res.data?.success && res.data?.data?.content?.length > 0) {
          const order = res.data.data.content[0];
          setCompletedOrderId(order.id || order._id);
        }
      } catch {
        // ignore
      }
    };
    checkOrder();
  }, [id, user]);

  const loadOffers = async () => {
    if (!id || !user || !product) return;
    try {
      const res = user.id === product.sellerId
        ? await productService.listProductOffers(id)
        : await productService.listMyOffers();
      if (res.success) {
        const content = res.data?.content || res.data || [];
        setOffers(user.id === product.sellerId ? content : content.filter((offer: any) => offer.productId === id));
      }
    } catch {
      // ignore optional offer panel errors
    }
  };

  useEffect(() => {
    void loadOffers();
  }, [id, user?.id, product?.sellerId]);

  useEffect(() => {
    if (!id) return;
    chatService.connect();
    const removeListener = chatService.addNotificationListener((notification: any) => {
      const targetId = String(notification?.targetId || '');
      const type = String(notification?.type || '').toUpperCase();
      if (targetId !== String(id)) return;

      if (type.includes('PRODUCT')) {
        productService.getProductById(id)
          .then((response) => {
            if (response.success) setProduct(response.data);
          })
          .catch(() => {});
        void loadOffers();
      }
    });
    return removeListener;
  }, [id, user?.id, product?.sellerId]);

  useEffect(() => {
    if (!id || !user) return;
    const checkWish = async () => {
      try {
        const res = await wishlistService.check(id);
        if (res.success) setWishlisted(res.data.wishlisted);
      } catch {
        // ignore
      }
    };
    checkWish();
  }, [id, user]);

  const sellerLabel = useMemo(() => {
    if (sellerProfile?.name) return sellerProfile.name;
    if (!product?.sellerId) return 'người bán';
    return `người bán ${String(product.sellerId).substring(0, 6)}`;
  }, [sellerProfile, product?.sellerId]);

  const sortedOffers = useMemo(() => {
    return [...offers].sort((left, right) => {
      const leftTime = new Date(left.updatedAt || left.createdAt || 0).getTime();
      const rightTime = new Date(right.updatedAt || right.createdAt || 0).getTime();
      return rightTime - leftTime;
    });
  }, [offers]);

  const activeOffers = useMemo(() => {
    return sortedOffers.filter((offer) => !ARCHIVED_OFFER_STATUSES.has(String(offer.status || '').toUpperCase()));
  }, [sortedOffers]);

  const archivedOffers = useMemo(() => {
    return sortedOffers.filter((offer) => ARCHIVED_OFFER_STATUSES.has(String(offer.status || '').toUpperCase()));
  }, [sortedOffers]);

  const handleToggleWishlist = async () => {
    if (!user) {
      toastError('Bạn cần đăng nhập để lưu sản phẩm!');
      return;
    }
    try {
      const res = await wishlistService.toggle(id!);
      if (res.success) setWishlisted(res.data.wishlisted);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async () => {
    if (!id) return;
    const confirmed = await confirm({
      title: 'Gỡ bài đăng',
      message: 'Bạn có chắc chắn muốn gỡ bài đăng này? Hành động này không thể hoàn tác.',
      confirmText: 'Gỡ bài',
      cancelText: 'Hủy',
      variant: 'danger',
    });
    if (!confirmed) return;
    try {
      setDeleting(true);
      const response = await productService.deleteProduct(id);
      if (response.success) {
        toastSuccess('Gỡ bài đăng thành công!');
        navigate('/');
      }
    } catch {
      toastError('Lỗi khi xóa bài.');
    } finally {
      setDeleting(false);
    }
  };

  const handleReport = async () => {
    if (!user) {
      toastError('Bạn cần đăng nhập để tố cáo!');
      return;
    }
    const reason = await prompt({
      title: 'Tố cáo sản phẩm',
      message: 'Vui lòng cho chúng tôi biết lý do tố cáo sản phẩm này.',
      placeholder: 'Nhập lý do tố cáo (ít nhất 5 ký tự)...',
      confirmText: 'Gửi tố cáo',
      minLength: 5,
      rows: 3,
    });
    if (!reason) return;
    try {
      await api.post('/reports', { targetType: 'PRODUCT', targetId: id, reason });
      toastSuccess('Đã gửi tố cáo. Admin sẽ xem xét sớm.');
    } catch (err: any) {
      toastError('Lỗi: ' + (err.response?.data?.message || 'Không thể gửi tố cáo'));
    }
  };

  const openPurchaseFlow = () => {
    if (!product) return;
    if (!user) {
      toastError('Bạn cần đăng nhập để mua hàng!');
      navigate('/login');
      return;
    }
    setPurchaseMessage(null);
    setPurchaseOpen(true);
  };

  const handleOrder = async () => {
    if (!product) return;
    try {
      setOrdering(true);
      setPurchaseMessage(null);

      const request = {
        productId: product.id,
        sellerId: product.sellerId || '',
        price: product.price,
        buyerNote: buyerNote.trim(),
        paymentMethod: paymentChoice,
        idempotencyKey: window.crypto.randomUUID(),
      };

      const orderResponse = await orderService.createOrder(request);
      const createdOrder = orderResponse.data;
      const orderId = createdOrder?.id || createdOrder?._id;

      if (!orderId) {
        throw new Error('Không lấy được mã đơn hàng');
      }

      if (product.sellerId) {
        chatService.triggerOpenChat(product.sellerId, sellerLabel, {
          id: product.id,
          title: product.title,
          price: product.price,
          imageUrl: product.imageUrls?.[0],
        });
      }

      setPurchaseOpen(false);
      setBuyerNote('');
      navigate(`/orders/${orderId}`, {
        state: {
          initialOrder: createdOrder,
          flashMessage:
            paymentChoice === 'BANK_TRANSFER'
              ? 'Đã tạo đơn. Hãy chuyển khoản cho người bán, sau đó bấm Tôi đã chuyển khoản trong chi tiết đơn.'
              : 'Đã tạo yêu cầu mua thành công. Bạn có thể theo dõi tiến độ đơn hàng tại đây.',
        },
      });
    } catch (error: any) {
      setPurchaseMessage(error.response?.data?.message || error.message || 'Có lỗi xảy ra khi tạo đơn hàng.');
    } finally {
      setOrdering(false);
    }
  };

  const handleCreateOffer = async () => {
    if (!product || !user) return;
    try {
      setOfferBusy(true);
      const payload = offerType === 'PRICE'
        ? { type: 'PRICE' as const, amount: Number(offerAmount), message: offerMessage.trim() }
        : { type: 'TRADE' as const, tradeItemTitle: tradeItemTitle.trim(), tradeItemDescription: tradeItemDescription.trim(), message: offerMessage.trim() };
      const res = await productService.createOffer(product.id, payload);
      if (res.success) {
        setOfferAmount('');
        setTradeItemTitle('');
        setTradeItemDescription('');
        setOfferMessage('');
        await loadOffers();
      }
    } catch (error: any) {
      toastError(error.response?.data?.message || 'Không thể gửi đề xuất lúc này.');
    } finally {
      setOfferBusy(false);
    }
  };

  const handleResolveOffer = async (offerId: string, action: 'ACCEPT' | 'REJECT') => {
    try {
      setOfferBusy(true);
      const res = await productService.resolveOffer(offerId, action);
      if (res.success) await loadOffers();
    } catch (error: any) {
      toastError(error.response?.data?.message || 'Không thể xử lý đề xuất.');
    } finally {
      setOfferBusy(false);
    }
  };

  const handleOrderFromOffer = async (offer: any) => {
    if (!product) return;
    try {
      setOfferBusy(true);
      const orderResponse = await orderService.createOrder({
        productId: product.id,
        sellerId: product.sellerId,
        price: offer.type === 'PRICE' ? Number(offer.amount) : 0,
        offerId: offer.id || offer._id,
        buyerNote: offer.message || '',
        idempotencyKey: window.crypto.randomUUID(),
      });
      const orderId = orderResponse.data?.id || orderResponse.data?._id;
      navigate(`/orders/${orderId}`);
    } catch (error: any) {
      toastError(error.response?.data?.message || 'Không thể tạo đơn từ đề xuất.');
    } finally {
      setOfferBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-40">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-slate-600"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="py-40 text-center">
        <AlertCircle size={40} className="mx-auto mb-3 text-slate-300" />
        <h2 className="text-lg font-semibold text-slate-800">Không tìm thấy sản phẩm</h2>
        <Link to="/" className="mt-2 inline-block text-sm text-slate-500 hover:text-slate-900">
          Quay lại trang chủ
        </Link>
      </div>
    );
  }

  const activeImage = product.imageUrls[selectedImage] || product.imageUrls[0] || 'https://placehold.co/800x600/e2e8f0/94a3b8?text=IUH';

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Top bar: nút quạy lại + menu 3 chấm */}
        <div className="mb-6 flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900">
            <ArrowLeft size={16} /> Quạy lại
          </button>

          {/* Menu 3 chấm — chỉ hiện khi không phải chủ sản phẩm */}
          {user && user.id !== product.sellerId && (
            <div className="relative">
              <button
                onClick={() => setMoreMenuOpen((v) => !v)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800"
                aria-label="Thêm tùy chọn"
              >
                <MoreHorizontal size={18} />
              </button>
              {moreMenuOpen && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setMoreMenuOpen(false)} />
                  <div className="absolute right-0 top-10 z-40 min-w-max overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
                    <button
                      onClick={() => { setMoreMenuOpen(false); handleReport(); }}
                      className="flex w-full items-center gap-2 whitespace-nowrap px-4 py-3 text-sm text-red-600 transition-colors hover:bg-red-50"
                    >
                      <Flag size={15} /> Tố cáo sản phẩm
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          {/* ===== CỘT TRÁI: Ảnh ===== */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            {/* Ảnh chính — ratio 4:3 cố định, bồ góc 18px, click mở lightbox */}
            <div
              className="group relative cursor-zoom-in overflow-hidden rounded-[18px] border border-slate-200 bg-slate-100"
              style={{ aspectRatio: '4/3' }}
              onClick={() => setLightboxOpen(true)}
            >
              <img
                src={activeImage}
                alt={product.title}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
              {/* Zoom hint */}
              <div className="absolute bottom-3 right-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/80 opacity-0 shadow transition-opacity group-hover:opacity-100 backdrop-blur-sm">
                <ZoomIn size={15} className="text-slate-600" />
              </div>
              {/* Badge số ảnh */}
              {product.imageUrls.length > 1 && (
                <div className="absolute bottom-3 left-3 rounded-full bg-black/50 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-sm">
                  {selectedImage + 1} / {product.imageUrls.length}
                </div>
              )}
            </div>

            {/* Thumbnails — chỉ hiện khi có > 1 ảnh */}
            {product.imageUrls.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {product.imageUrls.map((url, index) => (
                  <button
                    key={`thumb-${index}`}
                    type="button"
                    onClick={() => setSelectedImage(index)}
                    className={`group relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-xl border-2 transition-all duration-200 ${
                      selectedImage === index
                        ? 'border-slate-900 shadow-md'
                        : 'border-transparent hover:-translate-y-0.5 hover:shadow-sm'
                    }`}
                  >
                    <img
                      src={url}
                      alt={`${product.title} ${index + 1}`}
                      loading="lazy"
                      className="h-full w-full object-cover"
                    />
                    {selectedImage !== index && (
                      <div className="absolute inset-0 bg-slate-900/10 opacity-0 transition-opacity group-hover:opacity-100" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          {/* ===== CỘT PHẢI: Thông tin ===== */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col">
            {/* Category badge */}
            <span className="mb-3 w-fit rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
              {categoryLabel(product.category)}
            </span>

            {/* Tiêu đề + nút Yêu thích cùng hàng */}
            <div className="mb-4 flex items-start justify-between gap-3">
              <h1 className="text-2xl font-bold leading-tight text-slate-900">{product.title}</h1>
              {user && user.id !== product.sellerId && (
                <button
                  onClick={handleToggleWishlist}
                  className="group relative mt-0.5 shrink-0 rounded-full p-2 transition-all hover:bg-red-50"
                  aria-label={wishlisted ? 'Đã yêu thích' : 'Thêm vào yêu thích'}
                  title={wishlisted ? 'Đã yêu thích' : 'Thêm vào yêu thích'}
                >
                  <Heart
                    size={22}
                    className={wishlisted
                      ? 'fill-red-500 text-red-500'
                      : 'text-slate-300 transition-colors group-hover:text-red-400'
                    }
                  />
                </button>
              )}
            </div>

            {/* Giá */}
            <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4">
              <div className="mb-0.5 text-xs font-medium uppercase tracking-wide text-slate-400">Giá bán</div>
              <div className="text-3xl font-bold text-slate-900">
                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price)}
              </div>
            </div>

            {/* Status + ngày đăng — bên dướí giá */}
            <div className="mb-5 flex items-center gap-2">
              <span className="rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                {conditionLabel(product.condition)}
              </span>
              <span className="text-xs text-slate-400">
                Đăng ngày {new Date(product.createdAt).toLocaleDateString('vi-VN')}
              </span>
            </div>

            {/* Listing type badge */}
            {product.listingType && product.listingType !== 'SELL' && (
              <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
                <div className="font-bold">{product.listingType === 'TRADE' ? 'Bài đăng đổi đồ' : 'Bài đăng cho tặng'}</div>
                {product.tradeWanted && <div className="mt-1">Muốn đổi lấy: {product.tradeWanted}</div>}
              </div>
            )}

            {/* Đề xuất thương lượng */}
            {(activeOffers.length > 0 || archivedOffers.length > 0) && (
              <div className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white">
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <div>
                    <div className="text-sm font-bold text-slate-900">{user?.id === product.sellerId ? 'Đề xuất từ người mua' : 'Đề xuất của bạn'}</div>
                  </div>
                  
                </div>

                <div className="space-y-2 px-4 py-4">
                  {activeOffers.length > 0 ? (
                    activeOffers.slice(0, 5).map((offer) => (
                      <div key={offer.id || offer._id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-bold text-slate-800">
                            {offer.type === 'TRADE' ? `Đổi: ${offer.tradeItemTitle}` : `${Number(offer.amount || 0).toLocaleString()}đ`}
                          </div>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${offerStatusClass(offer.status)}`}>
                            {offerStatusLabel(offer.status)}
                          </span>
                        </div>
                        {offer.message && <div className="mt-1 text-xs text-slate-500">{offer.message}</div>}
                        {user?.id === product.sellerId && offer.status === 'PENDING' && (
                          <div className="mt-2 flex gap-2">
                            <button disabled={offerBusy} onClick={() => handleResolveOffer(offer.id || offer._id, 'ACCEPT')} className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white">Chấp nhận</button>
                            <button disabled={offerBusy} onClick={() => handleResolveOffer(offer.id || offer._id, 'REJECT')} className="rounded bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600">Từ chối</button>
                          </div>
                        )}
                        {user?.id !== product.sellerId && offer.status === 'ACCEPTED' && (
                          <button disabled={offerBusy} onClick={() => handleOrderFromOffer(offer)} className="mt-2 rounded bg-slate-900 px-3 py-1.5 text-xs font-bold text-white">Tạo đơn từ đề xuất</button>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-500">
                      Chưa có đề xuất đang hoạt động.
                    </div>
                  )}
                </div>

                {archivedOffers.length > 0 && (
                  <div className="border-t border-slate-100 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setOfferHistoryOpen((value) => !value)}
                      className="flex w-full items-center justify-between gap-3 text-left"
                    >
                      <div>
                        <div className="text-sm font-semibold text-slate-700">Xem lịch sử thương lượng</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-300">{archivedOffers.length}</span>
                        <ChevronDown size={16} className={`text-slate-400 transition-transform dark:text-slate-500 ${offerHistoryOpen ? 'rotate-180' : ''}`} />
                      </div>
                    </button>

                    {offerHistoryOpen && (
                      <div className="mt-3 space-y-2">
                        {archivedOffers.map((offer) => (
                          <div
                            key={offer.id || offer._id}
                            className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-300"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-medium text-slate-700 dark:text-slate-100">
                                {offer.type === 'TRADE' ? `Đổi: ${offer.tradeItemTitle}` : `${Number(offer.amount || 0).toLocaleString()}đ`}
                              </div>
                              <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${offerStatusClass(offer.status)}`}>
                                {offerStatusLabel(offer.status)}
                              </span>
                            </div>
                            {offer.message && <div className="mt-1 text-xs text-slate-400 dark:text-slate-500">{offer.message}</div>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Mô tả */}
            <div className="mb-2">
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <Package size={16} className="text-slate-400" /> Mô tả
              </h3>
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{product.description}</p>
            </div>

            {/* Action buttons */}
            <div className="mt-8 space-y-2 border-t border-slate-100 pt-4">
              {user?.id === product.sellerId ? (
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => navigate(`/products/${product.id}/edit`)}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50"
                  >
                    <Pencil size={15} /> Sửa tin
                  </button>
                  <button
                    onClick={handleDelete}
                    disabled={deleting}
                    className="flex items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-red-50 py-2.5 text-sm font-medium text-red-600 transition-all hover:bg-red-100 disabled:opacity-50"
                  >
                    <Trash2 size={15} /> {deleting ? 'Đang gỡ...' : 'Gỡ bài'}
                  </button>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={openPurchaseFlow}
                      disabled={ordering}
                      className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 py-2.5 text-sm font-medium text-white transition-all hover:bg-slate-800 disabled:opacity-50"
                    >
                      <ShoppingCart size={16} /> Mua sản phẩm
                    </button>
                    {product.allowOffers !== false ? (
                      <button
                        onClick={() => setOfferOpen(true)}
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50"
                      >
                        <Wallet size={16} /> Thương lượng
                      </button>
                    ) : (
                      <button
                        onClick={() => chatService.triggerOpenChat(product.sellerId, sellerLabel, { id: product.id, title: product.title, price: product.price, imageUrl: product.imageUrls?.[0] })}
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50"
                      >
                        <MessageSquare size={16} /> Chat với người bán
                      </button>
                    )}
                  </div>
                  {product.allowOffers !== false && (
                    <button
                      onClick={() => chatService.triggerOpenChat(product.sellerId, sellerLabel, { id: product.id, title: product.title, price: product.price, imageUrl: product.imageUrls?.[0] })}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50"
                    >
                      <MessageSquare size={16} /> Chat người bán
                    </button>
                  )}
                </>
              )}
            </div>
          </motion.div>
        </div>

        {/* ===== UY TÍN NGƯỜI BÁN — Full-width ===== */}
        {sellerProfile && (
          <div className="mb-8 mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-6 py-3.5">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                <ShieldCheck size={14} className="text-emerald-500" />
                Uy tín người bán
              </div>
              {sellerTrust?.badge && (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                  {sellerTrust.badge}
                </span>
              )}
            </div>

            {/* Body */}
            <div className="flex flex-wrap items-center gap-6 px-6 py-5 sm:flex-nowrap">

              {/* Avatar + tên + sao + nút theo dõi (avatar và tên là link đến profile) */}
              <div className="flex items-center gap-4 shrink-0">
                <Link to={`/sellers/${product.sellerId}`} className="relative h-16 w-16 shrink-0 block">
                  <div className="h-16 w-16 overflow-hidden rounded-full border-2 border-white bg-slate-100 shadow-md ring-2 ring-slate-100 transition-opacity hover:opacity-90">
                    {sellerProfile.avatarUrl
                      ? <img src={sellerProfile.avatarUrl} alt={sellerProfile.name} className="h-full w-full object-cover" />
                      : <div className="flex h-full w-full items-center justify-center text-slate-400"><User size={28} /></div>
                    }
                  </div>
                  <BadgeCheck size={19} className="absolute -bottom-0.5 -right-0.5 rounded-full bg-white text-emerald-500" />
                </Link>

                <div>
                  <Link
                    to={`/sellers/${product.sellerId}`}
                    className="text-base font-bold text-slate-900 hover:text-slate-600 transition-colors"
                  >
                    {sellerProfile.name || 'Người dùng IUH'}
                  </Link>
                  
                  {/* Nút theo dõi ngay dưới tên */}
                  {user && user.id !== product.sellerId && (
                    <button
                      onClick={async () => { const res = await productService.toggleSellerFollow(product.sellerId); if (res.success) setFollowingSeller(res.data.following); }}
                      className={`mt-2 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${followingSeller ? 'border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
                    >
                      {followingSeller ? 'Đang theo dõi' : '+ Theo dõi'}
                    </button>
                  )}
                </div>
              </div>

              <div className="hidden sm:block w-30" /> 

              {/* Stats — không có cột dọc ngăn cách */}
              <div className="flex items-center gap-30">
                <div className="text-center">
                  <div className="text-2xl font-black text-slate-900">{sellerTrust?.soldCount || 0}</div>
                  <div className="mt-0.5 text-xs font-medium text-slate-400">Giao dịch</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-black text-slate-900">{sellerTrust?.trustScore || 0}</div>
                  <div className="mt-0.5 text-xs font-medium text-slate-400">Điểm uy tín</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-black text-slate-900">{sellerTrust?.followerCount || 0}</div>
                  <div className="mt-0.5 text-xs font-medium text-slate-400">Người theo dõi</div>
                </div>
              </div>
            </div>
          </div>
        )}

        <ReviewSection productId={product.id} orderId={completedOrderId || undefined} />
      </div>

      {/* ===== MODAL MUA HÀNG ===== */}
      {purchaseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex shrink-0 items-start justify-between border-b border-slate-100 px-6 py-5">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Xác nhận mua sản phẩm</h2>
                <p className="mt-1 text-sm text-slate-500">Tạo yêu cầu mua và chọn bước thanh toán tiếp theo.</p>
              </div>
              <button onClick={() => setPurchaseOpen(false)} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="mb-1 text-sm font-semibold text-slate-900">{product.title}</div>
                <div className="text-sm text-slate-500">Người bán: {sellerLabel}</div>
                <div className="mt-3 text-xl font-bold text-slate-900">
                  {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price)}
                </div>
              </div>
              {paymentChoice === 'BANK_TRANSFER' && (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                  <div className="mb-3 text-sm font-bold text-emerald-800">Thông tin chuyển khoản người bán</div>
                  {sellerProfile?.bankInfo?.accountNumber ? (
                    <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                      <div className="space-y-2 text-sm text-slate-700">
                        <div><span className="font-semibold">Ngân hàng:</span> {sellerProfile.bankInfo.bankName || 'Chưa cập nhật'}</div>
                        <div><span className="font-semibold">Số tài khoản:</span> {sellerProfile.bankInfo.accountNumber}</div>
                        <div><span className="font-semibold">Chủ tài khoản:</span> {sellerProfile.bankInfo.accountHolder || sellerLabel}</div>
                        <div><span className="font-semibold">Nội dung:</span> IUH {product.id.slice(-6).toUpperCase()}</div>
                      </div>
                      {sellerProfile.bankInfo.qrCodeUrl && (
                        <img src={sellerProfile.bankInfo.qrCodeUrl} alt="QR chuyển khoản" className="h-28 w-28 rounded-lg border border-white bg-white object-cover" />
                      )}
                    </div>
                  ) : (
                    <div className="text-sm text-amber-700">Người bán chưa cập nhật thông tin ngân hàng.</div>
                  )}
                </div>
              )}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Lời nhắn cho người bán</label>
                <textarea value={buyerNote} onChange={(e) => setBuyerNote(e.target.value)} rows={4} placeholder="Ví dụ: Mình muốn nhận hàng vào chiều mai ở khu A." className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none transition-colors focus:border-slate-400" />
              </div>
              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700"><Wallet size={16} /><span>Hình thức thanh toán</span></div>
                <div className="space-y-2">
                  <button type="button" onClick={() => setPaymentChoice('BANK_TRANSFER')} className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${paymentChoice === 'BANK_TRANSFER' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                    <div className="font-medium">Chuyển khoản cho người bán</div>
                    <div className={`mt-1 text-xs ${paymentChoice === 'BANK_TRANSFER' ? 'text-slate-200' : 'text-slate-500'}`}>Tạo đơn xong, bạn chuyển khoản rồi bấm Tôi đã chuyển khoản.</div>
                  </button>
                  <button type="button" onClick={() => setPaymentChoice('CASH')} className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${paymentChoice === 'CASH' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}>
                    <div className="font-medium">Thanh toán khi gặp</div>
                    <div className={`mt-1 text-xs ${paymentChoice === 'CASH' ? 'text-slate-200' : 'text-slate-500'}`}>Gặp trong trường, trả tiền và nhận hàng trực tiếp.</div>
                  </button>
                </div>
              </div>
              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">
                <div className="mb-1 flex items-center gap-2 font-medium"><ShieldCheck size={16} /><span>Sau khi tạo đơn</span></div>
                <ul className="space-y-1 text-blue-700/90">
                  <li>1. Sản phẩm được giữ cho đơn của bạn.</li>
                  <li>2. Hai bên chốt lịch gặp trong trường.</li>
                  <li>3. Trang chi tiết đơn sẽ hiện đúng nút cần bấm tiếp theo.</li>
                </ul>
              </div>
              {purchaseMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{purchaseMessage}</div>
              )}
            </div>
            <div className="flex shrink-0 flex-col gap-3 border-t border-slate-100 px-6 py-5 sm:flex-row">
              <button type="button" onClick={() => setPurchaseOpen(false)} className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">Hủy</button>
              <button type="button" onClick={handleOrder} disabled={ordering} className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50">
                {ordering ? 'Đang tạo đơn...' : 'Tạo đơn hàng'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL THƯƠNG LƯỢNG (Trả giá / Đổi đồ) ===== */}
      {offerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4 py-6">
          <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Thương lượng</h2>
                <p className="text-xs text-slate-400">Trả giá hoặc đề xuất đổi đồ</p>
              </div>
              <button onClick={() => setOfferOpen(false)} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              {/* Product mini card */}
              <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                {product.imageUrls[0] && (
                  <img src={product.imageUrls[0]} alt={product.title} className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{product.title}</p>
                  <p className="text-xs text-slate-400">Giá niêm yết: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price)}</p>
                </div>
              </div>

              {/* Loại đề xuất */}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setOfferType('PRICE')} className={`rounded-xl border py-2.5 text-sm font-bold transition-all ${offerType === 'PRICE' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Trả giá</button>
                <button type="button" onClick={() => setOfferType('TRADE')} className={`rounded-xl border py-2.5 text-sm font-bold transition-all ${offerType === 'TRADE' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600 hover:bg-slate-50'}`}>Đổi đồ</button>
              </div>

              {offerType === 'PRICE' ? (
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-slate-500">Giá đề xuất (VND)</label>
                  <input
                    value={offerAmount}
                    onChange={(e) => setOfferAmount(e.target.value)}
                    type="number"
                    placeholder="Nhập giá bạn muốn trả..."
                    className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition-colors focus:border-slate-400"
                  />
                </div>
              ) : (
                <>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">Món bạn muốn đổi</label>
                    <input value={tradeItemTitle} onChange={(e) => setTradeItemTitle(e.target.value)} placeholder="Tên món đồ..." className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition-colors focus:border-slate-400" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-slate-500">Mô tả thêm</label>
                    <textarea value={tradeItemDescription} onChange={(e) => setTradeItemDescription(e.target.value)} placeholder="Tình trạng, đặc điểm..." rows={2} className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition-colors focus:border-slate-400" />
                  </div>
                </>
              )}
              <div>
                <label className="mb-1.5 block text-xs font-medium text-slate-500">Lời nhắn (tùy chọn)</label>
                <input value={offerMessage} onChange={(e) => setOfferMessage(e.target.value)} placeholder="Gửi kèm lời nhắn cho người bán..." className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition-colors focus:border-slate-400" />
              </div>
            </div>
            <div className="flex shrink-0 gap-3 border-t border-slate-100 px-6 py-4">
              <button type="button" onClick={() => setOfferOpen(false)} className="flex-1 rounded-xl border border-slate-200 bg-white py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">Hủy</button>
              <button
                type="button"
                disabled={offerBusy}
                onClick={async () => { await handleCreateOffer(); setOfferOpen(false); }}
                className="flex-1 rounded-xl bg-slate-900 py-3 text-sm font-bold text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
              >
                {offerBusy ? 'Đang gửi...' : 'Gửi đề xuất'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== LIGHTBOX ===== */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
          >
            <X size={20} />
          </button>
          {product.imageUrls.length > 1 && selectedImage > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedImage((i) => i - 1); }}
              className="absolute left-4 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <ArrowLeft size={20} />
            </button>
          )}
          {product.imageUrls.length > 1 && selectedImage < product.imageUrls.length - 1 && (
            <button
              onClick={(e) => { e.stopPropagation(); setSelectedImage((i) => i + 1); }}
              className="absolute right-14 top-1/2 -translate-y-1/2 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            >
              <ArrowRight size={20} />
            </button>
          )}
          <img
            src={activeImage}
            alt={product.title}
            className="max-h-[90vh] max-w-[90vw] rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {product.imageUrls.length > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm font-medium text-white/70">
              {selectedImage + 1} / {product.imageUrls.length}
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default ProductDetail;
