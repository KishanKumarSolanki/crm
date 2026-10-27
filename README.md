# CRM

A React + Vite CRM for managing leads, sales stages, follow-up tasks, and team members. Supabase provides authentication and data storage.

## Requirements

- Node.js 20.19+ or 22.12+
- A Supabase project with the CRM tables used by the app: `profiles`, `clients`, `team_members`, `tasks`, `activities`, and `notes`

## Local setup

1. Install packages:

   ```sh
   npm install
   ```

2. Copy `.env.example` to `.env` and set the Supabase project URL and anon/publishable key. EmailJS values are optional; configure them to send welcome emails when creating/importing leads.

3. Apply the migrations in `supabase/migrations/` in filename order using the Supabase CLI or SQL Editor:
   - `20261019000000_crm_access_policies.sql` assumes `profiles.id` matches `auth.users.id` and `profiles.role` contains `admin` for administrators.
   - `20261019000001_task_assignment_priority.sql` adds task priority and legacy assignment fields retained for database compatibility.
   - `20261022000000_client_follow_up_workflow.sql` adds lead follow-up fields and workflow policies.
   - `20261023000000_marketing_attribution_meta.sql` adds UTM attribution, revenue, campaign spend and the Meta event outbox.
   - `20261024000000_igs_external_lead_id.sql` supports duplicate-safe enquiries from the IGS website.
   - `20261024100000_welcome_email_sent_at.sql` records one-time welcome email delivery.
   - `20261024110000_manager_role_access.sql` adds manager permissions and scopes team-member tasks.
   - `20261024120000_daily_reports.sql` is retained for migration history because it was already applied remotely; the Daily Reports UI and routes have been removed.
   - `20261024130000_admin_manager_service_scope.sql` limits sign-in to Admin and Manager and restricts each Manager to one lead service/source.
   - `20261024140000_broadcasting.sql` adds channel consent fields, admin-only campaign/recipient logs, the atomic queue claim, and private campaign attachment storage.
   - `20261024150000_emailjs_broadcast_rate_limit.sql` spaces EmailJS sends across concurrent queue workers.
   - `20261027000000_conversation_follow_up.sql` stores each conversation's selected follow-up date on its activity record.
   - Review the access-control notes below before applying the migrations to an existing database.

4. Start the development server:

   ```sh
   npm run dev
   ```

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Supabase anon/publishable key |
| `VITE_EMAILJS_SERVICE_ID` | No | EmailJS service used for welcome emails |
| `VITE_EMAILJS_TEMPLATE_ID` | No | EmailJS welcome-email template |
| `VITE_EMAILJS_PUBLIC_KEY` | No | EmailJS public key |
| `VITE_META_PIXEL_ID` | No | Browser Pixel ID. Pixel events run only after marketing consent. |

Never put a Supabase service-role key in a `VITE_*` variable or browser code.

## Broadcasting

The admin-only `/broadcasting` panel provides email and WhatsApp campaign composition, recipient filters and preview, campaign drafts, scheduling, history, and delivery reports. It uses the existing `clients` and `team_members` data. Campaign content, recipient snapshots, provider IDs, attempts, and failure details are stored in `broadcast_campaigns` and `broadcast_recipients`; attachments use the private `broadcast-attachments` Storage bucket.

Before using the panel:

1. Apply `20261024140000_broadcasting.sql` and `20261024150000_emailjs_broadcast_rate_limit.sql` after the earlier migrations. The new channel consent fields default to `false`; these migrations do not infer channel permission from the older general `marketing_consent` field. An admin must record email or WhatsApp permission on each client detail page, based on consent the client actually gave. Email unsubscribe links turn off email eligibility immediately, including for already scheduled campaigns.
2. Reuse the existing EmailJS template for both automatic welcome emails (when a client moves to `Contacted`) and broadcasts. In EmailJS, set **To Email** to `{{to_email}}`, **Subject** to `{{subject}}`, and the HTML body to `{{{message_html}}}`. The shared template can also use `{{lead_name}}`, `{{company_name}}`, `{{message_text}}`, or `{{unsubscribe_url}}`. The welcome automation supplies its own welcome subject and body; campaigns supply the composed content and unsubscribe footer.
3. If email attachments are needed, add up to five **Form File Attachment** entries to the shared template with parameter names `broadcast_attachment_1` through `broadcast_attachment_5`. These names match the attachment fields sent by the queue worker.
4. Set up a Meta WhatsApp Business Platform Cloud API phone number and a permanent access token with messaging permission. Configure approved message templates in Meta. WhatsApp contacts need an explicit opt-in, and the provider enforces template, conversation-window, quality, and messaging limits.
5. Store these **Supabase Edge Function secrets** in the Supabase Dashboard under **Edge Function Secrets**, or with `supabase secrets set`. Do not add these values to frontend `.env` files or any `VITE_*` variable.

| Secret | Required | Purpose |
| --- | --- | --- |
| `EMAILJS_SERVICE_ID` | Email | Existing EmailJS service ID |
| `EMAILJS_TEMPLATE_ID` | Email | Existing shared welcome/broadcast EmailJS template ID |
| `EMAILJS_PUBLIC_KEY` | Email | EmailJS public key used by the existing welcome automation |
| `EMAILJS_PRIVATE_KEY` | No | Optional EmailJS private key, if enabled for your account |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp | Meta access token with WhatsApp messaging permission |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp | Registered Cloud API phone number ID |
| `WHATSAPP_GRAPH_API_VERSION` | WhatsApp | Graph API version enabled for your Meta app, e.g. `vXX.0` |
| `WHATSAPP_APP_SECRET` | WhatsApp status callbacks | Meta app secret used to verify webhook signatures |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | WhatsApp webhook setup | A long random token you choose for webhook verification |
| `BROADCAST_CRON_SECRET` | Scheduled campaigns | Long random secret sent by the scheduler to the queue worker |
| `PUBLIC_SITE_URL` | Email unsubscribe | Public CRM origin used in unsubscribe links. This is also used by the existing Meta function. |
| `PUBLIC_SITE_URLS` | No | Comma-separated allowed browser origins for the Edge Functions when they differ from `PUBLIC_SITE_URL` |

Supabase supplies `SUPABASE_URL` and the server-side key to deployed Edge Functions. The service-role key must remain server-side.

The worker spaces EmailJS requests at least 1.1 seconds apart across concurrent workers to respect its [documented one-request-per-second limit](https://www.emailjs.com/docs/rest-api/send/). It uses EmailJS's [multipart send endpoint](https://www.emailjs.com/docs/rest-api/send-form/) for campaign attachments. EmailJS acceptance is recorded as `sent`; this integration does not receive EmailJS delivery, bounce, open, or click callbacks, so email delivery analytics are not available in the panel. EmailJS does not provide an idempotency key here, so ambiguous timeout/server errors are not retried automatically; check the EmailJS dashboard history before retrying those messages. WhatsApp delivery/read statuses continue to come from Meta callbacks. The Campaign history tab has a **Process queue** action for queued work after the worker is deployed; the scheduled queue cron is still needed for automatic scheduling and retries.

Deploy the worker and callback functions after setting secrets:

```sh
supabase functions deploy process-broadcast-queue
supabase functions deploy unsubscribe-broadcast
supabase functions deploy whatsapp-broadcast-webhook
```

Configure provider callbacks:

- In the Meta app's WhatsApp webhook settings, use `https://<project-ref>.supabase.co/functions/v1/whatsapp-broadcast-webhook`, enter the same verify token as `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, and subscribe to the `messages` field. The handler checks Meta's request signature with `WHATSAPP_APP_SECRET`.

For scheduled campaigns and retries, enable Supabase's `pg_cron` and `pg_net` extensions. Store the project URL and the same random value used for `BROADCAST_CRON_SECRET` in Supabase Vault, then schedule a POST to `/functions/v1/process-broadcast-queue` every minute with header `x-internal-secret: <BROADCAST_CRON_SECRET>` and body `{"limit":25}`. In the SQL Editor, the setup has this shape (replace both placeholders with your project URL and generated secret):

```sql
select vault.create_secret('https://<project-ref>.supabase.co', 'broadcast_project_url');
select vault.create_secret('<same-value-as-BROADCAST_CRON_SECRET>', 'broadcast_cron_secret');

select cron.schedule(
  'process-broadcast-queue',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'broadcast_project_url') || '/functions/v1/process-broadcast-queue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'broadcast_cron_secret')
    ),
    body := '{"limit":25}'::jsonb
  ) as request_id;
  $$
);
```

The worker claims rows atomically and retries transient provider errors up to three times. An admin's immediate send also invokes the worker; the cron job drains larger campaigns and runs due schedules. See [Supabase's Edge Function scheduling guide](https://supabase.com/docs/guides/functions/schedule-functions) for the Vault and `pg_net` setup.

The composer limits uploads to 10 MB each (five files for email and one supported image, PDF, or MP4 for WhatsApp). The initial WhatsApp template editor sends text parameters for the approved template's body component. Verify the exact template name, language, and parameter order in Meta before sending.

## Landing page, attribution, and Meta events

- The public lead-capture page is `/landing`. It records first-touch UTM values and, after optional marketing consent, Meta click/browser identifiers. Leads are created through the `capture-lead` Supabase Edge Function so the public form does not need direct database insert access. Each lead also gets an activity, a next-day follow-up task and an optional project note. When an admin or manager moves a lead into `Contacted`, configured EmailJS sends the welcome email once; the timestamp is stored on the lead.
- The signed-in admin Marketing page is `/marketing`. Add ad spend by campaign and date there. Use the same campaign spelling in the landing link's `utm_campaign`; record each sale amount on that lead's detail page for revenue and ROAS.
- The database trigger queues `Lead`, `QualifiedLead`, `Schedule`, and `Purchase` events when a lead gave marketing consent. Stage names are `qualified`, `meeting_booked`, and `signed` respectively. Browser Pixel and server CAPI share the lead event ID for deduplication.
- Deploy both functions with the project: `supabase functions deploy capture-lead` and `supabase functions deploy process-meta-events`. The `supabase/config.toml` disables JWT verification only for the public capture function; it validates the request itself and checks the configured origin allowlist.
- Set Edge Function secrets in Supabase: `META_PIXEL_ID`, `META_ACCESS_TOKEN`, `META_GRAPH_API_VERSION`, `PUBLIC_SITE_URL`, optional comma-separated `PUBLIC_SITE_URLS`, and a long random `INTERNAL_FUNCTION_SECRET`. Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to deployed functions. `PUBLIC_SITE_URL` is the canonical site origin; add the CRM and IGS website origins to `PUBLIC_SITE_URLS` when they differ.
- Failed events use exponential retry timing. An admin can process due events or force a retry from Marketing Analytics. For unattended retries, schedule `process-meta-events` with Supabase Cron or another trusted scheduler.
- Public lead capture has a basic per-IP limit of 8 requests per 10 minutes. It stores a hashed IP key and purges keys older than 24 hours on a later capture request. A WAF or Turnstile can add stronger bot protection.
- Apply the migration and deploy the Edge Functions before using `/landing`. Until the Meta secrets and Pixel ID are configured, leads still save to the CRM, but Meta reporting stays inactive. Review the consent/privacy wording for your region before public production traffic.

## Access-control model

- `admin` uses the full CRM, including marketing, team management, and account role assignment.
- `manager` gets a manager dashboard and can see/update leads matching their configured service/source, log activity on those leads, and create or update tasks linked to those leads. Managers cannot browse other services or change account roles.
- `admin` has the full CRM and can set each manager's service scope from Team Members → Login roles. A lead matches a manager scope when its Service or Lead Source matches the configured value.
- Only `admin` and `manager` profiles can sign in to a CRM dashboard. Team-member records are managed separately from lead and task ownership; there is no Team Member dashboard.
- Create/invite accounts in Supabase Authentication, then assign the Admin or Manager role from Team Members. The initial Admin role can be set in `profiles` through Supabase if needed.
- Supabase RLS enforces the role and service restrictions in addition to UI routes. Apply the latest migration before using Manager accounts.
- There is no organization/tenant column in the current app model, so this migration does not isolate multiple companies from each other. Do not use this policy set for a multi-tenant deployment without adding and enforcing tenant ownership.
- The migration adds restrictive authentication/admin guards in addition to its permissive access policies. Review any existing policies and test with a regular account and an admin account in a non-production Supabase project before applying it to production.

## Available scripts

- `npm run dev` — local development server
- `npm run build` — production build
- `npm run preview` — preview the production build
- `npm run lint` — ESLint
