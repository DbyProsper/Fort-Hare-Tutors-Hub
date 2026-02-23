Edge Functions / Workers for Offer Workflow

Files:
- `send_offer_email/index.js`  -> serverless endpoint to send offer email with attachments
- `process_offer_reminders/index.js` -> background worker to process `offer_reminder_queue` and send reminders

Environment variables required (set in your deployment environment):
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`  (service role/admin key for DB updates and storage access)
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_SECURE` (true|false)
- `EMAIL_FROM`

Important: Admin-uploaded offer documents

- The `send_offer_email` function attaches two PDF files which must be uploaded by an admin to the Supabase Storage bucket named `offer-templates` (create this bucket if it does not exist).

  - Required filenames (exact keys): `tutor_personal_form.pdf` and `offer_affidavit.pdf`.

  - Use the Supabase dashboard (Storage → `offer-templates`) to upload these files.

  - When `send_offer_email` runs it will download and attach these two files to the outgoing offer email.

  - If either file is missing the function will log a warning and continue; the email will be sent without that attachment.

Notes:

- You may choose to have per-application offer PDFs uploaded instead of global templates. If you prefer that workflow, upload per-application files to `application-documents` under a clear naming convention (e.g. `<application_id>/offer_affidavit.pdf`), and update the `send_offer_email` function to reference those keys.

Deploy & Local Testing:

- For quick testing run locally:

```bash
cd supabase/functions
npm install
npm run start:send    # runs send_offer_email service locally
npm run start:reminder # runs the reminder worker locally
```

- For production, deploy as serverless functions (Supabase Edge Functions or other cloud functions). If you deploy to Supabase Edge, the Node.js code will need porting to Deno/Edge format; ask me and I can provide that conversion.

Security:

- Keep `SUPABASE_SERVICE_ROLE_KEY` secret and never expose it to browsers.
- Validate and virus-scan uploaded documents server-side before marking documents `VERIFIED`.

Operational notes:

- Ensure the `application-documents` storage bucket exists for applicant uploads; offer acceptance uploads are stored in that bucket under the application id.
- The worker `process_offer_reminders` marks reminders as processed in `offer_reminder_queue` once emails are sent; you can run it as a long-running process or deploy it as a scheduled job.

