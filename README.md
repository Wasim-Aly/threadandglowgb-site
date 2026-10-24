# Thread & Glow GB

A storefront for handmade crochet and Himalayan salt-lamp products from Gilgit-Baltistan. The production order and enquiry flows use Vercel serverless functions and Supabase. Customers submit an order or enquiry to the store database before choosing a WhatsApp or email draft; payment is not collected on the website.

## Storefront and admin

- Storefront: `/`
- Admin dashboard: `/admin/`
- Admin users sign in with Supabase Auth and must also be added to the `public.admin_users` allow-list.
- Supabase Dashboard sign-in with GitHub is separate from the store admin login. Create an email/password user under **Authentication → Users**, then add that user's UUID to `public.admin_users`.
- The dashboard manages order and enquiry statuses, product details, prices, active/visible products, and stock.
- Blank stock means inventory is not tracked; stock of zero makes a product unavailable. Orders do not reserve or deduct stock automatically.

## Configure Supabase

1. Create a Supabase project.
2. Open the project's SQL Editor and run [`supabase/schema.sql`](./supabase/schema.sql). It creates the tables, access policies, rate-limit function, and starter catalog. Review the product names/images, and add prices and stock in the admin after setup.
3. In Supabase Authentication, create an account for the store administrator. Disable public sign-up if it is not needed.
4. Copy that user's UUID from Authentication → Users, then run this in the SQL Editor, replacing the sample UUID:

   ```sql
   insert into public.admin_users (user_id)
   values ('00000000-0000-0000-0000-000000000000')
   on conflict (user_id) do nothing;
   ```

5. Keep the Supabase service-role key private. Never put it in browser JavaScript, commit it, or send it in chat.

## Configure Vercel

In the Vercel project, open **Settings → Environment Variables** and add the following for the environments you will deploy. The project URL and API keys are available in Supabase **Project Settings → API Keys** (or **Connect**).

| Variable | Value |
| --- | --- |
| `SUPABASE_URL` | Project URL |
| `SUPABASE_ANON_KEY` | Publishable key (`sb_publishable_...`) or legacy `anon` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key (`sb_secret_...`) or legacy `service_role` key |

Redeploy after saving the variables, then visit `/admin/` and sign in. The admin page rejects authenticated users who are not on the allow-list. The storefront will clearly report when the backend is not configured; live checkout stays disabled until the API and database are available.

An [.env.example](./.env.example) file documents the variable names using placeholders only. Do not replace those placeholders with real keys in a committed file.

The `/api/config` endpoint reports `configured: true` only for a valid HTTPS URL and supported Supabase key formats; never share its response publicly because it includes the publishable key. The secret/service-role key is never sent to the browser.

## Deploy

1. Import the GitHub repository into Vercel.
2. Use the repository root as the Root Directory and **Other** as the Framework Preset.
3. Leave the Build Command and Output Directory empty. Vercel serves the static storefront and deploys the functions in `api/`.
4. Add the environment variables above, deploy, and confirm the storefront catalog and `/admin/` work.

Opening `index.html` directly or serving it with a basic static server is useful for layout work, but the API routes are only available after deployment to Vercel (or when using the Vercel development CLI).

## Order and message behavior

An order request is saved in Supabase and assigned a reference before the website opens a prefilled WhatsApp or email draft. The customer must still review and send that draft. If the save fails, the page reports the error and preserves the cart. Enquiries are similarly saved before a draft is opened. Store staff review requests and confirm availability, final pricing, delivery, and payment with the customer.

The website does not automatically send replies to WhatsApp or email. Configure greeting/away messages in WhatsApp Business for automatic WhatsApp responses. Sending automatic email or WhatsApp replies from the website requires a separately configured provider and secure server-side credentials.

## Search engine setup

The canonical public domain is `https://threadandglowgb-site.vercel.app/`. The site includes a canonical URL, social-sharing metadata, store structured data, [`robots.txt`](./robots.txt), and [`sitemap.xml`](./sitemap.xml). Keep that domain assigned to the Vercel production deployment; if you switch to a custom domain, update the canonical URL, sitemap, robots sitemap location, and structured-data URLs together.

To help search engines discover the site, verify the domain in [Google Search Console](https://search.google.com/search-console), submit `https://threadandglowgb-site.vercel.app/sitemap.xml`, and inspect the homepage for indexing. Keep product names, descriptions, prices, inventory, and images accurate in the admin. Add real descriptive alt text to product images and use the same public business name, phone, and service area in your customer-facing profiles. Rankings depend on many factors and cannot be guaranteed; avoid buying links or publishing repetitive keyword-stuffed pages.
