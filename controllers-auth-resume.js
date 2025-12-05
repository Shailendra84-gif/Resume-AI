// ============================================
// FILE: controllers/authController.js
// ============================================

const User = require('../models/User');
const jwt = require('jsonwebtoken');

// Generate JWT Token
const generateToken = (id, type = 'access') => {
  const secret = type === 'access' ? process.env.JWT_ACCESS_SECRET : process.env.JWT_REFRESH_SECRET;
  const expiresIn = type === 'access' ? '15m' : '7d';
  
  return jwt.sign({ id }, secret, { expiresIn });
};

// Register User
exports.register = async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    // Create user
    const user = new User({
      email,
      password,
      firstName: firstName || '',
      lastName: lastName || ''
    });

    await user.save();

    // Generate tokens
    const accessToken = generateToken(user._id, 'access');
    const refreshToken = generateToken(user._id, 'refresh');

    // Set HTTP-only cookies
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.status(201).json({
      message: 'User registered successfully',
      user: user.toJSON(),
      accessToken
    });

  } catch (error) {
    res.status(500).json({ message: 'Registration failed', error: error.message });
  }
};

// Login User
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const accessToken = generateToken(user._id, 'access');
    const refreshToken = generateToken(user._id, 'refresh');

    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      message: 'Login successful',
      user: user.toJSON(),
      accessToken
    });

  } catch (error) {
    res.status(500).json({ message: 'Login failed', error: error.message });
  }
};

// Refresh Token
exports.refreshToken = (req, res) => {
  try {
    const { refreshToken } = req.cookies;

    if (!refreshToken) {
      return res.status(401).json({ message: 'Refresh token not found' });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    const newAccessToken = generateToken(decoded.id, 'access');

    res.json({ accessToken: newAccessToken });

  } catch (error) {
    res.status(401).json({ message: 'Token refresh failed' });
  }
};

// Logout
exports.logout = (req, res) => {
  res.clearCookie('refreshToken');
  res.json({ message: 'Logged out successfully' });
};

// Get Current User
exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get user' });
  }
};


// ============================================
// FILE: controllers/resumeController.js
// ============================================

const Resume = require('../models/Resume');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Create Resume
exports.createResume = async (req, res) => {
  try {
    const { title, data } = req.body;

    const resume = new Resume({
      userId: req.user.id,
      title: title || 'My Resume',
      data
    });

    await resume.save();

    res.status(201).json({
      message: 'Resume created successfully',
      resume
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to create resume', error: error.message });
  }
};

// Get All Resumes
exports.getAllResumes = async (req, res) => {
  try {
    const resumes = await Resume.find({ userId: req.user.id }).sort({ createdAt: -1 });
    res.json(resumes);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch resumes' });
  }
};

// Get Single Resume
exports.getResume = async (req, res) => {
  try {
    const resume = await Resume.findById(req.params.id);

    if (!resume || resume.userId.toString() !== req.user.id) {
      return res.status(404).json({ message: 'Resume not found' });
    }

    res.json(resume);
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch resume' });
  }
};

// Update Resume
exports.updateResume = async (req, res) => {
  try {
    let resume = await Resume.findById(req.params.id);

    if (!resume || resume.userId.toString() !== req.user.id) {
      return res.status(404).json({ message: 'Resume not found' });
    }

    resume.data = req.body.data || resume.data;
    resume.title = req.body.title || resume.title;
    resume.updatedAt = new Date();

    await resume.save();

    res.json({
      message: 'Resume updated successfully',
      resume
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to update resume' });
  }
};

// Delete Resume
exports.deleteResume = async (req, res) => {
  try {
    const resume = await Resume.findById(req.params.id);

    if (!resume || resume.userId.toString() !== req.user.id) {
      return res.status(404).json({ message: 'Resume not found' });
    }

    await Resume.findByIdAndDelete(req.params.id);

    res.json({ message: 'Resume deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete resume' });
  }
};

// Generate PDF
exports.generatePDF = async (req, res) => {
  try {
    const resume = await Resume.findById(req.params.id);

    if (!resume || resume.userId.toString() !== req.user.id) {
      return res.status(404).json({ message: 'Resume not found' });
    }

    // Create PDF document
    const doc = new PDFDocument();
    const filename = `${resume.title.replace(/\s+/g, '_')}_${Date.now()}.pdf`;
    const filepath = path.join(__dirname, '../uploads', filename);

    // Ensure uploads directory exists
    if (!fs.existsSync(path.dirname(filepath))) {
      fs.mkdirSync(path.dirname(filepath), { recursive: true });
    }

    doc.pipe(fs.createWriteStream(filepath));

    // Add content
    const data = resume.data;
    
    // Header
    doc.fontSize(20).font('Helvetica-Bold').text(
      `${data.personal.firstName} ${data.personal.lastName}`,
      { align: 'center' }
    );

    doc.fontSize(10).font('Helvetica').text(
      `${data.personal.email} | ${data.personal.phone} | ${data.personal.location}`,
      { align: 'center' }
    );

    // Professional Summary
    if (data.personal.summary) {
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica-Bold').text('PROFESSIONAL SUMMARY');
      doc.fontSize(10).font('Helvetica').text(data.personal.summary);
    }

    // Experience
    if (data.experience.length > 0) {
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica-Bold').text('EXPERIENCE');
      
      data.experience.forEach(exp => {
        doc.fontSize(10).font('Helvetica-Bold').text(exp.title);
        doc.fontSize(9).font('Helvetica-Oblique').text(`${exp.company} | ${exp.startDate} - ${exp.endDate}`);
        doc.fontSize(10).font('Helvetica').text(exp.description);
        doc.moveDown(0.3);
      });
    }

    // Education
    if (data.education.length > 0) {
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica-Bold').text('EDUCATION');
      
      data.education.forEach(edu => {
        doc.fontSize(10).font('Helvetica-Bold').text(`${edu.degree} in ${edu.field}`);
        doc.fontSize(9).font('Helvetica-Oblique').text(edu.school);
        doc.fontSize(10).font('Helvetica').text(`Graduated: ${edu.graduationDate}`);
        doc.moveDown(0.3);
      });
    }

    // Skills
    if (data.skills.length > 0) {
      doc.moveDown(0.5);
      doc.fontSize(12).font('Helvetica-Bold').text('SKILLS');
      doc.fontSize(10).font('Helvetica').text(data.skills.join(' • '));
    }

    doc.end();

    doc.on('finish', () => {
      resume.downloadCount += 1;
      resume.save();

      res.download(filepath, `${resume.title}.pdf`, (err) => {
        if (err) console.error(err);
        // Clean up file after download
        fs.unlink(filepath, (err) => {
          if (err) console.error(err);
        });
      });
    });

  } catch (error) {
    res.status(500).json({ message: 'Failed to generate PDF', error: error.message });
  }
};