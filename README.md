# Desti

A full-stack campus transport platform where verified Stetson University students can post rides, request future trips, and connect through intelligent matching, booking, and messaging workflows.

## Project Description

Desti is a campus ride-sharing web application built exclusively for verified Stetson University students. The platform connects drivers who have open seats with riders who need transportation, supporting the full lifecycle from posting through booking to in-app coordination.

### What Users Can Do

- **Drivers** post rides with origin, destination, departure windows, pricing, and seat availability
- **Riders** browse and book seats on available rides
- **Riders** post trip requests describing where and when they need to travel
- **Drivers** browse trip requests and send offers with pricing and seat details
- **Riders** accept or decline driver offers, which automatically create bookings
- **Both sides** communicate through in-app messaging tied to bookings and offers
- **Everyone** manages their activity from a central dashboard showing upcoming trips, pending offers, and confirmed bookings

### Key Features

- **Verified student authentication** — sign-in restricted to `@stetson.edu` email addresses via Clerk
- **User onboarding** — first-time users complete a profile (name, year, gender, age) before accessing the platform
- **Ride posting and browsing** — drivers post rides; riders search and filter by destination, date, price, distance, and seat count
- **Advanced ride filters** — modal-based filtering by date range, price range, distance category, and minimum available seats
- **Trip request posting and browsing** — riders post future travel needs; drivers browse and send offers
- **Booking and offer workflows** — idempotent creation, acceptance, cancellation with transactional consistency
- **Race-condition-safe offer handling** — cancel and accept operations use in-transaction guards to prevent concurrent state corruption
- **In-app conversations and messaging** — conversations anchored to bookings or offers with real-time message threads
- **Dashboard** — aggregated view of active rides, confirmed bookings, pending offers sent and received, with attention cards and quick actions
- **AI help assistant** — optional in-app chat widget powered by Google Gemini for user guidance

## Libraries, Packages, and Frameworks

### Core Application Stack

| Package | Version | Purpose |
|---|---|---|
| [Next.js](https://nextjs.org/) | `16.1.6` | React framework with App Router, API routes, and Turbopack |
| [React](https://react.dev/) | `19.2.3` | UI component library |
| [React DOM](https://react.dev/) | `19.2.3` | React renderer for the browser |
| [TypeScript](https://www.typescriptlang.org/) | `^5` | Static type checking |

### Authentication and Database

| Package | Version | Purpose |
|---|---|---|
| [@clerk/nextjs](https://clerk.com/docs/quickstarts/nextjs) | `^7.0.6` | Authentication and session management (restricted to `@stetson.edu` emails) |
| [Prisma ORM](https://www.prisma.io/) | `^6.19.2` | Database toolkit, migrations, and query builder |
| [@prisma/client](https://www.prisma.io/client) | `^6.19.2` | Auto-generated type-safe database client |
| [PostgreSQL](https://www.postgresql.org/) | `16` | Relational database (via Docker or local install) |

### AI Integration

| Package | Version | Purpose |
|---|---|---|
| [@google/genai](https://ai.google.dev/) | `^1.46.0` | Google Gemini API client for the AI help assistant |

### UI and Styling

| Package | Version | Purpose |
|---|---|---|
| [Tailwind CSS](https://tailwindcss.com/) | `^3.4.1` | Utility-first CSS framework |
| [PostCSS](https://postcss.org/) | `^8.5.8` | CSS transformation pipeline |
| [Autoprefixer](https://github.com/postcss/autoprefixer) | `^10.4.19` | Automatic vendor prefixing |
| [Framer Motion](https://www.framer.com/motion/) | `^12.35.0` | Animation library for React |
| [Lucide React](https://lucide.dev/) | `^0.577.0` | Icon library |
| [date-fns](https://date-fns.org/) | `^4.1.0` | Date utility functions |

### Tooling and Testing

| Package | Version | Purpose |
|---|---|---|
| [ESLint](https://eslint.org/) | `^9` | JavaScript/TypeScript linter |
| [eslint-config-next](https://nextjs.org/docs/app/api-reference/config/eslint) | `16.1.6` | Next.js ESLint configuration |
| [Vitest](https://vitest.dev/) | `^4.0.18` | Unit and integration test framework |
| [dotenv](https://github.com/motdotla/dotenv) | `^17.2.4` | Environment variable loading |
| @types/node | `^20` | Node.js type definitions |
| @types/react | `^19` | React type definitions |
| @types/react-dom | `^19` | React DOM type definitions |

### External Runtime Services

| Service | Required | Purpose |
|---|---|---|
| [Clerk](https://clerk.com/) | Yes | Authentication, session management, email verification |
| [PostgreSQL](https://www.postgresql.org/) | Yes | Persistent data storage for all application data |
| [Google Gemini](https://ai.google.dev/) | No | AI-powered in-app help assistant (gracefully degrades if unavailable) |

## Steps to Install or Recreate the Project on Another Machine

There are two supported ways to set up the project: **Docker** (recommended) or **local manual setup**.

### Option 1: Docker Setup (Recommended)

Docker handles the app runtime and PostgreSQL database in isolated containers, making setup consistent across machines.

#### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- A [Clerk](https://clerk.com/) account with a project configured for `@stetson.edu` emails

#### Steps

1. **Clone the repository:**

```bash
git clone https://github.com/Temitayo-bit/desti.git
cd desti
```

2. **Create your environment file:**

```bash
cp .env.example .env
```

3. **Edit `.env`** and set the following values:

```env
# Database — use this exact URL for Docker
DATABASE_URL="postgresql://postgres:postgres@db:5432/desti?schema=public"

# Clerk — get these from your Clerk dashboard
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_KEY
CLERK_SECRET_KEY=sk_test_YOUR_KEY

# Clerk redirect URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Optional — only needed for the AI chat assistant
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

4. **Start the stack:**

```bash
docker compose up --build
```

5. **Open the app** at [http://localhost:3000](http://localhost:3000).

On startup, the `web` container automatically runs all Prisma migrations and starts the Next.js development server.

#### What Docker Runs

| Container | Image | Purpose |
|---|---|---|
| `desti-web` | Built from `Dockerfile` (Node 20) | Next.js app with hot reload |
| `desti-db` | `postgres:16` | PostgreSQL database |

#### Useful Docker Commands

```bash
# Start in the background
docker compose up --build -d

# Stop everything
docker compose down

# Stop and remove the database volume (full reset)
docker compose down -v

# Run Prisma Studio inside the container
docker compose exec web npx prisma studio

# Run a new migration inside the container
docker compose exec web npx prisma migrate dev
```

---

### Option 2: Local Manual Setup (Without Docker)

Use this option if you prefer to run everything directly on your machine.

#### Prerequisites

- [Node.js](https://nodejs.org/) `20.9` or later
- npm (comes with Node.js)
- [PostgreSQL](https://www.postgresql.org/download/) `14` or later (16 recommended)
- A [Clerk](https://clerk.com/) account with a project configured for `@stetson.edu` emails

#### Steps

1. **Clone the repository:**

```bash
git clone https://github.com/Temitayo-bit/desti.git
cd desti
```

2. **Install dependencies:**

```bash
npm install
```

This also runs `prisma generate` automatically via the `postinstall` hook.

3. **Create your environment file:**

```bash
cp .env.example .env
```

4. **Edit `.env`** and configure your database and Clerk keys:

```env
# Database — point to your local PostgreSQL instance
DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:5432/desti?schema=public"

# Clerk keys
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_KEY
CLERK_SECRET_KEY=sk_test_YOUR_KEY

# Clerk redirect URLs
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up

# Optional — only needed for the AI chat assistant
GEMINI_API_KEY=YOUR_GEMINI_API_KEY
```

5. **Create the database** (if it does not already exist):

```bash
createdb desti
```

Or via `psql`:

```sql
CREATE DATABASE desti;
```

6. **Run database migrations:**

```bash
npx prisma migrate deploy
```

7. **Start the development server:**

```bash
npm run dev
```

8. **Open the app** at [http://localhost:3000](http://localhost:3000).

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Next.js development server with Turbopack |
| `npm run build` | Generate Prisma client and build the production app |
| `npm run start` | Run the production server (requires `npm run build` first) |
| `npm run lint` | Run ESLint across the codebase |
| `npm run test` | Run the Vitest test suite |

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Yes | Clerk publishable key (from Clerk dashboard) |
| `CLERK_SECRET_KEY` | Yes | Clerk secret key (from Clerk dashboard) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Yes | Sign-in route path (`/sign-in`) |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Yes | Sign-up route path (`/sign-up`) |
| `GEMINI_API_KEY` | No | Google Gemini API key for the AI assistant |
| `GEMINI_MODEL` | No | Override the default Gemini model (`gemini-2.5-flash`) |
