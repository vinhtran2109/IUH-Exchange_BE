import mongoose from 'mongoose';

const wishlistSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    productId: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

wishlistSchema.index({ userId: 1, productId: 1 }, { unique: true });

export const Wishlist = mongoose.model('Wishlist', wishlistSchema);
