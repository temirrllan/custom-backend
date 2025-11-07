import { Schema, model } from "mongoose";

const adminLogSchema = new Schema(
  {
    adminTgId: Number,
    action: String,
    details: Schema.Types.Mixed,
  },
  { timestamps: true }
);

export const AdminLog = model("AdminLog", adminLogSchema);
