import mongoose, { Schema, Document } from 'mongoose';

export interface IJobAuditLog extends Document {
  userId: string;
  jobId: string;
  jobName: string;
  message: string;
  status: 'success' | 'failed' | 'missed';
  runAt: Date;
  deliveredAt?: Date;
  errorMessage?: string;
  retryCount: number;
}

const JobAuditLogSchema = new Schema<IJobAuditLog>({
  userId: { type: String, required: true, index: true },
  jobId: { type: String, required: true },
  jobName: { type: String, required: true },
  message: { type: String, required: true },
  status: { type: String, enum: ['success', 'failed', 'missed'], required: true },
  runAt: { type: Date, required: true },
  deliveredAt: { type: Date },
  errorMessage: { type: String },
  retryCount: { type: Number, default: 0 },
}, {
  timestamps: true,
});

// Indexes for querying
JobAuditLogSchema.index({ userId: 1, runAt: -1 });
JobAuditLogSchema.index({ jobId: 1, status: 1 });

export const JobAuditLogModel = mongoose.model<IJobAuditLog>('JobAuditLog', JobAuditLogSchema);
