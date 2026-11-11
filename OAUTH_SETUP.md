# Supabase OAuth Setup Guide

This guide details the step-by-step instructions required to enable and configure **Google OAuth** and **GitHub OAuth** authentication for the TyProX application using your Supabase project (`<your-supabase-project-ref>`). Never commit provider client secrets, `.env.local`, or `SUPABASE_SERVICE_ROLE_KEY` to Git.

---

## 1. Get the Supabase Redirect URI

When setting up OAuth with Google and GitHub, you will need to provide them with the redirect callback URL from Supabase:

```text
https://<your-supabase-project-ref>.supabase.co/auth/v1/callback
```

---

## 2. Configure GitHub OAuth

1. Go to your **GitHub Settings** -> **Developer settings** -> **OAuth Apps**.
2. Click **New OAuth App**.
3. Fill in the application details:
   - **Application name**: `TyProX`
   - **Homepage URL**: `http://localhost:3000` (or your production deployment URL)
   - **Authorization callback URL**: `https://<your-supabase-project-ref>.supabase.co/auth/v1/callback`
4. Click **Register application**.
5. Copy the **Client ID**.
6. Click **Generate a new client secret** and copy the **Client Secret**.

---

## 3. Configure Google OAuth

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create or select a project.
3. Navigate to **APIs & Services** -> **OAuth consent screen**:
   - Choose **External** user type.
   - Fill in the application info (name, support email, developer email).
   - Under scopes, ensure `openid`, `.../auth/userinfo.email`, and `.../auth/userinfo.profile` are added.
4. Navigate to **APIs & Services** -> **Credentials**:
   - Click **+ Create Credentials** -> **OAuth client ID**.
   - Select **Web application** as the application type.
   - Add a name (e.g., `TyProX Client`).
   - Under **Authorized redirect URIs**, add:
     `https://<your-supabase-project-ref>.supabase.co/auth/v1/callback`
   - Click **Create**.
5. Copy your **Client ID** and **Client Secret**.

---

## 4. Enable Providers in Supabase

1. Open the [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your Supabase project **`<your-supabase-project-ref>`** (the project reference subdomain from `NEXT_PUBLIC_SUPABASE_URL`).
3. In the left navigation bar, go to **Authentication** -> **Providers**.
4. Configure **GitHub**:
   - Expand the **GitHub** section.
   - Toggle **Enable GitHub provider** to **ON**.
   - Paste the **Client ID** and **Client Secret** you obtained from GitHub.
   - Click **Save**.
5. Configure **Google**:
   - Expand the **Google** section.
   - Toggle **Enable Google provider** to **ON**.
   - Paste the **Client ID** and **Client Secret** you obtained from Google.
   - Click **Save**.

---

## 5. Configure Site URL & Redirect Allowlist in Supabase & Hosting

TyProX passes `${window.location.origin}/auth/callback` as the OAuth `redirectTo` target and validates `?next=` paths strictly on the server via `sanitizeRedirectPath()` (`lib/security/redirect.ts`) to block open redirects.

1. In Supabase **Authentication** -> **URL Configuration**:
   - Set **Site URL** to your primary production origin (matching `NEXT_PUBLIC_SITE_URL`).
   - Under **Redirect URLs**, explicitly allow each application origin callback:
     - `http://localhost:3000/auth/callback`
     - Your production deployment URL + `/auth/callback`
     - Any Vercel preview URL pattern you intentionally permit
2. In hosting (and `.env.local` locally), set `NEXT_PUBLIC_SITE_URL` to the exact canonical origin (`https://your-domain.example` in production, `http://localhost:3000` locally) so canonical metadata, `sitemap.xml`, `robots.txt`, and same-origin request validation stay aligned.

---

## 6. Verify the Integration

Once configured in Supabase, test the login buttons on the TyProX login page:
1. Run `npm run dev` and navigate to `http://localhost:3000/login`.
2. Click **GitHub** or **Google**.
3. Confirm the provider redirects cleanly back through `/auth/callback` to `/dashboard` (and onboarding handle selection prompts cleanly on new accounts).
