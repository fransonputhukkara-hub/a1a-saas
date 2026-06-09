# Deploy to Vercel

## Quick Start

1. **Push to GitHub:**
   ```bash
   git add .
   git commit -m "Deploy: St. Thomas Men's Wear app with correct Supabase config"
   git push origin master
   ```

2. **Connect to Vercel:**
   - Go to https://vercel.com/dashboard
   - Click "Add New..." → "Project"
   - Import from Git → Select `fransonputhukkara-hub/a1a-saas`
   - Under "Environment Variables", add:
     ```
     VITE_SUPABASE_URL=https://abwqcxdoimfnzmtcccjz.supabase.co
     VITE_SUPABASE_ANON_KEY=sb_publishable_vdY4zAft5kLLma8wlEGhRA_BttpiX-p
     ```
   - Click "Deploy"

3. **Log in:**
   - Email: `fransonputhukkara@gmail.com`
   - Password: `StThomas@2025`

Done! The app will be live in ~2-5 minutes with all 14 screens ready.

## What's Included

- ✅ All 14 screens (Dashboard, Sale, Customers, Purchase, etc.)
- ✅ Barcode scanning, generation, printing
- ✅ SPA routing fixed (no 404s)
- ✅ Correct Supabase project with live data
- ✅ Apple Light Glass UI theme
