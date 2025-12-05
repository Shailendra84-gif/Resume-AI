// ============================================
// FILE: controllers/paymentController.js
// ============================================

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const User = require('../models/User');
const Payment = require('../models/Payment');

const PLANS = {
  single: { amount: 999, downloads: 1, name: 'Single Resume' },
  pro: { amount: 2999, downloads: 5, name: 'Pro Package' },
  annual: { amount: 7999, downloads: 999, name: 'Annual Access' }
};

// Create Checkout Session
exports.createCheckout = async (req, res) => {
  try {
    const { plan } = req.body;

    if (!PLANS[plan]) {
      return res.status(400).json({ message: 'Invalid plan' });
    }

    const user = await User.findById(req.user.id);
    const planInfo = PLANS[plan];

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: user.email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: planInfo.name,
              description: `${planInfo.downloads} resume downloads`
            },
            unit_amount: planInfo.amount
          },
          quantity: 1
        }
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/payment-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/payment-cancel`,
      metadata: {
        userId: req.user.id.toString(),
        plan,
        downloads: planInfo.downloads
      }
    });

    // Save pending payment
    const payment = new Payment({
      userId: req.user.id,
      stripeSessionId: session.id,
      plan,
      amount: planInfo.amount,
      status: 'pending',
      metadata: {
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    await payment.save();

    res.json({ sessionId: session.id, url: session.url });

  } catch (error) {
    res.status(500).json({ message: 'Checkout creation failed', error: error.message });
  }
};

// Handle Webhook
exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];

  try {
    const event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;

      // Update payment
      const payment = await Payment.findOne({ stripeSessionId: session.id });
      if (payment) {
        payment.status = 'completed';
        payment.stripePaymentId = session.payment_intent;
        payment.completedAt = new Date();
        await payment.save();

        // Update user subscription
        const user = await User.findById(payment.userId);
        const planInfo = PLANS[payment.plan];
        
        user.subscription.plan = payment.plan;
        user.subscription.downloadsRemaining = planInfo.downloads;
        user.subscription.stripeCustomerId = session.customer;
        
        if (payment.plan === 'annual') {
          const expiresAt = new Date();
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);
          user.subscription.expiresAt = expiresAt;
        }

        await user.save();

        // Send confirmation email
        // await sendConfirmationEmail(user.email, payment);
      }
    }

    res.json({ received: true });

  } catch (error) {
    console.error('Webhook error:', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
};

// Get Payment Status
exports.getPaymentStatus = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);

    if (!payment || payment.userId.toString() !== req.user.id) {
      return res.status(404).json({ message: 'Payment not found' });
    }

    res.json(payment);
  } catch (error) {
    res.status(500).json({ message: 'Failed to get payment status' });
  }
};


// ============================================
// FILE: controllers/atsController.js - ATS Scoring
// ============================================

// ATS Scoring Algorithm
exports.calculateScore = async (req, res) => {
  try {
    const { data } = req.body;
    let score = 0;
    const issues = [];

    // 1. Format Score (20 points)
    if (data.personal.email && data.personal.email.includes('@')) score += 5;
    if (data.personal.phone && data.personal.phone.length >= 10) score += 5;
    if (data.personal.location) score += 5;
    if (data.experience.length > 0) score += 5;

    // 2. Content Score (40 points)
    const wordCount = Object.values(data).toString().split(/\s+/).length;
    if (wordCount >= 250) score += 10;
    else if (wordCount < 100) issues.push('Resume too short (< 100 words)');

    if (data.personal.summary && data.personal.summary.length > 50) score += 10;
    else issues.push('Add a professional summary');

    if (data.experience.length >= 2) score += 10;
    else if (data.experience.length === 0) issues.push('Add work experience');

    if (data.education.length >= 1) score += 10;
    else issues.push('Add education details');

    // 3. Skills Score (20 points)
    if (data.skills.length >= 5) score += 10;
    else if (data.skills.length > 0) score += 5;
    else issues.push('Add more skills (minimum 5 recommended)');

    // 4. Keywords Score (20 points)
    const keywords = ['responsible', 'managed', 'developed', 'implemented', 'achieved', 'improved'];
    const textContent = Object.values(data).toString().toLowerCase();
    const matchedKeywords = keywords.filter(kw => textContent.includes(kw)).length;
    score += (matchedKeywords / keywords.length) * 20;

    if (matchedKeywords < keywords.length) {
      issues.push(`Use strong action verbs (${matchedKeywords}/${keywords.length} found)`);
    }

    // Recommendations
    const recommendations = [
      data.personal.portfolio ? '✓ Portfolio/LinkedIn included' : 'Add portfolio/LinkedIn link',
      data.experience.some(e => e.description && e.description.length > 20) ? '✓ Descriptions complete' : 'Enhance experience descriptions',
      data.skills.length >= 10 ? '✓ Comprehensive skills section' : 'Add more relevant skills',
      wordCount >= 300 ? '✓ Adequate content length' : 'Expand resume content'
    ];

    res.json({
      atsScore: Math.round(Math.min(score, 100)),
      issues,
      recommendations,
      details: {
        formatScore: Math.min(20, score),
        contentScore: Math.min(40, wordCount >= 250 ? 40 : (wordCount / 250) * 40),
        skillsScore: Math.min(20, data.skills.length * 2),
        keywordScore: Math.min(20, (matchedKeywords / keywords.length) * 20)
      }
    });

  } catch (error) {
    res.status(500).json({ message: 'Failed to calculate ATS score', error: error.message });
  }
};

// Optimization Suggestions
exports.getOptimizations = async (req, res) => {
  try {
    const { data } = req.body;
    const suggestions = [];

    // Check for ATS issues
    if (!data.personal.email) suggestions.push({ level: 'error', msg: 'Email required' });
    if (!data.personal.firstName) suggestions.push({ level: 'error', msg: 'First name required' });
    if (data.experience.length === 0) suggestions.push({ level: 'warning', msg: 'No work experience found' });
    if (data.skills.length < 5) suggestions.push({ level: 'warning', msg: `Only ${data.skills.length} skills - add more` });

    // Format suggestions
    if (data.personal.email && data.personal.email.includes('+')) {
      suggestions.push({ level: 'info', msg: 'Use standard email format (some ATS may skip email aliases)' });
    }

    // Content suggestions
    data.experience.forEach((exp, idx) => {
      if (!exp.description || exp.description.length < 30) {
        suggestions.push({ level: 'warning', msg: `Experience #${idx + 1}: Add detailed description` });
      }
    });

    res.json({ suggestions });

  } catch (error) {
    res.status(500).json({ message: 'Failed to get optimizations' });
  }
};