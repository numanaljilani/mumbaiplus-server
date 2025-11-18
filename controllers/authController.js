// src/controllers/authController.js
import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// @desc    Register user
export const register = async (req, res) => {
  const { name, mobile, password , email } = req.body;

  try {
    const userExists = await User.findOne({ mobile });
    if (userExists) return res.status(400).json({ message: 'मोबाइल पहले से रजिस्टर्ड' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, mobile, password: hashedPassword , email });

    const token = generateToken(user._id);
    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, mobile: user.mobile, role: user.role , email : user.email },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Login user
export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ message: 'गलत मोबाइल या पासवर्ड' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'गलत पासवर्ड' });

    const token = generateToken(user._id);
    res.json({
      token,
      user: { id: user._id, name: user.name, mobile: user.mobile, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};