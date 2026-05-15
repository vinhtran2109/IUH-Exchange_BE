import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  Flag,
  Heart,
  MessageSquare,
  Package,
  Pencil,
  ShieldCheck,
  ShoppingCart,
  Trash2,
  Wallet,
  X,
} from 'lucide-react';
import { productService } from '../services/productService';
import { chatService } from '../services/chatService';
import { orderService } from '../services/orderService';
import type { Product } from '../services/productService';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import ReviewSection from '../components/ReviewSection';
import { wishlistService } from '../services/wishlistService';

type PaymentChoice = 'BANK_TRANSFER' | 'CASH';

const ProductDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore() as any;
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const [completedOrderId, setCompletedOrderId] = useState<string | null>(null);
  const [wishlisted, setWishlisted] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [buyerNote, setBuyerNote] = useState('');
  const [handoverLocation, setHandoverLocation] = useState('');
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
    if (!product?.sellerId) return 'người bán';
    return `người bán ${String(product.sellerId).substring(0, 6)}`;
  }, [product?.sellerId]);

  const handleToggleWishlist = async () => {
    if (!user) {
      alert('Bạn cần đăng nhập!');
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
    if (!id || !window.confirm('Bạn có chắc chắn muốn gỡ bài đăng này?')) return;
    try {
      setDeleting(true);
      const response = await productService.deleteProduct(id);
      if (response.success) {
        alert('Gỡ bài thành công!');
        navigate('/');
      }
    } catch {
      alert('Lỗi khi xóa bài.');
    } finally {
      setDeleting(false);
    }
  };

  const handleReport = async () => {
    if (!user) {
      alert('Bạn cần đăng nhập để tố cáo!');
      return;
    }
    const reason = prompt('Lý do tố cáo sản phẩm này:');
    if (!reason || reason.length < 5) return;
    try {
      await api.post('/reports', { targetType: 'PRODUCT', targetId: id, reason });
      alert('Đã gửi tố cáo. Admin sẽ xem xét sớm.');
    } catch (err: any) {
      alert('Lỗi: ' + (err.response?.data?.message || 'Không thể gửi tố cáo'));
    }
  };

  const openPurchaseFlow = () => {
    if (!product) return;
    if (!user) {
      alert('Bạn cần đăng nhập!');
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
        handoverLocation: handoverLocation.trim(),
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
        chatService.triggerOpenChat(product.sellerId, sellerLabel);
      }

      setPurchaseOpen(false);
      setBuyerNote('');
      setHandoverLocation('');
      navigate(`/orders/${orderId}`, {
        state: {
          flashMessage:
            paymentChoice === 'BANK_TRANSFER'
              ? 'Da tao don. Hay chuyen khoan cho nguoi ban, sau do bam Toi da chuyen khoan trong chi tiet don.'
              : 'Da tao yeu cau mua thanh cong. Ban co the theo doi tien do don hang tai day.',
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
      alert(error.response?.data?.message || 'Không thể gửi đề xuất lúc này.');
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
      alert(error.response?.data?.message || 'Không thể xử lý đề xuất.');
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
      alert(error.response?.data?.message || 'Không thể tạo đơn từ đề xuất.');
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

  const activeImage = product.imageUrls[selectedImage] || product.imageUrls[0] || 'https://placehold.co/800x800/e2e8f0/94a3b8?text=IUH';

  return (
    <>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Link to="/" className="mb-6 inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900">
          <ArrowLeft size={16} />
          Quay lại
        </Link>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <div className="aspect-square overflow-hidden rounded-xl border border-slate-200 bg-white">
              <img src={activeImage} className="h-full w-full object-cover" alt={product.title} />
            </div>
            {product.imageUrls.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {product.imageUrls.map((url, index) => (
                  <button
                    key={`${url}-${index}`}
                    type="button"
                    onClick={() => setSelectedImage(index)}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-lg border transition-colors ${
                      selectedImage === index ? 'border-slate-900 ring-1 ring-slate-900' : 'border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <img src={url} className="h-full w-full object-cover" alt={`${product.title} ${index + 1}`} />
                  </button>
                ))}
              </div>
            )}
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col">
            <span className="mb-3 w-fit rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">
              {product.category}
            </span>

            <h1 className="mb-3 text-2xl font-bold leading-tight text-slate-900">{product.title}</h1>

            {user && user.id !== product.sellerId && (
              <button onClick={handleToggleWishlist} className="mb-3 flex w-fit items-center gap-1.5 text-sm transition-all">
                <Heart size={16} className={wishlisted ? 'fill-red-500 text-red-500' : 'text-slate-400'} />
                <span className={wishlisted ? 'font-medium text-red-500' : 'text-slate-400'}>
                  {wishlisted ? 'Đã yêu thích' : 'Yêu thích'}
                </span>
              </button>
            )}

            <div className="mb-5 flex items-center gap-3">
              <span className="rounded border border-slate-200 bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{product.condition}</span>
              <span className="text-xs text-slate-400">{new Date(product.createdAt).toLocaleDateString()}</span>
            </div>

            <div className="mb-5 rounded-xl border border-slate-200 bg-slate-50 p-5">
              <div className="mb-0.5 text-xs font-medium uppercase tracking-wide text-slate-500">Giá</div>
              <div className="text-3xl font-bold text-slate-900">
                {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.price)}
              </div>
            </div>

            {product.listingType && product.listingType !== 'SELL' && (
              <div className="mb-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
                <div className="font-bold">{product.listingType === 'TRADE' ? 'Bài đăng đổi đồ' : 'Bài đăng cho tặng'}</div>
                {product.tradeWanted && <div className="mt-1">Muốn đổi lấy: {product.tradeWanted}</div>}
              </div>
            )}

            {user && user.id !== product.sellerId && product.allowOffers !== false && (
              <div id="offer-panel" className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-3 text-sm font-bold text-slate-900">Trả giá / đề xuất đổi</div>
                <div className="mb-3 grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setOfferType('PRICE')} className={`rounded-lg border px-3 py-2 text-sm font-bold ${offerType === 'PRICE' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600'}`}>Trả giá</button>
                  <button type="button" onClick={() => setOfferType('TRADE')} className={`rounded-lg border px-3 py-2 text-sm font-bold ${offerType === 'TRADE' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 text-slate-600'}`}>Đổi đồ</button>
                </div>
                {offerType === 'PRICE' ? (
                  <input value={offerAmount} onChange={(e) => setOfferAmount(e.target.value)} type="number" placeholder="Giá đề xuất" className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                ) : (
                  <>
                    <input value={tradeItemTitle} onChange={(e) => setTradeItemTitle(e.target.value)} placeholder="Món bạn muốn đổi" className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <textarea value={tradeItemDescription} onChange={(e) => setTradeItemDescription(e.target.value)} placeholder="Mô tả món đổi" rows={2} className="mb-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  </>
                )}
                <input value={offerMessage} onChange={(e) => setOfferMessage(e.target.value)} placeholder="Lời nhắn thêm" className="mb-3 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <button type="button" disabled={offerBusy} onClick={handleCreateOffer} className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Gửi đề xuất</button>
              </div>
            )}

            {offers.length > 0 && (
              <div className="mb-5 rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-3 text-sm font-bold text-slate-900">{user?.id === product.sellerId ? 'Đề xuất từ người mua' : 'Đề xuất của bạn'}</div>
                <div className="space-y-2">
                  {offers.slice(0, 5).map((offer) => (
                    <div key={offer.id || offer._id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold text-slate-800">
                          {offer.type === 'TRADE' ? `Đổi: ${offer.tradeItemTitle}` : `${Number(offer.amount || 0).toLocaleString()}đ`}
                        </div>
                        <span className="rounded-full bg-white px-2 py-1 text-xs font-bold text-slate-600">{offer.status}</span>
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
                  ))}
                </div>
              </div>
            )}

            <div className="mb-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-1 text-xs font-medium text-slate-500">Thanh toán</div>
                <div className="text-sm font-semibold text-slate-800">Online hoặc trực tiếp</div>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="mb-1 text-xs font-medium text-slate-500">Trao đổi</div>
                <div className="text-sm font-semibold text-slate-800">Chat với người bán sau khi tạo đơn</div>
              </div>
            </div>

            {sellerTrust && (
              <div className="mb-5 rounded-xl border border-emerald-100 bg-emerald-50 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-bold uppercase text-emerald-700">Uy tin nguoi ban</div>
                    <div className="mt-1 text-sm font-black text-slate-900">{sellerTrust.badge} - {sellerTrust.trustScore}/100</div>
                  </div>
                  {user && user.id !== product.sellerId && (
                    <button
                      onClick={async () => {
                        const res = await productService.toggleSellerFollow(product.sellerId);
                        if (res.success) setFollowingSeller(res.data.following);
                      }}
                      className="rounded-lg bg-white px-3 py-2 text-xs font-bold text-emerald-700 shadow-sm"
                    >
                      {followingSeller ? 'Dang theo doi' : 'Theo doi'}
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="rounded-lg bg-white p-2"><div className="font-black text-slate-900">{sellerTrust.avgRating || 0}</div><div className="text-slate-400">Rating</div></div>
                  <div className="rounded-lg bg-white p-2"><div className="font-black text-slate-900">{sellerTrust.soldCount || 0}</div><div className="text-slate-400">Da ban</div></div>
                  <div className="rounded-lg bg-white p-2"><div className="font-black text-slate-900">{sellerTrust.followerCount || 0}</div><div className="text-slate-400">Theo doi</div></div>
                </div>
              </div>
            )}

            <div className="mb-6">
              <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-slate-900">
                <Package size={16} className="text-slate-400" /> Mô tả
              </h3>
              <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{product.description}</p>
            </div>

            <div className="mt-auto space-y-2 border-t border-slate-100 pt-4">
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
                        onClick={() => document.getElementById('offer-panel')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                        disabled={offerBusy}
                        className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50 disabled:opacity-50"
                      >
                        <Wallet size={16} /> Thương lượng
                      </button>
                    ) : (
                    <button
                      onClick={() => chatService.triggerOpenChat(product.sellerId, sellerLabel)}
                      className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50"
                    >
                      <MessageSquare size={16} /> Chat người bán
                    </button>
                    )}
                  </div>
                  {product.allowOffers !== false && (
                    <button
                      onClick={() => chatService.triggerOpenChat(product.sellerId, sellerLabel)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 transition-all hover:bg-slate-50"
                    >
                      <MessageSquare size={16} /> Chat người bán
                    </button>
                  )}
                  <button onClick={handleReport} className="flex w-full items-center justify-center gap-1 py-2 text-xs font-medium text-slate-400 transition-colors hover:text-red-500">
                    <Flag size={12} /> Tố cáo sản phẩm
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>

        <ReviewSection productId={product.id} orderId={completedOrderId || undefined} />
      </div>

      {purchaseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">

              <div>
                <h2 className="text-lg font-semibold text-slate-900">Xác nhận mua sản phẩm</h2>
                <p className="mt-1 text-sm text-slate-500">Tạo yêu cầu mua và chọn bước thanh toán tiếp theo.</p>
              </div>
              <button onClick={() => setPurchaseOpen(false)} className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-5 px-6 py-5">
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
                    <div className="text-sm text-amber-700">Người bán chưa cập nhật thông tin ngân hàng. Bạn có thể chọn thanh toán khi gặp hoặc chat để hỏi thông tin.</div>
                  )}
                </div>
              )}
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Lời nhắn cho người bán</label>
                <textarea
                  value={buyerNote}
                  onChange={(e) => setBuyerNote(e.target.value)}
                  rows={4}
                  placeholder="Ví dụ: Mình muốn nhận hàng vào chiều mai ở khu A."
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none transition-colors focus:border-slate-400"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700">Diem hen giao dich</label>
                <input
                  value={handoverLocation}
                  onChange={(e) => setHandoverLocation(e.target.value)}
                  placeholder="Vi du: Sanh A, Thu vien IUH, cong Nguyen Van Bao"
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-800 outline-none transition-colors focus:border-slate-400"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Wallet size={16} />
                  <span>Hình thức thanh toán</span>
                </div>
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={() => setPaymentChoice('BANK_TRANSFER')}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                      paymentChoice === 'BANK_TRANSFER' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-medium">Chuyen khoan truc tiep cho nguoi ban</div>
                    <div className={`mt-1 text-xs ${paymentChoice === 'BANK_TRANSFER' ? 'text-slate-200' : 'text-slate-500'}`}>
                      He thong hien thong tin ngan hang/QR cua nguoi ban, ban tu chuyen khoan va nguoi ban xac nhan da nhan tien.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentChoice('CASH')}
                    className={`w-full rounded-xl border px-4 py-3 text-left transition-colors ${
                      paymentChoice === 'CASH' ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="font-medium">Thanh toán khi gặp</div>
                    <div className={`mt-1 text-xs ${paymentChoice === 'CASH' ? 'text-slate-200' : 'text-slate-500'}`}>
                      Tạo đơn trước, trao đổi với người bán, rồi xác nhận hoàn tất sau khi giao dịch xong.
                    </div>
                  </button>
                </div>
              </div>

              <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-700">
                <div className="mb-1 flex items-center gap-2 font-medium">
                  <ShieldCheck size={16} />
                  <span>Luồng mua sau khi tạo đơn</span>
                </div>
                <ul className="space-y-1 text-blue-700/90">
                  <li>1. Hệ thống giữ sản phẩm cho đơn hàng của bạn.</li>
                  <li>2. Bạn chat với người bán để chốt thời gian và địa điểm.</li>
                  <li>3. Người bán xác nhận khi giao dịch hoàn tất.</li>
                </ul>
              </div>

              {purchaseMessage && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {purchaseMessage}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 px-6 py-5 sm:flex-row">
              <button
                type="button"
                onClick={() => setPurchaseOpen(false)}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Để sau
              </button>
              <button
                type="button"
                onClick={handleOrder}
                disabled={ordering}
                className="flex-1 rounded-xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
              >
                {ordering ? 'Đang tạo đơn...' : 'Tạo đơn hàng'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ProductDetail;
