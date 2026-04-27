import Link from "next/link";
import Image from "next/image";
import "./landing.css";
import { currentUser } from "@clerk/nextjs/server";
import {
    ArrowRight,
    CheckCircle2,
    ShieldCheck,
    Leaf,
    MapPin,
    Globe,
} from "lucide-react";
import { redirect } from "next/navigation";
import { evaluateFrontendAccess } from "@/lib/frontend-auth";
import { prisma } from "@/lib/prisma";

const featureCards = [
    {
        title: "Verified Students",
        description:
            "Every user is verified with their official Stetson email address. No strangers, just fellow Hatters you can trust.",
        icon: CheckCircle2,
        color: "bg-emerald-500",
    },
    {
        title: "Safe & Secure",
        description:
            "In-app messaging and rigorous driver verification protocols keep your personal info private until you're ready to ride.",
        icon: ShieldCheck,
        color: "bg-blue-500",
    },
    {
        title: "Sustainable Savings",
        description:
            "Split gas costs effortlessly while reducing Stetson's carbon footprint. Good for your wallet, better for the planet.",
        icon: Leaf,
        color: "bg-pink-500",
    },
];

const howItWorksSteps = [
    {
        step: "1",
        title: "Search for a ride",
        description:
            "Enter your destination and find Hatters heading your way — from Stetson to the beach or back home.",
    },
    {
        step: "2",
        title: "Connect with a Hatter",
        description:
            "Check driver profiles, ratings, and shared interests. Use our secure chat to find up pick-up details.",
    },
    {
        step: "3",
        title: "Share the Journey",
        description:
            "Meet at a safe campus location, enjoy the ride, and handle payments seamlessly through the platform.",
    },
];

const testimonials = [
    {
        quote:
            "Destination changed my weekend trips home. I feel safe knowing I'm with other students and I save so much on gas money!",
        name: "Jalen Jenkins",
        role: "Stetson '26 • Political Science",
        avatar: "J",
    },
    {
        quote:
            "As a driver, it's great to have company on long drives to South Florida. The app makes it so easy to split costs and find reliable passengers.",
        name: "Marcus Rivera",
        role: "Stetson '25 • Business Admin",
        avatar: "M",
    },
];

function stripSurroundingQuotes(value: string): string {
    return value.replace(/^[\s"""]+/, "").replace(/[\s"""]+$/, "");
}

async function resolveRootState(showLanding: boolean) {
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

    // When the user explicitly clicks "Home", let them see the landing page
    if (showLanding && localUser?.onboardingComplete === true) {
        return;
    }

    if (localUser?.onboardingComplete === true) {
        redirect("/dashboard");
    }

    redirect("/onboarding");
}

function NavLink({ href, label }: { href: string; label: string }) {
    return (
        <a
            href={href}
            className="nav-link"
        >
            {label}
        </a>
    );
}

export default async function HomePage({
    searchParams,
}: {
    searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
    const params = await searchParams;
    const showLanding = params.home !== undefined;
    await resolveRootState(showLanding);

    return (
        <main className="landing-page">
            {/* ──────────────────── HEADER ──────────────────── */}
            <header className="landing-header">
                <div className="landing-header__inner">
                    <Link href="/" className="landing-logo">
                        <span className="landing-logo__text">Destination</span>
                    </Link>

                    <nav className="landing-nav">
                        <NavLink href="#features" label="Features" />
                        <NavLink href="#how-it-works" label="How it Works" />
                        <NavLink href="#safety" label="Safety" />
                    </nav>

                    <div className="landing-header__actions">
                        <Link href="/sign-in" className="landing-header__login">
                            Login
                        </Link>
                        <Link href="/sign-up" className="landing-header__signup">
                            Sign Up
                        </Link>
                        <button className="landing-header__settings" aria-label="Settings">
                            <Globe className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Mobile hamburger */}
                    <div className="landing-header__mobile">
                        <Link href="/sign-in" className="landing-header__login">
                            Login
                        </Link>
                        <Link href="/sign-up" className="landing-header__signup landing-header__signup--sm">
                            Sign Up
                        </Link>
                    </div>
                </div>
            </header>

            {/* ──────────────────── HERO ──────────────────── */}
            <section className="hero">
                <div className="hero__inner">
                    <div className="hero__content">
                        <span className="hero__badge">
                            <span className="hero__badge-dot" />
                            EXCLUSIVE TO STETSON STUDENTS
                        </span>
                        <h1 className="hero__title">
                            Your Journey,<br />
                            <span className="hero__title--italic">Reimagined.</span>
                        </h1>
                        <p className="hero__description">
                            The safest, most reliable way for Stetson students to share
                            rides, save money, and build community. Connect with
                            fellow Hatters today.
                        </p>

                        <div className="hero__buttons">
                            <Link href="/sign-up" className="btn btn--primary btn--lg">
                                Get Started
                                <ArrowRight className="h-5 w-5" />
                            </Link>
                            <Link href="#how-it-works" className="btn btn--outline btn--lg">
                                View Routes
                            </Link>
                        </div>

                        <div className="hero__trust">
                            <div className="hero__avatars">
                                <div className="hero__avatar hero__avatar--1">J</div>
                                <div className="hero__avatar hero__avatar--2">S</div>
                                <div className="hero__avatar hero__avatar--3">M</div>
                                <div className="hero__avatar hero__avatar--4">A</div>
                            </div>
                            <span className="hero__trust-text">
                                Trusted by <strong>300+</strong> Stetson Students
                            </span>
                        </div>
                    </div>

                    <div className="hero__visual">
                        <div className="hero__image-wrapper">
                            <Image
                                src="/hero-students.png"
                                alt="Stetson students walking on campus"
                                width={560}
                                height={560}
                                className="hero__image"
                                priority
                            />
                            {/* Floating ride card */}
                            <div className="hero__ride-card">
                                <div className="hero__ride-card-header">
                                    <MapPin className="h-4 w-4 text-emerald-600" />
                                    <span className="hero__ride-card-label">NEXT RIDE TO ORLANDO</span>
                                </div>
                                <p className="hero__ride-card-time">Today, 4:30 PM | 2 Seats Left</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ──────────────────── FEATURES ──────────────────── */}
            <section id="features" className="features">
                <div className="features__inner">
                    <div className="features__header">
                        <h2 className="features__title">Built Specifically for the Hatter Way</h2>
                        <p className="features__subtitle">
                            Experience the most thoughtful carpooling platform designed by students, for students.
                        </p>
                    </div>

                    <div className="features__grid">
                        {featureCards.map(({ title, description, icon: Icon, color }) => (
                            <article key={title} className="feature-card">
                                <div className={`feature-card__icon ${color}`}>
                                    <Icon className="h-5 w-5 text-white" strokeWidth={2.2} />
                                </div>
                                <h3 className="feature-card__title">{title}</h3>
                                <p className="feature-card__description">{description}</p>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            {/* ──────────────────── HOW IT WORKS ──────────────────── */}
            <section id="how-it-works" className="how-it-works">
                <div className="how-it-works__inner">
                    <div className="how-it-works__content">
                        <h2 className="how-it-works__title">
                            Simple. Reliable.<br />
                            <span className="how-it-works__title--green">Always Together.</span>
                        </h2>

                        <div className="how-it-works__steps">
                            {howItWorksSteps.map(({ step, title, description }) => (
                                <div key={step} className="step">
                                    <div className="step__number">{step}</div>
                                    <div className="step__content">
                                        <h3 className="step__title">{title}</h3>
                                        <p className="step__description">{description}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="how-it-works__visual">
                        <div className="how-it-works__image-wrapper">
                            <Image
                                src="/how-it-works.png"
                                alt="Students sharing a ride together"
                                width={520}
                                height={400}
                                className="how-it-works__image"
                            />
                            {/* Floating notification card */}
                            <div className="how-it-works__float-card">
                                <div className="how-it-works__float-icon">
                                    <MapPin className="h-4 w-4 text-emerald-600" />
                                </div>
                                <div>
                                    <p className="how-it-works__float-title">Trip to Orlando</p>
                                    <p className="how-it-works__float-subtitle">Today, 4:30 PM | 2 Seats Left</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ──────────────────── TESTIMONIALS ──────────────────── */}
            <section id="safety" className="testimonials">
                <div className="testimonials__inner">
                    <div className="testimonials__header">
                        <span className="testimonials__eyebrow">STUDENT EXPERIENCES</span>
                        <h2 className="testimonials__title">Hear it from the Community</h2>
                    </div>

                    <div className="testimonials__grid">
                        {testimonials.map((t) => (
                            <article key={t.name} className="testimonial-card">
                                <p className="testimonial-card__quote">
                                    &ldquo;{stripSurroundingQuotes(t.quote)}&rdquo;
                                </p>
                                <div className="testimonial-card__author">
                                    <div className="testimonial-card__avatar">{t.avatar}</div>
                                    <div>
                                        <p className="testimonial-card__name">{t.name}</p>
                                        <p className="testimonial-card__role">{t.role}</p>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                </div>
            </section>

            {/* ──────────────────── CTA ──────────────────── */}
            <section className="cta">
                <div className="cta__inner">
                    <div className="cta__card">
                        <h2 className="cta__title">Ready to join the community?</h2>
                        <p className="cta__description">
                            Sign up with your Stetson email today and start your first journey with a fellow
                            Hatter.
                        </p>
                        <Link href="/sign-up" className="btn btn--primary btn--lg cta__button">
                            Create Your Profile
                        </Link>
                        <p className="cta__note">
                            <ShieldCheck className="h-4 w-4" />
                            @stetson.edu email required
                        </p>
                    </div>
                </div>
            </section>

            {/* ──────────────────── FOOTER ──────────────────── */}
            <footer className="landing-footer">
                <div className="landing-footer__inner">
                    <div className="landing-footer__top">
                        <Link href="/" className="landing-logo landing-logo--footer">
                            <span className="landing-logo__text">Destination</span>
                        </Link>

                        <nav className="landing-footer__links">
                            <a href="#features">Help</a>
                            <a href="#safety">Safety</a>
                            <a href="/?home">Home</a>
                            <a href="#features">Privacy</a>
                            <a href="mailto:support@desti.app">Contact</a>
                        </nav>

                        <div className="landing-footer__social">
                            <Globe className="h-5 w-5" />
                        </div>
                    </div>

                    <div className="landing-footer__bottom">
                        <p>© 2026 Destination Stetson University. All rights reserved.</p>
                    </div>
                </div>
            </footer>
        </main>
    );
}
