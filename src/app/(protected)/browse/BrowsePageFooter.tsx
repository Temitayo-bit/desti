import Link from "next/link";
import { DestiLogo } from "@/components/DestiLogo";

export function BrowsePageFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-12 border-t border-zinc-200 py-8 text-sm text-zinc-600">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row md:px-6">
        <div className="flex flex-col items-center gap-1 sm:items-start">
          <DestiLogo size="sm" variant="moss" />
          <p>© {year} Desti · Stetson University. All rights reserved.</p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-6">
          <Link
            className="font-medium text-zinc-600 hover:text-[#0d3d2e]"
            href="/help"
          >
            Help
          </Link>
          <Link
            className="font-medium text-zinc-600 hover:text-[#0d3d2e]"
            href="/safety"
          >
            Safety
          </Link>
          <Link
            className="font-medium text-zinc-600 hover:text-[#0d3d2e]"
            href="/terms"
          >
            Terms
          </Link>
        </div>
      </div>
    </footer>
  );
}
