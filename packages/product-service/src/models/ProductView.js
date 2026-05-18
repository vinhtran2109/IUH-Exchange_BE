import mongoose from 'mongoose';

const productViewSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    productId: { type: String, required: true, index: true },
    sellerId: { type: String, default: '', index: true },
    viewedAt: { type: Date, default: Date.now, index: true },
  },
  { timestamps: true }
);

productViewSchema.index({ userId: 1, productId: 1 }, { unique: true });
productViewSchema.index({ userId: 1, viewedAt: -1 });

export const ProductView = mongoose.model('ProductView', productViewSchema);
