'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'
import Navbar from '@/components/Navbar'

type Booking = {
  id: string
  status: 'confirmed' | 'pending' | 'cancelled'
  ride: {
    id: string
    destinationText: string
    originText: string
    earliestDepartAt: string
    latestDepartAt: string
  }
  driver?: {
    firstName: string
    lastName: string
  }
}

type PostedRide = {
  id: string
  destinationText: string
  originText: string
  earliestDepartAt: string
  seatsBooked: number
  seatsTotal: number
}

const statusColor = (s: string) => {
  if (s === 'confirmed') return 'bg-green-100 text-green-800'
  if (s === 'pending') return 'bg-yellow-100 text-yellow-800'
  return 'bg-gray-100 text-gray-600'
}

const formatDateTime = (iso: string) => {
  const d = new Date(iso)
  const today = new Date()
  const dateStr = d.toDateString() === today.toDateString()
    ? 'Today'
    : d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  return `${dateStr} · ${time}`
}

export default function MyActivity() {
  const { getToken } = useAuth()
  const [bookings, setBookings] = useState<Booking[]>([])
  const [postedRides, setPostedRides] = useState<PostedRide[]>([])
  const [loading, setLoading] = useState(true)

  // ✅ Fetches the logged-in user's real bookings + rides from the database
  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = await getToken()
        const headers = { Authorization: `Bearer ${token}` }

        const [bookingsRes, ridesRes] = await Promise.all([
          fetch('/api/bookings/mine', { headers }),
          fetch('/api/rides/mine', { headers }),
        ])

        if (bookingsRes.ok) {
          const b = await bookingsRes.json()
          setBookings(Array.isArray(b) ? b : (b.bookings ?? b.data ?? []))
        }
        if (ridesRes.ok) {
          const r = await ridesRes.json()
          setPostedRides(Array.isArray(r) ? r : (r.rides ?? r.data ?? []))
        }
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 py-8">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-gray-900">My Activity</h1>
            <p className="text-gray-500 mt-1">View your bookings and posted rides</p>
          </div>
          <Link
            href="/trip-requests/new"
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all"
          >
            + Post Request
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {[1,2,3,4].map(i => <div key={i} className="bg-white rounded-2xl p-6 animate-pulse h-32" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

            {/* My Bookings */}
            <div>
              <h2 className="text-xl font-black text-gray-900 mb-4">My Bookings</h2>
              {bookings.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center">
                  <p className="text-4xl mb-3">🎫</p>
                  <p className="font-bold text-gray-700 mb-2">No bookings yet</p>
                  <p className="text-gray-500 text-sm mb-4">Find a ride and book your first seat</p>
                  <Link href="/rides" className="inline-flex px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl text-sm">
                    Browse Rides
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {bookings.map((b) => (
                    <Link key={b.id} href={`/rides/${b.ride.id}`}>
                      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400 text-sm">📍</span>
                              <h3 className="font-black text-gray-900">{b.ride.destinationText}</h3>
                            </div>
                            <p className="text-gray-500 text-sm ml-6">from {b.ride.originText}</p>
                          </div>
                          <span className={`px-3 py-1 rounded-full text-xs font-bold capitalize ${statusColor(b.status)}`}>
                            {b.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between ml-6">
                          <p className="text-sm text-gray-600">📅 {formatDateTime(b.ride.earliestDepartAt)}</p>
                          <span className="text-indigo-600 font-bold">→</span>
                        </div>
                        {b.driver && (
                          <div className="mt-3 ml-6 flex items-center justify-between">
                            <p className="text-sm text-gray-500">
                              Driver: <span className="font-semibold text-gray-700">{b.driver.firstName} {b.driver.lastName[0]}.</span>
                            </p>
                            <button className="text-sm text-indigo-600 font-semibold hover:underline">💬 Message</button>
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* My Posted Rides */}
            <div>
              <h2 className="text-xl font-black text-gray-900 mb-4">My Posted Rides</h2>
              {postedRides.length === 0 ? (
                <div className="bg-white rounded-2xl p-8 border border-gray-100 text-center">
                  <p className="text-4xl mb-3">🚗</p>
                  <p className="font-bold text-gray-700 mb-2">No rides posted yet</p>
                  <p className="text-gray-500 text-sm mb-4">Share your trip and earn money on rides you're already taking</p>
                  <Link href="/rides/new" className="inline-flex px-5 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl text-sm">
                    Post a Ride
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {postedRides.map((r) => (
                    <Link key={r.id} href={`/rides/${r.id}`}>
                      <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-gray-400 text-sm">📍</span>
                              <h3 className="font-black text-gray-900">{r.destinationText}</h3>
                            </div>
                            <p className="text-gray-500 text-sm ml-6">from {r.originText}</p>
                          </div>
                          <span className="px-3 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-bold">
                            {r.seatsBooked}/{r.seatsTotal} Booked
                          </span>
                        </div>
                        <div className="flex items-center justify-between ml-6">
                          <p className="text-sm text-gray-600">📅 {formatDateTime(r.earliestDepartAt)}</p>
                          <span className="text-indigo-600 font-bold">→</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  )
}
