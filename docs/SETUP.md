# SK Vasra Fun Run — deployment and security setup

This repository is a separate application, with a **separate Supabase project** for event data. SKVASRA remains the authority for KK profiles, login, review, and digital IDs. Do not copy or recreate KK user passwords.

## 1. Create the new Supabase project
1. Visit https://supabase.com/dashboard and create a separate project, for example "skvasra-funrun".
2. Open its SQL Editor. Run "supabase/migrations/20261108_funrun_initial.sql" from this repository. Do NOT run it in the original SKVASRA database.
3. Query "select * from public.funrun_events;" to confirm the draft placeholder event exists.
4. Once organizers finalize the date, venue and choices, update the placeholder record with official values. Example template (replace placeholders and official categories):

    update public.funrun_events
    set title = 'OFFICIAL EVENT TITLE',
        event_date = '2027-01-01',
        venue = 'OFFICIAL VENUE',
        distances = array[3,5,10],
        shirt_sizes = array['S','M','L','XL'],
        registration_open = false;

5. Keep registration_open=false until launch approval, verified documentation and testing. When ready, set registration_open=true.

## 2. Main SKVASRA sign-in bridge
The existing SKVASRA KK system uses custom private "vasra.kk_members" records and the HttpOnly "vasra_kk" session cookie, NOT native Supabase Auth. There is no safe direct cross-project Supabase JWT reuse.

A companion, opt-in branch in "luffylines/vasra" is required:
- "feat/funrun-secure-kk-bridge" adds GET "/api/kk/funrun/authorize?state=..." to the original SKVASRA API.
- It checks the original session using the existing KK mine RPC, then signs a 90-second HMAC assertion containing only member UUID, profile status, state and one-time nonce.
- The callback destination is a fixed exact URL, never an arbitrary user-provided redirect.
- The Fun Run server validates state/signature/expiry and records a nonce in its separate database to block reuse.
- Existing Google and email-2FA routes remain under SKVASRA.

For the **main SKVASRA Vercel project**, once the companion PR is reviewed and merged, add:
- FUNRUN_BRIDGE_SECRET = secure 32+-character random secret (same on BOTH deployments)
- FUNRUN_CALLBACK_URL = https://funrun.skvasra.app/api/auth/callback

The secret must NOT be pasted into GitHub or into chat.

## 3. Deploy the separate Fun Run website on Vercel
1. Import GitHub repo "luffylines/funrunskvasra" into a NEW Vercel project. Do not replace the current "vasra" Vercel project.
2. Framework Preset "Other". Root directory ".". The committed "vercel.json" selects static output folder "public" and a Node serverless API.
3. In Vercel Project Settings > Environment Variables set the following, scoped to production (and appropriate previews):
   - FUNRUN_ORIGIN = https://funrun.skvasra.app
   - FUNRUN_SUPABASE_URL = URL of the NEW Fun Run Supabase project
   - FUNRUN_SUPABASE_SECRET_KEY = its server-only sb_secret_... key
   - FUNRUN_BRIDGE_SECRET = same secret as the main project
   - FUNRUN_SESSION_SECRET = a DIFFERENT 32+ character random secret
4. Add the custom domain "funrun.skvasra.app" in the Fun Run Vercel project and configure the DNS record Vercel gives. Existing "skvasra.app" DNS stays untouched.
5. Redeploy the Fun Run project and then the main project after its bridge change and environment settings are ready.
6. Check https://funrun.skvasra.app/api/health returns configured:true, and /api/config returns official event details.
7. Open registration only after test sign-ins and successful Supabase insert on the new project.

### Local preview
Node 22+ required. Run "npm test" and "npm start". Visit http://127.0.0.1:4174. Static UI works locally; the SKVASRA authentication bridge is tied to the official hosted domain and does not work on arbitrary local/preview URLs.

## 4. Test cases
- Test an existing KK member's successful sign-in, with a submitted pending or verified profile.
- Verify Google login and 2FA flows still finish at SKVASRA and return to Fun Run appropriately.
- New members must first create their KK account at https://www.skvasra.app/kk-register and complete the full profile. Then return to the Fun Run page.
- Verify draft/rejected KK profiles cannot enroll.
- Repeating the registration must not create another event record (unique member_id/event_id).
- Verify signed login ticket cannot be replayed.
- Check no database secret appears in browser network responses or in source control.
- Verify original SKVASRA database contains no Fun Run event rows.
- Check mobile widths and both themes.

## Scope and limitations
- Event date, distance options, and shirt sizes must be confirmed by the SK; no official options were provided.
- New KK signups still occur on original SKVASRA registration; a fully combined one-page KK+Fun Run signup flow is not yet included.
- Organizer dashboard, QR scan/check-in, payment, guest/non-KK runners, T-shirt inventory and claim tracking are future features, not implemented in this first release.
- A submitted Fun Run record starts as "pending"; it is not proof of SK review, attendance or eligibility.
- Event member reference, selected distance, shirt size, state and timestamps live in the Fun Run database; full KK profile data stays private in SKVASRA.
- Privacy notice and data retention policy require SK approval before production registration.
- A second project has separate database resources but does not guarantee the Supabase Free Plan quotas or avoid project pausing. Monitor usage and billing.
