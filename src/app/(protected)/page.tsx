'use client'
import Link from 'next/link'
import { UserButton, SignedIn, SignedOut, SignInButton, SignUpButton } from '@clerk/nextjs'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24 bg-gradient-to-br from-indigo-50 to-blue-50">
      <div className="text-center max-w-2xl">
        <h1 className="text-6xl font-black bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-6 drop-shadow-lg">
          DESTi
        </h1>
        <p className="text-xl text-gray-700 mb-8 leading-relaxed">
          Safe rides. Post rides or find travels on campus.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12 p-4 rounded-xl bg-white/50 backdrop-blur-sm shadow-xl">
          <SignedOut>
            <SignInButton mode="modal">
              <button className="px-8 py-4 bg-indigo-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl hover:bg-indigo-700 transition-all text-lg">
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="px-8 py-4 border-2 border-indigo-600 text-indigo-600 font-semibold rounded-xl shadow-lg hover:shadow-xl hover:bg-indigo-600 hover:text-white transition-all text-lg">
                Sign Up (@stetson.edu)
              </button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <UserButton />
          </SignedIn>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-16 max-w-4xl w-full">
          <div className="text-left p-6 bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-2xl transition-all">
            <h3 className="text-2xl font-bold text-gray-900 mb-2"> Drivers</h3>
            <p>Post rides with destination, time window, price & available seats</p>
          </div>
          <div className="text-left p-6 bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-2xl transition-all">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">👥 Riders</h3>
            <p>Browse rides or post trip requests</p>
          </div>
          <div className="text-left p-6 bg-white/70 backdrop-blur-sm rounded-2xl shadow-lg hover:shadow-2xl transition-all">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">✅ Verified</h3>
            <p>Stetson students only. Seat availability enforced.</p>
          </div>
        </div>
      </div>
    </main>
  )
}
