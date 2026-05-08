import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  sellerId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  price: { type: Number, required: true, min: 0 },
  images: [{ type: String }],
  category: { type: String, trim: true },
  condition: {
    type: String,
    enum: ['NEW', 'LIKE_NEW', 'GOOD', 'FAIR', 'POOR'],
    default: 'GOOD',
  },
  status: {
    type: String,
    enum: ['AVAILABLE', 'PENDING', 'SOLD', 'REMOVED'],
    default: 'AVAILABLE',
    index: true,
  },
}, { timestamps: true });

productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ status: 1, createdAt: -1 });

export const Product = mongoose.model('Product', productSchema);
