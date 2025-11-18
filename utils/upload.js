// utils/upload.js
import multer from 'multer';
import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// Cloudinary कॉन्फ़िगरेशन
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Multer: सिर्फ़ मेमोरी में रखें — कोई डिस्क फाइल नहीं बनेगी
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|webm/;
    const ext = file.originalname.toLowerCase().split('.').pop();
    const isValid = allowedTypes.test(ext) && allowedTypes.test(file.mimetype);

    if (isValid) return cb(null, true);
    cb(new Error('केवल JPG, PNG, GIF, MP4, MOV, AVI, WEBM फाइलें'));
  },
});

// Cloudinary पर अपलोड (बफर → स्ट्रीम)
const uploadToCloudinary = (buffer, originalName) => {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'mumbaiplus/posts',
        resource_type: 'auto', // image/video ऑटो
        public_id: `${Date.now()}_${originalName.split('.').slice(0, -1).join('.')}`,
        // transformation: [
        //   { quality: 'auto', fetch_format: 'auto' },
        //   { if: 'resource_type = image', width: 1200, crop: 'limit' },
        // ],
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
          resource_type: result.resource_type,
        });
      }
    );

    stream.end(buffer); // बफर भेजें
  });
};

export { upload, uploadToCloudinary };