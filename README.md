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
   - `20261019000001_task_assignment_priority.sql` adds task assignee and priority fields used by task management.
   - `20261022000000_client_follow_up_workflow.sql` adds lead follow-up and staff assignment workflows.
   - `20261023000000_marketing_attribution_meta.sql` adds UTM attribution, revenue, campaign spend and the Meta event outbox.
   - `20261024000000_igs_external_lead_id.sql` supports duplicate-safe enquiries from the IGS website.
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

## Landing page, attribution, and Meta events

- The public lead-capture page is `/landing`. It records first-touch UTM values and, after optional marketing consent, Meta click/browser identifiers. Leads are created through the `capture-lead` Supabase Edge Function so the public form does not need direct database insert access. Each lead also gets an activity, a next-day follow-up task and an optional project note. When a team member moves a lead into `Contacted`, configured EmailJS sends the welcome email once; the timestamp is stored on the lead.
- The signed-in admin Marketing page is `/marketing`. Add ad spend by campaign and date there. Use the same campaign spelling in the landing link's `utm_campaign`; record each sale amount on that lead's detail page for revenue and ROAS.
- The database trigger queues `Lead`, `QualifiedLead`, `Schedule`, and `Purchase` events when a lead gave marketing consent. Stage names are `qualified`, `meeting_booked`, and `signed` respectively. Browser Pixel and server CAPI share the lead event ID for deduplication.
- Deploy both functions with the project: `supabase functions deploy capture-lead` and `supabase functions deploy process-meta-events`. The `supabase/config.toml` disables JWT verification only for the public capture function; it validates the request itself and checks the configured origin allowlist.
- Set Edge Function secrets in Supabase: `META_PIXEL_ID`, `META_ACCESS_TOKEN`, `META_GRAPH_API_VERSION`, `PUBLIC_SITE_URL`, optional comma-separated `PUBLIC_SITE_URLS`, and a long random `INTERNAL_FUNCTION_SECRET`. Supabase provides `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` to deployed functions. `PUBLIC_SITE_URL` is the canonical site origin; add the CRM and IGS website origins to `PUBLIC_SITE_URLS` when they differ.
- Failed events use exponential retry timing. An admin can process due events or force a retry from Marketing Analytics. For unattended retries, schedule `process-meta-events` with Supabase Cron or another trusted scheduler.
- Public lead capture has a basic per-IP limit of 8 requests per 10 minutes. It stores a hashed IP key and purges keys older than 24 hours on a later capture request. A WAF or Turnstile can add stronger bot protection.
- Apply the migration and deploy the Edge Functions before using `/landing`. Until the Meta secrets and Pixel ID are configured, leads still save to the CRM, but Meta reporting stays inactive. Review the consent/privacy wording for your region before public production traffic.

## Access-control model

- Every signed-in user can view and manage shared leads, tasks, notes, and activity records, matching the current single-workspace UI.
- Signed-in users can view team member records; only users whose own profile has `role = 'admin'` can create, edit, or delete them.
- The team-member pages are also protected by an admin route in the UI. Supabase RLS is the data-layer enforcement and must be applied independently.
- There is no organization/tenant column in the current app model, so this migration does not isolate multiple companies from each other. Do not use this policy set for a multi-tenant deployment without adding and enforcing tenant ownership.
- The migration adds restrictive authentication/admin guards in addition to its permissive access policies. Review any existing policies and test with a regular account and an admin account in a non-production Supabase project before applying it to production.

## Available scripts

- `npm run dev` — local development server
- `npm run build` — production build
- `npm run preview` — preview the production build
- `npm run lint` — ESLint
