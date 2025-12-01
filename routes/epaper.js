// routes/epaperRoutes.js
import express from 'express';
import {
  createEPaper,
  getEPapers,
  getEPaperById,
  updateEPaper,
  deleteEPaper,
  getEPaperBySpecificDate,
} from '../controllers/epaperController.js';
import { upload } from '../utils/upload.js';


const router = express.Router();

// Public Routes
router.get('/', getEPapers);
router.get('/epaper-by-date', getEPaperBySpecificDate);
router.get('/:id', getEPaperById);

// Admin Only Routes
router.post('/',upload.single("pdfFile"), createEPaper);
router.put('/:id', updateEPaper);
router.delete('/:id', deleteEPaper);

export default router;