import mongoose, { Schema, Document } from 'mongoose';

export interface IContext extends Document {
  userId: string;
  messages: any[];
  createdAt: Date;
  updatedAt: Date;
}

const ContextSchema = new Schema<IContext>({
  userId: { type: String, required: true, unique: true, index: true },
  messages: [],
}, {
  timestamps: true,
});

export const ContextModel = mongoose.model<IContext>('Context', ContextSchema);