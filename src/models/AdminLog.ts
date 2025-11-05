import { Schema, model, Document } from 'mongoose';

export interface IAdminLog extends Document {
  action: string;
  adminTgId?: number;
  details?: any;
}

const AdminLogSchema = new Schema<IAdminLog>({
  action: { type: String, required: true },
  adminTgId: Number,
  details: Schema.Types.Mixed
}, { timestamps: true });

export const AdminLog = model<IAdminLog>('AdminLog', AdminLogSchema);
