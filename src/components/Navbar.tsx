'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserButton } from '@clerk/nextjs'

const navLinks = [
   { href: '/dashboard', label: 'Profile', icon: '👤' },
    { href: '/rides', label: 'Browse Rides', icon: '🏠' },
  { href: '/rides/new', label: 'Post Ride', icon: '➕' },
  { href: '/trip-requests', label: 'Requests', icon: '📬' },
  { href: '/messages', label: 'Messages', icon: '💬' },
]

export default function Navbar() {
  const pathname = usePathname()

  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/dashboard" className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <span className="text-white font-black text-lg">D</span>
            </div>
            <span className="text-xl font-black bg-gradient-to-r from-indigo-900 to-purple-900 bg-clip-text text-transparent">
              Desti
            </span>
          </Link>

          {/* Nav Links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 ${
                  pathname === link.href
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-gray-600 hover:text-indigo-600 hover:bg-indigo-50'
                }`}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 rounded-full border border-indigo-200">
              <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
              <span className="text-xs font-bold text-indigo-700">Stetson Verified</span>
            </div>
            <UserButton afterSignOutUrl="/" />
          </div>

        </div>
      </div>
    </nav>
  )
}
