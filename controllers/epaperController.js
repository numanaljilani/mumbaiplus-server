// controllers/epaperController.js
import EPaper from '../models/EPaper.js';
import { generateThumbnail, uploadToCloudinary } from '../utils/upload.js';

// CREATE - Upload E-Paper
export const createEPaper = async (req, res) => {
  try {
    // Multer से फाइल और डेटा लें
    const { date } = req.body;
    const pdfFile = req.file; // Multer द्वारा जोड़ा गया

    if (!date || !pdfFile) {
      return res.status(400).json({ message: 'तारीख और PDF फाइल जरूरी है' });
    }

    // चेक करें कि इस तारीख का ई-पेपर पहले से है या नहीं
    const exists = await EPaper.findOne({ date: new Date(date) });
    if (exists) {
      return res.status(400).json({ message: 'इस तारीख का ई-पेपर पहले से मौजूद है' });
    }

    // Step 1: Cloudinary पर PDF अपलोड करें (raw format)
    const uploadResult = await uploadToCloudinary.uploader.upload(pdfFile.path, {
      resource_type: 'raw',
      folder: 'mumbaiplus/epaper',
      public_id: `epaper_${new Date(date).toISOString().split('T')[0]}`,
      overwrite: true,
      format: 'pdf',
    });

    const pdfUrl = uploadResult.secure_url;

    // Step 2: पहला पेज से थंबनेल ऑटो जनरेट
    const thumbnailUrl = generateThumbnail(pdfUrl);

    // Step 3: डेटाबेस में सेव करें
    const epaper = await EPaper.create({
      date: new Date(date),
      pdfUrl,
      thumbnailUrl,
    });

    // लोकल फाइल डिलीट करें (ऑप्शनल, अगर आप चाहें तो)
    // fs.unlinkSync(pdfFile.path);

    res.status(201).json({
      success: true,
      message: 'ई-पेपर सफलतापूर्वक अपलोड हो गया',
      epaper,
    });
  } catch (err) {
    console.error('EPaper Upload Error:', err);
    res.status(500).json({
      success: false,
      message: 'ई-पेपर अपलोड करते समय त्रुटि हुई',
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
    const epaper = await EPaper.findById(req.params.id);
    if (!epaper) {
      return res.status(404).json({ message: 'ई-पेपर नहीं मिला' });
    }

    await EPaper.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'ई-पेपर हटा दिया गया' });
  } catch (err) {
    res.status(500).json({ message: 'Server Error' });
  }
};