// Cloudflare Worker: Avatar Verification with Email Notifications
// This worker handles avatar verification requests and sends emails via Brevo

// In-memory store (note: resets when worker redeploys)
// For production, use Cloudflare KV or Durable Objects
let verificationStore = {};

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendEmail(to, subject, html, env) {
  const BREVO_API_KEY = env.BREVO_API_KEY;
  const BREVO_FROM_EMAIL = env.BREVO_FROM_EMAIL || env.SENDGRID_FROM_EMAIL || 'hectorlannister@gmail.com';
  const BREVO_FROM_NAME = env.BREVO_FROM_NAME || 'Avatar Verification';

  const SENDGRID_API_KEY = env.SENDGRID_KEY;

  if (!BREVO_API_KEY && !SENDGRID_API_KEY) {
    console.error('No email provider is configured (BREVO_API_KEY or SENDGRID_KEY)');
    return {
      ok: false,
      status: 500,
      code: 'email_not_configured',
      error: 'Email service is not configured',
    };
  }

  // Use Brevo first. Keep SendGrid as fallback during migration.
  if (BREVO_API_KEY) {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender: {
            name: BREVO_FROM_NAME,
            email: BREVO_FROM_EMAIL,
          },
          to: [{ email: to }],
          subject: subject,
          htmlContent: html,
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error('Brevo API error:', response.status, errText);
        if (response.status === 402 || response.status === 429 || /quota|limit|credits/i.test(errText)) {
          return {
            ok: false,
            status: 503,
            code: 'email_quota_exceeded',
            error: 'Email service quota exceeded. Please try again later.',
          };
        }
        return {
          ok: false,
          status: response.status,
          code: 'email_provider_error',
          error: 'Email provider rejected the request',
        };
      }

      return { ok: true };
    } catch (err) {
      console.error('Brevo error:', err);
      return {
        ok: false,
        status: 502,
        code: 'email_network_error',
        error: 'Email service network error',
      };
    }
  }

  try {
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
        from: { email: BREVO_FROM_EMAIL },
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
      console.error('SendGrid fallback API error:', response.status, errText);
      if (response.status === 401 && /Maximum credits exceeded/i.test(errText)) {
        return {
          ok: false,
          status: 503,
          code: 'email_quota_exceeded',
          error: 'Email service quota exceeded. Please try again later.',
        };
      }
      return {
        ok: false,
        status: response.status,
        code: 'email_provider_error',
        error: 'Email provider rejected the request',
      };
    }

    return { ok: true };
  } catch (err) {
    console.error('SendGrid fallback error:', err);
    return {
      ok: false,
      status: 502,
      code: 'email_network_error',
      error: 'Email service network error',
    };
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

      const emailResult = await sendEmail(email, 'Your Avatar Access Code', userEmailHtml, env);

      if (!emailResult.ok) {
        return new Response(JSON.stringify({
          error: emailResult.error || 'Failed to send email',
          code: emailResult.code || 'email_send_failed',
        }), {
          status: emailResult.status || 500,
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
