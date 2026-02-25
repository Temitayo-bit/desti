'use client'
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from '@clerk/nextjs'
import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-12 lg:p-24 bg-gradient-to-br from-indigo-50 to-purple-50">
      <div className="text-center max-w-4xl mx-auto space-y-12">
        
        {/* Header */}
        <div>
          <h1 className="text-6xl lg:text-7xl font-black bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-900 bg-clip-text text-transparent mb-6 drop-shadow-2xl">
            DESTi
          </h1>
          <p className="text-2xl lg:text-3xl text-gray-700 font-light leading-tight">
            Safe rides for Stetson students
          </p>
          <p className="text-lg text-indigo-600 font-semibold mt-2">stetson email required</p>
        </div>

        {/* Auth Buttons - Standard */}
        <SignedOut>
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center p-8 bg-white/60 backdrop-blur-xl rounded-3xl shadow-2xl max-w-2xl w-full">
            <SignInButton mode="modal">
              <button className="flex-1 px-10 py-5 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold text-xl rounded-2xl shadow-xl hover:shadow-2xl hover:from-indigo-700 transition-all">
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="flex-1 px-10 py-5 border-3 border-indigo-600 text-indigo-600 font-bold text-xl rounded-2xl shadow-xl hover:bg-indigo-600 hover:text-white transition-all">
                Sign Up
              </button>
            </SignUpButton>
          </div>
        </SignedOut>

        <SignedIn>
          <UserButton afterSignOutUrl="/" />
        </SignedIn>

        {/* Driver/Rider Preview Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-6xl w-full pt-12">
          
          {/* Driver */}
          <Link href="/rides/new" className="group">
            <div className="p-10 rounded-3xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-200/50 backdrop-blur-xl shadow-2xl hover:shadow-3xl hover:-translate-y-2 hover:from-indigo-500/20 transition-all">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center text-white shadow-lg text-xl">
                  🚗
                </div>
                <div>
                  <h3 className="text-3xl font-black text-gray-900 mb-2 group-hover:text-indigo-600">Driver</h3>
                  <p className="text-indigo-600 font-bold text-xl">Earn money</p>
                </div>
              </div>
              <ul className="text-gray-700 space-y-2 mb-8 text-left">
                <li>• Post rides to your destinations</li>
                <li>• Set price per seat & availability</li>
                <li>• Control seat bookings manually</li>
              </ul>
            </div>
          </Link>

          {/* Rider */}
          <Link href="/rides" className="group">
            <div className="p-10 rounded-3xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-200/50 backdrop-blur-xl shadow-2xl hover:shadow-3xl hover:-translate-y-2 hover:from-indigo-500/20 transition-all">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center text-white shadow-lg text-xl">
                  👥
                </div>
                <div>
                  <h3 className="text-3xl font-black text-gray-900 mb-2 group-hover:text-indigo-600">Rider</h3>
                  <p className="text-indigo-600 font-bold text-xl">Find rides</p>
                </div>
              </div>
              <ul className="text-gray-700 space-y-2 mb-8 text-left">
                <li>• Browse rides by destination & time</li>
                <li>• Book available seats directly</li>
                <li>• Post trip requests for matching</li>
              </ul>
            </div>
          </Link>

        </div>
      </div>
    </main>
  )
}
