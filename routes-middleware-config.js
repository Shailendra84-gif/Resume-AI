// ============================================
// FILE: middleware/auth.js - JWT Middleware
// ============================================

const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ message: 'No token provided' });
    }

    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
    req.user = decoded;
    next();

  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Token expired' });
    }
    res.status(401).json({ message: 'Invalid token' });
  }
};

module.exports = authMiddleware;


// ============================================
// FILE: routes/auth.js - Authentication Routes
// ============================================

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const auth = require('../middleware/auth');

router.post('/register', authController.register);
router.post('/login', authController.login);
router.post('/refresh', authController.refreshToken);
router.post('/logout', authController.logout);
router.get('/me', auth, authController.getCurrentUser);

module.exports = router;


// ============================================
// FILE: routes/resume.js - Resume Routes
// ============================================

const express = require('express');
const router = express.Router();
const resumeController = require('../controllers/resumeController');
const auth = require('../middleware/auth');

router.post('/', auth, resumeController.createResume);
router.get('/', auth, resumeController.getAllResumes);
router.get('/:id', auth, resumeController.getResume);
router.put('/:id', auth, resumeController.updateResume);
router.delete('/:id', auth, resumeController.deleteResume);
router.get('/:id/pdf', auth, resumeController.generatePDF);

module.exports = router;


// ============================================
// FILE: routes/payment.js - Payment Routes
// ============================================

const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');
const auth = require('../middleware/auth');

router.post('/create-checkout', auth, paymentController.createCheckout);
router.post('/webhook', express.raw({type: 'application/json'}), paymentController.handleWebhook);
router.get('/status/:id', auth, paymentController.getPaymentStatus);

module.exports = router;


// ============================================
// FILE: routes/ats.js - ATS Scoring Routes
// ============================================

const express = require('express');
const router = express.Router();
const atsController = require('../controllers/atsController');
const auth = require('../middleware/auth');

router.post('/score', auth, atsController.calculateScore);
router.post('/optimize', auth, atsController.getOptimizations);

module.exports = router;


// ============================================
// FILE: package.json - Dependencies
// ============================================

{
  "name": "resumeai-backend",
  "version": "1.0.0",
  "description": "ResumeAI - AI-Powered Resume Builder Backend",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": ["resume", "builder", "ats", "stripe"],
  "author": "Your Name",
  "license": "ISC",
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "dotenv": "^16.0.3",
    "express": "^4.18.2",
    "express-rate-limit": "^6.7.0",
    "helmet": "^7.0.0",
    "jsonwebtoken": "^9.0.0",
    "mongoose": "^7.0.3",
    "pdfkit": "^0.13.0",
    "stripe": "^11.10.0",
    "multer": "^1.4.5-lts.1",
    "pdf-parse": "^1.1.1",
    "axios": "^1.4.0",
    "nodemailer": "^6.9.3"
  },
  "devDependencies": {
    "nodemon": "^2.0.20"
  },
  "engines": {
    "node": "16.0.0"
  }
}


// ============================================
// FILE: .env.example - Environment Variables Template
// ============================================

# Server Configuration
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/resumeai

# JWT Secrets
JWT_ACCESS_SECRET=your_super_secret_access_key_change_this_in_production
JWT_REFRESH_SECRET=your_super_secret_refresh_key_change_this_in_production

# Stripe Keys
STRIPE_PUBLIC_KEY=pk_test_your_public_key_here
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here

# Frontend & Backend URLs
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:5000

# Email Service
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-app-specific-password

# Or use SendGrid
SENDGRID_API_KEY=SG.your_sendgrid_key_here

# File Upload
MAX_FILE_SIZE=5242880
UPLOAD_DIR=./uploads

# AWS S3 (Optional)
AWS_ACCESS_KEY=your_aws_access_key
AWS_SECRET_KEY=your_aws_secret_key
AWS_S3_BUCKET=resumeai-uploads


// ============================================
// FILE: .gitignore
// ============================================

node_modules/
.env
.env.local
.env.*.local
uploads/
*.log
*.pem
dist/
build/
.DS_Store
*.swp
*.swo
*~