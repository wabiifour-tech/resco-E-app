# RESCO eCard

Electronic report-card and academic result management system for **Redeemer's Schools and College, Owotoro** (Oyo State, Nigeria).

> *Excellence, Knowledge, and Wisdom.*

RESCO eCard digitizes the school's report-card process: teachers enter termly results (CA /30 + Examination /70), the system auto-calculates totals, grades, positions, and cumulative results across the three terms, the principal reviews/approves/locks results, and professional printable report cards are generated.

- **Two user roles only:** Principal (full admin) and Teacher (scoped to their assigned classes + subjects).
- **No student login.** Students exist only as academic records.
- **Flat class structure** (no arms): KG → Nursery 1–2 → Primary 1–6 → JSS 1–3 → SS 1–3.
- **Multi-class, multi-subject teacher assignments** with optional class-teacher responsibility.
- **Configurable subject library** + per-class subject offerings (NERDC baseline + school-specific).

---

## Tech stack

- **Next.js 16** (App Router) + **TypeScript 5**
- **Tailwind CSS 4** + **shadcn/ui** component library
- **Prisma ORM** + SQLite (local dev) / Turso libSQL (production)
- **TanStack Query** + **Zustand** + **sonner** toasts
- Custom JWT-cookie session auth (node:crypto HMAC + scrypt password hashing — no plaintext passwords, no forgot-password flow)

---

## Local development

```bash
bun install
cp .env.example .env           # local dev uses a file-based SQLite DB
bun run db:push                # create the schema
bun run db:seed                # seed the principal + curriculum (run with SEED_DEMO=1 for demo data)
bun run dev                    # http://localhost:3000
```

### Default seeded credentials

| Role | Email | Password |
|---|---|---|
| Principal | `principal@resco.edu.ng` | `Principal@2026` (override with `PRINCIPAL_PASSWORD`) |
| Teacher (JSS 1 — Mathematics) | `teacher@resco.edu.ng` | `Teacher@2026` (demo only, `SEED_DEMO=1`) |
| Teacher (Primary 2/3/5) | `adebayo@resco.edu.ng` | `Adebayo@2026` (demo only, `SEED_DEMO=1`) |

> For production, set `PRINCIPAL_PASSWORD` to a strong value before the first deploy so the seeded principal account doesn't use the default password.

---

## Deploy to Vercel

Vercel's serverless platform has **no persistent filesystem**, so the local SQLite file can't be used in production. The app is wired to use **Turso** (hosted libSQL/SQLite) — the Prisma schema stays `sqlite`, local dev keeps using the file, and production uses a `libsql://` URL via the Prisma libSQL driver adapter (`src/lib/prisma-client.ts`).

### Step 1 — Push to GitHub

```bash
# from the project root
git add -A
git commit -m "RESCO eCard — production-ready (Turso libSQL + Vercel config)"
# create an empty repo on github.com first (no README), then:
git remote add origin https://github.com/<your-user>/resco-ecard.git
git branch -M main
git push -u origin main
```

### Step 2 — Create a Turso database (free)

1. Sign up at <https://turso.tech> (free tier: 500 DBs, generous limits).
2. Install the Turso CLI: `curl -sSfL https://get.tur.so/install.sh | bash` (or use the web dashboard).
3. Create a DB:
   ```bash
   turso auth login
   turso db create resco-ecard
   turso db show resco-ecard --url        # → libsql://resco-ecard-<user>.tur.so
   turso db tokens create resco-ecard     # → <auth-token>
   ```

### Step 3 — Import to Vercel

1. Go to <https://vercel.com> → **Add New… → Project** → import your GitHub repo.
2. Vercel auto-detects Next.js + Bun. The `vercel.json` build command runs:
   `prisma generate && prisma db push --accept-data-loss && bun run db:seed && next build`
   — so on every deploy the schema is synced and the seed runs (it's guarded: it skips if the DB already has users, so the principal's runtime edits are never overwritten).
3. **Project → Settings → Environment Variables** — add:
   | Name | Value |
   |---|---|
   | `DATABASE_URL` | `libsql://resco-ecard-<user>.tur.so` |
   | `DATABASE_AUTH_TOKEN` | `<the Turso token from step 2>` |
   | `NEXTAUTH_SECRET` | a strong random string (run `bun -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`) |
   | `PRINCIPAL_PASSWORD` | a strong password for the seeded principal account |
   | `SEED_DEMO` | leave unset for a clean prod seed, or `1` to include demo teachers/student |
4. **Deploy.** The first build provisions the schema + seeds the principal + the 15-class curriculum + 42-subject library + ClassSubject defaults + grade boundaries + remarks + the 2026/2027 session/terms.
5. Visit the deployed URL and log in with the principal email + the `PRINCIPAL_PASSWORD` you set.

> After the first successful deploy, you can remove `PRINCIPAL_PASSWORD` from Vercel env vars (the seed won't re-run). Change the principal password via the UI thereafter.

---

## Key features

- **Authentication** — single login page for principal + teachers; secure hashed passwords (scrypt); JWT-cookie sessions; no student accounts.
- **Academic structure** — sessions, terms (First/Second/Third), flat classes (KG → SS 3), configurable subject library, per-class subject offerings.
- **Teacher assignments** — a teacher may teach many classes and many subjects per class, with independent subject selections per class and an optional class-teacher (form-tutor) responsibility. Backend-enforced: a teacher can only enter results for their assigned (class, subject) combos where the subject is offered.
- **Results** — CA /30 + Exam /70 = Total /100. Second term auto-carries the first-term total (teacher doesn't re-enter it); third term auto-carries first + second. Cumulative = (T1+T2)/2 and (T1+T2+T3)/3. Auto grade + tie-ranked position per class/subject/session/term.
- **Approval workflow** — Save → Submit → Principal reviews → Approve (locks) → Reopen. Audited.
- **Report cards** — professional, printable, PDF (print-to-PDF). Show the school logo, name, motto, address, student + class, subject results with CA/Exam/Total/Grade/Position/Cumulative, teacher's remark, principal signature area. 2nd term shows 1st + 2nd; 3rd term shows all three.
- **Audit log** — logins, result create/edit/submit/approve/unlock, teacher/student/class/subject/remark/grading/settings changes.
- **Mobile responsive** — works on Android/iPhone/tablet/desktop; result entry is practical on small screens.
- **School branding** — the principal configures the school logo, name, motto, address, principal name + signature in School Settings; the logo propagates app-wide (login, shell, report cards) via the public `/api/branding` endpoint.

---

## Scripts

| Script | Purpose |
|---|---|
| `bun run dev` | Start the dev server on port 3000 |
| `bun run lint` | ESLint |
| `bun run db:push` | Push the Prisma schema to the DB (idempotent) |
| `bun run db:generate` | Regenerate the Prisma client |
| `bun run db:seed` | Seed the principal + curriculum (guarded — skips if users exist; set `SEED_DEMO=1` for demo data) |
