import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockProductModel = {
  findById: vi.fn(),
};

const mockOfferModel = {
  create: vi.fn(),
  findById: vi.fn(),
  find: vi.fn(),
  countDocuments: vi.fn(),
  updateMany: vi.fn(),
};

vi.mock('../models/Product.js', () => ({ Product: mockProductModel }));
vi.mock('../models/Offer.js', () => ({ Offer: mockOfferModel }));
vi.mock('../services/kafka.service.js', () => ({
  publishProductEvent: vi.fn().mockResolvedValue(true),
}));
vi.mock('@iuh-exchange/common', async (importOriginal) => {
  const actual = await importOriginal();
  return actual;
});

const offerController = await import('../controllers/offer.controller.js');

function mockReqRes(body = {}, params = {}, user = { sub: 'buyer123' }) {
  return {
    req: { body, params, user, query: {} },
    res: {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    },
  };
}

describe('offer.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockOfferModel.updateMany.mockResolvedValue({ modifiedCount: 0 });
  });

  it('creates a price negotiation offer', async () => {
    mockProductModel.findById.mockResolvedValue({
      _id: 'prod123',
      sellerId: 'seller123',
      status: 'AVAILABLE',
      allowOffers: true,
    });
    mockOfferModel.create.mockResolvedValue({
      _id: 'offer123',
      productId: 'prod123',
      buyerId: 'buyer123',
      sellerId: 'seller123',
      type: 'PRICE',
      amount: 75000,
      status: 'PENDING',
      toObject() { return this; },
    });

    const { req, res } = mockReqRes({ type: 'PRICE', amount: 75000 }, { productId: 'prod123' });
    await offerController.createOffer(req, res);

    expect(mockOfferModel.create).toHaveBeenCalledWith(expect.objectContaining({
      type: 'PRICE',
      amount: 75000,
    }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('requires trade item details for trade offers', async () => {
    mockProductModel.findById.mockResolvedValue({
      _id: 'prod123',
      sellerId: 'seller123',
      status: 'AVAILABLE',
      allowOffers: true,
    });

    const { req, res } = mockReqRes({ type: 'TRADE' }, { productId: 'prod123' });

    await expect(offerController.createOffer(req, res)).rejects.toThrow('tradeItemTitle');
    expect(mockOfferModel.create).not.toHaveBeenCalled();
  });

  it('lets seller accept an offer and rejects competing pending offers', async () => {
    const offer = {
      _id: 'offer123',
      productId: 'prod123',
      buyerId: 'buyer123',
      sellerId: 'seller123',
      status: 'PENDING',
      expiresAt: new Date(Date.now() + 60_000),
      save: vi.fn().mockResolvedValue(true),
      toObject() { return this; },
    };
    mockOfferModel.findById.mockResolvedValue(offer);
    mockOfferModel.updateMany.mockResolvedValue({ modifiedCount: 2 });

    const { req, res } = mockReqRes({ action: 'ACCEPT' }, { offerId: 'offer123' }, { sub: 'seller123' });
    await offerController.resolveOffer(req, res);

    expect(offer.status).toBe('ACCEPTED');
    expect(mockOfferModel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 'prod123', status: 'PENDING' }),
      expect.objectContaining({ status: 'REJECTED' })
    );
    expect(res.json).toHaveBeenCalled();
  });

  it('returns checkout payload for accepted offer owner', async () => {
    mockOfferModel.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: 'offer123',
        productId: 'prod123',
        buyerId: 'buyer123',
        sellerId: 'seller123',
        status: 'ACCEPTED',
        type: 'PRICE',
        amount: 42000,
      }),
    });
    mockProductModel.findById.mockReturnValue({
      lean: vi.fn().mockResolvedValue({
        _id: 'prod123',
        sellerId: 'seller123',
        status: 'AVAILABLE',
        listingType: 'SELL',
      }),
    });

    const { req, res } = mockReqRes({}, { offerId: 'offer123' }, { sub: 'buyer123' });
    await offerController.getOfferCheckout(req, res);

    const response = res.json.mock.calls[0][0];
    expect(response.data.price).toBe(42000);
    expect(response.data.productId).toBe('prod123');
  });
});
