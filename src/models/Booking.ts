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
  type: 'online' | 'offline';
  
  // 🆕 Новые поля для правильной логики проката
  eventDate: Date;        // Дата мероприятия (когда клиент использует костюм)
  pickupDate: Date;       // Дата выдачи (за 1 день до eventDate, после 17:00)
  returnDate: Date;       // Дата возврата (день мероприятия, до 17:00)
  
  // Старое поле для совместимости
  bookingDate: Date;      // Дублирует eventDate
  
  googleSheetRowLink?: string;
  createdAt: Date;
  updatedAt: Date;
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
  type: { type: String, enum: ['online', 'offline'], default: 'online' },
  
  // 🆕 Новые поля
  eventDate: { type: Date, required: true },
  pickupDate: { type: Date, required: true },
  returnDate: { type: Date, required: true },
  
  bookingDate: { type: Date, required: true },
  googleSheetRowLink: String
}, { timestamps: true });

// 🆕 Индексы для быстрого поиска конфликтов
BookingSchema.index({ costumeId: 1, size: 1, status: 1 });
BookingSchema.index({ pickupDate: 1, returnDate: 1 });

export const Booking = model<IBooking>('Booking', BookingSchema);