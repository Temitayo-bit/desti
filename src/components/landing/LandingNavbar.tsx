import Link from "next/link";
import { DestiLogo } from "@/components/DestiLogo";

export function LandingNavbar() {
    return (
        <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-white/90 backdrop-blur-md">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 md:px-6 lg:max-w-7xl lg:px-8">
                {/* Left group: logo + nav links */}
                <div className="flex items-center gap-8 lg:gap-10">
                    <Link
                        href="/"
                        className="shrink-0"
                    >
                        <DestiLogo size="md" />
                    </Link>

                    <nav
                        className="hidden items-center gap-6 md:flex lg:gap-8"
                        aria-label="Primary"
                    >
                        <a
                            href="#features"
                            className="border-b-2 border-[#16a34a] pb-0.5 text-sm font-semibold text-zinc-900 transition-colors md:text-base"
                        >
                            Features
                        </a>
                        <a
                            href="#how-it-works"
                            className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 md:text-base"
                        >
                            How it Works
                        </a>
                        <a
                            href="#safety"
                            className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 md:text-base"
                        >
                            Safety
                        </a>
                    </nav>
                </div>

                {/* Right group: auth actions */}
                <div className="flex items-center gap-2 sm:gap-3">
                    <Link
                        href="/sign-in"
                        className="px-2 text-sm font-medium text-zinc-700 transition-colors hover:text-zinc-950 sm:px-3 md:text-base"
                    >
                        Login
                    </Link>
                    <Link
                        href="/sign-up"
                        className="inline-flex items-center justify-center rounded-lg bg-[#14532d] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#134026] md:px-5"
                    >
                        Sign Up
                    </Link>
                </div>
            </div>

            {/* Mobile nav links row */}
            <div className="border-t border-zinc-100 md:hidden">
                <div className="mx-auto flex max-w-6xl items-center justify-center gap-6 overflow-x-auto px-4 py-2.5 text-sm font-medium text-zinc-600">
                    <a href="#features" className="shrink-0 font-semibold text-zinc-900">
                        Features
                    </a>
                    <a href="#how-it-works" className="shrink-0">
                        How it Works
                    </a>
                    <a href="#safety" className="shrink-0">
                        Safety
                    </a>
                </div>
            </div>
        </header>
    );
}
