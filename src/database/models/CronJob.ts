import mongoose, { Schema, Document } from 'mongoose';

export interface ICronJob extends Document {
  userId: string;
  name: string;
  naturalSchedule: string;
  cronExpression: string;
  timezone: string;
  message: string;
  enabled: boolean;
  agendaJobId?: string;
  createdAt: Date;
  updatedAt: Date;
  lastRunAt?: Date;
  nextRunAt?: Date;
}

const CronJobSchema = new Schema<ICronJob>({
  userId: { type: String, required: true, index: true },
  name: { type: String, required: true },
  naturalSchedule: { type: String, required: true },
  cronExpression: { type: String, required: true },
  timezone: { type: String, required: true, default: 'UTC' },
  message: { type: String, required: true },
  enabled: { type: Boolean, default: true },
  agendaJobId: { type: String },
  lastRunAt: { type: Date },
  nextRunAt: { type: Date },
}, {
  timestamps: true,
});

// Compound index to ensure unique job names per user
CronJobSchema.index({ userId: 1, name: 1 }, { unique: true });

export const CronJobModel = mongoose.model<ICronJob>('CronJob', CronJobSchema);
