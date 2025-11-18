// src/models/Post.js
import mongoose from 'mongoose';

const postSchema = new mongoose.Schema({
  heading: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
  },
  location: {
    type: String,
    // required: true,
  },
  category: {
    type: String,
    // enum: ['भ्रष्टाचार', 'पानी', 'सड़क', 'अवैध निर्माण', 'BMC', 'अन्य'],
    // default: 'अन्य',
  },

  image: {
    type: String,
  },
  resourceType: {
  type: String,
  enum: ['image', 'video'],
  default: 'image'
},
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],
}, { timestamps: true });

// Virtual for formatted date
postSchema.virtual('formattedDate').get(function () {
  return this.createdAt.toLocaleDateString('hi-IN');
});

export default mongoose.model('Post', postSchema);