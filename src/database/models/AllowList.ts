import mongoose, { Schema, Document } from 'mongoose';

export interface IAllowList extends Document {
  number: string;
  createdAt: Date;
  updatedAt: Date;
}

const AllowListSchema = new Schema<IAllowList>({
  number: { type: String, required: true, unique: true, index: true },
}, {
  timestamps: true,
});

export const AllowListModel = mongoose.model<IAllowList>('AllowList', AllowListSchema);
