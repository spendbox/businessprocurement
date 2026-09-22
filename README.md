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
| `ADMIN_EMAIL` | `you@spendbox.site` | For the dashboard |
| `ADMIN_PASSWORD` | a long random string | For the dashboard |
| `ADMIN_SESSION_SECRET` | 32+ random characters | For the dashboard |
| `OPENAI_API_KEY` | `sk-…` | Optional |
| `OPENAI_MODEL` | `gpt-4o-mini` | Optional |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Optional |

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

## When email is not arriving

Open **`/admin/diagnostics`**. It reads the live deployment and tells you, in
order:

1. **Which settings this deployment can actually see.** A variable added in
   Vercel does nothing until the next deploy — if you added one and did not
   redeploy, this page will still show it as missing, which is the answer.
2. **What Resend says.** The *Send a test email* button sends one real email
   and prints Resend's reply word for word, including the error. That is the
   difference between "not configured", "rejected by Resend" and "sent but not
   delivered", and you cannot tell those apart from the form.

The two failures that produce complete silence — nothing in your inbox *and*
nothing in the Resend log — are:

- **`EMAIL_FROM` uses a domain you have not verified in Resend.** Resend
  refuses the request outright, so no email record is ever created and the
  Resend dashboard stays empty. Verify the domain under **Domains**, wait for
  it to read Verified, then set `EMAIL_FROM` to an address on it.
- **No verified domain at all.** Resend then only delivers to your own account
  address, so a test to yourself succeeds while every real buyer gets nothing.

Server logs are on vercel.com under the **Logs** tab (not the build log on a
deployment). Every line this app writes starts with `spendbox`, so search for
that. Nothing appears until a request has actually hit the server.

---

## The admin dashboard

Live at **`/admin`** on your site — for example `https://spendbox.site/admin`.
It is not linked from anywhere public, and search engines are told not to
index it.

**To turn it on**, add three variables in Vercel and redeploy:

| Variable | What it is |
| --- | --- |
| `ADMIN_EMAIL` | the email you sign in with |
| `ADMIN_PASSWORD` | the password you sign in with |
| `ADMIN_SESSION_SECRET` | a random string that keeps the login cookie honest |

Generate the secret by running `openssl rand -base64 32` in a terminal, or use
any password generator set to 32+ characters. It is not something you type — it
just has to be long and random.

To change who can sign in later, edit `ADMIN_EMAIL` / `ADMIN_PASSWORD` in Vercel
and redeploy. There is no user list to manage and no password-reset email to
build; everyone signed in is signed out the moment you change the secret.

**What you can do there:**

- **Overview** — open requests, how many are urgent, intake over the last
  fourteen days, most-requested categories, and which categories have *no*
  approved merchant (a request in one of those has nobody to send it to).
- **Requests** — search and filter by status, urgency or category. Open one to
  see everything the buyer submitted, move it through `new → sourcing → quoted
  → won / lost`, keep internal notes, and email or call the buyer.
- **Send to merchants** — on a request, the dashboard lists approved merchants
  who supply those categories *and* cover that location, you tick the ones you
  want, add an optional note, and it emails them all at once. They get the item,
  quantity, destination and deadline — **not** the buyer's name or contact
  details. Sending moves the request to `sourcing`.
- **Merchants** — every application, with search and filters, and a dropdown to
  move each between `pending → approved / rejected / paused`. Only *approved*
  merchants are ever offered as recipients.
- **Diagnostics** — what this deployment can see, and a live test email. The
  first place to look when mail goes quiet.

The dashboard reads from Supabase, so it needs Supabase configured. Without it
the pages explain what is missing rather than erroring.

---

## Categories being filled in automatically

As someone types their request, the site works out which categories it belongs
to and ticks them — they can still change the answer.

This runs on a **built-in keyword matcher**. It needs no key, costs nothing,
answers instantly, and it is what runs by default.

If you set `OPENAI_API_KEY`, a language-model pass runs on top of it and the
keyword matcher becomes the fallback. Anything the model returns is checked
against the real category list before it is used, and if the model is slow
(over 3.5 seconds), unreachable, or returns something unexpected, the keyword
answer is used instead. The person filling the form never sees an error either
way.

`OPENAI_MODEL` and `OPENAI_BASE_URL` let you pick the model and the provider —
any OpenAI-compatible endpoint works, so you are not locked to one company.

> **A note on the model name:** there is no OpenAI model called "5.6", so
> nothing is hardcoded to it. `OPENAI_MODEL` defaults to `gpt-4o-mini`; set it
> to whatever model your account actually has and it will be used as-is.

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
| The logo and favicon | `components/Logo.tsx`, `app/icon.svg` |
| Nigerian states and cities | `lib/geo.ts` |
| Countries and dialling codes | `lib/geo.ts` → `COUNTRIES` |
| Words that map to a category | `lib/classify.ts` → `KEYWORDS` |

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
  api/classify/route.ts suggests categories from what the buyer typed
  admin/             the dashboard (sign-in, overview, requests, merchants)
  api/admin/         sign in and out, change a status, email merchants

components/
  Shell.tsx        holds the "which form is open" state for the whole page
  CommandBar.tsx   the input field that never leaves the screen
  ScrollStage.tsx  the pinned hero where scrolling changes the background
  DockBar.tsx      the same bar, docked to the bottom further down the page
  OrderForm.tsx    the buyer's 4-step form
  VendorForm.tsx   the vendor's 5-step form
  Sheet.tsx        the pop-up panel both forms live in
  Field.tsx        text boxes, chips, choice cards, yes/no, word counter
  Combobox.tsx     the searchable dropdowns (country, state, city, coverage)
  PhoneField.tsx   phone number with its dialling code
  Logo.tsx         the S mark
  Sections.tsx     everything below the hero

lib/
  catalog.ts     categories, urgency levels, dropdown options
  geo.ts         countries, dialling codes, Nigerian states and cities
  schemas.ts     the rules for what counts as a valid submission
  classify.ts    works out the category from the request text
  email.ts       how the emails are laid out
  resend.ts      sending
  supabase.ts    saving
  admin-auth.ts  the dashboard login
  admin-data.ts  the dashboard's database queries
  ratelimit.ts   stops one person spamming the form
  useVisualViewport.ts  keeps forms above the phone keyboard

middleware.ts  blocks /admin for anyone not signed in

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
- **Nothing fails silently.** If a request cannot be emailed *and* cannot be
  stored, the sender is told so plainly instead of being shown a success
  screen — a request that exists nowhere must never look like it worked.
- **The bot trap flags, it does not bin.** It marks a suspicious submission
  `[?spam]` in the internal email and carries on. Dropping a real order to
  block a fake one is the wrong trade for this business.
- **Every animation is turned off** for visitors whose device is set to
  "reduce motion".
- **Forms are positioned against the phone's visual viewport**, not the page,
  so the on-screen keyboard never covers the field you are typing in or the
  button you are reaching for.
- **Each step reveals one question at a time**, so a step opens as a single
  thing to answer rather than a wall of inputs. A field never disappears once
  it has appeared.
- **Nigeria is seeded properly** — all 36 states and the FCT with their real
  cities. Any other country falls back to free text, so nobody is blocked by a
  list that is missing their town.
- **The dashboard login has no user table.** Credentials live in environment
  variables and the session is a signed cookie, so there is no account
  database to secure, back up or leak.
