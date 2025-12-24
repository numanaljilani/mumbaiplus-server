// models/EPaper.js
import mongoose from 'mongoose';

const epaperSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    unique: true,
    index: true
  },
  pdfUrl: {
    type: String,
    required: true
  },
  pdfKey: {
    type: String,
    required: true,
    index: true
  },
  thumbnailUrl: {
    type: String
  },
  fileInfo: {
    fileName: String,
    fileSize: Number,
    originalName: String,
    mimeType: String,
    uploadedAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: Date
  },
  isActive: {
    type: Boolean,
    default: true
  },
  deletedAt: {
    type: Date
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { 
  timestamps: true 
});

// Virtual for formatted date
epaperSchema.virtual('formattedDate').get(function() {
  return this.date.toLocaleDateString('hi-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
});

// Virtual for simple date (YYYY-MM-DD)
epaperSchema.virtual('simpleDate').get(function() {
  return this.date.toISOString().split('T')[0];
});

// Indexes for better query performance
epaperSchema.index({ date: -1, isActive: 1 });
epaperSchema.index({ isActive: 1, createdAt: -1 });

const EPaper = mongoose.model('EPaper', epaperSchema);

export default EPaper;