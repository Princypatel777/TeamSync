import mongoose from 'mongoose';

const releaseSchema = new mongoose.Schema(
  {
    projectId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Project',
      required: true,
    },
    version: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    releaseDate: {
      type: Date,
      required: true,
    },
    milestoneId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Milestone',
    },
    includedFeatures: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Feature',
      }
    ],
    status: {
      type: String,
      enum: ['DRAFT', 'SCHEDULED', 'RELEASED'],
      default: 'DRAFT',
    },
    githubReleaseUrl: {
      type: String,
      default: '',
    },
    tag: {
      type: String,
      default: '',
    }
  },
  {
    timestamps: true,
  }
);

const Release = mongoose.model('Release', releaseSchema);
export default Release;
