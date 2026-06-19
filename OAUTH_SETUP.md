# Supabase OAuth Setup Guide

This guide details the step-by-step instructions required to enable and configure **Google OAuth** and **GitHub OAuth** authentication for the TyProX application using your Supabase project (`gbovkejymfeiqgverzfr`).

---

## 1. Get the Supabase Redirect URI

When setting up OAuth with Google and GitHub, you will need to provide them with the redirect callback URL from Supabase:

```text
https://gbovkejymfeiqgverzfr.supabase.co/auth/v1/callback
```

---

## 2. Configure GitHub OAuth

1. Go to your **GitHub Settings** -> **Developer settings** -> **OAuth Apps**.
2. Click **New OAuth App**.
3. Fill in the application details:
   - **Application name**: `TyProX`
   - **Homepage URL**: `http://localhost:3000` (or your production Vercel URL)
   - **Authorization callback URL**: `https://gbovkejymfeiqgverzfr.supabase.co/auth/v1/callback`
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
     `https://gbovkejymfeiqgverzfr.supabase.co/auth/v1/callback`
   - Click **Create**.
5. Copy your **Client ID** and **Client Secret**.

---

## 4. Enable Providers in Supabase

1. Open the [Supabase Dashboard](https://supabase.com/dashboard).
2. Select your project **`gbovkejymfeiqgverzfr`**.
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

## 5. Verify the Integration

Once configured in Supabase, test the login buttons on the TyProX login page again:
1. Run `npm run dev` and navigate to `http://localhost:3000/login`.
2. Click **GitHub** or **Google**.
3. You should be redirected to the provider's sign-in screen, and then redirected back to the TyProX Dashboard.
