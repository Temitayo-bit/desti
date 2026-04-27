import Link from "next/link";

export function BrowsePageFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="mt-12 border-t border-zinc-200 py-8 text-sm text-zinc-600">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 sm:flex-row md:px-6">
        <p>
          <span className="font-extrabold text-[#0d3d2e]">Destination</span>
          <span className="ml-2">
            © {year} Destination Stetson University. All rights reserved.
          </span>
        </p>
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
