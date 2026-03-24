# Desti
A full-stack campus transport platform where verified students can post rides, request future trips, and connect through intelligent matching and booking workflows.

## Project Description

Desti is a campus transport web application built for verified Stetson University students. It lets drivers post rides, riders post trip requests, drivers send offers, riders book seats, and both sides coordinate through in-app messaging.

Core capabilities in the current codebase include:

- Verified student authentication using Clerk
- User onboarding for first-time users
- Ride posting and ride browsing
- Trip request posting and trip request browsing
- Booking and offer workflows
- In-app conversations and messaging
- Dashboard views for rides, bookings, offers, and trip requests
- Optional in-app AI help assistant

## Libraries, Packages, and Frameworks

The app currently uses the following primary libraries, packages, and frameworks.

### Core App Stack

- Next.js `16.1.6`
- React `19.2.3`
- React DOM `19.2.3`
- TypeScript `^5`

### Authentication and Database

- Clerk `^6.37.3` via `@clerk/nextjs`
- Prisma ORM `^6.19.2`
- Prisma Client `^6.19.2` via `@prisma/client`
- PostgreSQL as the database

### UI and Styling

- Tailwind CSS `^3.4.1`
- PostCSS `^8.5.8`
- Autoprefixer `^10.4.19`
- Framer Motion `^12.35.0`
- Lucide React `^0.577.0`
- date-fns `^4.1.0`

### Tooling and Testing

- ESLint `^9`
- eslint-config-next `16.1.6`
- Vitest `^4.0.18`
- dotenv `^17.2.4`
- `@types/node` `^20`
- `@types/react` `^19`
- `@types/react-dom` `^19`

### External Runtime Services

- Clerk for authentication
- PostgreSQL for persistent storage
- Gemini for the AI assistant backend
- Gemini API access for AI-powered in-app help

## Steps to Install or Recreate the Project on Another Machine

There are two supported ways to recreate the project: Docker or a local manual setup.

### Option 1: Docker Setup

This is the easiest way to run the project on another machine because Docker handles the app runtime and PostgreSQL database consistently.

## Docker Setup

This repo includes a local Docker development setup for the app and PostgreSQL database.

### Prerequisites

- Docker Desktop
- Clerk keys for authentication

### Environment Variables

Create `.env` from `.env.example`.

For Docker, use this database URL:

```env
DATABASE_URL="postgresql://postgres:postgres@db:5432/desti?schema=public"
```

You also need:

- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`
- `NEXT_PUBLIC_CLERK_SIGN_IN_URL`
- `NEXT_PUBLIC_CLERK_SIGN_UP_URL`

If you want the AI assistant feature to work, make sure your environment is configured for Gemini access.

### Start The Stack

From the project root:

```bash
docker compose up --build
```

The app will be available at `http://localhost:3000`.

### What Docker Runs

- `web`: the Next.js app
- `db`: PostgreSQL 16

On startup, the `web` container runs the committed Prisma migrations and then starts the development server.

### Useful Commands

Start in the background:

```bash
docker compose up --build -d
```

Stop everything:

```bash
docker compose down
```

Stop everything and remove the database volume:

```bash
docker compose down -v
```

Run Prisma commands inside the app container:

```bash
docker compose exec web npx prisma studio
docker compose exec web npx prisma migrate dev
```

### Option 2: Local Manual Setup Without Docker

Use this option if you want to run everything directly on your machine without containers.

#### Prerequisites

- Node.js `20.9+`
- npm
- PostgreSQL
- Clerk account and project keys

#### Steps

1. Clone the repository.
2. Enter the project directory:

```bash
cd desti
```

3. Install dependencies:

```bash
npm install
```

4. Create `.env` from `.env.example`.
5. Set a working PostgreSQL connection string in `DATABASE_URL`.
6. Add your Clerk keys.
7. Run Prisma migrations:

```bash
npx prisma migrate deploy
```

8. Start the development server:

```bash
npm run dev
```

9. Open the app at `http://localhost:3000`.

## Available Scripts

- `npm run dev` starts the Next.js development server
- `npm run build` generates Prisma client and builds the production app
- `npm run start` runs the production server
- `npm run lint` runs ESLint
- `npm run test` runs the Vitest test suite
