'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import Navbar from '@/components/Navbar'

type RideDetail = {
  id: string
  destinationText: string
  originText: string
  earliestDepartAt: string
  latestDepartAt: string
  seatsAvailable: number
  seatsTotal: number
  price: number
  distanceKm?: number
  driver?: {
    firstName: string
    lastName: string
    note?: string
    verified?: boolean
    year?: string
  }
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const formatDate = (iso: string) => {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Today'
  return d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })
}

export default function RideDetails() {
  const { id } = useParams()
  const { getToken } = useAuth()
  const [ride, setRide] = useState<RideDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [booking, setBooking] = useState(false)
  const [booked, setBooked] = useState(false)

  // ✅ Fetches this specific ride from your database
  useEffect(() => {
    const fetchRide = async () => {
      try {
        const token = await getToken()
        const res = await fetch(`/api/rides/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error('Ride not found')
        const data = await res.json()
        setRide(data.ride || data)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchRide()
  }, [id])

  const handleBook = async () => {
    if (!ride) return
    setBooking(true)
    try {
      const token = await getToken()
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          'Idempotency-Key': `booking-${ride.id}-${Date.now()}`,
        },
        body: JSON.stringify({ rideId: ride.id, seatsRequested: 1 }),
      })
      if (!res.ok) throw new Error((await res.json()).message || 'Booking failed')
      setBooked(true)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setBooking(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="bg-white rounded-2xl p-6 animate-pulse h-32" />)}
      </div>
    </div>
  )

  if (error || !ride) return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="bg-red-50 rounded-2xl p-8 text-center border border-red-100">
          <p className="text-5xl mb-4">😕</p>
          <h2 className="text-2xl font-black text-red-800 mb-2">Ride not found</h2>
          <p className="text-red-600 mb-6">{error}</p>
          <Link href="/rides" className="px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl">
            Browse All Rides
          </Link>
        </div>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-8">

        <Link href="/rides" className="flex items-center gap-2 text-gray-600 hover:text-indigo-600 font-semibold mb-2 transition-colors">
          ←
        </Link>
        <h1 className="text-3xl font-black text-gray-900 mb-8">Ride Details</h1>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Left: Ride Info */}
          <div className="flex-1 space-y-4">
            {/* Route Card */}
            <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-100">
              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center pt-1 flex-shrink-0">
                  <div className="w-3 h-3 rounded-full bg-indigo-600"></div>
                  <div className="w-0.5 h-12 bg-indigo-300 my-1"></div>
                  <div className="w-3 h-3 rounded-full border-2 border-indigo-600 bg-white"></div>
                </div>
                <div className="space-y-6">
                  <div>
                    <p className="text-xs font-bold text-indigo-500 uppercase tracking-wide">From</p>
                    <p className="text-xl font-black text-gray-900">{ride.originText}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold text-indigo-500 uppercase tracking-wide">To</p>
                    <p className="text-xl font-black text-gray-900">{ride.destinationText}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Departure Window */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-xl flex-shrink-0">🕐</div>
                <div>
                  <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">Departure Window</p>
                  <p className="text-2xl font-black text-gray-900">
                    {formatTime(ride.earliestDepartAt)} - {formatTime(ride.latestDepartAt)}
                  </p>
                  <p className="text-gray-500 text-sm">{formatDate(ride.earliestDepartAt)}</p>
                </div>
              </div>
            </div>

            {/* Driver Card */}
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-gray-900">Driver</h3>
                {ride.driver?.verified && (
                  <span className="flex items-center gap-1.5 px-3 py-1 bg-indigo-50 rounded-full border border-indigo-200">
                    <span className="text-xs">🛡️</span>
                    <span className="text-xs font-bold text-indigo-700">Verified</span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-black text-lg">
                    {ride.driver?.firstName?.[0] ?? '?'}
                  </span>
                </div>
                <div>
                  <p className="font-black text-gray-900">
                    {ride.driver ? `${ride.driver.firstName} ${ride.driver.lastName[0]}.` : 'Driver'}
                  </p>
                  <p className="text-gray-500 text-sm">{ride.driver?.year ?? 'Stetson Student'}</p>
                </div>
              </div>
              {ride.driver?.note && (
                <p className="text-gray-600 italic">"{ride.driver.note}"</p>
              )}
            </div>

            {/* Safety */}
            <div className="bg-indigo-50 rounded-2xl p-5 border border-indigo-100">
              <div className="flex items-center gap-2 mb-1">
                <span>🔒</span>
                <p className="font-bold text-indigo-800">Safety First</p>
              </div>
              <p className="text-sm text-indigo-700">Only verified @stetson.edu students can post and book rides on this platform.</p>
            </div>
          </div>

          {/* Right: Booking Summary */}
          <div className="lg:w-80">
            <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-lg sticky top-24">
              <h3 className="text-xl font-black text-gray-900 mb-6">Booking Summary</h3>
              <div className="space-y-4 mb-6">
                <div className="flex items-center justify-between py-3 border-b border-gray-100">
                  <div className="flex items-center gap-2 text-gray-600">
                    <span>👥</span>
                    <span className="font-semibold">Seats Available</span>
                  </div>
                  <span className="font-black text-gray-900">{ride.seatsAvailable}/{ride.seatsTotal}</span>
                </div>
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-2 text-gray-600">
                    <span>💰</span>
                    <span className="font-semibold">Price per Seat</span>
                  </div>
                  <span className="text-2xl font-black bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                    ${ride.price}
                  </span>
                </div>
              </div>

              {booked ? (
                <div className="w-full py-4 bg-green-50 border-2 border-green-200 text-green-800 font-black text-center rounded-2xl">
                  ✅ Booking Confirmed!
                </div>
              ) : ride.seatsAvailable === 0 ? (
                <div className="w-full py-4 bg-gray-100 text-gray-500 font-black text-center rounded-2xl">
                  😔 Fully Booked
                </div>
              ) : (
                <button
                  onClick={handleBook}
                  disabled={booking}
                  className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-lg rounded-2xl shadow-xl hover:shadow-2xl hover:from-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {booking ? 'Booking...' : `Book Seat for $${ride.price} →`}
                </button>
              )}
              <p className="text-center text-xs text-gray-400 mt-3">No payment collected — pay driver directly</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
