'use client'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'

export default function Dashboard() {
  const { user } = useUser()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50">
      {/* Header */}
      <header className="bg-white/90 backdrop-blur-md shadow-sm sticky top-0 z-50 border-b border-indigo-100">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col lg:flex-row gap-4 items-center justify-between">
            <div>
              <h1 className="text-3xl lg:text-4xl font-black bg-gradient-to-r from-indigo-900 to-purple-900 bg-clip-text text-transparent">
                Dashboard
              </h1>
              <p className="text-gray-600 mt-1">Welcome, {user?.firstName || 'Student'}!</p>
            </div>
            <div className="flex gap-3">
              <Link href="/rides" className="px-8 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-2xl shadow-lg hover:shadow-xl hover:from-indigo-700 transition-all">
                Browse Rides
              </Link>
              <Link href="/rides/new" className="px-8 py-3 border-2 border-indigo-600 text-indigo-600 font-bold rounded-2xl shadow-lg hover:bg-indigo-600 hover:text-white transition-all">
                Post Ride
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Unified Action Cards */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          
          {/* Post Ride Card */}
          <Link href="/rides/new" className="group block">
            <div className="group bg-gradient-to-br from-indigo-50 to-purple-50/50 p-8 rounded-3xl shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all border border-indigo-100/50 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="text-2xl">🚗</span>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gray-900 group-hover:text-indigo-600 transition-colors">Post Ride</h3>
                  <p className="text-indigo-600 font-semibold">Share your seats</p>
                </div>
              </div>
              <p className="text-gray-700 mb-8 leading-relaxed">Destination, time window (earliest/latest), price per seat, total seats</p>
              <button className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-2xl shadow-xl hover:shadow-2xl hover:from-indigo-700 transition-all">
                Create Ride
              </button>
            </div>
          </Link>

          {/* Browse Rides Card */}
          <Link href="/rides" className="group block">
            <div className="group bg-gradient-to-br from-indigo-50 to-purple-50/50 p-8 rounded-3xl shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all border border-indigo-100/50 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="text-2xl">🔍</span>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gray-900 group-hover:text-indigo-600 transition-colors">Find Rides</h3>
                  <p className="text-indigo-600 font-semibold">Browse campus rides</p>
                </div>
              </div>
              <p className="text-gray-700 mb-8 leading-relaxed">Filter by distance category, browse by time & destination</p>
              <button className="w-full py-4 px-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-2xl shadow-xl hover:shadow-2xl hover:from-indigo-700 transition-all">
                Browse Rides
              </button>
            </div>
          </Link>

          {/* My Activity Card */}
          <div className="group block">
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50/50 p-8 rounded-3xl shadow-xl hover:shadow-2xl hover:-translate-y-2 transition-all border border-indigo-100/50 backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <span className="text-2xl">📋</span>
                </div>
                <div>
                  <h3 className="text-2xl font-black text-gray-900 group-hover:text-indigo-600 transition-colors">My Activity</h3>
                  <p className="text-indigo-600 font-semibold">Track everything</p>
                </div>
              </div>
              <div className="space-y-3">
                <Link href="/dashboard/my-rides" className="w-full block p-4 bg-white/70 rounded-2xl border border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 transition-all font-semibold">
                  My Rides
                </Link>
                <Link href="/dashboard/bookings" className="w-full block p-4 bg-white/70 rounded-2xl border border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 transition-all font-semibold">
                  Bookings
                </Link>
                <Link href="/trip-requests" className="w-full block p-4 bg-white/70 rounded-2xl border border-indigo-200 hover:bg-indigo-50 hover:border-indigo-300 transition-all font-semibold">
                  Trip Requests
                </Link>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
