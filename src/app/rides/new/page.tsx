'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@clerk/nextjs'
import Link from 'next/link'

export default function PostRidePage() {
  const { getToken } = useAuth()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    originText: '',
    destinationText: '',
    earliestDepartAt: '',
    latestDepartAt: '',
    distanceCategory: 'short',
    price: '',
    seatsTotal: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const token = await getToken()
      const idempotencyKey = `ride-${Date.now()}-${Math.random()}`

      const res = await fetch('/api/rides', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify({
          ...form,
          price: parseFloat(form.price),
          seatsTotal: parseInt(form.seatsTotal),
          earliestDepartAt: new Date(form.earliestDepartAt).toISOString(),
          latestDepartAt: new Date(form.latestDepartAt).toISOString(),
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || 'Failed to post ride')
      }

      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 py-12">
      <div className="max-w-2xl mx-auto px-4">

        <Link href="/dashboard" className="text-indigo-600 font-semibold hover:underline mb-8 block">
          ← Back to Dashboard
        </Link>

        <div className="bg-white/80 backdrop-blur rounded-3xl shadow-2xl p-10 border border-indigo-100">
          <h1 className="text-4xl font-black bg-gradient-to-r from-indigo-900 to-purple-900 bg-clip-text text-transparent mb-2">
            Post a Ride
          </h1>
          <p className="text-gray-600 mb-10">Fill in your trip details. Riders will book from this listing.</p>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl font-medium">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
                From (Origin)
              </label>
              <input
                name="originText"
                value={form.originText}
                onChange={handleChange}
                placeholder="e.g. Hatfield Dorm"
                required
                className="w-full p-4 rounded-2xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none text-lg transition-all"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
                To (Destination)
              </label>
              <input
                name="destinationText"
                value={form.destinationText}
                onChange={handleChange}
                placeholder="e.g. DeLand Station"
                required
                className="w-full p-4 rounded-2xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none text-lg transition-all"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
                  Earliest Departure
                </label>
                <input
                  type="datetime-local"
                  name="earliestDepartAt"
                  value={form.earliestDepartAt}
                  onChange={handleChange}
                  required
                  className="w-full p-4 rounded-2xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none text-lg transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
                  Latest Departure
                </label>
                <input
                  type="datetime-local"
                  name="latestDepartAt"
                  value={form.latestDepartAt}
                  onChange={handleChange}
                  required
                  className="w-full p-4 rounded-2xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none text-lg transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
                Distance Category
              </label>
              <select
                name="distanceCategory"
                value={form.distanceCategory}
                onChange={handleChange}
                className="w-full p-4 rounded-2xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none text-lg transition-all bg-white"
              >
                <option value="short">Short (on/near campus)</option>
                <option value="medium">Medium (nearby city)</option>
                <option value="long">Long (1hr+ away)</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
                  Price per Seat ($)
                </label>
                <input
                  type="number"
                  name="price"
                  value={form.price}
                  onChange={handleChange}
                  placeholder="e.g. 10"
                  min="0"
                  step="0.01"
                  required
                  className="w-full p-4 rounded-2xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none text-lg transition-all"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2 uppercase tracking-wide">
                  Total Seats
                </label>
                <input
                  type="number"
                  name="seatsTotal"
                  value={form.seatsTotal}
                  onChange={handleChange}
                  placeholder="e.g. 3"
                  min="1"
                  max="8"
                  required
                  className="w-full p-4 rounded-2xl border-2 border-gray-200 focus:border-indigo-500 focus:outline-none text-lg transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-xl rounded-2xl shadow-2xl hover:shadow-3xl hover:from-indigo-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Posting Ride...' : 'Post Ride 🚗'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
