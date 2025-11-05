import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  tgId: number;
  username?: string;
  firstName?: string;
  lastName?: string;
  isAdmin: boolean;
}

const UserSchema = new Schema<IUser>({
  tgId: { type: Number, required: true, unique: true },
  username: String,
  firstName: String,
  lastName: String,
  isAdmin: { type: Boolean, default: false }
}, { timestamps: true });

export const User = model<IUser>('User', UserSchema);
