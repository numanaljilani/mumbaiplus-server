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
  location: String,
  category: String,

  image: String,
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

  // नया फील्ड: किस एडमिन ने अप्रूव किया
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },

  approvedAt: {
    type: Date,
    default: null,
  },

  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],

}, { timestamps: true });

// Virtuals });

postSchema.virtual('formattedDate').get(function () {
  return this.createdAt.toLocaleDateString('hi-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
});

export default mongoose.model('Post', postSchema);