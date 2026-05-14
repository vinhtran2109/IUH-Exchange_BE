import mongoose from 'mongoose';

const sellerFollowSchema = new mongoose.Schema(
  {
    followerId: { type: String, required: true, index: true },
    sellerId: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

sellerFollowSchema.index({ followerId: 1, sellerId: 1 }, { unique: true });

export const SellerFollow = mongoose.model('SellerFollow', sellerFollowSchema);
