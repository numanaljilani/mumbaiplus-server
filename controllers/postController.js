// src/controllers/postController.js
import Post from "../models/Post.js";
import { uploadToCloudinary } from "../utils/upload.js";

// 1. Create Post (User)
export const createPost = async (req, res) => {
 
  const { heading, description, location, category } = req.body;

  try {
    let imageUrl = null;
    let resourceType = "image";

    if (req.file) {
      const result = await uploadToCloudinary(
        req.file.buffer,
        req.file.originalname
      );
      imageUrl = result.secure_url;
      resourceType = result.resource_type;
    }

    const post = await Post.create({
      heading,
      description,
      location,
      category,
      image: imageUrl,
      resourceType,
      status: "pending",
      userId: req.user._id,
    });

    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ message: "पोस्ट बनाने में त्रुटि" });
  }
};

// 2. Get All Approved Posts (Public)
export const getPosts = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const skip = (page - 1) * limit;
  (req.query?.status , "req.query?.status")

  const filter = {
    status: req.query?.status == "all" ? "" : req.query?.status || "approved",
  }; // सिर्फ अप्रूव्ड दिखें

  if (req.query.category) filter.category = req.query.category;
  if (req.query.ward)
    filter.location = { $regex: req.query.ward, $options: "i" };

  try {
    const total = await Post.countDocuments(filter);
    const posts = await Post.find(filter)
      .populate("userId", "name mobile")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    

    res.json({
      posts,
      pagination: { current: page, pages: Math.ceil(total / limit), total },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
export const breackingNews = async (req, res) => {

  const limit = 10;
  const skip = 0;

  const filter = { status: "approved" }; // सिर्फ अप्रूव्ड दिखें

  try {
    const posts = await Post.find(filter);
    // .populate('userId', 'name mobile')
    // .sort({ createdAt: -1 })
    // .skip(skip)
    // .limit(limit);
  
    res.json({
      posts,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 3. Get Single Post
export const getPost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id)
      .populate("userId", "name mobile")
      .populate("approvedBy", "name");

    if (!post) return res.status(404).json({ message: "पोस्ट नहीं मिली" });
    res.json(post);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 4. Update Post (User या Admin)
export const updatePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "पोस्ट नहीं मिली" });

    if (
      post.userId.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ message: "अनुमति नहीं" });
    }

    const updates = req.body;
    if (req.file) {
      const result = await uploadToCloudinary(
        req.file.buffer,
        req.file.originalname
      );
      updates.image = result.secure_url;
      updates.resourceType = result.resource_type;
    }

    const updatedPost = await Post.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    });
    res.json(updatedPost);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 5. Delete Post (User/Admin)
export const deletePost = async (req, res) => {

  try {
    const post = await Post.findById(req.params.id);
  
    if (!post) return res.status(404).json({ message: "पोस्ट नहीं मिली" });
  

    // if (post.userId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
    //   return res.status(403).json({ message: 'अनुमति नहीं' });
    // }

    await Post.findByIdAndDelete(req.params.id);
    res.json({ message: "पोस्ट हटा दी गई" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 6. Like Post
export const likePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "पोस्ट नहीं मिली" });

    const userIdStr = req.user._id.toString();
    const liked = post.likes.some((id) => id.toString() === userIdStr);

    if (liked) {
      post.likes = post.likes.filter((id) => id.toString() !== userIdStr);
    } else {
      post.likes.push(req.user._id);
    }

    await post.save();
    res.json({ likes: post.likes.length, liked: !liked });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 7. Get My Posts (Logged in User)
export const getMyPosts = async (req, res) => {
  try {
    const posts = await Post.find({ userId: req.user._id }).sort({
      createdAt: -1,
    });

    res.json(posts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 8. Admin: Get All Posts (Pending + Approved)
export const getAllPostsAdmin = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 15;
  const skip = (page - 1) * limit;

  const filter = {};
  if (req.query.status && req.query.status !== "all") {
    filter.status = req.query.status;
  }
  if (req.query.search) {
    filter.$or = [
      { heading: { $regex: req.query.search, $options: "i" } },
      { description: { $regex: req.query.search, $options: "i" } },
    ];
  }

  try {
    const total = await Post.countDocuments(filter);
    const posts = await Post.find(filter)
      .populate("userId", "name mobile email")
      .populate("approvedBy", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      posts,
      total,
      pages: Math.ceil(total / limit),
      current: page,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 9. Approve Post (Admin Only)
export const approvePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return res.status(404).json({ message: "पोस्ट नहीं मिली" });

    post.status = "approved";
    post.approvedBy = req.user._id;
    post.approvedAt = new Date();

    await post.save();
    await post.populate("approvedBy", "name");

    res.json({ message: "पोस्ट अप्रूव हो गई", post });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 10. Reject Post (Admin Only)
export const rejectPost = async (req, res) => {
  try {
    const post = await Post.findByIdAndUpdate(
      req.params.id,
      { status: "rejected" },
      { new: true }
    );

    if (!post) return res.status(404).json({ message: "पोस्ट नहीं मिली" });
    res.json({ message: "पोस्ट रिजेक्ट हो गई", post });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 11. Admin Update Post
export const adminUpdatePost = async (req, res) => {
  try {
    const updates = req.body;
    if (req.file) {
      const result = await uploadToCloudinary(
        req.file.buffer,
        req.file.originalname
      );
      updates.image = result.secure_url;
      updates.resourceType = result.resource_type;
    }

    const post = await Post.findByIdAndUpdate(req.params.id, updates, {
      new: true,
    })
      .populate("userId", "name")
      .populate("approvedBy", "name");

    res.json(post);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 12. Admin Delete Post
export const adminDeletePost = async (req, res) => {
  try {
    const post = await Post.findByIdAndDelete(req.params.id);
    if (!post) return res.status(404).json({ message: "पोस्ट नहीं मिली" });

    res.json({ message: "पोस्ट डिलीट हो गई" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
