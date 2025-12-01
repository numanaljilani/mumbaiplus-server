// src/controllers/reporterController.js
import User from '../models/User.js';
import bcrypt from 'bcryptjs';

// --- Helper Function ---
/**
 * @desc Get pagination data for a query
 * @param {object} query - The mongoose query object
 * @param {number} page - Current page number
 * @param {number} limit - Items per page
 * @returns {Promise<{totalItems: number, totalPages: number, currentPage: number}>}
 */
const getPaginationData = async (query, page, limit) => {
    const totalItems = await User.countDocuments(query);
    const totalPages = Math.ceil(totalItems / limit);
    return {
        totalItems,
        totalPages,
        currentPage: page,
    };
};

// --- CRUD Operations ---

/**
 * @desc नया रिपोर्टर बनाएँ (केवल एडमिन के लिए, या रजिस्ट्रेशन के लिए)
 * @route POST /api/v1/reporters
 * @access Private/Admin
 */
export const createReporter = async (req, res) => {
    try {
        const { name, email, mobile, password, role = 'reporter', isVerified = false } = req.body;

        // 1. देखें कि ईमेल पहले से मौजूद है या नहीं
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'यह ईमेल पहले से पंजीकृत है।' });
        }

        // 2. पासवर्ड हैश करें
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // 3. नया रिपोर्टर बनाएँ
        const newReporter = await User.create({
            name,
            email,
            mobile,
            password: hashedPassword,
            role,
            isVerified,
            status: 'pending' // डिफॉल्ट स्टेटस
        });

        // पासवर्ड हटाकर प्रतिक्रिया भेजें
        const { password: _, ...reporterData } = newReporter.toObject();

        res.status(201).json({ 
            success: true, 
            message: 'रिपोर्टर सफलतापूर्वक बनाया गया।', 
            data: reporterData 
        });
    } catch (error) {
        // मोबाइल नंबर मैच/यूनिक एरर या अन्य MongoDB एरर हैंडल करें
        res.status(500).json({ 
            success: false, 
            message: 'रिपोर्टर बनाने में विफलता।', 
            error: error.message 
        });
    }
};

/**
 * @desc सभी रिपोर्टरों को पेजिंग और फ़िल्टरिंग के साथ प्राप्त करें
 * @route GET /api/v1/reporters
 * @access Private/Admin
 */
export const getReporters = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const { search, status, isVerified } = req.query;

        // बेस query: केवल 'reporter' और 'admin' रोल दिखाएँ
        let query = { 
            role: { $in: ['reporter', 'admin' , 'user'] } 
        };
        
        // 1. Search Filter (नाम या ईमेल)
        if (search) {
            const searchRegex = new RegExp(search, 'i');
            query.$or = [
                { name: { $regex: searchRegex } },
                { email: { $regex: searchRegex } },
            ];
        }

        // 2. Status Filter ('active', 'pending', 'suspended')
        if (status && ['active', 'pending', 'suspended'].includes(status)) {
            query.status = status;
        }

        // 3. Verification Filter (सत्यापित/असत्यापित)
        if (isVerified !== undefined) {
            if (isVerified === 'true') {
                query.isVerified = true;
            } else if (isVerified === 'false') {
                query.isVerified = false;
            }
        }
        
        // डेटाबेस से रिपोर्टर प्राप्त करें
        const reporters = await User.find(query)
            .select('-password') // सुरक्षा के लिए पासवर्ड हटाएँ
            .sort({ registered: -1 }) // नवीनतम पहले
            .skip(skip)
            .limit(limit);

        // पेजिनेशन मेटाडेटा प्राप्त करें
        const pagination = await getPaginationData(query, page, limit);

        res.status(200).json({
            success: true,
            count: reporters.length,
            pagination,
            data: reporters,
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: 'रिपोर्टर सूची प्राप्त करने में विफलता।', 
            error: error.message 
        });
    }
};

/**
 * @desc एक रिपोर्टर को ID द्वारा प्राप्त करें (Read One)
 * @route GET /api/v1/reporters/:id
 * @access Private/Admin
 */
export const getReporterById = async (req, res) => {
    try {
        const reporter = await User.findById(req.params.id).select('-password');
        
        if (!reporter || !['reporter', 'admin'].includes(reporter.role)) {
            return res.status(404).json({ success: false, message: 'रिपोर्टर नहीं मिला।' });
        }

        res.status(200).json({ success: true, data: reporter });
    } catch (error) {
        res.status(500).json({ success: false, message: 'रिपोर्टर प्राप्त करने में विफलता।', error: error.message });
    }
};

/**
 * @desc रिपोर्टर विवरण अपडेट करें (Update)
 * @route PATCH /api/v1/reporters/:id
 * @access Private/Admin
 */
export const updateReporter = async (req, res) => {
    try {
        const updates = req.body;
        
        // केवल अनुमति प्राप्त फ़ील्ड्स को अपडेट करने की अनुमति दें
        const allowedUpdates = ['name', 'email', 'mobile', 'status', 'isVerified', 'role'];
        const actualUpdates = Object.keys(updates).filter(key => allowedUpdates.includes(key));

        if (actualUpdates.length === 0) {
            return res.status(400).json({ success: false, message: 'अपडेट के लिए कोई वैध फ़ील्ड नहीं है।' });
        }

        const reporter = await User.findByIdAndUpdate(
            req.params.id,
            { $set: updates },
            { new: true, runValidators: true } // 'new: true' अपडेटेड दस्तावेज़ लौटाता है
        ).select('-password');

        if (!reporter) {
            return res.status(404).json({ success: false, message: 'अपडेट करने के लिए रिपोर्टर नहीं मिला।' });
        }
        
        res.status(200).json({ success: true, message: 'रिपोर्टर सफलतापूर्वक अपडेट किया गया।', data: reporter });
    } catch (error) {
        // वैलिडेशन एरर (जैसे गलत मोबाइल फॉर्मेट) हैंडल करें
        res.status(400).json({ success: false, message: 'अपडेट करने में विफलता।', error: error.message });
    }
};

/**
 * @desc रिपोर्टर को हटाएँ (Delete)
 * @route DELETE /api/v1/reporters/:id
 * @access Private/Admin
 */
export const deleteReporter = async (req, res) => {
    try {
        const reporter = await User.findByIdAndDelete(req.params.id);

        if (!reporter) {
            return res.status(404).json({ success: false, message: 'हटाने के लिए रिपोर्टर नहीं मिला।' });
        }
        
        res.status(200).json({ success: true, message: 'रिपोर्टर सफलतापूर्वक हटाया गया।' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'रिपोर्टर को हटाने में विफलता।', error: error.message });
    }
};