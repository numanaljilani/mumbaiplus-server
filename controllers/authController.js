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
  console.log(req.body)
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
// Auth Controller (Modified Login Function)

export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    
    // 1. Check if user exists
    if (!user) {
      return res.status(401).json({ message: 'गलत ईमेल या पासवर्ड' });
    }

    // 2. Check if the password matches
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'गलत ईमेल या पासवर्ड' });
    }

    // 3. IMPORTANT: Check for verification status
    if (user.role === 'reporter' && !user.isVerified) {
      return res.status(403).json({ 
        message: 'आपका अकाउंट अभी सत्यापन (Verification) के लिए लंबित है।',
        code: 'PENDING_APPROVAL' // Custom code for client-side handling
      });
    }
    
    // If the user is verified or is an admin (assuming admins are verified by default/skip this check), proceed.
    
    // 4. Generate token and respond
    const token = generateToken(user._id);
    res.json({
      token,
      user: { id: user._id, name: user.name, mobile: user.mobile, role: user.role, isVerified: user.isVerified },
    });
    
  } catch (error) {
    // Note: Log the error on the server side for debugging
    console.error("Login error:", error);
    res.status(500).json({ message: 'सर्वर त्रुटि। कृपया बाद में प्रयास करें।' });
  }
};