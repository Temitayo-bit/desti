'use client'
import Link from 'next/link'
import { useUser } from '@clerk/nextjs'
import Navbar from '@/components/Navbar'

export default function Dashboard() {
  const { user } = useUser()

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-6xl mx-auto px-4 py-10">

        {/* Welcome Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-black text-gray-900">
            Welcome back, {user?.firstName ?? 'Student'} 👋
          </h1>
          <p className="text-gray-500 mt-2">What do you want to do today?</p>
        </div>

        {/* Main Action Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">

          {/* Browse Rides */}
          <Link href="/rides" className="group block">
            <div className="bg-white rounded-2xl p-7 border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-indigo-200 transition-all h-full">
              <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg mb-5">
                <span className="text-2xl">🏠</span>
              </div>
              <h3 className="text-xl font-black text-gray-900 group-hover:text-indigo-700 transition-colors mb-2">
                Browse Rides
              </h3>
              <p className="text-gray-500 text-sm mb-6">
                Find available rides from verified Stetson students heading your way
              </p>
              <div className="mt-auto">
                <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl text-sm shadow-md group-hover:shadow-lg transition-all">
                  Find a Ride →
                </span>
              </div>
            </div>
          </Link>

          {/* Post Ride */}
          <Link href="/rides/new" className="group block">
            <div className="bg-white rounded-2xl p-7 border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-indigo-200 transition-all h-full">
              <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg mb-5">
                <span className="text-2xl">🚗</span>
              </div>
              <h3 className="text-xl font-black text-gray-900 group-hover:text-indigo-700 transition-colors mb-2">
                Post a Ride
              </h3>
              <p className="text-gray-500 text-sm mb-6">
                Share your trip with other students and split the cost of a ride you're already taking
              </p>
              <div className="mt-auto">
                <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl text-sm shadow-md group-hover:shadow-lg transition-all">
                  Post Ride →
                </span>
              </div>
            </div>
          </Link>

          {/* Requests */}
          <Link href="/trip-requests" className="group block">
            <div className="bg-white rounded-2xl p-7 border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 hover:border-indigo-200 transition-all h-full">
              <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg mb-5">
                <span className="text-2xl">📬</span>
              </div>
              <h3 className="text-xl font-black text-gray-900 group-hover:text-indigo-700 transition-colors mb-2">
                Trip Requests
              </h3>
              <p className="text-gray-500 text-sm mb-6">
                Post a trip request and let drivers come to you — great if no rides are listed yet
              </p>
              <div className="mt-auto">
                <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl text-sm shadow-md group-hover:shadow-lg transition-all">
                  View Requests →
                </span>
              </div>
            </div>
          </Link>

        </div>

        {/* Quick Links Row */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
          <h2 className="text-lg font-black text-gray-900 mb-5">My Activity</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

            <Link
              href="/dashboard/my-rides"
              className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:bg-indigo-50 hover:border-indigo-200 transition-all group"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">🎫</span>
                <div>
                  <p className="font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">My Bookings</p>
                  <p className="text-xs text-gray-500">Rides you've booked</p>
                </div>
              </div>
              <span className="text-indigo-500 font-bold">→</span>
            </Link>

            <Link
              href="/dashboard/my-rides"
              className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:bg-indigo-50 hover:border-indigo-200 transition-all group"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">🚘</span>
                <div>
                  <p className="font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">My Posted Rides</p>
                  <p className="text-xs text-gray-500">Rides you're driving</p>
                </div>
              </div>
              <span className="text-indigo-500 font-bold">→</span>
            </Link>

            <Link
              href="/messages"
              className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:bg-indigo-50 hover:border-indigo-200 transition-all group"
            >
              <div className="flex items-center gap-3">
                <span className="text-xl">💬</span>
                <div>
                  <p className="font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">Messages</p>
                  <p className="text-xs text-gray-500">Chat with riders & drivers</p>
                </div>
              </div>
              <span className="text-indigo-500 font-bold">→</span>
            </Link>

          </div>
        </div>

        {/* Profile Info */}
        <div className="mt-6 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100 p-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center shadow-lg flex-shrink-0">
              <span className="text-white font-black text-xl">
                {user?.firstName?.[0] ?? '?'}
              </span>
            </div>
            <div className="flex-1">
              <p className="font-black text-gray-900 text-lg">
                {user?.firstName} {user?.lastName}
              </p>
              <p className="text-indigo-600 text-sm font-semibold">
                {user?.emailAddresses?.[0]?.emailAddress}
              </p>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-indigo-200 shadow-sm">
              <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
              <span className="text-xs font-bold text-indigo-700">Stetson Verified</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
