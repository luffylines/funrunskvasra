# SKVASRA Fun Run

Standalone Fun Run website for Barangay Vasra, using the same blue/navy styling, Manrope typography, cards, layout and mobile design as the existing SKVASRA portal.

- Main portal: https://www.skvasra.app (KK member account, login, profiling, ID and approval).
- Fun Run: separate GitHub repository, Vercel deployment and Supabase project (event registrations only).
- Planned domain: https://funrun.skvasra.app.
- No shared public database keys and no duplicate KK passwords or profile records.

## Included
- Responsive landing page, event information, mobile/dark-mode UI.
- Connect with SKVASRA through short-lived one-use signed login tickets.
- Event form for official running-distance and shirt-size options.
- Server-only Supabase database access with RLS-denied public tables.
- One event registration per member and status/registration number display.
- Local preview and Node security tests.

## Required before public launch
The companion SKVASRA integration lives on the **separate main-site review branch** "feat/funrun-secure-kk-bridge" in repository "luffylines/vasra". The main site's KK authentication is custom, not native Supabase Auth, so the bridge must be reviewed, merged and configured before Fun Run login works. New KK accounts are created on the original SKVASRA registration page (not within this Fun Run website yet).

Create a NEW Supabase project, run the migration, configure official event details, and add secret environment variables separately in Vercel. Registration stays closed by default.

See [docs/SETUP.md](docs/SETUP.md) for complete step-by-step hosting instructions, security model, tests, and current limitations.

## Local development
Node.js 22 or later, no npm dependencies.

    npm test
    npm start

Then visit http://127.0.0.1:4174 (preview UI only until the production integration is configured).

## Privacy
The Fun Run database stores a member UUID reference, event ID, selected distance, T-shirt size, status and timestamp. KK identities and profile details stay in SKVASRA. Opening registration requires the official SK privacy notice and event rules.
