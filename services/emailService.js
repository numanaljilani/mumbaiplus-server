// src/services/emailService.js
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Create transporter with better configuration
const createTransporter = () => {
  // Check if we're in development mode and use ethereal for testing
  if (process.env.NODE_ENV === 'development' && !process.env.EMAIL_USER) {
    // Create test account on ethereal.email
    return nodemailer.createTestAccount().then(testAccount => {
      console.log('Using Ethereal Email for testing:');
      console.log('Preview URL: https://ethereal.email');
      console.log('Username:', testAccount.user);
      console.log('Password:', testAccount.pass);
      
      return nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
    });
  }

  // Production/Configured environment
  const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT) || 587,
    secure: process.env.EMAIL_PORT === '465', // true for 465, false for other ports
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
    // Add connection timeout
    connectionTimeout: 10000, // 10 seconds
    // Add debug in development
    debug: process.env.NODE_ENV === 'development',
  });

  return Promise.resolve(transporter);
};

// Generate 6-digit OTP
export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Verify transporter connection
export const verifyTransporter = async () => {
  try {
    const transporter = await createTransporter();
    await transporter.verify();
    console.log('Email server is ready to send messages');
    return true;
  } catch (error) {
    console.error('Email server verification failed:', error);
    return false;
  }
};

// Send OTP email
export const sendOTPEmail = async (email, otp) => {
  try {
    const transporter = await createTransporter();
    
    const mailOptions = {
      from: `"Mumbaiplus" <${process.env.EMAIL_USER || 'noreply@newsreporter.com'}>`,
      to: email,
      subject: 'Password Reset OTP - Mumbaiplus',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 20px auto;
              background: #ffffff;
              border-radius: 10px;
              overflow: hidden;
              box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            .header {
              background: #dc2626;
              color: white;
              padding: 20px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
            }
            .content {
              padding: 30px;
              background: #ffffff;
            }
            .otp-box {
              background: #f3f4f6;
              border: 2px dashed #dc2626;
              padding: 20px;
              text-align: center;
              margin: 20px 0;
              border-radius: 8px;
            }
            .otp-code {
              font-size: 36px;
              font-weight: bold;
              letter-spacing: 8px;
              color: #dc2626;
              font-family: monospace;
            }
            .warning {
              color: #666;
              font-size: 14px;
              margin-top: 20px;
              padding-top: 20px;
              border-top: 1px solid #eee;
            }
            .footer {
              background: #f9fafb;
              padding: 20px;
              text-align: center;
              font-size: 12px;
              color: #666;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 पासवर्ड रीसेट OTP</h1>
            </div>
            <div class="content">
              <p>नमस्ते,</p>
              <p>आपने अपना पासवर्ड रीसेट करने का अनुरोध किया है। कृपया नीचे दिए गए OTP का उपयोग करें:</p>
              
              <div class="otp-box">
                <div class="otp-code">${otp}</div>
              </div>
              
              <p>यह OTP <strong>10 मिनट</strong> के लिए वैध है।</p>
              
              <p>यदि आपने यह अनुरोध नहीं किया है, तो कृपया इस ईमेल को अनदेखा करें।</p>
              
              <div class="warning">
                ⚠️ किसी के साथ OTP साझा न करें। सुरक्षा कारणों से, हम कभी भी आपका OTP नहीं मांगेंगे।
              </div>
            </div>
            <div class="footer">
              <p>यह एक स्वचालित संदेश है। कृपया इस ईमेल का जवाब न दें।</p>
              <p>&copy; 2024 Mumbaiplus. सर्वाधिकार सुरक्षित।</p>
            </div>
          </div>
        </body>
        </html>
      `,
      // Plain text version for email clients that don't support HTML
      text: `
        पासवर्ड रीसेट OTP
        
        आपका OTP है: ${otp}
        
        यह OTP 10 मिनट के लिए वैध है।
        
        यदि आपने यह अनुरोध नहीं किया है, तो कृपया इस ईमेल को अनदेखा करें।
        
        किसी के साथ OTP साझा न करें।
      `,
    };

    const info = await transporter.sendMail(mailOptions);
    
    // If using ethereal, log the preview URL
    if (info.messageId && info.messageId.includes('ethereal')) {
      console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
    }
    
    console.log('Email sent successfully:', info.messageId);
    return info;
    
  } catch (error) {
    console.error('Detailed email error:', {
      message: error.message,
      code: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
    });
    
    // Throw a more user-friendly error
    throw new Error('Failed to send OTP email. Please check your email configuration.');
  }
};

// Optional: Test email configuration
export const testEmailConfig = async () => {
  try {
    const isVerified = await verifyTransporter();
    if (!isVerified) {
      console.log('❌ Email configuration is invalid');
      return false;
    }
    
    // Send a test email
    const testOTP = generateOTP();
    await sendOTPEmail(process.env.EMAIL_USER || 'test@example.com', testOTP);
    console.log('✅ Test email sent successfully');
    return true;
    
  } catch (error) {
    console.error('❌ Email test failed:', error.message);
    return false;
  }
};