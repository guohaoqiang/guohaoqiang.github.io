// Cloudflare Worker: Avatar Verification with Email Notifications
// This worker handles avatar verification requests and sends emails via SendGrid

// In-memory store (note: resets when worker redeploys)
// For production, use Cloudflare KV or Durable Objects
let verificationStore = {};

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendEmail(to, subject, html, env) {
  // Try to get SENDGRID_KEY from env - it should be injected as a secret
  let SENDGRID_API_KEY = env.SENDGRID_KEY;
  
  console.log('sendEmail called:', { to, env_keys: Object.keys(env) });
  console.log('SENDGRID_KEY value:', SENDGRID_API_KEY);
  
  if (!SENDGRID_API_KEY) {
    // If not found, check if it's stored under a different name
    const keys = Object.keys(env);
    if (keys.length > 0) {
      SENDGRID_API_KEY = env[keys[0]]; // Use the first available key
      console.log('Using key:', keys[0]);
    }
  }
  
  if (!SENDGRID_API_KEY) {
    console.error('SENDGRID_KEY not configured. Available env:', Object.keys(env));
    return false;
  }

  try {
    const fromEmail = 'hqguo1116@gmail.com'; // Your verified sender email
    
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: to }],
            subject: subject,
          },
        ],
        from: { email: fromEmail },
        content: [
          {
            type: 'text/html',
            value: html,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('SendGrid API error:', response.status, errText);
      return false;
    }

    return true;
  } catch (err) {
    console.error('SendGrid error:', err);
    return false;
  }
}

async function handleRequest(request, env) {
  // CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const { action, email, code } = body;

    if (action === 'request-code') {
      // Validate email
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return new Response(JSON.stringify({ error: 'Invalid email address' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Generate code
      const verificationCode = generateCode();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

      verificationStore[email] = {
        code: verificationCode,
        expiresAt,
        verified: false,
      };

      // Send verification email to user
      const userEmailHtml = `
        <h2>Avatar Access Verification</h2>
        <p>Your verification code is:</p>
        <h1 style="color: #032b56; font-family: monospace; letter-spacing: 3px; margin: 20px 0;">${verificationCode}</h1>
        <p>This code expires in 10 minutes.</p>
        <p>If you didn't request this, you can safely ignore this email.</p>
      `;

      const emailSent = await sendEmail(email, 'Your Avatar Access Code', userEmailHtml, env);

      if (!emailSent) {
        return new Response(JSON.stringify({ error: 'Failed to send email' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true, message: 'Code sent' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (action === 'verify-code') {
      if (!email || !code) {
        return new Response(JSON.stringify({ error: 'Email and code required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const stored = verificationStore[email];

      if (!stored) {
        return new Response(JSON.stringify({ error: 'No code found' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (Date.now() > stored.expiresAt) {
        delete verificationStore[email];
        return new Response(JSON.stringify({ error: 'Code expired' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (stored.code !== code) {
        return new Response(JSON.stringify({ error: 'Invalid code' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Code verified! Send notification to admin
      const adminEmailHtml = `
        <p>Someone verified their email to access the avatar:</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Time:</strong> ${new Date().toISOString()}</p>
      `;

      await sendEmail('hqguo1116@gmail.com', 'Avatar Access Request', adminEmailHtml, env);

      return new Response(JSON.stringify({ success: true, message: 'Verified' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Worker error:', err);
    return new Response(JSON.stringify({ error: 'Server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
}

export default {
  fetch: (request, env) => handleRequest(request, env),
};
