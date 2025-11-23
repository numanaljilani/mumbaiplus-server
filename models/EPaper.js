// models/EPaper.js
import mongoose from 'mongoose';

const ePaperSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      unique: true,
    },
    pdfUrl: {
      type: String,
      required: true,
    },
    thumbnailUrl: {
      type: String,
      required: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Virtual: Hindi formatted date
ePaperSchema.virtual('formattedDate').get(function () {
  return this.date.toLocaleDateString('hi-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
});

export default mongoose.models.EPaper || mongoose.model('EPaper', ePaperSchema);