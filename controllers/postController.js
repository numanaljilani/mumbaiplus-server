// src/controllers/postController.js
import Post from "../models/Post.js";
import { deleteFromS3, uploadToPostImages , generateThumbnail } from "../utils/upload.js";

// 1. Create Post (User)
export const createPost = async (req, res) => {
  const { heading, description, location, category } = req.body;

  try {
    let imageData = null;
    let thumbnailUrl = null;
    let resourceType = "image";

    if (req.file) {
      // फाइल अपलोड करें
      const result = await uploadToPostImages(
        req.file.buffer,
        req.file.originalname,
        req.file.mimetype
      );

      imageData = {
        url: result.url,
        key: result.key,
        fileName: result.fileName,
        folder: result.folder
      };

      // फाइल टाइप निर्धारित करें
      const fileExt = req.file.originalname.split('.').pop().toLowerCase();
      if (['mp4', 'mov', 'avi', 'webm'].includes(fileExt)) {
        resourceType = "video";
      } else if (fileExt === 'pdf') {
        resourceType = "pdf";
        // PDF के लिए थंबनेल जेनरेट करें (अस्थायी समाधान)
        thumbnailUrl = generateThumbnail(result.key);
      } else {
        resourceType = "image";
      }
    }

    const post = await Post.create({
      heading,
      description,
      location,
      category,
      image: imageData ? imageData.url : null,
      imageKey: imageData ? imageData.key : null, // S3 key स्टोर करें
      thumbnail: thumbnailUrl, // PDF थंबनेल के लिए
      resourceType,
      status: "pending",
      userId: req.user._id,
      metadata: imageData ? {
        fileName: imageData.fileName,
        folder: imageData.folder,
        uploadedAt: new Date()
      } : null
    });

    res.status(201).json({
      success: true,
      message: "पोस्ट सफलतापूर्वक बनाया गया",
      data: post
    });
  } catch (error) {
    console.error('पोस्ट बनाने में त्रुटि:', error);
    res.status(500).json({ 
      success: false,
      message: "पोस्ट बनाने में त्रुटि",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// 2. Get All Approved Posts (Public)
export const getPosts = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 10;
  const skip = (page - 1) * limit;
  console.log(req.query?.status , "req.query?.status")

  const filter = {
    status: req.query?.status == "all" ? "" : req.query?.status || "approved",
  }; // सिर्फ अप्रूव्ड दिखें

  if (req.query.category) filter.category = req.query.category;
  if (req.query.ward)
    filter.location = { $regex: req.query.ward, $options: "i" };

  try {
    const total = await Post.countDocuments();
        const approved = await Post.countDocuments({status : "approved"});
    const rejected = await Post.countDocuments({status : "rejected"});
    const pending = await Post.countDocuments({status : 'pending'});
    const posts = await Post.find(filter)
      .populate("userId", "name mobile")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);
    

    res.json({
      posts,
      pagination: { current: page, pages: Math.ceil(total / limit), total , approved , rejected , pending },
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
console.log(req.body.data , "DATA")
    const post = await Post.findById(req.params.id);
    if (!post) {
      return res.status(404).json({ 
        success: false,
        message: "पोस्ट नहीं मिली" 
      });
    }

    // Permission check
    if (
      post.userId.toString() !== req.user._id.toString() &&
      req.user.role !== "admin"
    ) {
      return res.status(403).json({ 
        success: false,
        message: "इस पोस्ट को अपडेट करने की अनुमति नहीं है" 
      });
    }

    const updates = req.body?.data;
    let newThumbnailUrl = post.thumbnail;

    // Handle file upload if new file is provided
    if (req.file) {
      try {
        // Delete old file from S3 if it exists
        if (post.imageKey) {
          try {
            await deleteFromS3(post.imageKey);
            console.log(`Deleted old file from S3: ${post.imageKey}`);
          } catch (deleteError) {
            console.error('Error deleting old file from S3:', deleteError);
            // Continue with update even if delete fails
          }
        }

        // Upload new file to S3
        const result = await uploadToPostImages(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        );

        // Set new image data
        updates.image = result.url;
        updates.imageKey = result.key;
        
        // Determine resource type based on file extension
        const fileExt = req.file.originalname.split('.').pop().toLowerCase();
        if (['mp4', 'mov', 'avi', 'webm'].includes(fileExt)) {
          updates.resourceType = "video";
        } else if (fileExt === 'pdf') {
          updates.resourceType = "pdf";
          // Generate thumbnail for PDF
          newThumbnailUrl = generateThumbnail(result.key);
          updates.thumbnail = newThumbnailUrl;
        } else {
          updates.resourceType = "image";
          // For images, keep existing thumbnail or use image URL
          updates.thumbnail = updates.thumbnail || result.url;
        }

        // Update metadata
        updates.metadata = {
          ...post.metadata,
          fileName: result.fileName,
          folder: result.folder,
          updatedAt: new Date()
        };

      } catch (uploadError) {
        console.error('Error uploading file to S3:', uploadError);
        return res.status(500).json({
          success: false,
          message: "फाइल अपलोड करने में त्रुटि",
          error: process.env.NODE_ENV === 'development' ? uploadError.message : undefined
        });
      }
    } else {
      // If no new file, keep existing file data
      if (!updates.image) {
        updates.image = post.image;
      }
      if (!updates.imageKey) {
        updates.imageKey = post.imageKey;
      }
      if (!updates.resourceType) {
        updates.resourceType = post.resourceType;
      }
      if (!updates.thumbnail) {
        updates.thumbnail = post.thumbnail;
      }
    }

    // Handle specific field updates
    const updateFields = {};
    
    // Only update fields that are provided in request

    // console.log(updates, "HEADING")
    if (updates?.title) updateFields.heading = updates?.title;
    if (updates.content !== undefined) updateFields.description = updates.content;
    if (updates.location !== undefined) updateFields.location = updates.location;
    if (updates.category !== undefined) updateFields.category = updates.category;
    if (updates.status !== undefined && req.user.role === "admin") {
      updateFields.status = updates.status;
    }
    
    // Update image-related fields
    if (updates.image !== undefined) updateFields.image = updates.image;
    if (updates.imageKey !== undefined) updateFields.imageKey = updates.imageKey;
    if (updates.resourceType !== undefined) updateFields.resourceType = updates.resourceType;
    if (updates.thumbnail !== undefined) updateFields.thumbnail = updates.thumbnail;
    if (updates.metadata !== undefined) updateFields.metadata = updates.metadata;
console.log(updateFields , "NEW ")
    const updatedPost = await Post.findByIdAndUpdate(
      req.params.id, 
      updateFields, 
      {
        new: true,
        runValidators: true
      }
    ).populate('userId', 'username email');

    res.json({
      success: true,
      message: "पोस्ट सफलतापूर्वक अपडेट हुई",
      data: updatedPost
    });
  } catch (error) {
    console.error('पोस्ट अपडेट त्रुटि:', error);
    res.status(500).json({ 
      success: false,
      message: "पोस्ट अपडेट करने में त्रुटि",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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

    const total = await Post.countDocuments({status : "all"});
    const approved = await Post.countDocuments({status : "approved"});
    const rejected = await Post.countDocuments({status : "rejected"});
    const pending = await Post.countDocuments(filter);

    console.log(approvePost , "APPROVED POST")

    const posts = await Post.find(filter)
      .populate("userId", "name mobile email")
      .populate("approvedBy", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.json({
      posts,
      total,
      rejected,
      pending,
      approved,
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
    // Check if user is admin
    if (req.user.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "केवल एडमिन यह कार्रवाई कर सकते हैं"
      });
    }

    const postId = req.params.id;
    const updates = req.body;
    let oldImageKey = null;

    // Get current post to check for existing image
    const currentPost = await Post.findById(postId);
    if (!currentPost) {
      return res.status(404).json({
        success: false,
        message: "पोस्ट नहीं मिली"
      });
    }

    oldImageKey = currentPost.imageKey;

    // Handle file upload if new file is provided
    if (req.file) {
      try {
        // Delete old file from S3 if it exists
        if (oldImageKey) {
          try {
            await deleteFromS3(oldImageKey);
            console.log(`Admin: Deleted old file from S3: ${oldImageKey}`);
          } catch (deleteError) {
            console.error('Admin: Error deleting old file from S3:', deleteError);
            // Continue with update even if delete fails
          }
        }

        // Upload new file to S3
        const result = await uploadToPostImages(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype
        );

        // Set new image data
        updates.image = result.url;
        updates.imageKey = result.key;
        
        // Determine resource type based on file extension
        const fileExt = req.file.originalname.split('.').pop().toLowerCase();
        if (['mp4', 'mov', 'avi', 'webm'].includes(fileExt)) {
          updates.resourceType = "video";
        } else if (fileExt === 'pdf') {
          updates.resourceType = "pdf";
          // Generate thumbnail for PDF
          updates.thumbnail = generateThumbnail(result.key);
        } else {
          updates.resourceType = "image";
          // For images, use image URL as thumbnail if no thumbnail exists
          if (!updates.thumbnail) {
            updates.thumbnail = result.url;
          }
        }

        // Update metadata
        updates.metadata = {
          ...currentPost.metadata,
          fileName: result.fileName,
          folder: result.folder,
          updatedAt: new Date(),
          updatedBy: req.user._id,
          updateType: 'admin_updated'
        };

      } catch (uploadError) {
        console.error('Admin: Error uploading file to S3:', uploadError);
        return res.status(500).json({
          success: false,
          message: "फाइल अपलोड करने में त्रुटि",
          error: process.env.NODE_ENV === 'development' ? uploadError.message : undefined
        });
      }
    }

    // If status is being updated to approved/rejected, track admin info
    if (updates.status && ['approved', 'rejected'].includes(updates.status)) {
      updates.approvedBy = req.user._id;
      updates.approvedAt = new Date();
      
      // Add to metadata
      updates.metadata = {
        ...(updates.metadata || currentPost.metadata || {}),
        statusUpdatedAt: new Date(),
        statusUpdatedBy: req.user._id,
        previousStatus: currentPost.status
      };
    }

    // Prepare update object
    const updateFields = { ...updates };
    
    // Remove fields that shouldn't be directly updated
    delete updateFields._id;
    delete updateFields.createdAt;
    delete updateFields.__v;

    // Ensure metadata is properly structured
    if (updateFields.metadata && typeof updateFields.metadata === 'object') {
      updateFields.metadata = {
        ...(currentPost.metadata || {}),
        ...updateFields.metadata,
        lastAdminUpdate: new Date()
      };
    }

    const post = await Post.findByIdAndUpdate(
      postId, 
      updateFields, 
      {
        new: true,
        runValidators: true
      }
    )
      .populate("userId", "name username email")
      .populate("approvedBy", "name username");

    // Log the admin action
    console.log(`Admin ${req.user._id} updated post ${postId}`);

    res.json({
      success: true,
      message: "पोस्ट एडमिन द्वारा सफलतापूर्वक अपडेट हुई",
      data: post,
      changes: {
        imageChanged: !!req.file,
        statusChanged: updates.status && updates.status !== currentPost.status,
        previousStatus: currentPost.status,
        newStatus: updates.status
      }
    });
  } catch (error) {
    console.error('एडमिन पोस्ट अपडेट त्रुटि:', error);
    res.status(500).json({ 
      success: false,
      message: "पोस्ट अपडेट करने में त्रुटि",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
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
