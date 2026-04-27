import { Globe, User } from "lucide-react";

const footerLinkClass =
    "text-sm text-zinc-600 transition-colors hover:text-zinc-900 md:text-base";

export function LandingFooter() {
    return (
        <footer className="border-t border-zinc-200 bg-[#f8f8f6]">
            <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-10 md:flex-row md:items-center md:justify-between md:px-6 lg:max-w-7xl lg:px-8 lg:py-12">
                <div>
                    <p className="text-lg font-bold tracking-tight text-zinc-950">Destination</p>
                    <p className="mt-2 text-sm text-zinc-500 md:mt-3">
                        © 2024 Destination Stetson University. All rights reserved.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                    <a href="#help" className={footerLinkClass}>
                        Help
                    </a>
                    <a href="#safety" className={footerLinkClass}>
                        Safety
                    </a>
                    <a href="#terms" className={footerLinkClass}>
                        Terms
                    </a>
                    <a href="#privacy" className={footerLinkClass}>
                        Privacy
                    </a>
                    <a href="#contact" className={footerLinkClass}>
                        Contact
                    </a>
                    <span className="ml-0 flex items-center gap-2 border-l border-zinc-300 pl-4 md:ml-2">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500">
                            <Globe className="h-4 w-4" strokeWidth={2} aria-hidden />
                        </span>
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-500">
                            <User className="h-4 w-4" strokeWidth={2} aria-hidden />
                        </span>
                    </span>
                </div>
            </div>
        </footer>
    );
}
