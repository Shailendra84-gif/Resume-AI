// ============================================
// FILE: Complete Frontend JavaScript Integration
// Add this to your HTML file in the <script> section
// ============================================

const API_BASE_URL = 'http://localhost:5000'; // Change to your backend URL
let stripe, cardElement;
let currentUser = null;
let resumeData = {
  template: 'modern',
  personal: {},
  experience: [],
  education: [],
  skills: []
};

// ============ INITIALIZATION ============

async function initApp() {
  // Check if user is logged in
  const token = localStorage.getItem('accessToken');
  if (token) {
    await loadCurrentUser(token);
  }
  
  // Initialize Stripe
  try {
    stripe = Stripe(document.querySelector('script[data-stripe-key]')?.dataset.stripeKey || 'pk_test_demo');
    const elements = stripe.elements();
    cardElement = elements.create('card');
  } catch (e) {
    console.log('Stripe not initialized (demo mode)');
  }

  updatePreview();
}

// ============ AUTHENTICATION ============

async function register() {
  const email = prompt('Email:');
  const password = prompt('Password:');
  const firstName = prompt('First Name:');
  const lastName = prompt('Last Name:');

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, firstName, lastName })
    });

    const data = await response.json();
    
    if (!response.ok) {
      alert('Registration failed: ' + data.message);
      return;
    }

    localStorage.setItem('accessToken', data.accessToken);
    currentUser = data.user;
    alert('Registration successful!');
    location.reload();

  } catch (error) {
    alert('Error: ' + error.message);
  }
}

async function login() {
  const email = prompt('Email:');
  const password = prompt('Password:');

  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await response.json();
    
    if (!response.ok) {
      alert('Login failed: ' + data.message);
      return;
    }

    localStorage.setItem('accessToken', data.accessToken);
    currentUser = data.user;
    document.getElementById('userEmail').textContent = data.user.email;
    alert('Login successful!');

  } catch (error) {
    alert('Error: ' + error.message);
  }
}

async function loadCurrentUser(token) {
  try {
    const response = await fetch(`${API_BASE_URL}/api/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      currentUser = await response.json();
      document.getElementById('userEmail').textContent = currentUser.email;
    }
  } catch (error) {
    console.error('Failed to load user:', error);
  }
}

function logout() {
  localStorage.removeItem('accessToken');
  currentUser = null;
  alert('Logged out successfully');
  location.reload();
}

// ============ RESUME MANAGEMENT ============

async function saveResume() {
  if (!currentUser) {
    alert('Please login first');
    return;
  }

  const token = localStorage.getItem('accessToken');
  const title = prompt('Resume title:', 'My Resume');

  try {
    const response = await fetch(`${API_BASE_URL}/api/resumes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        title,
        data: resumeData
      })
    });

    const data = await response.json();
    
    if (response.ok) {
      alert('Resume saved successfully! ID: ' + data.resume._id);
      return data.resume._id;
    } else {
      alert('Error saving resume: ' + data.message);
    }

  } catch (error) {
    alert('Error: ' + error.message);
  }
}

async function updateResume(resumeId) {
  if (!currentUser) {
    alert('Please login first');
    return;
  }

  const token = localStorage.getItem('accessToken');

  try {
    const response = await fetch(`${API_BASE_URL}/api/resumes/${resumeId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ data: resumeData })
    });

    const data = await response.json();
    
    if (response.ok) {
      alert('Resume updated successfully!');
    } else {
      alert('Error updating resume: ' + data.message);
    }

  } catch (error) {
    alert('Error: ' + error.message);
  }
}

async function deleteResume(resumeId) {
  if (!confirm('Delete this resume?')) return;

  if (!currentUser) {
    alert('Please login first');
    return;
  }

  const token = localStorage.getItem('accessToken');

  try {
    const response = await fetch(`${API_BASE_URL}/api/resumes/${resumeId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      alert('Resume deleted');
      // Reload list
    } else {
      alert('Error deleting resume');
    }

  } catch (error) {
    alert('Error: ' + error.message);
  }
}

// ============ DOWNLOAD RESUME ============

async function downloadResume() {
  if (!currentUser) {
    alert('Please login to download resume');
    login();
    return;
  }

  // First save the resume
  const resumeId = await saveResume();
  if (!resumeId) return;

  const token = localStorage.getItem('accessToken');

  try {
    const response = await fetch(`${API_BASE_URL}/api/resumes/${resumeId}/pdf`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.ok) {
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${resumeData.personal.firstName || 'resume'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
    } else {
      alert('Error downloading resume');
    }

  } catch (error) {
    alert('Error: ' + error.message);
  }
}

// ============ ATS SCORING ============

async function calculateATSScore() {
  if (!currentUser) {
    console.log('Demo mode: showing sample scores');
    return;
  }

  const token = localStorage.getItem('accessToken');

  try {
    const response = await fetch(`${API_BASE_URL}/api/ats/score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ data: resumeData })
    });

    const scores = await response.json();
    
    document.getElementById('atsScore').textContent = scores.atsScore;
    document.getElementById('contentScore').textContent = scores.contentScore;
    document.getElementById('atsBar').style.width = scores.atsScore + '%';
    document.getElementById('contentBar').style.width = scores.contentScore + '%';

  } catch (error) {
    console.error('ATS scoring error:', error);
  }
}

async function getOptimizations() {
  if (!currentUser) {
    alert('Please login to get optimization suggestions');
    return;
  }

  const token = localStorage.getItem('accessToken');

  try {
    const response = await fetch(`${API_BASE_URL}/api/ats/optimize`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ data: resumeData })
    });

    const result = await response.json();
    const message = result.suggestions.map(s => `[${s.level}] ${s.msg}`).join('\n');
    alert('Optimization suggestions:\n\n' + message);

  } catch (error) {
    alert('Error: ' + error.message);
  }
}

// ============ PAYMENT PROCESSING ============

async function processPayment() {
  if (!currentUser) {
    alert('Please login first');
    return;
  }

  const plan = document.querySelector('input[name="plan"]:checked').value;
  const token = localStorage.getItem('accessToken');

  try {
    const response = await fetch(`${API_BASE_URL}/api/payment/create-checkout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ plan })
    });

    const data = await response.json();
    
    if (data.url) {
      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } else {
      alert('Error creating checkout session: ' + data.message);
    }

  } catch (error) {
    alert('Error: ' + error.message);
  }
}

// ============ FILE UPLOAD ============

async function uploadResume(file) {
  if (!currentUser) {
    alert('Please login first');
    return;
  }

  const token = localStorage.getItem('accessToken');
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(`${API_BASE_URL}/api/upload/resume`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData
    });

    const data = await response.json();
    
    if (response.ok) {
      // Auto-fill form with parsed data
      resumeData.personal = data.parsed.personal || resumeData.personal;
      resumeData.experience = data.parsed.experience || resumeData.experience;
      resumeData.education = data.parsed.education || resumeData.education;
      resumeData.skills = data.parsed.skills || resumeData.skills;
      
      updatePreview();
      alert('Resume uploaded and parsed successfully!');
    } else {
      alert('Error uploading resume: ' + data.message);
    }

  } catch (error) {
    alert('Error: ' + error.message);
  }
}

// ============ UPDATE EVENT LISTENERS ============

function setupEventListeners() {
  // Auto-save on input
  document.querySelectorAll('.form-input, .form-textarea').forEach(el => {
    el.addEventListener('change', () => {
      updatePreview();
      calculateATSScore();
    });
  });

  // Skills input - allow Enter key
  const skillInput = document.getElementById('skillInput');
  if (skillInput) {
    skillInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        addSkill();
        calculateATSScore();
      }
    });
  }
}

// ============ PAGE LOAD ============

document.addEventListener('DOMContentLoaded', () => {
  initApp();
  setupEventListeners();
  
  // Add login/register buttons to header if needed
  const navRight = document.querySelector('.nav-right');
  if (navRight && !currentUser) {
    navRight.innerHTML = `
      <button class="btn btn-secondary" onclick="login()">Login</button>
      <button class="btn btn-primary" onclick="register()">Register</button>
    `;
  }
});

// ============ EXPORT FOR INTEGRATION ============

// To use in your HTML, add these data attributes to your script tag:
// <script 
//   src="your-script.js" 
//   data-stripe-key="pk_live_your_key"
//   data-api-url="https://api.yourdomain.com"
// ></script>

// Then update at top of file:
// const API_BASE_URL = document.currentScript?.dataset.apiUrl || 'http://localhost:5000';
// const STRIPE_KEY = document.currentScript?.dataset.stripeKey || 'pk_test_demo';