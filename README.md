# CRM

A React + Vite CRM for managing clients, sales stages, follow-up tasks, and team members. Supabase provides authentication and data storage.

## Requirements

- Node.js 20.19+ or 22.12+
- A Supabase project with the CRM tables used by the app: `profiles`, `clients`, `team_members`, `tasks`, `activities`, and `notes`

## Local setup

1. Install packages:

   ```sh
   npm install
   ```

2. Copy `.env.example` to `.env` and set the Supabase project URL and anon/publishable key. EmailJS values are optional; configure them to send welcome emails when creating/importing clients.

3. Apply both migrations in `supabase/migrations/` in filename order using the Supabase CLI or SQL Editor:
   - `20261019000000_crm_access_policies.sql` assumes `profiles.id` matches `auth.users.id` and `profiles.role` contains `admin` for administrators.
   - `20261019000001_task_assignment_priority.sql` adds task assignee and priority fields used by task management.
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

Never put a Supabase service-role key in a `VITE_*` variable or browser code.

## Access-control model

- Every signed-in user can view and manage shared clients, tasks, notes, and activity records, matching the current single-workspace UI.
- Signed-in users can view team member records; only users whose own profile has `role = 'admin'` can create, edit, or delete them.
- The team-member pages are also protected by an admin route in the UI. Supabase RLS is the data-layer enforcement and must be applied independently.
- There is no organization/tenant column in the current app model, so this migration does not isolate multiple companies from each other. Do not use this policy set for a multi-tenant deployment without adding and enforcing tenant ownership.
- The migration adds restrictive authentication/admin guards in addition to its permissive access policies. Review any existing policies and test with a regular account and an admin account in a non-production Supabase project before applying it to production.

## Available scripts

- `npm run dev` — local development server
- `npm run build` — production build
- `npm run preview` — preview the production build
- `npm run lint` — ESLint
