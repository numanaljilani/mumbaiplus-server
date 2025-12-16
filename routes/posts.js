// src/routes/posts.js
import express from 'express';
import {
  createPost,
  getPosts,
  getPost,
  updatePost,
  deletePost,
  likePost,

  // नए Admin कंट्रोलर्स
  getAllPostsAdmin,
  getMyPosts,
  approvePost,
  rejectPost,
  adminUpdatePost,
  adminDeletePost,
  breackingNews,
} from '../controllers/postController.js';
import { protect, admin } from '../middleware/auth.js';
import { upload } from '../utils/upload.js';

const router = express.Router();


  router.get("/breaking" , breackingNews)
// Public & User Routes
router.route('/')
  .post(protect, upload.single('image'), createPost)
  .get(getPosts); // सिर्फ approved पोस्ट्स दिखेंगी







// User: अपनी पोस्ट्स देखें
router.get('/my-posts', protect, getMyPosts);

// Admin Only Routes
router.get('/admin/all', getAllPostsAdmin);           // सभी पोस्ट्स (पेंडिंग + अप्रूव्ड)
router.patch('/admin/:id/approve', protect, approvePost);      // अप्रूव
router.patch('/admin/:id/reject', protect, admin, rejectPost);        // रिजेक्ट
router.put('/admin/:id', protect, admin, upload.single('image'), adminUpdatePost); // एडमिन एडिट
router.delete('/admin/:id', protect, admin, adminDeletePost);         // एडमिन डिलीट

router.route('/:id')
  .get(getPost)
  .put(protect, upload.single('image'), updatePost)
  .delete( deletePost);
router.post('/:id/like', protect, likePost);
export default router;