import mongoose from 'mongoose';

const chatMessageSchema = new mongoose.Schema(
  {
    senderId: { type: String, required: true, index: true },
    receiverId: { type: String, required: true, index: true },
    conversationId: { type: String, required: true, index: true },
    content: { type: String, default: '' },
    messageType: {
      type: String,
      enum: ['TEXT', 'IMAGE', 'FILE'],
      default: 'TEXT',
    },
    fileUrl: { type: String, default: null },
    fileName: { type: String, default: null },
    isRead: { type: Boolean, default: false },
  },
  { timestamps: true }
);

chatMessageSchema.index({ conversationId: 1, createdAt: -1 });

export const ChatMessage = mongoose.model('ChatMessage', chatMessageSchema);
