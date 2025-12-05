// ============================================
// FILE: models/User.js - MongoDB User Schema
// ============================================

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    match: /.+\@.+\..+/
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  firstName: String,
  lastName: String,
  phone: String,
  profilePicture: String,
  subscription: {
    plan: {
      type: String,
      enum: ['free', 'single', 'pro', 'annual'],
      default: 'free'
    },
    downloadsRemaining: {
      type: Number,
      default: 0
    },
    expiresAt: Date,
    stripeCustomerId: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: Date
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    this.updatedAt = new Date();
    next();
  } catch (err) {
    next(err);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Remove password from response
userSchema.methods.toJSON = function() {
  const { password, ...user } = this.toObject();
  return user;
};

module.exports = mongoose.model('User', userSchema);


// ============================================
// FILE: models/Resume.js - MongoDB Resume Schema
// ============================================

const resumeSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  title: {
    type: String,
    default: 'Untitled Resume'
  },
  data: {
    template: {
      type: String,
      enum: ['modern', 'classic', 'minimal'],
      default: 'modern'
    },
    personal: {
      firstName: String,
      lastName: String,
      email: String,
      phone: String,
      location: String,
      summary: String,
      portfolio: String
    },
    experience: [{
      title: String,
      company: String,
      startDate: String,
      endDate: String,
      description: String
    }],
    education: [{
      school: String,
      degree: String,
      field: String,
      graduationDate: String
    }],
    skills: [String]
  },
  scores: {
    atsScore: {
      type: Number,
      default: 0
    },
    contentScore: {
      type: Number,
      default: 0
    },
    recommendations: [String]
  },
  downloadCount: {
    type: Number,
    default: 0
  },
  pdfUrl: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: Date
});

module.exports = mongoose.model('Resume', resumeSchema);


// ============================================
// FILE: models/Payment.js - MongoDB Payment Schema
// ============================================

const paymentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  stripePaymentId: String,
  stripeSessionId: String,
  plan: {
    type: String,
    enum: ['single', 'pro', 'annual'],
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'usd'
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'refunded'],
    default: 'pending'
  },
  metadata: {
    resumeId: String,
    ipAddress: String,
    userAgent: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  completedAt: Date
});

module.exports = mongoose.model('Payment', paymentSchema);