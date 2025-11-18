// src/routes/posts.js
import express from 'express';
import {
  createPost,
  getPosts,
  getPost,
  updatePost,
  deletePost,
  likePost,
} from '../controllers/postController.js';
import { protect, admin } from '../middleware/auth.js';
import { upload } from '../utils/upload.js';


const router = express.Router();

router.route('/')
  .post(protect, upload.single('image'), createPost)
  .get(getPosts);

router.route('/:id')
  .get(getPost)
  .put(protect, upload.single('image'), updatePost)
  .delete(protect, deletePost);

router.post('/:id/like', protect, likePost);

export default router;