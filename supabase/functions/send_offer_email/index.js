// send_offer_email - simple Node script for deployment as an Edge Function or serverless endpoint
// Requirements (env):
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM

const { createClient } = require('@supabase/supabase-js');
const nodemailer = require('nodemailer');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function handler(req, res) {
  try {
    const { application_id } = req.body || {};
    if (!application_id) return res.status(400).send({ error: 'application_id required' });

    // Load application
    const { data: app, error: appErr } = await supabase
      .from('tutor_applications')
      .select('*')
      .eq('id', application_id)
      .single();
    if (appErr || !app) throw appErr || new Error('Application not found');

    // Get associated user email
    const applicantEmail = app.email;
    if (!applicantEmail) throw new Error('Applicant email not present');

    // Download template PDFs from storage: templates/tutor_personal_form.pdf and templates/offer_affidavit.pdf
    const attachments = [];
    try {
      const tpl1 = await supabase.storage.from('offer-templates').download('tutor_personal_form.pdf');
      const buffer1 = await tpl1.arrayBuffer();
      attachments.push({ filename: 'Tutor_Personal_Information_Form.pdf', content: Buffer.from(buffer1) });
    } catch (err) {
      console.warn('Could not download tutor_personal_form.pdf from storage; ensure it exists in bucket offer-templates');
    }
    try {
      const tpl2 = await supabase.storage.from('offer-templates').download('offer_affidavit.pdf');
      const buffer2 = await tpl2.arrayBuffer();
      attachments.push({ filename: 'Student_Tutor_Acceptance_Affidavit.pdf', content: Buffer.from(buffer2) });
    } catch (err) {
      console.warn('Could not download offer_affidavit.pdf from storage; ensure it exists in bucket offer-templates');
    }

    const mailOptions = {
      from: process.env.EMAIL_FROM,
      to: applicantEmail,
      subject: 'UFH Tutors - Offer of Tutor Post',
      text: `Dear ${app.full_name || 'Applicant'},\n\nPlease find attached the Tutor Personal Information Form and the Student Tutor/Assistance Acceptance of Post Form/Affidavit. Print, sign (Commissioner of Oaths) and re-upload via your application dashboard.\n\nRegards,\nUFH Tutors Team`,
      attachments,
    };

    await transporter.sendMail(mailOptions);

    // Update application record
    const { error: updateErr } = await supabase
      .from('tutor_applications')
      .update({ offer_status: 'SENT', offer_sent_at: new Date().toISOString() } )
      .eq('id', application_id);
    if (updateErr) throw updateErr;

    return res.status(200).send({ ok: true });
  } catch (err) {
    console.error('send_offer_email error:', err);
    return res.status(500).send({ error: err.message || String(err) });
  }
}

// Simple adapter for running with `node index.js` in dev
if (require.main === module) {
  const express = require('express');
  const app = express();
  app.use(express.json());
  app.post('/send_offer', (req, res) => handler(req, res));
  const port = process.env.PORT || 3001;
  app.listen(port, () => console.log(`send_offer_email listening on ${port}`));
}

module.exports = handler;
