// process_offer_reminders - worker that processes offer_reminder_queue and sends reminder emails
// Env required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM

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

async function processOnce() {
  try {
    // Fetch one unprocessed reminder
    const { data: reminders, error } = await supabase
      .from('offer_reminder_queue')
      .select('*')
      .eq('processed', false)
      .order('created_at', { ascending: true })
      .limit(10);

    if (error) throw error;
    if (!reminders || reminders.length === 0) return;

    for (const r of reminders) {
      try {
        // load application
        const { data: app } = await supabase.from('tutor_applications').select('*').eq('id', r.application_id).single();
        if (!app) {
          await markProcessed(r.id);
          continue;
        }

        let subject = 'UFH Tutors - Reminder';
        let text = `Dear ${app.full_name || 'Applicant'},\n\nThis is a reminder regarding your tutor offer process.`;
        if (r.reminder_type === 'OFFER_SENT_REMINDER') {
          subject = 'Reminder: Please upload signed offer documents';
          text = `Dear ${app.full_name || 'Applicant'},\n\nWe sent you an offer on ${new Date(app.offer_sent_at).toLocaleDateString()}. Please upload the signed documents in your application dashboard.`;
        } else if (r.reminder_type === 'RESUBMISSION_REMINDER') {
          subject = 'Reminder: Please resubmit your corrected documents';
          text = `Dear ${app.full_name || 'Applicant'},\n\nYour offer documents were rejected on ${new Date(app.document_rejected_at).toLocaleDateString()}. Please resubmit corrected signed documents.`;
        }

        await transporter.sendMail({ from: process.env.EMAIL_FROM, to: app.email, subject, text });
        // mark processed
        await markProcessed(r.id);
      } catch (err) {
        console.error('Error processing reminder', r.id, err);
        // do not crash; continue to next
      }
    }
  } catch (err) {
    console.error('process_offer_reminders error:', err);
  }
}

async function markProcessed(id) {
  await supabase.from('offer_reminder_queue').update({ processed: true, processed_at: new Date().toISOString() } ).eq('id', id);
}

// Run continuously if executed directly
if (require.main === module) {
  (async () => {
    console.log('process_offer_reminders worker started');
    while (true) {
      await processOnce();
      await new Promise(r => setTimeout(r, 5000));
    }
  })();
}

module.exports = { processOnce };
