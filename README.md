# Spendbox

A B2B procurement site. One input field stays on screen at all times; scrolling
changes everything behind it. Clicking the field opens a short multi-step form.
When someone sends a request, two emails go out straight away — one to your
team, one confirming to them.

There is a second, separate form for vendors who want to supply.

---

## What you need before you start

Three accounts. All three have a free tier.

| Service | What it does here | Required? |
| --- | --- | --- |
| [Vercel](https://vercel.com) | Hosts the website | Yes |
| [Resend](https://resend.com) | Sends the emails | Yes |
| [Supabase](https://supabase.com) | Keeps a copy of every request in a database | Optional |

Without Supabase the site works perfectly — you just get the requests by email
instead of also having them in a table.

---

## Setting it up, step by step

### 1. Resend — so emails can be sent

1. Sign up at [resend.com](https://resend.com).
2. Go to **Domains** and add your domain (for example `spendbox.site`). Resend
   shows you a few DNS records to copy into wherever you bought the domain.
   Wait for it to say **Verified** — this usually takes a few minutes.
3. Go to **API Keys** → **Create API Key**. Copy the key that starts with `re_`.
   You only get to see it once.

> In a hurry? You can skip the domain step and send from
> `onboarding@resend.dev` while testing, but Resend will only deliver to your
> own address until a domain is verified.

### 2. Supabase — optional, only if you want a database

1. Sign up at [supabase.com](https://supabase.com) and create a project.
2. Open **SQL Editor** → **New query**.
3. Open the file `supabase/schema.sql` in this project, copy everything in it,
   paste it in, and press **Run**. This creates the two tables.
4. Go to **Project Settings** → **API** and copy two things:
   - the **Project URL**
   - the **`service_role`** key (the secret one, not `anon`)

### 3. Vercel — putting the site online

1. Push this project to GitHub (see *Deploying changes* below).
2. Go to [vercel.com/new](https://vercel.com/new), pick the repository, and
   click **Import**. Vercel detects Next.js on its own — don't change the build
   settings.
3. Before clicking **Deploy**, open **Environment Variables** and add the ones
   in the table below.
4. Click **Deploy**. About a minute later the site is live.

---

## Environment variables

These are the settings the site reads. Add them in Vercel under
**Project → Settings → Environment Variables**. There is a copy of this list in
the file `.env.example`.

| Name | Example | Needed |
| --- | --- | --- |
| `RESEND_API_KEY` | `re_abc123…` | Yes |
| `EMAIL_FROM` | `Spendbox <requests@spendbox.site>` | Yes |
| `EMAIL_TO_INTERNAL` | `you@spendbox.site` | Yes |
| `EMAIL_REPLY_TO` | `hello@spendbox.site` | No |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://abc.supabase.co` | Only with Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOi…` | Only with Supabase |
| `NEXT_PUBLIC_SITE_URL` | `https://spendbox.site` | Recommended |

Notes:

- `EMAIL_FROM` must use a domain you verified in Resend, or nothing sends.
- `EMAIL_TO_INTERNAL` can hold several addresses separated by commas:
  `ada@x.com, musa@x.com`.
- **Never** rename `SUPABASE_SERVICE_ROLE_KEY` to start with `NEXT_PUBLIC_`.
  Anything starting with `NEXT_PUBLIC_` is visible to everyone who opens the
  site, and that key can read and write your whole database.

After changing any variable in Vercel you have to **redeploy** for it to take
effect (Deployments → ⋯ → Redeploy).

---

## What happens when someone submits

**A buyer sends a request:**

1. It is checked for obvious mistakes (missing email, nonsense phone number).
2. If Supabase is set up, a row is saved to `procurement_requests`.
3. Two emails go out at the same time:
   - to your team, with everything they filled in, and **Reply** goes straight
     back to the buyer;
   - to the buyer, confirming it, with a reference like `SPB-4K2P-7QX`.

**A vendor applies:** the same thing, into `vendor_applications`, with a
reference like `VND-8M3T-2LP`.

If email is not configured, the person is told plainly that their request could
not be delivered rather than being shown a fake success screen.

---

## Changing the things you will most likely want to change

Almost everything you'd want to edit lives in **one file**:
[`lib/catalog.ts`](lib/catalog.ts).

| To change… | Edit this in `lib/catalog.ts` |
| --- | --- |
| The 12 categories, their descriptions and examples | `CATEGORIES` |
| The urgency options and what each promises | `URGENCIES` |
| The budget bands (currently in naira) | `BUDGET_BANDS` |
| The cities/regions vendors can pick | `REGIONS` |
| Vendor payment terms and delivery speeds | `PAYMENT_TERMS`, `FULFILMENT_SPEEDS` |

Other common edits:

| To change… | File |
| --- | --- |
| The five headlines you scroll through | `components/ScrollStage.tsx` → `CHAPTERS` |
| The example requests in the search bar | `components/CommandBar.tsx` → `PLACEHOLDERS` |
| The FAQ | `components/Sections.tsx` → `FAQS` |
| Colours and fonts | `app/globals.css` → the `@theme` block |
| The category pictures | `public/img/*.svg` |

---

## Running it on your own computer

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install          # once
cp .env.example .env # then fill in the values
npm run dev          # open http://localhost:3000
```

Other commands:

```bash
npm run build      # check it compiles the way Vercel will
npm run typecheck  # check for mistakes without building
```

---

## Deploying changes

Once the project is connected to Vercel, every push to the `main` branch
deploys automatically.

```bash
git add .
git commit -m "Describe what you changed"
git push
```

---

## How the site is put together

```
app/
  page.tsx            the home page, which stacks the sections together
  layout.tsx          fonts, page title, social preview
  globals.css         colours, fonts, spacing — the whole design system
  api/order/route.ts  receives buyer requests, saves and emails them
  api/vendor/route.ts receives vendor applications, saves and emails them

components/
  Shell.tsx        holds the "which form is open" state for the whole page
  CommandBar.tsx   the input field that never leaves the screen
  ScrollStage.tsx  the pinned hero where scrolling changes the background
  DockBar.tsx      the same bar, docked to the bottom further down the page
  OrderForm.tsx    the buyer's 4-step form
  VendorForm.tsx   the vendor's 5-step form
  Sheet.tsx        the pop-up panel both forms live in
  Field.tsx        text boxes, chips, choice cards, checkboxes
  Sections.tsx     everything below the hero

lib/
  catalog.ts   categories, urgency levels, dropdown options
  schemas.ts   the rules for what counts as a valid submission
  email.ts     how the emails are laid out
  resend.ts    sending
  supabase.ts  saving
  ratelimit.ts stops one person spamming the form

supabase/schema.sql   the database tables
public/img/           the twelve category illustrations
```

### A few deliberate decisions

- **The fonts are self-hosted** (`app/fonts/`) rather than loaded from Google.
  Two files, under 70KB together, and no third-party connection on first paint.
- **The pictures are hand-drawn SVG**, about 1.5KB each, so all twelve load
  instantly and stay sharp on any screen. Swap in photographs by replacing the
  files in `public/img/` and pointing `image` in `lib/catalog.ts` at them.
- **The forms load only when opened**, so they cost nothing on first visit.
- **Supabase is optional on purpose.** If the database is down or misconfigured,
  the request still reaches you by email, and the internal email says the row
  was not saved.
- **Every animation is turned off** for visitors whose device is set to
  "reduce motion".
