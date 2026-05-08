import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
  content: { type: String, required: true },
  conversationId: { type: String, required: true, index: true },
  isRead: { type: Boolean, default: false },
}, { timestamps: true });

chatMessageSchema.index({ conversationId: 1, createdAt: -1 });

export const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
