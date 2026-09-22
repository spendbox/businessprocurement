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
   paste it in, and press **Run**. This creates the tables — requests,
   merchant applications, invoices and your team.

   **If you already had a database before invoices, the archive or the team
   existed, run this same file again.** It is written to be safe on a database with
   data in it: it only adds what is missing, and touches nothing that is
   already there. Until you do, the Invoices page will tell you so and the
   rest of the dashboard carries on working.
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

## How a request gets filled in

The buyer writes **one message** — what they need, how many, where, budget,
how soon, in any order and in their own words. They can attach the actual
purchase order or spreadsheet rather than describe it.

As they type, the server reads the message and pulls out the structure:
category, quantity, budget band, state and city, and urgency. A live
checklist shows what has been picked up and what is still missing, so they
can see the gap and fill it in their own words instead of being marched
through fields.

After that it is four short steps — how soon, where it is going (prefilled
from what was read), and who is asking. Eight screens in total, most of them
one tap.

The reading runs on a local pass that needs no key: keyword matching for
category, regex for naira amounts and quantities, and the real Nigerian state
and city lists for place names. Setting `OPENAI_API_KEY` adds a model pass on
top and the local pass fills any blank it leaves. Everything read is shown on
the review screen and can be corrected there — and the raw message always
reaches the sourcing team intact, whatever the reading made of it.

Attachments ride along on the internal email, so the team opens the real
file. No storage bucket to configure.

**The limit is 5MB per file and 5MB per request, across at most five files.**
Every file is measured in the browser *before* it is read, so an oversized
one is refused the instant it is picked — with a sentence saying what is
wrong with it — rather than after a long upload that fails at the end. A
running bar shows how much of the 5MB is gone. The server checks the size of
the whole request from its header before reading a byte of it, and refuses
anything over the limit outright, so the same rule holds for anything that
did not come from our own form.

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

## Sign-in for businesses (built, switched off)

There is a working passwordless portal at `/portal` — a business enters the
email they used, gets a 30-minute link, and sees their requests and status.
It is **turned off**: those pages return 404 and nothing on the site links to
them.

To switch it on, set `NEXT_PUBLIC_PORTAL_ENABLED=true` in Vercel and redeploy.
It needs Supabase and Resend.

**If one email is both a buyer and a merchant**, it is one sign-in and one
page showing both: their requests underneath their merchant application.
There are no separate buyer and merchant accounts — the email is the
identity, and whatever is filed under it is what they see.

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
and redeploy. Everyone signed in is signed out the moment you change the secret.

That account is **yours** and always an admin. Everybody else you add on the
**Team** page, with their own email and password — see *Your team, and the
two roles* below.

**What you can do there:**

- **Overview** — open requests, how many are urgent, intake over the last
  fourteen days, most-requested categories, and which categories have *no*
  approved merchant (a request in one of those has nobody to send it to).
- **Requests** — search and filter by status, urgency or category, across three
  views: the **working list** (the default), the **archive**, and everything at
  once. Open one to see what the buyer submitted, move it through
  `new → sourcing → quoted → won / lost`, keep internal notes, and email or
  call the buyer.
- **Cancelling archives it.** Setting a request to `cancelled` files it away:
  it leaves the working list and appears under *Archive*, still fully
  readable. Putting it back on any other status brings it straight back. The
  overview links to the archive whenever anything is in it. Nothing is ever
  deleted.
- **Send to merchants** — on a request, every approved merchant is scored
  against it and the best matches are listed first, pre-ticked. Each one shows
  *why*: green chips for what fits ("Supplies 2 of 2 categories", "Covers
  Lagos", "Fast enough for an urgent order") and red ones for what does not
  ("Does not cover Lagos"). Score comes from category overlap, whether they
  reach that location, speed weighed against how urgent the request is, own
  logistics and years trading.

  **Add other merchants** opens the rest of the approved list, searchable, so
  you can include someone the scoring would not have picked — a supplier who
  will travel for a big enough order, or one you are trying out. Tick as many
  as you like and one click emails them all. They get the item, quantity,
  destination and deadline — **not** the buyer's name or contact details.
  Sending moves the request to `sourcing`.
- **Merchants** — every application, with search and filters, and a dropdown to
  move each between `pending → approved / rejected / paused`. Only *approved*
  merchants are ever offered as recipients.
- **Add a merchant by hand.** For the supplier you already know, or one who
  gave you their details on the phone: **Merchants → Add a merchant**. It asks
  for what matching actually needs — who they are, what they supply, where they
  deliver — and lets the rest (RC number, capacity, website) wait. They are
  approved from the start unless you say otherwise, marked *added by hand* in
  the list, and can be emailed to say they are set up if you tick the box.
- **Approving one emails them.** The moment a merchant is set to `approved`
  they get a letter telling them they are on, what we have on file for them,
  and how quoting works. It goes out once, on the move *into* approved, so
  nobody is emailed twice. If Resend is not configured, or the send fails, the
  dashboard says so next to the dropdown instead of pretending.
- **Deleting a merchant** removes the application for good — for duplicates,
  test rows, or a company that asked to come off. It takes two clicks: the
  button turns into a plain question naming the company first, because there
  is no undo.
- **Invoices** — raise an invoice from a request (it carries the request
  reference and prefills the buyer) or on its own from the Invoices page. Add
  lines, a VAT rate and a delivery charge, and the total updates as you type.
  Then either **email it to the business** — the invoice is in the body and
  attached as a document — or **download it**. Opening one shows a *Print or
  save as PDF* button, which is how you get a PDF on any machine. Each invoice
  moves through `draft → sent → paid / void`, and the page totals up what is
  still outstanding.
- **Team** — the people who work with you, what each may do, and who looks
  after which merchant.
- **Diagnostics** — what this deployment can see, and a live test email. The
  first place to look when mail goes quiet.

The dashboard reads from Supabase, so it needs Supabase configured. Without it
the pages explain what is missing rather than erroring.

---

## Your team, and the two roles

Everything here is on the **Team** page in the dashboard.

**Adding someone.** Name, email, role, and — if they need to sign in — a
password of at least ten characters. Give them the password there and then:
it is hashed the moment it is saved and can never be read back, only replaced.
They then sign in at `/admin/login` with their own email.

Someone **without** a password is still worth adding. They are a name you can
hand merchants to, which is the point of the next part.

**The two roles:**

| | Admin | Coordinator |
|---|---|---|
| Requests, and sending them to merchants | yes | **yes** |
| The overview, the charts, the numbers | yes | no |
| Merchants, adding and approving them | yes | no |
| Invoices and totals | yes | no |
| The team, and diagnostics | yes | no |

A **coordinator** is the sub-admin: they work the orders and get them out to
merchants for quoting, and they see no figures about the business at all. This
is not a matter of hidden links. The middleware turns their request away before
the page runs, every page checks again, and every route that could change or
reveal something refuses them — so typing the address in by hand gets them
nothing but their own request list.

**Who looks after which merchant.** Every merchant row has a *Looked after by*
dropdown; pick a team member and it saves straight away. The Team page shows
how many merchants each person carries. Removing someone leaves their
merchants in place and simply unassigns them.

**Switching someone off** keeps the person and their history but refuses their
sign-in, which is what you want when somebody leaves or goes on leave.
*Take away their sign-in* does the same to the password alone. You cannot
delete the account you are currently signed in with.

**If you get locked out**, your own `ADMIN_EMAIL` / `ADMIN_PASSWORD` in Vercel
is checked before this table and is not affected by anything on the Team page.

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
  admin/             the dashboard (sign-in, overview, requests, merchants,
                     invoices, team)
  api/admin/         sign in and out, change a status, email merchants,
                     add and delete merchants, raise and send invoices,
                     manage the team

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
  roles.ts       the two roles and what each may open
  team.ts        your team, their passwords and who owns which merchant
  admin-guard.ts one place that answers "may this person do that?"
  invoices.ts    invoice maths, validation and the printable document
  attachments.ts what may be attached, and how big it may be
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
- **Forms ask one question per screen.** Cramming a step full of fields and
  revealing them as you go made a phone feel crowded; a single question with
  a progress count is faster to answer and much easier to read.
- **Dropdowns are rendered outside the form**, into the page body and
  positioned against the visual viewport, so a long list is never clipped by
  the panel it sits in and never ends up behind the keyboard.
- **Portal sessions carry nothing but a verified email**, and every query is
  scoped to it, so there is no id to tamper with to see someone else's rows.
