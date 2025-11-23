// routes/epaperRoutes.js
import express from 'express';
import {
  createEPaper,
  getEPapers,
  getEPaperById,
  updateEPaper,
  deleteEPaper,
} from '../controllers/epaperController.js';


const router = express.Router();

// Public Routes
router.get('/', getEPapers);
router.get('/:id', getEPaperById);

// Admin Only Routes
router.post('/', createEPaper);
router.put('/:id', updateEPaper);
router.delete('/:id', deleteEPaper);

export default router;