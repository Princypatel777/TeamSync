import mongoose from 'mongoose';

const projectFileSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    fileUrl: {
      type: String,
      required: true,
    },
    category: {
      type: String,
      enum: ['SRS Documents', 'Design Documents', 'Presentations', 'Progress Reports', 'Research Papers', 'Technical Documents', 'Final Reports', 'OTHER'],
      default: 'OTHER',
    },
    description: {
      type: String,
      default: '',
    },
    relatedToType: {
      type: String,
      enum: ['GENERAL', 'FEATURE', 'TASK', 'MILESTONE', 'BUG'],
      default: 'GENERAL',
    },
    relatedToId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },
    size: {
      type: Number,
      default: 0,
    },
    mimeType: {
      type: String,
      default: 'application/octet-stream',
    },
    uploaderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    version: {
      type: Number,
      default: 1,
    },
  },
  {
    timestamps: true,
  }
);

const ProjectFile = mongoose.model('ProjectFile', projectFileSchema);
export default ProjectFile;
