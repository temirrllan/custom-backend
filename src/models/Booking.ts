import { Schema, model, Document } from 'mongoose';
import { Types } from 'mongoose';

export interface IBooking extends Document {
  userTgId: number;
  clientName: string;
  phone: string;
  costumeId: Types.ObjectId;
  costumeTitle: string;
  size: string;
  childName?: string;
  childAge?: number;
  childHeight?: number;
  status: 'new' | 'confirmed' | 'cancelled' | 'completed';
  type: 'online' | 'offline'; // 🆕 Тип брони
  returnDate?: Date; // 🆕 Когда должен вернуть костюм
  googleSheetRowLink?: string;
}

const BookingSchema = new Schema<IBooking>({
  userTgId: { type: Number, required: true },
  clientName: { type: String, required: true },
  phone: { type: String, required: true },
  costumeId: { type: Schema.Types.ObjectId, ref: 'Costume', required: true },
  costumeTitle: { type: String, required: true },
  size: { type: String, required: true },
  childName: String,
  childAge: Number,
  childHeight: Number,
  status: { type: String, default: 'new' },
  type: { type: String, enum: ['online', 'offline'], default: 'online' }, // 🆕
  returnDate: Date, // 🆕
  googleSheetRowLink: String
}, { timestamps: true });

export const Booking = model<IBooking>('Booking', BookingSchema);