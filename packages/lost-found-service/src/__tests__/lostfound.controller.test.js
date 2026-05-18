import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──
const mockLostFoundItem = {
  _id: 'lf123',
  userId: 'user123',
  type: 'LOST',
  title: 'Mất ví da',
  description: 'Ví da màu đen, bên trong có CMND',
  images: ['https://s3.amazonaws.com/img1.jpg'],
  location: 'Tầng 3 thư viện',
  contactInfo: 'Zalo: 0909123456',
  status: 'OPEN',
  createdAt: new Date(),
  toObject: vi.fn().mockReturnThis(),
  deleteOne: vi.fn().mockResolvedValue(true),
  save: vi.fn().mockResolvedValue(true),
};

const mockLFModel = {
  find: vi.fn().mockReturnThis(),
  findById: vi.fn(),
  countDocuments: vi.fn(),
  sort: vi.fn().mockReturnThis(),
  skip: vi.fn().mockReturnThis(),
  limit: vi.fn().mockReturnThis(),
  create: vi.fn(),
};

vi.mock('../models/LostFound.js', () => ({
  LostFoundItem: mockLFModel,
}));

vi.mock('../services/s3.service.js', () => ({
  generatePresignedUploadUrl: vi.fn().mockResolvedValue({
    presignedUrl: 'https://s3.amazonaws.com/upload',
    publicUrl: 'https://s3.amazonaws.com/img.jpg',
  }),
  deleteFileByUrl: vi.fn().mockResolvedValue(true),
}));

vi.mock('../services/matching.service.js', () => ({
  findMatches: vi.fn().mockResolvedValue([]),
  autoMatchOnCreate: vi.fn().mockResolvedValue([]),
}));

vi.mock('@iuh-exchange/common', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    logger: { info: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
  };
});

const lfController = await import('../controllers/lostfound.controller.js');

function mockReqRes(body = {}, params = {}, query = {}, user = { sub: 'user123' }) {
  const req = { body, params, query, user };
  const res = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  const next = vi.fn();
  return { req, res, next };
}

describe('lostfound.controller', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLFModel.find.mockReturnThis();
    mockLFModel.sort.mockReturnThis();
    mockLFModel.skip.mockReturnThis();
    mockLFModel.limit.mockReturnThis();
  });

  describe('listItems', () => {
    it('should return paginated items', async () => {
      mockLFModel.find.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ ...mockLostFoundItem }]),
          }),
        }),
      });
      mockLFModel.countDocuments.mockResolvedValue(1);

      const { req, res, next } = mockReqRes({}, {}, { page: '1', size: '20' });
      await lfController.listItems(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });

    it('should filter by type LOST', async () => {
      mockLFModel.find.mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      mockLFModel.countDocuments.mockResolvedValue(0);

      const { req, res, next } = mockReqRes({}, {}, { type: 'LOST' });
      await lfController.listItems(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });

    it('should reject invalid type', async () => {
      const { req, res, next } = mockReqRes({}, {}, { type: 'INVALID' });
      await lfController.listItems(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('getItemById', () => {
    it('should return item by ID', async () => {
      mockLFModel.findById.mockResolvedValue({ ...mockLostFoundItem });

      const { req, res, next } = mockReqRes({}, { id: 'lf123' });
      await lfController.getItemById(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });

    it('should throw 404 for missing item', async () => {
      mockLFModel.findById.mockResolvedValue(null);

      const { req, res, next } = mockReqRes({}, { id: 'nonexistent' });
      await lfController.getItemById(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('createItem', () => {
    it('should create lost/found item successfully', async () => {
      mockLFModel.create.mockResolvedValue({ ...mockLostFoundItem });

      const { req, res, next } = mockReqRes({
        type: 'LOST',
        title: 'Mất ví da',
        description: 'Ví da màu đen',
        images: ['https://s3.amazonaws.com/img.jpg'],
        location: 'Thư viện',
        contactInfo: 'Zalo: 0909123456',
      });
      await lfController.createItem(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(mockLFModel.create).toHaveBeenCalled();
    });

    it('should support imageUrls field name from frontend', async () => {
      mockLFModel.create.mockResolvedValue({ ...mockLostFoundItem });

      const { req, res, next } = mockReqRes({
        type: 'FOUND',
        title: 'Nhặt được chìa khóa',
        imageUrls: ['https://s3.amazonaws.com/keys.jpg'],
      });
      await lfController.createItem(req, res, next);

      expect(mockLFModel.create).toHaveBeenCalled();
    });

    it('should return matches in response', async () => {
      const { autoMatchOnCreate } = await import('../services/matching.service.js');
      autoMatchOnCreate.mockResolvedValue([
        { item: { ...mockLostFoundItem }, score: 0.75 },
      ]);
      mockLFModel.create.mockResolvedValue({ ...mockLostFoundItem });

      const { req, res, next } = mockReqRes({
        type: 'LOST',
        title: 'Mất ví da',
      });
      await lfController.createItem(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      const response = res.json.mock.calls[0][0];
      expect(response.data.matches).toBeDefined();
      expect(response.data.matches.length).toBe(1);
      expect(response.data.matches[0].score).toBe(0.75);
    });
  });

  describe('updateItem', () => {
    it('should update item successfully', async () => {
      mockLFModel.findById.mockResolvedValue({
        ...mockLostFoundItem,
        userId: { toString: () => 'user123' },
      });

      const { req, res, next } = mockReqRes(
        { title: 'Updated title', status: 'CLAIMED' },
        { id: 'lf123' }
      );
      await lfController.updateItem(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });

    it('should reject update from non-owner', async () => {
      mockLFModel.findById.mockResolvedValue({
        ...mockLostFoundItem,
        userId: { toString: () => 'other-user' },
      });

      const { req, res, next } = mockReqRes(
        { title: 'Hacked' },
        { id: 'lf123' },
        {},
        { sub: 'attacker' }
      );
      await lfController.updateItem(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });

  describe('deleteItem', () => {
    it('should delete item and cleanup S3 images', async () => {
      mockLFModel.findById.mockResolvedValue({
        ...mockLostFoundItem,
        userId: { toString: () => 'user123' },
        images: ['https://s3.amazonaws.com/img1.jpg'],
      });

      const { req, res, next } = mockReqRes({}, { id: 'lf123' });
      await lfController.deleteItem(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('claimItem', () => {
    it('should claim an open item', async () => {
      mockLFModel.findById.mockResolvedValue({
        ...mockLostFoundItem,
        userId: { toString: () => 'other-user' },
        status: 'OPEN',
      });

      const { req, res, next } = mockReqRes({}, { id: 'lf123' }, {}, { sub: 'claimer123' });
      await lfController.claimItem(req, res, next);

      expect(res.json).toHaveBeenCalled();
    });

    it('should reject claiming own item', async () => {
      mockLFModel.findById.mockResolvedValue({
        ...mockLostFoundItem,
        userId: { toString: () => 'user123' },
        status: 'OPEN',
      });

      const { req, res, next } = mockReqRes({}, { id: 'lf123' }, {}, { sub: 'user123' });
      await lfController.claimItem(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    it('should reject claiming non-OPEN item', async () => {
      mockLFModel.findById.mockResolvedValue({
        ...mockLostFoundItem,
        userId: { toString: () => 'other-user' },
        status: 'CLOSED',
      });

      const { req, res, next } = mockReqRes({}, { id: 'lf123' }, {}, { sub: 'claimer123' });
      await lfController.claimItem(req, res, next);

      expect(next).toHaveBeenCalled();
    });
  });
});
