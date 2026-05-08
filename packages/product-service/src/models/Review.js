import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema(
  {
    productId: { type: String, required: true, index: true },
    orderId: { type: String, required: true, unique: true }, // 1 review per order
    buyerId: { type: String, required: true, index: true },
    sellerId: { type: String, required: true, index: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: '', maxlength: 1000 },
  },
  { timestamps: true }
);

reviewSchema.index({ productId: 1, createdAt: -1 });
reviewSchema.index({ sellerId: 1, createdAt: -1 });
reviewSchema.index({ buyerId: 1, createdAt: -1 });

export const Review = mongoose.model('Review', reviewSchema);
