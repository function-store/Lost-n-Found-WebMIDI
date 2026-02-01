# Deploying the Lost + Found MIDI Editor

Since your domain is managed by **Squarespace** and your site is hosted on **Wix**, the most reliable way to host this Web MIDI application is to run it on a specialized static host (like Vercel or Netlify) and connect it to a **subdomain** (e.g., `editor.yourdomain.com`).

**Why not embed it directly in Wix?**
> ⚠️ **Critical Web MIDI Warning:** Web MIDI requires specific browser permissions that are often blocked inside the sandboxed `iframes` used by website builders like Wix. Hosting it on its own subdomain ensures the MIDI connection works reliably on all supported browsers.

---

## Option 1: The Subdomain Method (Recommended)

This method hosts the app separately but makes it look like part of your site via a custom URL.

### Step 1: Deploy with Firebase (Recommended)

I have already created the configuration files (`firebase.json` and `.firebaserc`) for you. **You generally do NOT need to install anything globally.**

**Option A: Firebase Hosting (Simplest)**
1.  **Build the app:**
    ```bash
    npm run build
    ```
2.  **Login to Firebase:**
    ```bash
    npx firebase login --no-localhost
    ```
    *(Click the link, sign in, paste code)*
3.  **Deploy:**
    ```bash
    npx firebase deploy
    ```

That's it! You will get a live URL (e.g., `https://lost-n-found-midi.web.app`).

**Option B: Vercel**
1. Push your code to a generic GitHub repository (private or public).
2. Go to [Vercel.com](https://vercel.com) and sign up/login.
3. Click **"Add New Project"** and import your GitHub repo.
4. Vercel will detect it's a Vite project. The default settings are usually correct:
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. Click **Deploy**.
6. Once finished, Vercel will give you a URL like `project-name.vercel.app`. Test it to make sure it loads.

### Step 2: Configure Your Subdomain (Squarespace)
Now, point a clean URL like `editor.yoursite.com` to your new deployment.

1. Log in to your **Squarespace** account.
2. Go to **Domains** and select your domain.
3. Look for **DNS Settings** (or "Manage DNS").
4. Add a new record with these settings:

   | Field in Squarespace | Value to Enter | Notes |
   | :--- | :--- | :--- |
   | **Host** | `editor` (or `lost-n-found`) | This is your subdomain. <br>• If you enter `editor`, your URL will be `editor.yoursite.com`. <br>• If you enter `lost-n-found`, it will be `lost-n-found.yoursite.com`. |
   | **Type** | `CNAME` | Tells the system this is an alias for another address. |
   | **Priority** | `0` or `N/A` | Leave blank or default. CNAMEs do not use priority. |
   | **TTL** | `1 Hour` (or default) | "Time To Live". Standard is 1 hour (3600). |
   | **Data** (or Value) | `[your-project].web.app` | **CRITICAL:** Check your host's dashboard for the exact value. <br>• **Firebase:** Usually `your-project-id.web.app` <br>• **Vercel:** `cname.vercel-dns.com` |
5. Save the record.

### Step 3: Finish Domain Setup on Host
1. Go back to your Vercel/Netlify dashboard.
2. Go to **Settings > Domains**.
3. Add your full subdomain: `editor.yourdomain.com`.
4. It will verify the DNS record you just added. Once verified, SSL (HTTPS) will be provisioned automatically.

### Step 4: Link from Wix
1. Go to your **Wix Editor**.
2. Add a button or menu link labeled "Launch Editor" or "Pedal Manager".
3. Set the link destination to `https://editor.yourdomain.com`.
4. (Optional) Set it to open in a new tab.

---

## Option 2: Embedding in Wix (Experimental)

If you absolutely must have the interface visually *inside* your Wix page, you can try enclosing it in an HTML Element, but **Web MIDI may fail** depending on Wix's security policies.

1. Deploy the app to Vercel/Netlify as described in "Step 1" above.
2. In **Wix Editor**, go to **Add Elements (+) > Embed Code > Embed HTML**.
3. Select **Code** (not Website Address) and paste this:

```html
<iframe 
  src="https://your-project.vercel.app" 
  width="100%" 
  height="800px" 
  style="border:none;"
  allow="midi; usb"
></iframe>
```
*Note the `allow="midi; usb"` attribute—this is crucial. If Wix strips this attribute, the app will not work.*

---

## Deployment Checklist

- [ ] **Build Command**: `npm run build`
- [ ] **Environment**: Set `NODE_ENV` to `production`.
- [ ] **HTTPS**: Must be served over HTTPS (Web MIDI requirement).
- [ ] **Google Auth**: If using the Cloud Sync features with Firebase:
    - Go to your [Firebase Console](https://console.firebase.google.com/).
    - Authentication > Settings > Authorized Domains.
    - Add your new domain (`editor.yourdomain.com` and `your-project.vercel.app`).
