'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { useAuth } from '@clerk/nextjs'

type Ride = {
  id: string
  destinationText: string
  originText: string
  earliestDepartAt: string
  latestDepartAt: string
  seatsAvailable: number
  seatsTotal: number
  price: number
  distanceKm?: number
  distanceCategory: 'short' | 'medium' | 'long'
  driver?: {
    firstName: string
    lastName: string
  }
}

const distanceBadge = (km?: number) => {
  if (!km) return 'bg-gray-100 text-gray-600'
  if (km <= 25) return 'bg-green-100 text-green-800'
  if (km <= 60) return 'bg-yellow-100 text-yellow-800'
  return 'bg-red-100 text-red-800'
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const formatDate = (iso: string) => {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Today'
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function BrowseRides() {
  const { getToken } = useAuth()
  const [rides, setRides] = useState<Ride[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('All')
  const [showFilters, setShowFilters] = useState(false)

  // ✅ Fetches REAL rides from your database
  useEffect(() => {
    const fetchRides = async () => {
      try {
        const token = await getToken()
        const res = await fetch('/api/rides', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error('Failed to load rides')
        const data = await res.json()
        const list = data.rides ?? data.data ?? data
        setRides(Array.isArray(list) ? list : [])
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchRides()
  }, [])

  const filtered = rides.filter((ride) => {
    const matchesSearch =
      ride.destinationText.toLowerCase().includes(search.toLowerCase()) ||
      ride.originText.toLowerCase().includes(search.toLowerCase())
    const matchesFilter =
      activeFilter === 'All' ||
      (activeFilter === 'Today' && formatDate(ride.earliestDepartAt) === 'Today') ||
      ride.distanceCategory === activeFilter.toLowerCase()
    return matchesSearch && matchesFilter
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-black text-gray-900">Browse Available Rides</h1>
              <p className="text-gray-500 mt-1">Find rides from verified Stetson students</p>
            </div>
            <Link
              href="/rides/new"
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:from-indigo-700 transition-all"
            >
              <span>+</span> Post a Ride
            </Link>
          </div>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            <input
              type="text"
              placeholder="Search destinations..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-xl border-2 border-gray-100 focus:border-indigo-300 focus:outline-none text-gray-700 bg-gray-50"
            />
          </div>
        </div>

        <div className="flex gap-6">
          {/* Filters Sidebar */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h3 className="font-black text-gray-900 mb-4">Filters</h3>
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">Quick Filters</p>
              <div className="flex flex-wrap gap-2 mb-6">
                {['All', 'Today', 'Short', 'Medium', 'Long'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setActiveFilter(f)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                      activeFilter === f
                        ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                        : 'bg-gray-100 text-gray-700 hover:bg-indigo-50 hover:text-indigo-700'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <button
                onClick={() => setShowFilters(true)}
                className="w-full py-3 border-2 border-indigo-200 text-indigo-700 font-bold rounded-xl hover:bg-indigo-50 transition-all"
              >
                ⚙️ Advanced Filters
              </button>
            </div>
          </div>

          {/* Rides List */}
          <div className="flex-1">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 animate-pulse h-24" />
                ))}
              </div>
            ) : error ? (
              <div className="bg-red-50 rounded-2xl p-6 border border-red-100 text-red-700 font-semibold">{error}</div>
            ) : filtered.length === 0 ? (
              <div className="bg-white rounded-2xl p-12 border border-gray-100 text-center">
                <p className="text-5xl mb-4">🚗</p>
                <h3 className="text-xl font-black text-gray-900 mb-2">No rides found</h3>
                <p className="text-gray-500 mb-6">
                  {search ? `No results for "${search}"` : 'No rides posted yet for this filter'}
                </p>
                <Link
                  href="/rides/new"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl"
                >
                  + Be the first to post a ride
                </Link>
              </div>
            ) : (
              <>
                <p className="text-sm text-gray-500 font-medium mb-4">{filtered.length} rides available</p>
                <div className="space-y-3">
                  {filtered.map((ride) => (
                    <Link key={ride.id} href={`/rides/${ride.id}`}>
                      <div className="bg-white rounded-2xl p-5 border border-gray-100 hover:shadow-md hover:border-indigo-200 transition-all group">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-gray-400 text-sm">📍</span>
                              <h3 className="text-lg font-black text-gray-900 group-hover:text-indigo-700 transition-colors">
                                {ride.destinationText}
                              </h3>
                              {ride.distanceKm && (
                                <span className={`ml-auto px-2.5 py-0.5 rounded-full text-xs font-bold ${distanceBadge(ride.distanceKm)}`}>
                                  {ride.distanceKm} km
                                </span>
                              )}
                            </div>
                            <p className="text-gray-500 text-sm ml-6 mb-3">from {ride.originText}</p>
                            <div className="flex items-center gap-4 ml-6 text-sm text-gray-600">
                              <span>🕐 {formatTime(ride.earliestDepartAt)} - {formatTime(ride.latestDepartAt)}</span>
                              <span>👥 {ride.seatsAvailable} seats</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4 self-end">
                            <span className="text-xl font-black text-gray-900">$ {ride.price}</span>
                            <span className="text-indigo-600 font-bold">→</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Advanced Filters Modal */}
      {showFilters && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-black text-gray-900">Filters</h2>
              <button onClick={() => setShowFilters(false)} className="text-gray-400 hover:text-gray-700 text-xl font-bold">✕</button>
            </div>
            <div className="space-y-6">
              <div>
                <p className="font-bold text-gray-700 mb-3">Minimum Seats Available</p>
                <div className="grid grid-cols-4 gap-2">
                  {['1+', '2+', '3+', '4+'].map((s) => (
                    <button key={s} className="py-2 rounded-xl border-2 border-gray-200 font-bold text-sm hover:border-indigo-500 hover:text-indigo-600 transition-all">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="font-bold text-gray-700 mb-3">Distance</p>
                <div className="grid grid-cols-3 gap-2">
                  {['Short', 'Medium', 'Long'].map((d) => (
                    <button key={d} className="py-2 rounded-xl border-2 border-gray-200 font-bold text-sm hover:border-indigo-500 hover:text-indigo-600 transition-all">
                      {d}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-8 space-y-3">
              <button onClick={() => setShowFilters(false)} className="w-full py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black rounded-2xl shadow-xl">
                Apply Filters
              </button>
              <button onClick={() => setShowFilters(false)} className="w-full py-3 text-gray-500 font-semibold">Reset All</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
