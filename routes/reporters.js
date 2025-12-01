// src/routes/reporterRoutes.js
import express from 'express';
import { 
    getReporters, 
    getReporterById, 
    createReporter, 
    updateReporter, 
    deleteReporter 
} from '../controllers/reportersController.js';

const router = express.Router();

// **ध्यान दें:** वास्तविक एप्लिकेशन में, आपको यहाँ 
// प्रमाणीकरण (Authentication - जैसे protect) और 
// प्राधिकरण (Authorization - जैसे adminCheck) मिडलवेयर की आवश्यकता होगी।

// GET /api/v1/reporters/  -> सभी रिपोर्टरों को प्राप्त करें (फिल्टरिंग, पेजिंग के साथ)
// POST /api/v1/reporters/ -> नया रिपोर्टर बनाएँ
router.route('/')
    .get(getReporters)
    .post(createReporter);

// GET /api/v1/reporters/:id   -> एक रिपोर्टर को प्राप्त करें
// PATCH /api/v1/reporters/:id -> रिपोर्टर को अपडेट करें
// DELETE /api/v1/reporters/:id -> रिपोर्टर को हटाएँ
router.route('/:id')
    .get(getReporterById)
    .patch(updateReporter)
    .delete(deleteReporter);

export default router;