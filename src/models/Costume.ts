import { Schema, model, Document } from "mongoose";

export interface ICostume extends Document {
  title: string;
  price: number;
  sizes: string[];
  photos: string[];
  stockBySize: Record<string, number>;
  available: boolean;
  heightRange?: string;   // 👈 рост ребёнка
  notes?: string;         // 👈 примечание
  description?: string;   // 👈 опционально, если хочешь хранить описание
}

const CostumeSchema = new Schema<ICostume>(
  {
    title: { type: String, required: true },
    price: { type: Number, required: true },
    sizes: [{ type: String }],
    photos: [{ type: String }],
    stockBySize: { type: Schema.Types.Mixed, default: {} },
    available: { type: Boolean, default: true },
    heightRange: { type: String, default: "" }, // 👈 новое поле
    notes: { type: String, default: "" },       // 👈 новое поле
    description: { type: String, default: "" }, // 👈 описание (по желанию)
  },
  { timestamps: true }
);

export const Costume = model<ICostume>("Costume", CostumeSchema);
