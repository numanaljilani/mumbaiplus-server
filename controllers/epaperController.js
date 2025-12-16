// controllers/epaperController.js
import EPaper from '../models/EPaper.js';
import { generateThumbnail, uploadToCloudinary } from '../utils/upload.js';
import { v2 as cloudinary } from 'cloudinary';
// CREATE - Upload E-Paper
export const createEPaper = async (req, res) => {
  try {

    const { date } = req.body;
    const pdfFile = req.file;

    if (!date || !pdfFile) {
      return res.status(400).json({ message: "तारीख और PDF फ़ाइल ज़रूरी है" });
    }

    // Check existing date
    const exists = await EPaper.findOne({ date: new Date(date) });
    if (exists) {
      return res.status(400).json({ message: "इस तारीख का ई-पेपर पहले से मौजूद है" });
    }

    // ---- CLOUDINARY UPLOAD (BUFFER) ----
    const uploadResult = await new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
    {
        resource_type: "raw",
        folder: "mumbaiplus/epaper",
        public_id: `epaper_${new Date(date).toISOString().split("T")[0]}`,
        overwrite: true,
        format: "pdf",
        // 🔑 FIX: Set the access mode to public so the direct URL works
        access_mode: "public", 
    },
    (error, result) => {
        if (error) reject(error);
        else resolve(result);
    }
);

      // Very important
      uploadStream.end(pdfFile.buffer);
    });

    const pdfUrl = uploadResult.secure_url;

    const thumbnailUrl = generateThumbnail(pdfUrl);

    const epaper = await EPaper.create({
      date: new Date(date),
      pdfUrl,
      thumbnailUrl,
    });

    res.status(201).json({
      success: true,
      message: "ई-पेपर सफलतापूर्वक अपलोड हो गया",
      epaper,
    });

  } catch (err) {
    console.error("EPaper Upload Error:", err);
    res.status(500).json({
      success: false,
      message: "ई-पेपर अपलोड करते समय त्रुटि हुई",
      error: err.message,
    });
  }
};

// GET ALL - List with Pagination
export const getEPapers = async (req, res) => {

  try {
    const page = Number(req.query.page) || 1;
    const limit = 12;
    const skip = (page - 1) * limit;

    const epapers = await EPaper.find({ isActive: true })
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .select('date thumbnailUrl formattedDate');
   

    const total = await EPaper.countDocuments({ isActive: true });

    res.json({
      epapers,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
      total,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};
export const getEPaperBySpecificDate = async (req, res) => {
    // 1. Get the date from the route parameters (preferred) or query string
    const targetDate = req.params.date || req.query.date;

 

    // Check if the date was provided
    if (!targetDate) {
        return res.status(400).json({ message: 'Date parameter is required.' });
    }

    try {
        // 2. Find a single document that matches the date AND is active
        const epaper = await EPaper.findOne({
            date: targetDate, 
            isActive: true 
        }).select('-__v -createdAt -updatedAt'); // Exclude unnecessary fields

        // 3. Handle Paper Not Found
        if (!epaper) {
            return res.status(404).json({ 
                message: `No active E-Paper found for date: ${targetDate}` 
            });
        }

        // 4. Send the specific paper
        res.status(200).json(epaper);

    } catch (err) {
        console.error('Error fetching E-Paper by date:', err);
        res.status(500).json({ message: 'Server Error during E-Paper lookup.' });
    }
};

// GET ONE
export const getEPaperById = async (req, res) => {
  try {
    const epaper = await EPaper.findById(req.params.id);
    if (!epaper || !epaper.isActive) {
      return res.status(404).json({ message: 'ई-पेपर नहीं मिला' });
    }
    res.json(ePaper);
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// UPDATE - Replace PDF
export const updateEPaper = async (req, res) => {
  try {
    const { pdfUrl } = req.body;
    if (!pdfUrl) {
      return res.status(400).json({ message: 'PDF URL जरूरी है' });
    }

    const epaper = await EPaper.findById(req.params.id);
    if (!epaper) {
      return res.status(404).json({ message: 'ई-पेपर नहीं मिला' });
    }

    const thumbnailUrl = generateThumbnail(pdfUrl);

    const updated = await EPaper.findByIdAndUpdate(
      req.params.id,
      { pdfUrl, thumbnailUrl },
      { new: true }
    );

    res.json(updated);
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};

// DELETE - Soft Delete
export const deleteEPaper = async (req, res) => {
    try {
        // 1. Find the document to get the necessary data (like 'date')
        const epaper = await EPaper.findById(req.params.id);
        
        if (!epaper) {
            return res.status(404).json({ message: 'ई-पेपर नहीं मिला' });
        }

        // Get the date string in YYYY-MM-DD format
        const targetDate = epaper.date; 

        // 2. Construct the Cloudinary Public IDs
        // Based on your upload structure: 'mumbaiplus/epaper/epaper_YYYY-MM-DD'
        const publicIdBase = `mumbaiplus/epaper/epaper_${targetDate}`;
        
        // --- Cloudinary Deletion Steps ---

        // A. Delete the PDF file (resource_type: "raw")
        await cloudinary.uploader.destroy(publicIdBase, {
            resource_type: 'raw',
            invalidate: true // Ensure CDN cache is cleared
        });
        
        // B. Delete the Thumbnail Image (resource_type: "image")
        // If you don't use thumbnails, this will safely attempt deletion and proceed.
        await cloudinary.uploader.destroy(publicIdBase, {
            resource_type: 'image',
            invalidate: true // Ensure CDN cache is cleared
        });
        
        
        
        // 3. Perform the hard delete on the MongoDB document
        await EPaper.findByIdAndDelete(req.params.id);

        res.json({ message: 'ई-पेपर और संबंधित फाइलें सफलतापूर्वक हटा दी गईं' });

    } catch (err) {
        console.error('Error during E-Paper deletion:', err);
        // Respond with an error message, potentially clarifying the Cloudinary failure
        res.status(500).json({ 
            message: 'Server Error: डेटाबेस या क्लाउडिनरी से हटाने में विफल रहा' 
        });
    }
};