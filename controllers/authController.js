// src/controllers/authController.js
import User from '../models/User.js';
import Otp from '../models/Otp.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { generateOTP, sendOTPEmail } from '../services/emailService.js';

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE,
  });
};

// @desc    Register user
export const register = async (req, res) => {
  const { name, mobile, password, email } = req.body;

  try {
    const userExists = await User.findOne({ mobile });
    if (userExists) return res.status(400).json({ message: 'मोबाइल पहले से रजिस्टर्ड' });

    const emailExists = await User.findOne({ email });
    if (emailExists) return res.status(400).json({ message: 'ईमेल पहले से रजिस्टर्ड' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ name, mobile, password: hashedPassword, email });

    const token = generateToken(user._id);
    res.status(201).json({
      token,
      user: { id: user._id, name: user.name, mobile: user.mobile, role: user.role, email: user.email },
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
    
    if (!user) {
      return res.status(401).json({ message: 'गलत ईमेल या पासवर्ड' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'गलत ईमेल या पासवर्ड' });
    }

    if (user.role === 'reporter' && !user.isVerified) {
      return res.status(403).json({ 
        message: 'आपका अकाउंट अभी सत्यापन (Verification) के लिए लंबित है।',
        code: 'PENDING_APPROVAL'
      });
    }
    
    const token = generateToken(user._id);
    res.json({
      token,
      user: { id: user._id, name: user.name, mobile: user.mobile, role: user.role, isVerified: user.isVerified, email: user.email },
    });
    
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ message: 'सर्वर त्रुटि। कृपया बाद में प्रयास करें।' });
  }
};

// @desc    Request OTP for password reset
export const requestOTP = async (req, res) => {
  const { email } = req.body;

  try {
    // Check if user exists with this email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'इस ईमेल से कोई खाता नहीं मिला' });
    }

    // Generate OTP
    const otp = generateOTP();

    // Save OTP to database
    await Otp.create({
      email,
      otp,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    });
console.log(otp , "otp >>>>>>")
    // Send OTP via email
    await sendOTPEmail(email, otp);

    res.status(200).json({ 
      message: 'OTP आपके ईमेल पर भेज दिया गया है',
      email: email 
    });

  } catch (error) {
    console.error('OTP request error:', error);
    res.status(500).json({ message: 'OTP भेजने में त्रुटि। कृपया बाद में प्रयास करें।' });
  }
};

// @desc    Verify OTP
export const verifyOTP = async (req, res) => {
  const { email, otp } = req.body;

  try {
    // Find valid OTP
    const otpRecord = await Otp.findOne({
      email,
      otp,
      isUsed: false,
      expiresAt: { $gt: new Date() }
    });

    if (!otpRecord) {
      return res.status(400).json({ 
        message: 'अमान्य या समाप्त हो चुका OTP' 
      });
    }

    // Mark OTP as used
    otpRecord.isUsed = true;
    await otpRecord.save();

    // Generate temporary token for password reset (valid for 15 minutes)
    const resetToken = jwt.sign(
      { email }, 
      process.env.JWT_SECRET, 
      { expiresIn: '15m' }
    );

    res.status(200).json({ 
      message: 'OTP सत्यापित हो गया है',
      resetToken 
    });

  } catch (error) {
    console.error('OTP verification error:', error);
    res.status(500).json({ message: 'OTP सत्यापन में त्रुटि' });
  }
};

// @desc    Reset password
export const resetPassword = async (req, res) => {
  const { resetToken, newPassword } = req.body;

  try {
    // Verify reset token
    const decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    const email = decoded.email;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: 'उपयोगकर्ता नहीं मिला' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    user.password = hashedPassword;
    await user.save();

    // Delete all used OTPs for this email
    await Otp.deleteMany({ email, isUsed: true });

    res.status(200).json({ 
      message: 'पासवर्ड सफलतापूर्वक बदल दिया गया है' 
    });

  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        message: 'अमान्य या समाप्त हो चुका टोकन। कृपया पुनः OTP प्राप्त करें।' 
      });
    }
    
    console.error('Password reset error:', error);
    res.status(500).json({ message: 'पासवर्ड बदलने में त्रुटि' });
  }
};

// @desc    Update password (for logged in users)
export const updatePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.id; // Assuming you have auth middleware

  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'उपयोगकर्ता नहीं मिला' });
    }

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'वर्तमान पासवर्ड गलत है' });
    }

    // Hash and update new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    await user.save();

    res.status(200).json({ 
      message: 'पासवर्ड सफलतापूर्वक अपडेट हो गया है' 
    });

  } catch (error) {
    console.error('Password update error:', error);
    res.status(500).json({ message: 'पासवर्ड अपडेट करने में त्रुटि' });
  }
};


// // src/controllers/authController.js
// import User from '../models/User.js';
// import bcrypt from 'bcryptjs';
// import jwt from 'jsonwebtoken';

// // Generate JWT
// const generateToken = (id) => {
//   return jwt.sign({ id }, process.env.JWT_SECRET, {
//     expiresIn: process.env.JWT_EXPIRE,
//   });
// };

// // @desc    Register user
// export const register = async (req, res) => {

//   const { name, mobile, password , email } = req.body;

//   try {
//     const userExists = await User.findOne({ mobile });
//     if (userExists) return res.status(400).json({ message: 'मोबाइल पहले से रजिस्टर्ड' });

//     const hashedPassword = await bcrypt.hash(password, 10);
//     const user = await User.create({ name, mobile, password: hashedPassword , email });

//     const token = generateToken(user._id);
//     res.status(201).json({
//       token,
//       user: { id: user._id, name: user.name, mobile: user.mobile, role: user.role , email : user.email },
//     });
//   } catch (error) {
//     res.status(500).json({ message: error.message });
//   }
// };

// // @desc    Login user
// // Auth Controller (Modified Login Function)

// export const login = async (req, res) => {
//   const { email, password } = req.body;

//   try {
//     const user = await User.findOne({ email });
    
//     // 1. Check if user exists
//     if (!user) {
//       return res.status(401).json({ message: 'गलत ईमेल या पासवर्ड' });
//     }

//     // 2. Check if the password matches
//     const isMatch = await bcrypt.compare(password, user.password);
//     if (!isMatch) {
//       return res.status(401).json({ message: 'गलत ईमेल या पासवर्ड' });
//     }

//     // 3. IMPORTANT: Check for verification status
//     if (user.role === 'reporter' && !user.isVerified) {
//       return res.status(403).json({ 
//         message: 'आपका अकाउंट अभी सत्यापन (Verification) के लिए लंबित है।',
//         code: 'PENDING_APPROVAL' // Custom code for client-side handling
//       });
//     }
    
//     // If the user is verified or is an admin (assuming admins are verified by default/skip this check), proceed.
    
//     // 4. Generate token and respond
//     const token = generateToken(user._id);
//     res.json({
//       token,
//       user: { id: user._id, name: user.name, mobile: user.mobile, role: user.role, isVerified: user.isVerified },
//     });
    
//   } catch (error) {
//     // Note: Log the error on the server side for debugging
//     console.error("Login error:", error);
//     res.status(500).json({ message: 'सर्वर त्रुटि। कृपया बाद में प्रयास करें।' });
//   }
// };