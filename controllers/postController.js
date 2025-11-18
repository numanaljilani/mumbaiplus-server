// src/controllers/postController.js
import Post from '../models/Post.js';
import { uploadToCloudinary } from '../utils/upload.js';

// @desc    Create post
export const createPost = async (req, res) => {
  const { heading, description, location, category } = req.body;

  try {
    let imageUrl = null;
    let resourceType = null;

    // अगर फाइल है तो Cloudinary पर अपलोड करें
    if (req.file) {
      try {
        const result = await uploadToCloudinary(req.file.buffer, req.file.originalname);

        imageUrl = result.secure_url;        // CDN URL
        resourceType = result.resource_type; // image या video
      } catch (uploadError) {
        console.error('Cloudinary अपलोड त्रुटि:', uploadError);
        return res.status(500).json({ message: `फ़ाइल अपलोड नहीं हो सकी: ${uploadError.message}` });
      }
    }

    // पोस्ट बनाएँ
    const post = await Post.create({
      heading,
      description,
      location,
      category,
      image: imageUrl,
      resourceType, // नया फ़ील्ड (image/video)
      userId: req.user._id,
    });

    res.status(201).json(post);
  } catch (error) {
    console.error('पोस्ट बनाने में त्रुटि:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all posts with filter & pagination
export const getPosts = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  console.log(page)

  const filter = {};
  if (req.query.category) filter.category = req.query.category;
  if (req.query.ward) filter.location = { $regex: req.query.ward, $options: 'i' };
  if (req.query.status) filter.status = req.query.status;

  try {
    const total = await Post.countDocuments(filter);
    const posts = await Post.find(filter)
      .populate('userId', 'name mobile')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      posts,
      pagination: {
        current: page,
        pages: Math.ceil(total / limit),
        total,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get single post
export const getPost = async (req, res) => {
  console.log( req.params.id,">>>")
  try {
    const post = await Post.findById(req.params.id).populate('userId', 'name');
    if (!post) return res.status(404).json({ message: 'पोस्ट नहीं मिली' });
    res.json(post);
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update post
export const updatePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'पोस्ट नहीं मिली' });

    // ऑथराइज़ेशन चेक
    if (post.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'अनुमति नहीं' });
    }

    const updates = req.body;

    // अगर फाइल है तो Cloudinary पर अपलोड करें
    if (req.file) {
      try {
        const uploadResult = await uploadToCloudinary(
          req.file.buffer,
          req.file.originalname
        );
        updates.image = uploadResult.secure_url; // Cloudinary URL सेव करें
        updates.resource_type = uploadResult.resource_type; // image/video
      } catch (uploadError) {
        return res.status(500).json({ message: `अपलोड त्रुटि: ${uploadError.message}` });
      }
    }

    // अपडेट सेव करें
    const updatedPost = await Post.findByIdAndUpdate(req.params.id, updates, { new: true });
    res.json(updatedPost);
  } catch (error) {
    console.log(error)
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete post
export const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'पोस्ट नहीं मिली' });

    if (post.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'अनुमति नहीं' });
    }

    await Post.findByIdAndDelete(req.params.id);
    res.json({ message: 'पोस्ट हटाई गई' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Like post
export const likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: 'पोस्ट नहीं मिली' });

    if (post.likes.includes(req.user._id)) {
      post.likes = post.likes.filter(id => id.toString() !== req.user._id.toString());
    } else {
      post.likes.push(req.user._id);
    }

    await post.save();
    res.json({ likes: post.likes.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};