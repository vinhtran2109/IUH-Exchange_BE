import mongoose from 'mongoose';

const productSchema = new mongoose.Schema(
  {
    sellerId: { type: String, required: true, index: true },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 200 },
    description: { type: String, required: true, trim: true, minlength: 5, maxlength: 2000 },
    price: { type: Number, required: true, min: 0 },
    listingType: {
      type: String,
      enum: ['SELL', 'GIVE_AWAY', 'TRADE'],
      default: 'SELL',
      index: true,
    },
    tradeWanted: { type: String, trim: true, default: '', maxlength: 500 },
    allowOffers: { type: Boolean, default: true },
    imageUrls: [{ type: String }],
    category: { type: String, required: true, trim: true, index: true },
    location: { type: String, trim: true, default: '', index: true },
    condition: {
      type: String,
      enum: ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR'],
      default: 'GOOD',
    },
    status: {
      type: String,
      enum: ['PENDING_APPROVAL', 'AVAILABLE', 'RESERVED', 'PENDING', 'SOLD', 'HIDDEN', 'REJECTED'],
      default: 'PENDING_APPROVAL',
      index: true,
    },
    reservedOrderId: { type: String, default: null, index: true },
    reservedBy: { type: String, default: null },
    reservedAt: { type: Date, default: null },
    reservationExpiresAt: { type: Date, default: null, index: true },
  },
  { timestamps: true }
);

productSchema.index({ status: 1, createdAt: -1 });
productSchema.index({ sellerId: 1, createdAt: -1 });
productSchema.index({ category: 1, status: 1, createdAt: -1 });
productSchema.index({ location: 1, status: 1, createdAt: -1 });

export const Product = mongoose.model('Product', productSchema);
