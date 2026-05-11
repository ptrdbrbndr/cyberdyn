import express from 'express';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const app = express();
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', 'https://cyberdyn.nl');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_AUDIENCE_ID } = process.env;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY || !RESEND_AUDIENCE_ID) {
  console.error('Ontbrekende env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, RESEND_AUDIENCE_ID');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const resend = new Resend(RESEND_API_KEY);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

app.post('/waitlist', async (req, res) => {
  const { email, source = 'cyberdyn' } = req.body ?? {};
  if (!email || !EMAIL_RE.test(email)) {
    return res.status(400).json({ error: 'invalid email' });
  }

  const { error: dbError } = await supabase
    .from('waitlist')
    .upsert({ email, source }, { onConflict: 'email', ignoreDuplicates: true });

  if (dbError) {
    console.error('supabase error', dbError.message);
    return res.status(500).json({ error: 'db error' });
  }

  await resend.contacts.create({
    email,
    audienceId: RESEND_AUDIENCE_ID,
    unsubscribed: false,
  }).catch(e => console.warn('resend fout (niet kritiek):', e.message));

  res.json({ ok: true });
});

app.get('/health', (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT ?? 3001;
app.listen(PORT, () => console.log(`waitlist api op :${PORT}`));
