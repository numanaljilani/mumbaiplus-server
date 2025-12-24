// utils/upload.js
import multer from 'multer';
import AWS from 'aws-sdk';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();
console.log(process.env.AWS_ACCESS_KEY_ID , process.env.AWS_ACCESS_KEY_ID)
// AWS S3 कॉन्फ़िगरेशन
const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'ap-south-1',
});

const BUCKET_NAME = process.env.S3_BUCKET_NAME || 'mumbaiplus';

// Multer: सिर्फ़ मेमोरी में रखें — कोई डिस्क फाइल नहीं बनेगी
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi|webm|pdf/;
    
    const ext = file.originalname.toLowerCase().split('.').pop();
    const mimetype = file.mimetype.toLowerCase();

    const isValid = allowedTypes.test(ext) || mimetype === "application/pdf";

    if (isValid) return cb(null, true);

    cb(new Error('केवल JPG, PNG, GIF, MP4, MOV, AVI, WEBM और PDF फाइलें अनुमति हैं'));
  },
});

// S3 पर अपलोड
const uploadToS3 = (buffer, originalName, folder = 'post-images', contentType) => {
  return new Promise((resolve, reject) => {
    const fileExtension = originalName.split('.').pop();
    const fileName = `${uuidv4()}_${Date.now()}.${fileExtension}`;
    const key = `${folder}/${fileName}`;

    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType || getContentType(fileExtension),
      // ACL: 'public-read', // सार्वजनिक पठन की अनुमति
    };

    s3.upload(params, (error, data) => {
      if (error) {
        return reject(error);
      }
      
      resolve({
        url: data.Location,
        key: data.Key,
        fileName: fileName,
        bucket: data.Bucket,
        etag: data.ETag,
        folder: folder
      });
    });
  });
};

// फ़ाइल एक्सटेंशन के आधार पर Content-Type निर्धारित करें
const getContentType = (extension) => {
  const mimeTypes = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    pdf: 'application/pdf',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    webm: 'video/webm',
  };
  
  return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
};

// विशेष फ़ोल्डर के लिए अपलोड फ़ंक्शन
const uploadToPostImages = (buffer, originalName, contentType) => {
  return uploadToS3(buffer, originalName, 'post-images', contentType);
};

const uploadToEpaperFiles = (buffer, originalName, contentType) => {
  return uploadToS3(buffer, originalName, 'epaper-files', contentType);
};

// S3 से फ़ाइल डिलीट करें
const deleteFromS3 = (key) => {
  return new Promise((resolve, reject) => {
    const params = {
      Bucket: BUCKET_NAME,
      Key: key,
    };

    s3.deleteObject(params, (error, data) => {
      if (error) {
        return reject(error);
      }
      resolve(data);
    });
  });
};

// थंबनेल जेनरेट करने के लिए (PDF के लिए)
// नोट: S3 में थंबनेल जेनरेट करने के लिए अलग सेवा की आवश्यकता होगी
const generateThumbnail = (pdfKey) => {
  // AWS Lambda या अन्य सेवा के साथ PDF थंबनेल जेनरेट करें
  // यहां आप एक डिफ़ॉल्ट थंबनेल URL लौटा सकते हैं
  // या AWS Textract/ImageMagick के साथ कस्टम समाधान बना सकते हैं
  
  // अस्थायी समाधान: PDF फ़ाइल का URL लौटाएं
  return `https://${BUCKET_NAME}.s3.ap-south-1.amazonaws.com/${pdfKey}`;
};

// फ़ाइल URL जेनरेट करें
const getFileUrl = (key) => {
  return `https://${BUCKET_NAME}.s3.ap-south-1.amazonaws.com/${key}`;
};

// फ़ोल्डर सूची प्राप्त करें
const listFilesInFolder = (folder, maxKeys = 50) => {
  return new Promise((resolve, reject) => {
    const params = {
      Bucket: BUCKET_NAME,
      Prefix: folder + '/',
      MaxKeys: maxKeys,
    };

    s3.listObjectsV2(params, (error, data) => {
      if (error) {
        return reject(error);
      }
      
      const files = data.Contents.map(item => ({
        key: item.Key,
        url: getFileUrl(item.Key),
        size: item.Size,
        lastModified: item.LastModified,
      }));
      
      resolve(files);
    });
  });
};

export { 
  upload, 
  uploadToS3, 
  uploadToPostImages, 
  uploadToEpaperFiles,
  deleteFromS3, 
  generateThumbnail,
  getFileUrl,
  listFilesInFolder,
  BUCKET_NAME 
};