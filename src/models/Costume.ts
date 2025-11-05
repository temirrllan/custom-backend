import { Schema, model, Document } from 'mongoose';

export interface ICostume extends Document {
  title: string;
  price: number;
  sizes: string[];
  photos: string[];
  stockBySize: Record<string, number>;
  available: boolean;
}

const CostumeSchema = new Schema<ICostume>({
  title: { type: String, required: true },
  price: { type: Number, required: true },
  sizes: [{ type: String }],
  photos: [{ type: String }],
  stockBySize: { type: Schema.Types.Mixed, default: {} },
  available: { type: Boolean, default: true }
}, { timestamps: true });

export const Costume = model<ICostume>('Costume', CostumeSchema);
