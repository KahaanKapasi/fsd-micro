import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { jsonContract } from './plugins.js';

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Invalid email'],
    },
    passwordHash: { type: String, required: true, select: false },
    avatar: { type: String, default: '' },
    status: { type: String, enum: ['online', 'offline', 'busy'], default: 'offline' },
  },
  { timestamps: true }
);

userSchema.statics.hashPassword = (plain) => bcrypt.hash(plain, 10);
userSchema.methods.verifyPassword = function verifyPassword(plain) {
  return bcrypt.compare(plain, this.passwordHash);
};

jsonContract(userSchema);
export const User = mongoose.model('User', userSchema);
