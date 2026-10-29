# Supabase setup (once, about 15 minutes)

Sign-in and onboarding need a real backend. This is free (Supabase free tier). Everything here happens in your browser plus a few PowerShell commands. Until you finish it, the app keeps running on sample data.

## 1. Create the project
1. Sign up at **supabase.com**, then **New project**.
2. Name it `yard-staging` and pick the **East US** region (closest to Charlotte). Save the database password in your password manager. You won't need it often.
3. When it's ready, open **Project Settings › API** and keep that tab open. You need the **Project URL** and the **anon public** key. Both are safe to put in the app. **Never** put the `service_role` key in the app or in git.

## 2. Point the app at it
Create `mobile\.env` (it's gitignored) with:
```
EXPO_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon public key>
```

## 3. Push the database (schema, privacy rules, functions)
In PowerShell, from the repo root:
```powershell
npx supabase login
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```
`db push` applies every file in `supabase/migrations/`. Run it again whenever a PR adds a migration.

If `supabase login` hits the same browser-opening bug Expo had, create an access token at supabase.com › Account › Access Tokens, then run `$env:SUPABASE_ACCESS_TOKEN = "<token>"` before the commands.

## 4. Turn on sign-in methods
In the Supabase dashboard, under **Authentication**:

**Email (one-time code):**
1. **Sign In / Providers › Email:** enabled, with "Confirm email" on.
2. **Emails › Templates › Magic Link:** make the body show the 6-digit code, for example:
   ```html
   <h2>Your yard code</h2>
   <p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
   ```
   The app asks for the code instead of opening a link.
3. Supabase's built-in email sender is only meant for testing (very low hourly limit). That's fine for you now. Before the beta, add a custom SMTP sender.

**Apple:**
1. **Sign In / Providers › Apple:** enable it.
2. In **Client IDs**, enter `host.exp.Exponent,com.dixitsa.yard`. The first is Expo Go, which lets Sign in with Apple work while you test in Expo Go; the second is the real app.
3. You can leave the secret key / OAuth fields empty for now. The app uses Apple's native sign-in, which only needs the client IDs.

## 5. Check it
Restart the dev server (`npx expo start --clear`). The app should open on the yard welcome screen instead of the sample feed. Sign in with your email, enter the code, and complete onboarding.
