'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuth } from '@clerk/nextjs'
import Navbar from '@/components/Navbar'

type TripRequest = {
  id: string
  destinationText: string
  originText: string
  earliestDepartAt: string
  latestDepartAt: string
  seatsNeeded: number
  maxPrice: number
  note?: string
  requester?: { firstName: string; lastName: string }
}

const formatTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

const formatDate = (iso: string) => {
  const d = new Date(iso)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return 'Today'
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export default function TripRequests() {
  const { getToken } = useAuth()
  const [requests, setRequests] = useState<TripRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const token = await getToken()
        const res = await fetch('/api/trip-requests', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) throw new Error('Failed to load requests')
        const data = await res.json()
        const list = data.requests ?? data.tripRequests ?? data.data ?? data
        setRequests(Array.isArray(list) ? list : [])

      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }
    fetchRequests()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-black text-gray-900">Trip Requests</h1>
            <p className="text-gray-500 mt-1 text-sm">Students looking for rides — offer to drive them</p>
          </div>
          <Link
            href="/trip-requests/new"
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl hover:from-indigo-700 transition-all text-sm"
          >
            + Post Request
          </Link>
        </div>

        {/* List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white rounded-2xl p-5 border border-gray-100 animate-pulse h-28" />
            ))}
          </div>
        ) : error ? (
          <div className="bg-red-50 rounded-2xl p-6 border border-red-100 text-red-700 font-semibold">{error}</div>
        ) : requests.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 border border-gray-100 shadow-sm text-center">
            <p className="text-5xl mb-4">📬</p>
            <h3 className="text-xl font-black text-gray-900 mb-2">No requests yet</h3>
            <p className="text-gray-500 text-sm mb-6">Be the first to post a trip request</p>
            <Link
              href="/trip-requests/new"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold rounded-xl shadow-lg"
            >
              + Post a Request
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => (
              <div
                key={req.id}
                className="bg-white rounded-2xl p-5 border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-gray-400 text-sm">📍</span>
                      <h3 className="font-black text-gray-900">{req.destinationText}</h3>
                    </div>
                    <p className="text-gray-500 text-sm ml-6 mb-3">from {req.originText}</p>
                    <div className="flex flex-wrap items-center gap-4 ml-6 text-sm text-gray-600">
                      <span>🕐 {formatTime(req.earliestDepartAt)} – {formatTime(req.latestDepartAt)}</span>
                      <span>📅 {formatDate(req.earliestDepartAt)}</span>
                      <span>👥 {req.seatsNeeded} seat{req.seatsNeeded > 1 ? 's' : ''}</span>
                      <span className="font-bold text-indigo-600">up to ${req.maxPrice}</span>
                    </div>
                    {req.note && (
                      <p className="ml-6 mt-3 text-sm text-gray-500 italic">"{req.note}"</p>
                    )}
                  </div>
                  {req.requester && (
                    <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                      <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-black text-sm">{req.requester.firstName[0]}</span>
                      </div>
                      <div>
                        <p className="text-xs font-bold text-gray-700">{req.requester.firstName} {req.requester.lastName[0]}.</p>
                        <p className="text-xs text-gray-400">Stetson</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
