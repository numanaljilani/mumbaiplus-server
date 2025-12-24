// controllers/epaperController.js
import EPaper from '../models/EPaper.js';
import { 
  uploadToEpaperFiles, 
  generateThumbnail, 
  deleteFromS3,
  getFileUrl 
} from '../utils/upload.js';

// CREATE - Upload E-Paper
export const createEPaper = async (req, res) => {
  try {
    const { date } = req.body;
    const pdfFile = req.file;

    if (!date || !pdfFile) {
      return res.status(400).json({ 
        success: false,
        message: "तारीख और PDF फ़ाइल ज़रूरी है" 
      });
    }

    // Validate file is PDF
    const fileExt = pdfFile.originalname.split('.').pop().toLowerCase();
    if (fileExt !== 'pdf') {
      return res.status(400).json({
        success: false,
        message: "केवल PDF फाइलें स्वीकार्य हैं"
      });
    }

    // Check existing date
    const parsedDate = new Date(date);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({
        success: false,
        message: "अमान्य तारीख फॉर्मेट"
      });
    }

    const exists = await EPaper.findOne({ date: parsedDate });
    if (exists) {
      return res.status(400).json({ 
        success: false,
        message: "इस तारीख का ई-पेपर पहले से मौजूद है",
        existingEpaper: exists
      });
    }

    // ---- AWS S3 UPLOAD ----
    const uploadResult = await uploadToEpaperFiles(
      pdfFile.buffer,
      pdfFile.originalname,
      pdfFile.mimetype
    );

    const pdfUrl = uploadResult.url;
    const thumbnailUrl = generateThumbnail(uploadResult.key);

    const epaper = await EPaper.create({
      date: parsedDate,
      pdfUrl,
      pdfKey: uploadResult.key, // Store S3 key for deletion
      thumbnailUrl,
      fileInfo: {
        fileName: uploadResult.fileName,
        fileSize: pdfFile.size,
        originalName: pdfFile.originalname,
        mimeType: pdfFile.mimetype
      }
    });

    // Format date for response
    const formattedDate = epaper.date.toLocaleDateString('hi-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    res.status(201).json({
      success: true,
      message: "ई-पेपर सफलतापूर्वक अपलोड हो गया",
      data: {
        ...epaper.toObject(),
        formattedDate
      }
    });

  } catch (err) {
    console.error("EPaper Upload Error:", err);
    res.status(500).json({
      success: false,
      message: "ई-पेपर अपलोड करते समय त्रुटि हुई",
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// GET ALL - List with Pagination
export const getEPapers = async (req, res) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 12;
    const skip = (page - 1) * limit;

    const epapers = await EPaper.find({ isActive: true })
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit)
      .select('date thumbnailUrl pdfUrl createdAt fileInfo');

    // Format dates for response
    const formattedEpaper = epapers.map(epaper => {
      const formattedDate = epaper.date.toLocaleDateString('hi-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      
      const simpleDate = epaper.date.toISOString().split('T')[0];
      
      return {
        ...epaper.toObject(),
        formattedDate,
        simpleDate,
        id: epaper._id
      };
    });

    const total = await EPaper.countDocuments({ isActive: true });

    res.json({
      success: true,
      data: {
        epapers: formattedEpaper,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(total / limit),
          totalItems: total,
          itemsPerPage: limit,
          hasNextPage: page < Math.ceil(total / limit),
          hasPreviousPage: page > 1
        }
      }
    });
  } catch (err) {
    console.error("Get E-Papers Error:", err);
    res.status(500).json({ 
      success: false,
      message: 'ई-पेपर लोड करने में त्रुटि',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// GET E-Paper by specific date
export const getEPaperBySpecificDate = async (req, res) => {
  const targetDate = req.params.date || req.query.date;
console.log(targetDate , "targetDate")
  if (!targetDate) {
    return res.status(400).json({ 
      success: false,
      message: 'Date parameter is required.' 
    });
  }

  try {
    console.log("Indie try ")
   const epaper = await EPaper.findOne({
  $expr: {
    $eq: [
      { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
      targetDate
    ]
  },
  isActive: true 
}).select('-__v -updatedAt');
console.log(epaper , "epaper")

    if (!epaper) {
      return res.status(404).json({ 
        success: false,
        message: `No active E-Paper found for date: ${targetDate}` 
      });
    }

    // Format date for response
    const formattedDate = epaper.date.toLocaleDateString('hi-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const simpleDate = epaper.date.toISOString().split('T')[0];
    console.log(simpleDate , "simpleDate")

    res.status(200).json({
      success: true,
      data: {
        ...epaper.toObject(),
        formattedDate,
        simpleDate
      }
    });

  } catch (err) {
    console.error('Error fetching E-Paper by date:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server Error during E-Paper lookup.',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// GET ONE by ID
export const getEPaperById = async (req, res) => {
  try {
    const epaper = await EPaper.findById(req.params.id);
    
    if (!epaper || !epaper.isActive) {
      return res.status(404).json({ 
        success: false,
        message: 'ई-पेपर नहीं मिला' 
      });
    }

    // Format date
    const formattedDate = epaper.date.toLocaleDateString('hi-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    res.json({
      success: true,
      data: {
        ...epaper.toObject(),
        formattedDate
      }
    });
  } catch (err) {
    console.error("Get E-Paper by ID Error:", err);
    res.status(500).json({ 
      success: false,
      message: 'ई-पेपर लोड करने में त्रुटि',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// UPDATE - Replace PDF (Admin only)
export const updateEPaper = async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "केवल एडमिन यह कार्रवाई कर सकते हैं"
      });
    }

    const { id } = req.params;
    const { date } = req.body;
    const pdfFile = req.file;

    const epaper = await EPaper.findById(id);
    if (!epaper) {
      return res.status(404).json({ 
        success: false,
        message: 'ई-पेपर नहीं मिला' 
      });
    }

    const updates = {};
    
    // Update date if provided
    if (date) {
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        return res.status(400).json({
          success: false,
          message: "अमान्य तारीख फॉर्मेट"
        });
      }
      
      // Check if date already exists (excluding current document)
      const dateExists = await EPaper.findOne({
        date: parsedDate,
        _id: { $ne: id }
      });
      
      if (dateExists) {
        return res.status(400).json({
          success: false,
          message: "इस तारीख का ई-पेपर पहले से मौजूद है"
        });
      }
      
      updates.date = parsedDate;
    }

    // Handle file upload if new file is provided
    if (pdfFile) {
      // Validate file is PDF
      const fileExt = pdfFile.originalname.split('.').pop().toLowerCase();
      if (fileExt !== 'pdf') {
        return res.status(400).json({
          success: false,
          message: "केवल PDF फाइलें स्वीकार्य हैं"
        });
      }

      // Delete old file from S3
      if (epaper.pdfKey) {
        try {
          await deleteFromS3(epaper.pdfKey);
          console.log(`Deleted old E-Paper from S3: ${epaper.pdfKey}`);
        } catch (deleteError) {
          console.error('Error deleting old E-Paper from S3:', deleteError);
        }
      }

      // Upload new file
      const uploadResult = await uploadToEpaperFiles(
        pdfFile.buffer,
        pdfFile.originalname,
        pdfFile.mimetype
      );

      updates.pdfUrl = uploadResult.url;
      updates.pdfKey = uploadResult.key;
      updates.thumbnailUrl = generateThumbnail(uploadResult.key);
      updates.fileInfo = {
        fileName: uploadResult.fileName,
        fileSize: pdfFile.size,
        originalName: pdfFile.originalname,
        mimeType: pdfFile.mimetype,
        updatedAt: new Date()
      };
    }

    const updated = await EPaper.findByIdAndUpdate(
      id,
      updates,
      { new: true }
    );

    // Format date for response
    const formattedDate = updated.date.toLocaleDateString('hi-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    res.json({
      success: true,
      message: "ई-पेपर सफलतापूर्वक अपडेट हुआ",
      data: {
        ...updated.toObject(),
        formattedDate
      }
    });
  } catch (err) {
    console.error("Update E-Paper Error:", err);
    res.status(500).json({ 
      success: false,
      message: 'ई-पेपर अपडेट करने में त्रुटि',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// SOFT DELETE - Set isActive to false
export const softDeleteEPaper = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "केवल एडमिन यह कार्रवाई कर सकते हैं"
      });
    }

    const epaper = await EPaper.findById(req.params.id);
    
    if (!epaper) {
      return res.status(404).json({ 
        success: false,
        message: 'ई-पेपर नहीं मिला' 
      });
    }

    const deleted = await EPaper.findByIdAndUpdate(
      req.params.id,
      { isActive: false, deletedAt: new Date() },
      { new: true }
    );

    res.json({
      success: true,
      message: "ई-पेपर सफलतापूर्वक डिलीट हुआ",
      data: deleted
    });
  } catch (err) {
    console.error("Soft Delete E-Paper Error:", err);
    res.status(500).json({ 
      success: false,
      message: 'ई-पेपर डिलीट करने में त्रुटि',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// HARD DELETE - Delete from DB and S3
export const deleteEPaper = async (req, res) => {
  try {
    console.log(req.user)
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "केवल एडमिन यह कार्रवाई कर सकते हैं"
      });
    }

    const epaper = await EPaper.findById(req.params.id);
    
    if (!epaper) {
      return res.status(404).json({ 
        success: false,
        message: 'ई-पेपर नहीं मिला' 
      });
    }

    // Delete from S3
    if (epaper.pdfKey) {
      try {
        await deleteFromS3(epaper.pdfKey);
        console.log(`Deleted E-Paper from S3: ${epaper.pdfKey}`);
      } catch (deleteError) {
        console.error('Error deleting E-Paper from S3:', deleteError);
        return res.status(500).json({
          success: false,
          message: "S3 से फाइल डिलीट करने में त्रुटि",
          error: process.env.NODE_ENV === 'development' ? deleteError.message : undefined
        });
      }
    }

    // Delete from database
    await EPaper.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'ई-पेपर और संबंधित फाइलें सफलतापूर्वक हटा दी गईं'
    });

  } catch (err) {
    console.error('Error during E-Paper deletion:', err);
    res.status(500).json({ 
      success: false,
      message: 'Server Error: डेटाबेस या S3 से हटाने में विफल रहा',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// RESTORE soft deleted E-Paper
export const restoreEPaper = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "केवल एडमिन यह कार्रवाई कर सकते हैं"
      });
    }

    const epaper = await EPaper.findById(req.params.id);
    
    if (!epaper) {
      return res.status(404).json({ 
        success: false,
        message: 'ई-पेपर नहीं मिला' 
      });
    }

    const restored = await EPaper.findByIdAndUpdate(
      req.params.id,
      { isActive: true, deletedAt: null },
      { new: true }
    );

    res.json({
      success: true,
      message: "ई-पेपर सफलतापूर्वक रिस्टोर हुआ",
      data: restored
    });
  } catch (err) {
    console.error("Restore E-Paper Error:", err);
    res.status(500).json({ 
      success: false,
      message: 'ई-पेपर रिस्टोर करने में त्रुटि',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

// GET latest E-Paper
export const getLatestEPaper = async (req, res) => {
  try {
    const latestEpaper = await EPaper.findOne({ isActive: true })
      .sort({ date: -1 })
      .select('date pdfUrl thumbnailUrl');

    if (!latestEpaper) {
      return res.status(404).json({
        success: false,
        message: "कोई ई-पेपर उपलब्ध नहीं है"
      });
    }

    const formattedDate = latestEpaper.date.toLocaleDateString('hi-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    res.json({
      success: true,
      data: {
        ...latestEpaper.toObject(),
        formattedDate
      }
    });
  } catch (err) {
    console.error("Get Latest E-Paper Error:", err);
    res.status(500).json({
      success: false,
      message: 'सबसे नवीन ई-पेपर लोड करने में त्रुटि',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};