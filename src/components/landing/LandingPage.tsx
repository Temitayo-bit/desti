import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Car, Check, Leaf, Lock, ShieldCheck } from "lucide-react";
import { FeatureCard } from "./FeatureCard";
import { LandingFooter } from "./LandingFooter";
import { LandingNavbar } from "./LandingNavbar";
import { TestimonialCard } from "./TestimonialCard";

const HERO_IMAGE =
    "https://images.unsplash.com/photo-1663162550938-60f70fab5d31?auto=format&fit=crop&w=1200&q=80";
const HOW_IMAGE =
    "https://images.unsplash.com/photo-1530065928592-fb0dc85d2f27?auto=format&fit=crop&w=1000&q=80";

const PROOF_AVATARS = [
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=120&h=120&q=80",
    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=120&h=120&q=80",
    "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=120&h=120&q=80",
];

export function LandingPage() {
    return (
        <div className="min-h-screen bg-white text-zinc-900">
            <LandingNavbar />

            {/* Hero */}
            <section
                className="relative overflow-hidden"
                style={{
                    background:
                        "radial-gradient(ellipse 80% 60% at 0% 0%, rgba(34, 197, 94, 0.12) 0%, transparent 50%), #ffffff",
                }}
            >
                <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 md:gap-12 md:px-6 lg:max-w-7xl lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-20">
                    <div className="order-2 lg:order-1">
                        <p className="inline-flex items-center gap-1.5 rounded-full border border-[#bbf7d0] bg-[#f0fdf4] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#14532d] md:px-4 md:text-sm">
                            <span className="h-1.5 w-1.5 rounded-full bg-[#22c55e]" aria-hidden />
                            Exclusive to Stetson Students
                        </p>

                        <h1 className="mt-5 text-4xl font-bold leading-[1.1] tracking-tight text-zinc-950 sm:text-5xl lg:text-6xl">
                            Your Journey,
                            <br />
                            <span className="text-[#16a34a]">Reimagined.</span>
                        </h1>

                        <p className="mt-5 max-w-lg text-base leading-relaxed text-zinc-600 md:mt-6 md:text-lg">
                            The safest, most reliable way for Stetson students to share rides, save
                            money, and build community. Connect with fellow Hatters today.
                        </p>

                        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4 md:mt-8">
                            <Link
                                href="/sign-up"
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#14532d] px-6 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#134026] md:px-7 md:text-base"
                            >
                                Get Started
                                <ArrowRight className="h-4 w-4" strokeWidth={2} />
                            </Link>
                            <a
                                href="#features"
                                className="inline-flex items-center justify-center rounded-xl border border-zinc-300 bg-white px-6 py-3.5 text-sm font-semibold text-zinc-800 transition hover:border-zinc-400 md:text-base"
                            >
                                View Routes
                            </a>
                        </div>

                        <div className="mt-8 flex items-center gap-3 md:mt-10">
                            <div className="flex -space-x-2">
                                {PROOF_AVATARS.map((src, i) => (
                                    <div
                                        key={src}
                                        className="relative h-9 w-9 overflow-hidden rounded-full border-2 border-white ring-0 md:h-10 md:w-10"
                                        style={{ zIndex: 3 - i }}
                                    >
                                        <Image
                                            src={src}
                                            alt=""
                                            width={40}
                                            height={40}
                                            className="object-cover"
                                        />
                                    </div>
                                ))}
                            </div>
                            <p className="text-sm font-medium text-[#15803d] md:text-base">
                                Trusted by 500+ Stetson Students
                            </p>
                        </div>
                    </div>

                    <div className="order-1 lg:order-2">
                        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
                            <div className="relative aspect-[4/5] overflow-hidden rounded-[1.5rem] shadow-[0_20px_50px_rgba(15,23,42,0.12)] md:rounded-[1.75rem] lg:aspect-[3.5/4.4]">
                                <Image
                                    src={HERO_IMAGE}
                                    alt="Stetson students walking together on campus"
                                    fill
                                    className="object-cover"
                                    priority
                                    sizes="(min-width: 1024px) 45vw, 90vw"
                                />
                            </div>
                            <div
                                className="absolute -bottom-2 left-3 right-3 md:left-4 md:right-auto md:max-w-[90%] lg:bottom-4 lg:left-6"
                            >
                                <div className="flex items-center gap-3 rounded-2xl border border-white/60 bg-white/90 px-4 py-3 shadow-lg backdrop-blur-sm md:px-5 md:py-4">
                                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#ecfdf5] text-[#14532d]">
                                        <Car className="h-5 w-5" strokeWidth={2} />
                                    </div>
                                    <div>
                                        <p className="text-xs font-bold uppercase tracking-wide text-[#14532d]">
                                            Next ride to Orlando
                                        </p>
                                        <p className="text-sm text-zinc-600">
                                            Today, 4:30 PM · 2 seats left
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features */}
            <section
                id="features"
                className="scroll-mt-24 border-t border-zinc-100 bg-[#fafaf9] px-4 py-16 md:px-6 md:py-24 lg:px-8"
            >
                <div className="mx-auto max-w-6xl text-center lg:max-w-7xl">
                    <h2 className="text-3xl font-bold tracking-tight text-zinc-950 md:text-4xl">
                        Built Specifically for the Hatter Way
                    </h2>
                    <p className="mx-auto mt-3 max-w-2xl text-base text-zinc-600 md:mt-4 md:text-lg">
                        Experience the most thoughtful carpooling platform designed by students,
                        for students.
                    </p>

                    <div className="mt-10 grid gap-5 md:mt-14 md:grid-cols-3 md:gap-6">
                        <FeatureCard
                            title="Verified Students"
                            description="Every account is tied to a @stetson.edu email so you only ride with fellow Hatters you can trust."
                            icon={ShieldCheck}
                        />
                        <FeatureCard
                            id="safety"
                            title="Safe & Secure"
                            description="In-app messaging and driver checks keep your plans private. Coordinate with confidence, every time."
                            icon={Lock}
                        />
                        <FeatureCard
                            title="Sustainable Savings"
                            description="Split gas fairly and cut your carbon footprint when you share seats instead of driving alone."
                            icon={Leaf}
                            iconClassName="text-rose-500"
                        />
                    </div>
                </div>
            </section>

            {/* How it works */}
            <section
                id="how-it-works"
                className="scroll-mt-24 border-t border-zinc-100 px-4 py-16 md:px-6 md:py-24 lg:px-8"
            >
                <div className="mx-auto grid max-w-6xl items-center gap-12 lg:max-w-7xl lg:grid-cols-2 lg:gap-16">
                    <div>
                        <h2 className="text-3xl font-bold tracking-tight text-zinc-950 md:text-4xl">
                            Simple. Reliable.{" "}
                            <span className="text-[#16a34a]">Always Together.</span>
                        </h2>

                        <ol className="mt-8 space-y-6 md:mt-10 md:space-y-8">
                            {[
                                {
                                    n: 1,
                                    title: "Search for a ride",
                                    text: "Find Hatters already heading to the airport, home, or your next road trip—filter by time and route.",
                                },
                                {
                                    n: 2,
                                    title: "Connect with a Hatter",
                                    text: "View driver profiles, ratings, and chat securely before you ever share a ride.",
                                },
                                {
                                    n: 3,
                                    title: "Share the Journey",
                                    text: "Meet at a familiar campus spot, split the trip fairly, and enjoy the ride with people from your school.",
                                },
                            ].map((step) => (
                                <li key={step.n} className="flex gap-4">
                                    <div
                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#14532d] text-sm font-bold text-white md:h-10 md:w-10"
                                        aria-hidden
                                    >
                                        {step.n}
                                    </div>
                                    <div>
                                        <h3 className="text-lg font-bold text-zinc-950">
                                            {step.title}
                                        </h3>
                                        <p className="mt-1.5 text-sm leading-relaxed text-zinc-600 md:text-base">
                                            {step.text}
                                        </p>
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </div>

                    <div className="relative mx-auto w-full max-w-md lg:max-w-none">
                        <div className="relative aspect-[3/4] overflow-hidden rounded-[1.5rem] shadow-[0_20px_50px_rgba(15,23,42,0.1)] md:rounded-3xl">
                            <Image
                                src={HOW_IMAGE}
                                alt="Students riding together in a car"
                                fill
                                className="object-cover"
                                sizes="(min-width: 1024px) 40vw, 90vw"
                            />
                        </div>
                        <div className="absolute right-3 top-3 md:right-4 md:top-4">
                            <div className="max-w-[220px] rounded-2xl border border-white/70 bg-white/95 px-3 py-2 shadow-lg backdrop-blur-sm md:max-w-xs md:px-4 md:py-2.5">
                                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600 md:text-xs">
                                    ★ Top rated ride
                                </p>
                                <p className="text-xs text-zinc-700 md:text-sm">
                                    &ldquo;Best ride ever!&rdquo;
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Testimonials */}
            <section
                className="border-t border-zinc-100 bg-[#14532d] px-4 py-16 text-white md:px-6 md:py-24 lg:px-8"
                aria-labelledby="testimonials-heading"
            >
                <div className="mx-auto max-w-6xl lg:max-w-7xl">
                    <p className="text-center text-xs font-bold uppercase tracking-[0.2em] text-white/80">
                        Student experiences
                    </p>
                    <h2
                        id="testimonials-heading"
                        className="mt-2 text-center text-3xl font-bold tracking-tight md:mt-3 md:text-4xl"
                    >
                        Hear it from the Community
                    </h2>

                    <div className="mt-10 grid gap-5 md:mt-12 md:grid-cols-2 md:gap-6">
                        <TestimonialCard
                            quote="Desti made getting to the airport for spring break so easy. I found a Hatter going the same way in minutes."
                            name="Sarah Jenkins"
                            detail="Class of '25 · Psychology"
                            imageSrc="https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80"
                            imageAlt="Sarah Jenkins"
                        />
                        <TestimonialCard
                            quote="I was nervous about carpooling at first, but everyone is verified. It feels like riding with a friend from class."
                            name="Marcus Chen"
                            detail="Class of '26 · Business"
                            imageSrc="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80"
                            imageAlt="Marcus Chen"
                        />
                    </div>
                </div>
            </section>

            {/* CTA */}
            <section className="border-t border-zinc-100 bg-[#f4f4f1] px-4 py-16 md:px-6 md:py-24 lg:px-8">
                <div
                    className="relative mx-auto max-w-2xl overflow-hidden rounded-3xl border border-zinc-200/80 bg-gradient-to-b from-white to-zinc-50/90 px-6 py-10 shadow-[0_12px_40px_rgba(15,23,42,0.08)] md:px-10 md:py-12"
                    style={{
                        boxShadow:
                            "0 0 0 1px rgba(0,0,0,0.03), 0 24px 60px -12px rgba(20, 83, 45, 0.12)",
                    }}
                >
                    <h2 className="text-center text-2xl font-bold text-zinc-950 md:text-3xl">
                        Ready to join the community?
                    </h2>
                    <p className="mx-auto mt-3 max-w-md text-center text-sm text-zinc-600 md:mt-4 md:text-base">
                        Sign up with your Stetson email today and start your first journey with a
                        fellow Hatter.
                    </p>
                    <div className="mt-7 flex flex-col items-center md:mt-8">
                        <Link
                            href="/sign-up"
                            className="inline-flex w-full max-w-sm items-center justify-center rounded-xl bg-[#14532d] px-6 py-3.5 text-sm font-semibold text-white shadow-md transition hover:bg-[#134026] sm:w-auto md:text-base"
                        >
                            Create Your Profile
                        </Link>
                        <p className="mt-3 flex items-center gap-1.5 text-xs text-zinc-500 md:text-sm">
                            <span className="text-[#16a34a]">
                                <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
                            </span>
                            stetson.edu email required
                        </p>
                    </div>
                </div>
            </section>

            <LandingFooter />
        </div>
    );
}
