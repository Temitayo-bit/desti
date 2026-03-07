import Link from "next/link";
import { currentUser } from "@clerk/nextjs/server";
import {
    Check,
    CircleHelp,
    Clock3,
    DollarSign,
    Handshake,
    Lock,
    MapPin,
    MessageCircle,
    PhoneOff,
    Plane,
    Search,
    Shield,
    Users,
    CarFront,
} from "lucide-react";
import { redirect } from "next/navigation";
import { evaluateFrontendAccess } from "@/lib/frontend-auth";
import { prisma } from "@/lib/prisma";
import { DestiLogo } from "@/components/DestiLogo";

const featureCards = [
    {
        title: "Verified students only",
        description:
            "Every user must sign in with a Stetson email. No random strangers.",
        icon: Shield,
    },
    {
        title: "Easy ride posting",
        description:
            "Drivers can post rides in seconds and fill empty seats with students going the same way.",
        icon: CarFront,
    },
    {
        title: "Flexible ride requests",
        description:
            "Need a ride? Post a request and drivers can send you offers.",
        icon: MapPin,
    },
    {
        title: "Built-in messaging",
        description:
            "Coordinate pickup times and locations directly inside the app.",
        icon: MessageCircle,
    },
    {
        title: "Simple offers",
        description:
            "Drivers can respond to trip requests with a price and seat availability.",
        icon: Handshake,
    },
    {
        title: "Student-friendly pricing",
        description: "Share gas costs and keep travel affordable.",
        icon: DollarSign,
    },
];

const howItWorksSteps = [
    {
        step: "1",
        title: "Create or browse rides",
        description:
            "Search for rides posted by other students or post your own ride.",
        icon: Search,
    },
    {
        step: "2",
        title: "Book or send an offer",
        description:
            "Reserve your seat or respond to a trip request with a ride offer.",
        icon: Plane,
    },
    {
        step: "3",
        title: "Meet and ride",
        description:
            "Coordinate details through messaging and travel together.",
        icon: Users,
    },
];

const safetyPoints = [
    {
        title: "Verified Stetson accounts only",
        description:
            "Only students with verified @stetson.edu emails can join.",
        icon: Shield,
    },
    {
        title: "Private conversations between riders and drivers",
        description: "All messaging happens securely within the app.",
        icon: Lock,
    },
    {
        title: "No public phone numbers",
        description: "Your personal information stays private.",
        icon: PhoneOff,
    },
    {
        title: "Clear ride confirmations",
        description: "Know exactly who you're riding with before you go.",
        icon: Check,
    },
];

const testimonials = [
    {
        quote:
            '"Desti made getting to Orlando Airport so much easier. I found a ride in minutes."',
        name: "Sarah",
        role: "Junior",
        initial: "S",
    },
    {
        quote: '"I saved money on gas by filling the extra seats in my car."',
        name: "David",
        role: "Senior",
        initial: "D",
    },
    {
        quote: `"It's way safer than posting rides in random group chats."`,
        name: "Emily",
        role: "Sophomore",
        initial: "E",
    },
];

const faqItems = [
    {
        question: "Who can use Desti?",
        answer:
            "Desti is limited to students with a verified @stetson.edu email address.",
    },
    {
        question: "How do payments work?",
        answer:
            "Drivers set a simple per-seat contribution so riders can split gas costs clearly before the trip.",
    },
    {
        question: "Can I request a ride instead of posting one?",
        answer:
            "Yes. Riders can post trip requests and drivers can respond with offers that include seats and pricing.",
    },
    {
        question: "How do riders and drivers coordinate?",
        answer:
            "Every booking and accepted offer includes in-app messaging so you can confirm pickup details privately.",
    },
];

const heroRideCards = [
    {
        destination: "Orlando Airport",
        date: "March 8, 2:00 PM",
        seats: "2 seats left",
        duration: "1h 15min",
        price: "$15",
    },
    {
        destination: "Daytona Beach",
        date: "March 9, 11:00 AM",
        seats: "3 seats left",
        duration: "25min",
        price: "$8",
    },
    {
        destination: "Winter Park",
        date: "March 10, 4:30 PM",
        seats: "1 seat left",
        duration: "45min",
        price: "$12",
    },
];

async function resolveRootState() {
    const user = await currentUser();

    if (!user) {
        return;
    }

    const access = evaluateFrontendAccess(user);
    if (!access.allowed) {
        const query = new URLSearchParams({ reason: access.reason });
        redirect(`/access-restricted?${query.toString()}`);
    }

    const localUser = await prisma.user.findUnique({
        where: { clerkUserId: user.id },
        select: { onboardingComplete: true },
    });

    if (localUser?.onboardingComplete === true) {
        redirect("/dashboard");
    }

    redirect("/onboarding");
}

function NavLink({ href, label }: { href: string; label: string }) {
    return (
        <a
            href={href}
            className="text-base font-semibold text-slate-600 transition-colors hover:text-slate-900"
        >
            {label}
        </a>
    );
}

function SectionHeading({
    eyebrow,
    title,
    description,
}: {
    eyebrow?: string;
    title: string;
    description?: string;
}) {
    return (
        <div className="mx-auto max-w-4xl text-center">
            {eyebrow ? (
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-700">
                    {eyebrow}
                </p>
            ) : null}
            <h2 className="mt-3 text-4xl font-bold tracking-tight text-slate-950 md:text-6xl">
                {title}
            </h2>
            {description ? (
                <p className="mt-5 text-lg leading-8 text-slate-600 md:text-xl">
                    {description}
                </p>
            ) : null}
        </div>
    );
}

export default async function HomePage() {
    await resolveRootState();

    return (
        <main className="min-h-screen bg-[#f7f7f5] text-slate-950">
            <header className="sticky top-0 z-30 border-b border-zinc-200 bg-[#f7f7f5]/95 backdrop-blur">
                <div className="mx-auto flex max-w-[1220px] items-center justify-between gap-6 px-6 py-6 lg:px-10">
                    <Link href="/" className="shrink-0">
                        <DestiLogo size="md" />
                    </Link>

                    <nav className="hidden items-center gap-14 lg:flex">
                        <NavLink href="#how-it-works" label="How it Works" />
                        <NavLink href="#safety" label="Safety" />
                        <NavLink href="#faq" label="FAQ" />
                    </nav>

                    <div className="hidden items-center gap-6 lg:flex">
                        <Link
                            href="/sign-in"
                            className="text-base font-semibold text-slate-700 transition-colors hover:text-slate-950"
                        >
                            Log In
                        </Link>
                        <Link
                            href="/sign-up"
                            className="inline-flex items-center rounded-full bg-emerald-700 px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-emerald-800"
                        >
                            Get Started
                        </Link>
                    </div>

                    <div className="flex items-center gap-3 lg:hidden">
                        <Link
                            href="/sign-in"
                            className="text-sm font-semibold text-slate-700"
                        >
                            Log In
                        </Link>
                        <Link
                            href="/sign-up"
                            className="inline-flex items-center rounded-full bg-emerald-700 px-5 py-3 text-sm font-semibold text-white"
                        >
                            Get Started
                        </Link>
                    </div>
                </div>

                <div className="border-t border-zinc-200 lg:hidden">
                    <div className="mx-auto flex max-w-[1220px] items-center justify-between gap-4 overflow-x-auto px-6 py-4 text-sm font-semibold text-slate-600">
                        <NavLink href="#how-it-works" label="How it Works" />
                        <NavLink href="#safety" label="Safety" />
                        <NavLink href="#faq" label="FAQ" />
                    </div>
                </div>
            </header>

            <section className="border-b border-zinc-200">
                <div className="mx-auto grid max-w-[1220px] gap-16 px-6 py-16 lg:grid-cols-[1.05fr_0.95fr] lg:px-10 lg:py-24">
                    <div className="max-w-3xl">
                        <h1 className="max-w-4xl text-6xl font-bold tracking-[-0.05em] text-slate-950 md:text-7xl lg:text-[6.5rem] lg:leading-[0.98]">
                            Share rides with verified Stetson students.
                        </h1>
                        <p className="mt-10 max-w-2xl text-xl leading-[1.65] text-slate-600 md:text-[2rem] md:leading-[1.55]">
                            Desti helps Stetson students find safe, affordable rides to
                            airports, beaches, and nearby cities. Post a ride or
                            request one in seconds.
                        </p>

                        <div className="mt-12 flex flex-col gap-4 sm:flex-row">
                            <Link
                                href="/sign-up"
                                className="inline-flex min-w-[220px] items-center justify-center rounded-full bg-emerald-700 px-8 py-5 text-xl font-semibold text-white transition-colors hover:bg-emerald-800"
                            >
                                Find a Ride
                            </Link>
                            <Link
                                href="/sign-in"
                                className="inline-flex min-w-[220px] items-center justify-center rounded-full border-2 border-emerald-700 px-8 py-5 text-xl font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
                            >
                                Post a Ride
                            </Link>
                        </div>

                        <div className="mt-12 flex items-center gap-4 text-xl text-slate-600">
                            <Check className="h-8 w-8 text-emerald-700" strokeWidth={2.5} />
                            <span>Only verified @stetson.edu students</span>
                        </div>
                    </div>

                    <div className="space-y-7 lg:pt-10">
                        {heroRideCards.map((ride) => (
                            <article
                                key={ride.destination}
                                className="rounded-[2rem] border border-zinc-200 bg-white px-7 py-8 shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
                            >
                                <div className="flex items-start justify-between gap-6">
                                    <div>
                                        <h2 className="text-3xl font-bold tracking-tight text-slate-950">
                                            {ride.destination}
                                        </h2>
                                        <p className="mt-2 text-2xl text-slate-500">
                                            {ride.date}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-4xl font-bold text-emerald-700">
                                            {ride.price}
                                        </p>
                                        <p className="mt-2 text-xl text-slate-500">
                                            per person
                                        </p>
                                    </div>
                                </div>

                                <div className="mt-10 flex flex-wrap items-center gap-8 text-xl text-slate-600">
                                    <span className="inline-flex items-center gap-3">
                                        <Users className="h-6 w-6" />
                                        {ride.seats}
                                    </span>
                                    <span className="inline-flex items-center gap-3">
                                        <Clock3 className="h-6 w-6" />
                                        {ride.duration}
                                    </span>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className="px-6 py-20 lg:px-10 lg:py-28">
                <div className="mx-auto max-w-[1220px]">
                    <SectionHeading title="Everything you need to coordinate rides" />

                    <div className="mt-16 grid gap-8 md:grid-cols-2 xl:grid-cols-3">
                        {featureCards.map(({ title, description, icon: Icon }) => (
                            <article
                                key={title}
                                className="rounded-[2rem] border border-zinc-200 bg-white p-10 shadow-[0_14px_30px_rgba(15,23,42,0.05)]"
                            >
                                <div className="flex h-24 w-24 items-center justify-center rounded-[1.75rem] bg-emerald-50 text-emerald-700">
                                    <Icon className="h-11 w-11" strokeWidth={2} />
                                </div>
                                <h3 className="mt-10 text-3xl font-bold tracking-tight text-slate-950">
                                    {title}
                                </h3>
                                <p className="mt-6 text-2xl leading-[1.6] text-slate-600">
                                    {description}
                                </p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section
                id="how-it-works"
                className="border-y border-zinc-200 px-6 py-20 lg:px-10 lg:py-28"
            >
                <div className="mx-auto max-w-[1220px]">
                    <SectionHeading title="How Desti Works" />

                    <div className="mt-20 grid gap-12 lg:grid-cols-3">
                        {howItWorksSteps.map(({ step, title, description, icon: Icon }) => (
                            <article key={step} className="text-center">
                                <div className="mx-auto flex max-w-[21rem] items-start justify-between">
                                    <div className="flex h-28 w-28 items-center justify-center rounded-full bg-emerald-700 text-white shadow-[0_20px_50px_rgba(4,120,87,0.25)]">
                                        <Icon className="h-12 w-12" strokeWidth={2.2} />
                                    </div>
                                    <div className="flex h-16 w-16 items-center justify-center rounded-full border-[6px] border-emerald-700 bg-white text-2xl font-bold text-emerald-700">
                                        {step}
                                    </div>
                                </div>
                                <h3 className="mt-10 text-4xl font-bold tracking-tight text-slate-950">
                                    {title}
                                </h3>
                                <p className="mx-auto mt-6 max-w-md text-2xl leading-[1.55] text-slate-600">
                                    {description}
                                </p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section
                id="safety"
                className="border-y border-zinc-200 px-6 py-20 lg:px-10 lg:py-28"
            >
                <div className="mx-auto grid max-w-[1220px] gap-14 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
                    <div>
                        <SectionHeading
                            eyebrow="Designed for student safety"
                            title="Trust the people you're riding with"
                            description="Private messaging, verified accounts, and clear confirmations keep ride coordination simple and secure."
                        />

                        <div className="mt-14 space-y-8">
                            {safetyPoints.map(({ title, description, icon: Icon }) => (
                                <div key={title} className="flex gap-6">
                                    <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[1.4rem] bg-emerald-50 text-emerald-700">
                                        <Icon className="h-9 w-9" strokeWidth={2.2} />
                                    </div>
                                    <div>
                                        <h3 className="text-3xl font-bold tracking-tight text-slate-950">
                                            {title}
                                        </h3>
                                        <p className="mt-3 text-2xl leading-[1.5] text-slate-600">
                                            {description}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-[2.75rem] bg-emerald-700 p-8 shadow-[0_24px_60px_rgba(4,120,87,0.28)] md:p-12">
                        <div className="rounded-[2.25rem] bg-white p-7 shadow-[0_24px_40px_rgba(15,23,42,0.12)] md:p-10">
                            <div className="flex items-center gap-5">
                                <div className="h-20 w-20 rounded-full bg-zinc-200" />
                                <div>
                                    <h3 className="text-3xl font-bold tracking-tight text-slate-950">
                                        Sarah Martinez
                                    </h3>
                                    <p className="mt-2 text-2xl text-slate-500">
                                        @stetson.edu verified
                                    </p>
                                </div>
                            </div>

                            <div className="mt-8 border-t border-zinc-200 pt-8">
                                <div className="max-w-[78%] rounded-[1.7rem] bg-zinc-100 px-6 py-5 text-2xl text-slate-800">
                                    <p>Hey! What time works for pickup?</p>
                                    <p className="mt-2 text-xl text-slate-500">10:23 AM</p>
                                </div>
                                <div className="ml-auto mt-7 max-w-[78%] rounded-[1.7rem] bg-emerald-700 px-6 py-5 text-2xl text-white">
                                    <p>How about 2:00 PM at the main entrance?</p>
                                    <p className="mt-2 text-xl text-emerald-100">10:24 AM</p>
                                </div>
                                <div className="mt-7 max-w-[78%] rounded-[1.7rem] bg-zinc-100 px-6 py-5 text-2xl text-slate-800">
                                    <p>Perfect! See you then.</p>
                                    <p className="mt-2 text-xl text-slate-500">10:25 AM</p>
                                </div>
                            </div>

                            <div className="mt-8 border-t border-zinc-200 pt-8">
                                <div className="flex items-center justify-between gap-6 rounded-[1.6rem] bg-emerald-50 px-6 py-5">
                                    <div>
                                        <p className="text-2xl font-bold text-slate-950">
                                            Ride Confirmed
                                        </p>
                                        <p className="mt-2 text-xl text-slate-500">
                                            Orlando Airport • March 8, 2:00 PM
                                        </p>
                                    </div>
                                    <Check className="h-12 w-12 text-emerald-700" strokeWidth={2.4} />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="px-6 py-20 lg:px-10 lg:py-28">
                <div className="mx-auto max-w-[1220px]">
                    <SectionHeading title="What students are saying" />

                    <div className="mt-16 grid gap-8 lg:grid-cols-3">
                        {testimonials.map((testimonial) => (
                            <article
                                key={testimonial.name}
                                className="rounded-[2rem] border border-zinc-200 bg-white p-10 shadow-[0_14px_30px_rgba(15,23,42,0.05)]"
                            >
                                <p className="text-[6rem] font-bold leading-none text-emerald-100">
                                    &ldquo;
                                </p>
                                <p className="-mt-4 text-[2.2rem] leading-[1.55] text-slate-700">
                                    {testimonial.quote}
                                </p>
                                <div className="mt-10 flex items-center gap-5">
                                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50 text-3xl font-bold text-emerald-700">
                                        {testimonial.initial}
                                    </div>
                                    <div>
                                        <p className="text-3xl font-bold tracking-tight text-slate-950">
                                            {testimonial.name}
                                        </p>
                                        <p className="mt-2 text-2xl text-slate-500">
                                            {testimonial.role}
                                        </p>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section
                id="faq"
                className="border-y border-zinc-200 px-6 py-20 lg:px-10 lg:py-28"
            >
                <div className="mx-auto max-w-[1220px]">
                    <SectionHeading
                        title="Frequently asked questions"
                        description="Everything students usually want to know before sharing a ride."
                    />

                    <div className="mt-16 grid gap-8 lg:grid-cols-2">
                        {faqItems.map((item) => (
                            <article
                                key={item.question}
                                className="rounded-[2rem] border border-zinc-200 bg-white p-10 shadow-[0_14px_30px_rgba(15,23,42,0.05)]"
                            >
                                <div className="flex items-start gap-5">
                                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                                        <CircleHelp className="h-7 w-7" strokeWidth={2.2} />
                                    </div>
                                    <div>
                                        <h3 className="text-3xl font-bold tracking-tight text-slate-950">
                                            {item.question}
                                        </h3>
                                        <p className="mt-4 text-2xl leading-[1.55] text-slate-600">
                                            {item.answer}
                                        </p>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            <section className="px-6 py-20 lg:px-10 lg:py-24">
                <div className="mx-auto max-w-[1220px] rounded-[3rem] bg-emerald-700 px-8 py-16 text-center text-white shadow-[0_24px_70px_rgba(4,120,87,0.28)] md:px-14 md:py-20">
                    <h2 className="text-5xl font-bold tracking-tight md:text-7xl">
                        Ready to share your next ride?
                    </h2>
                    <p className="mx-auto mt-6 max-w-4xl text-2xl leading-[1.55] text-emerald-50 md:text-3xl">
                        Join verified Stetson students already sharing rides.
                    </p>
                    <div className="mt-12 flex flex-col items-center justify-center gap-4 sm:flex-row">
                        <Link
                            href="/sign-up"
                            className="inline-flex min-w-[260px] items-center justify-center rounded-full bg-white px-10 py-5 text-2xl font-semibold text-emerald-700 transition-colors hover:bg-emerald-50"
                        >
                            Browse Rides
                        </Link>
                        <Link
                            href="/sign-in"
                            className="inline-flex min-w-[260px] items-center justify-center rounded-full border-2 border-white px-10 py-5 text-2xl font-semibold text-white transition-colors hover:bg-white/10"
                        >
                            Post a Ride
                        </Link>
                    </div>
                </div>
            </section>

            <footer className="border-t border-zinc-200 px-6 py-16 lg:px-10">
                <div className="mx-auto grid max-w-[1220px] gap-12 lg:grid-cols-[1.3fr_1fr_1fr]">
                    <div>
                        <Link href="/" className="inline-flex">
                            <DestiLogo size="lg" />
                        </Link>
                        <p className="mt-8 max-w-md text-2xl leading-[1.55] text-slate-600">
                            Built for the Stetson University community.
                        </p>
                    </div>

                    <div>
                        <h3 className="text-2xl font-bold text-slate-950">Product</h3>
                        <div className="mt-6 space-y-4 text-2xl text-slate-600">
                            <div>
                                <a href="#how-it-works" className="hover:text-slate-950">
                                    How it Works
                                </a>
                            </div>
                            <div>
                                <a href="#safety" className="hover:text-slate-950">
                                    Safety
                                </a>
                            </div>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-2xl font-bold text-slate-950">Support</h3>
                        <div className="mt-6 space-y-4 text-2xl text-slate-600">
                            <div>
                                <a href="#faq" className="hover:text-slate-950">
                                    FAQ
                                </a>
                            </div>
                            <div>
                                <a href="mailto:support@desti.app" className="hover:text-slate-950">
                                    Contact
                                </a>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mx-auto mt-16 max-w-[1220px] border-t border-zinc-200 pt-10 text-center text-xl text-slate-500">
                    © 2026 Desti. All rights reserved.
                </div>
            </footer>
        </main>
    );
}
