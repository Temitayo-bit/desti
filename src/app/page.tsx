'use client'
import { useState } from 'react'
import Link from 'next/link'

// ── Navbar ──────────────────────────────────────────────
function LandingNav() {
  return (
    <nav className="bg-[#EDEAE5] border-b border-[#E0DDD8] sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2.5">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="14" fill="#1F6F43"/>
              <path d="M8 14c0-3.3 2.7-6 6-6s6 2.7 6 6-2.7 6-6 6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="14" cy="14" r="2.5" fill="white"/>
            </svg>
            <span className="text-xl font-black text-[#0D1F17]">Desti</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#how-it-works" className="text-sm font-medium text-[#4B5563] hover:text-[#1F6F43] transition-colors">How it Works</a>
            <a href="#safety" className="text-sm font-medium text-[#4B5563] hover:text-[#1F6F43] transition-colors">Safety</a>
            <a href="#faq" className="text-sm font-medium text-[#4B5563] hover:text-[#1F6F43] transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/sign-in" className="text-sm font-semibold text-[#0D1F17] hover:text-[#1F6F43] transition-colors">
              Log In
            </Link>
            <Link href="/sign-up" className="px-5 py-2.5 bg-[#1F6F43] text-white font-bold rounded-full text-sm hover:bg-[#185c38] transition-colors shadow-sm">
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}

// ── Ride Preview Card ────────────────────────────────────
function RideCard({ destination, date, price, seats, duration }: {
  destination: string
  date: string
  price: number
  seats: number
  duration: string
}) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-[#E8E4DE]">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-bold text-[#0D1F17] text-lg">{destination}</h3>
          <p className="text-[#9CA3AF] text-sm mt-0.5">{date}</p>
        </div>
        <div className="text-right">
          <p className="text-[#1F6F43] font-black text-2xl">${price}</p>
          <p className="text-[#9CA3AF] text-xs">per person</p>
        </div>
      </div>
      <div className="flex items-center gap-5 text-sm text-[#6B7280]">
        <span className="flex items-center gap-1.5">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          {seats} seats left
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
          </svg>
          {duration}
        </span>
      </div>
    </div>
  )
}

// ── FAQ Item ─────────────────────────────────────────────
function FAQCard({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="bg-white rounded-2xl p-6 border border-[#E8E4DE] shadow-sm">
      <div className="flex items-start gap-4">
        <div className="w-8 h-8 rounded-full border-2 border-[#1F6F43] flex items-center justify-center flex-shrink-0 mt-0.5">
          <span className="text-[#1F6F43] font-bold text-sm">?</span>
        </div>
        <div>
          <h3 className="font-bold text-[#0D1F17] text-base mb-2">{question}</h3>
          <p className="text-[#6B7280] text-sm leading-relaxed">{answer}</p>
        </div>
      </div>
    </div>
  )
}

// ── AI Chatbot Button ─────────────────────────────────────
function ChatbotButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="fixed bottom-6 right-6 z-50 w-12 h-12 bg-[#0D1F17] rounded-full flex items-center justify-center shadow-lg hover:bg-[#1F6F43] transition-colors"
      >
        {open ? (
          <svg width="18" height="18" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        ) : (
          <svg width="20" height="20" fill="none" stroke="white" strokeWidth="1.8" viewBox="0 0 24 24">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          </svg>
        )}
      </button>
      {open && (
        <div className="fixed bottom-22 right-6 z-50 w-80 bg-white rounded-2xl shadow-2xl border border-[#E8E4DE] overflow-hidden">
          <div className="bg-[#1F6F43] p-4 flex items-center gap-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
            <div>
              <p className="text-white font-bold text-sm">Desti Assistant</p>
              <p className="text-white/70 text-xs">Ask me anything</p>
            </div>
          </div>
          <div className="p-4">
            <div className="bg-[#F5F5F5] rounded-xl p-3 mb-4">
              <p className="text-sm text-[#374151]">👋 Hi! I'm the Desti AI assistant. I can help you find rides, answer questions about how Desti works, or guide you through posting your first ride!</p>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Ask something..."
                className="flex-1 text-sm px-3 py-2 rounded-xl border border-[#E8E4DE] focus:border-[#1F6F43] focus:outline-none bg-[#F9F9F9]"
              />
              <button className="w-9 h-9 bg-[#1F6F43] rounded-xl flex items-center justify-center flex-shrink-0">
                <svg width="14" height="14" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24">
                  <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ── Main Landing Page ─────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#EDEAE5] font-sans">
      <LandingNav />

      {/* ── 1. HERO ── */}
      <section className="max-w-7xl mx-auto px-6 lg:px-8 py-20 lg:py-28">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="text-6xl lg:text-7xl font-black text-[#0D1F17] leading-[1.05] tracking-tight mb-6">
              Share rides<br />with verified<br />Stetson<br />students.
            </h1>
            <p className="text-lg text-[#6B7280] leading-relaxed mb-8 max-w-md">
              Desti helps Stetson students find safe, affordable rides to airports, home, and everywhere in between.
            </p>
            <div className="flex items-center gap-4">
              <Link href="/rides" className="px-7 py-3.5 bg-[#1F6F43] text-white font-bold rounded-full text-base hover:bg-[#185c38] transition-colors shadow-md">
                Find a Ride
              </Link>
              <Link href="/rides/new" className="px-7 py-3.5 border-2 border-[#0D1F17] text-[#0D1F17] font-bold rounded-full text-base hover:bg-[#0D1F17] hover:text-white transition-colors">
                Post a Ride
              </Link>
            </div>
            {/* Trust line */}
            <div className="flex items-center gap-2 mt-4">
              <svg width="16" height="16" fill="none" stroke="#1F6F43" strokeWidth="2.5" viewBox="0 0 24 24">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <span className="text-sm text-[#4B5563]">Only verified @stetson.edu students</span>
            </div>
          </div>
          <div className="space-y-4">
            <RideCard destination="Orlando Airport" date="March 8, 2:00 PM" price={15} seats={2} duration="1h 15min" />
            <RideCard destination="Daytona Beach" date="March 9, 11:00 AM" price={8} seats={3} duration="25min" />
            <RideCard destination="Winter Park" date="March 10, 4:30 PM" price={12} seats={4} duration="45min" />
          </div>
        </div>
      </section>

      {/* ── 2. FEATURES ── */}
      <section className="bg-[#EDEAE5] py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <h2 className="text-5xl font-black text-[#0D1F17] text-center mb-4">Everything you need to<br />coordinate rides</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-14">
            {[
              {
                icon: (
                  <svg width="24" height="24" fill="none" stroke="#1F6F43" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                ),
                title: 'Verified students only',
                desc: 'Every user must sign in with a Stetson email. No random strangers.',
              },
              {
                icon: (
                  <svg width="24" height="24" fill="none" stroke="#1F6F43" strokeWidth="2" viewBox="0 0 24 24">
                    <rect x="1" y="3" width="15" height="13" rx="2"/>
                    <path d="M16 8h4l3 3v5h-7V8z"/>
                    <circle cx="5.5" cy="18.5" r="2.5"/>
                    <circle cx="18.5" cy="18.5" r="2.5"/>
                  </svg>
                ),
                title: 'Easy ride posting',
                desc: 'Drivers can post rides in seconds and fill empty seats with students going the same way.',
              },
              {
                icon: (
                  <svg width="24" height="24" fill="none" stroke="#1F6F43" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
                    <circle cx="12" cy="10" r="3"/>
                  </svg>
                ),
                title: 'Flexible ride requests',
                desc: 'Need a ride? Post a request and drivers can send you offers.',
              },
              {
                icon: (
                  <svg width="24" height="24" fill="none" stroke="#1F6F43" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                ),
                title: 'Built-in messaging',
                desc: 'Coordinate pickup times and locations directly inside the app.',
              },
              {
                icon: (
                  <svg width="24" height="24" fill="none" stroke="#1F6F43" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
                  </svg>
                ),
                title: 'Simple offers',
                desc: 'Drivers can respond to trip requests with a price and seat availability.',
              },
              {
                icon: (
                  <svg width="24" height="24" fill="none" stroke="#1F6F43" strokeWidth="2" viewBox="0 0 24 24">
                    <line x1="12" y1="1" x2="12" y2="23"/>
                    <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
                  </svg>
                ),
                title: 'Student-friendly pricing',
                desc: 'Share gas costs and keep travel affordable.',
              },
            ].map((f, i) => (
              <div key={i} className="bg-white rounded-2xl p-7 border border-[#E8E4DE] shadow-sm">
                <div className="w-14 h-14 bg-[#DFF3E7] rounded-2xl flex items-center justify-center mb-5">
                  {f.icon}
                </div>
                <h3 className="font-black text-[#0D1F17] text-lg mb-2">{f.title}</h3>
                <p className="text-[#6B7280] text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 3. HOW IT WORKS ── */}
      <section id="how-it-works" className="bg-[#EDEAE5] py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <h2 className="text-5xl font-black text-[#0D1F17] text-center mb-16">How Desti Works</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {[
              {
                num: '1',
                icon: (
                  <svg width="28" height="28" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                ),
                title: 'Create or browse rides',
                desc: 'Search for rides posted by other students or post your own ride.',
              },
              {
                num: '2',
                icon: (
                  <svg width="28" height="28" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M22 2L11 13"/><path d="M22 2L15 22l-4-9-9-4 20-7z"/>
                  </svg>
                ),
                title: 'Book or send an offer',
                desc: 'Reserve your seat or respond to a trip request with a ride offer.',
              },
              {
                num: '3',
                icon: (
                  <svg width="28" height="28" fill="none" stroke="white" strokeWidth="2" viewBox="0 0 24 24">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                ),
                title: 'Meet and ride',
                desc: 'Coordinate details through messaging and travel together.',
              },
            ].map((step, i) => (
              <div key={i} className="flex flex-col items-center text-center">
                <div className="relative mb-6">
                  <div className="w-20 h-20 bg-[#1F6F43] rounded-full flex items-center justify-center shadow-lg">
                    {step.icon}
                  </div>
                  <div className="absolute -top-1 -right-1 w-7 h-7 bg-[#EDEAE5] border-2 border-[#1F6F43] rounded-full flex items-center justify-center">
                    <span className="text-[#1F6F43] font-black text-xs">{step.num}</span>
                  </div>
                </div>
                <h3 className="text-xl font-black text-[#0D1F17] mb-2">{step.title}</h3>
                <p className="text-[#6B7280] text-sm leading-relaxed max-w-xs">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. SAFETY ── */}
      <section id="safety" className="bg-[#EDEAE5] py-20">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
            <div>
              <p className="text-xs font-bold text-[#1F6F43] uppercase tracking-widest mb-3">Designed for student safety</p>
              <h2 className="text-5xl font-black text-[#0D1F17] leading-tight mb-4">
                Trust the people<br />you're riding with
              </h2>
              <p className="text-[#6B7280] mb-10 leading-relaxed">
                Private messaging, verified accounts, and clear confirmations keep ride coordination simple and secure.
              </p>
              <div className="space-y-7">
                {[
                  {
                    icon: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>,
                    title: 'Verified Stetson accounts only',
                    desc: 'Only students with verified @stetson.edu emails can join.',
                  },
                  {
                    icon: <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
                    title: 'Private conversations between riders and drivers',
                    desc: 'All messaging happens securely within the app.',
                  },
                  {
                    icon: <><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12 19.79 19.79 0 0 1 1.59 3.41 2 2 0 0 1 3.56 1.23h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L7.91 8.96a16 16 0 0 0 6.13 6.13l1.27-1.27a2 2 0 0 1 2.11-.45c.9.354 1.847.57 2.81.65A2 2 0 0 1 22 16.92z"/></>,
                    title: 'No public phone numbers',
                    desc: 'Coordinate without sharing personal contact info.',
                  },
                  {
                    icon: <><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></>,
                    title: 'Clear ride confirmations',
                    desc: "Know exactly who you're riding with before you go.",
                  },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-4">
                    <div className="w-10 h-10 bg-[#DFF3E7] rounded-xl flex items-center justify-center flex-shrink-0">
                      <svg width="18" height="18" fill="none" stroke="#1F6F43" strokeWidth="2" viewBox="0 0 24 24">
                        {item.icon}
                      </svg>
                    </div>
                    <div>
                      <p className="font-bold text-[#0D1F17] mb-1">{item.title}</p>
                      <p className="text-[#6B7280] text-sm">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Chat mockup */}
            <div className="bg-white rounded-3xl shadow-xl border-4 border-[#1F6F43] overflow-hidden max-w-sm mx-auto w-full">
              <div className="p-5 border-b border-[#E8E4DE]">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 bg-[#E8E4DE] rounded-full"></div>
                  <div>
                    <p className="font-bold text-[#0D1F17]">Sarah Martinez</p>
                    <p className="text-xs text-[#9CA3AF]">@stetson.edu verified</p>
                  </div>
                </div>
              </div>
              <div className="p-5 space-y-4 bg-white min-h-48">
                <div className="flex justify-start">
                  <div className="bg-[#F3F4F6] rounded-2xl rounded-bl-sm px-4 py-3 max-w-xs">
                    <p className="text-sm text-[#0D1F17]">Hey! What time works for pickup?</p>
                    <p className="text-xs text-[#9CA3AF] mt-1">10:23 AM</p>
                  </div>
                </div>
                <div className="flex justify-end">
                  <div className="bg-[#1F6F43] rounded-2xl rounded-br-sm px-4 py-3 max-w-xs">
                    <p className="text-sm text-white">How about 2:00 PM at the main entrance?</p>
                    <p className="text-xs text-white/60 mt-1">10:24 AM</p>
                  </div>
                </div>
                <div className="flex justify-start">
                  <div className="bg-[#F3F4F6] rounded-2xl rounded-bl-sm px-4 py-3 max-w-xs">
                    <p className="text-sm text-[#0D1F17]">Perfect! See you then.</p>
                    <p className="text-xs text-[#9CA3AF] mt-1">10:25 AM</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. FAQ ── */}
      <section id="faq" className="bg-[#EDEAE5] py-20">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <h2 className="text-5xl font-black text-[#0D1F17] text-center mb-3">Frequently asked questions</h2>
          <p className="text-[#9CA3AF] text-center mb-12">Everything students usually want to know before sharing a ride.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FAQCard question="Who can use Desti?" answer="Desti is limited to students with a verified @stetson.edu email address." />
            <FAQCard question="How do payments work?" answer="Drivers set a simple per-seat contribution so riders can split gas costs clearly before the trip." />
            <FAQCard question="Can I request a ride instead of posting one?" answer="Yes. Riders can post trip requests and drivers can respond with offers that include seats and pricing." />
            <FAQCard question="How do riders and drivers coordinate?" answer="Every booking and accepted offer includes in-app messaging so you can confirm pickup details privately." />
            <FAQCard question="Is Desti free to use?" answer="Yes, Desti is completely free. Drivers set their own per-seat price to cover gas costs." />
            <FAQCard question="What if my plans change?" answer="You can cancel a booking before the departure window. Message the driver directly to let them know." />
          </div>
        </div>
      </section>

      {/* ── 6. CTA BANNER ── */}
      <section className="bg-[#EDEAE5] py-10">
        <div className="max-w-5xl mx-auto px-6 lg:px-8">
          <div className="bg-[#1F6F43] rounded-3xl px-10 py-14 text-center">
            <h2 className="text-4xl lg:text-5xl font-black text-white mb-3">Ready to share your next ride?</h2>
            <p className="text-white/80 mb-10 text-lg">Join verified Stetson students already sharing rides.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/rides" className="px-10 py-4 bg-white text-[#1F6F43] font-bold rounded-full text-base hover:bg-gray-100 transition-colors shadow-md">
                Browse Rides
              </Link>
              <Link href="/rides/new" className="px-10 py-4 border-2 border-white text-white font-bold rounded-full text-base hover:bg-white hover:text-[#1F6F43] transition-colors">
                Post a Ride
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="bg-[#EDEAE5] border-t border-[#E0DDD8] py-12">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
                  <circle cx="14" cy="14" r="14" fill="#1F6F43"/>
                  <path d="M8 14c0-3.3 2.7-6 6-6s6 2.7 6 6-2.7 6-6 6" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                  <circle cx="14" cy="14" r="2.5" fill="white"/>
                </svg>
                <span className="font-black text-[#0D1F17] text-lg">Desti</span>
              </div>
              <p className="text-[#9CA3AF] text-sm leading-relaxed">Built for the Stetson University community.</p>
            </div>
            <div>
              <p className="font-bold text-[#0D1F17] mb-4">Product</p>
              <div className="space-y-2">
                <a href="#how-it-works" className="block text-sm text-[#9CA3AF] hover:text-[#1F6F43] transition-colors">How it Works</a>
                <a href="#safety" className="block text-sm text-[#9CA3AF] hover:text-[#1F6F43] transition-colors">Safety</a>
              </div>
            </div>
            <div>
              <p className="font-bold text-[#0D1F17] mb-4">Support</p>
              <div className="space-y-2">
                <a href="#faq" className="block text-sm text-[#9CA3AF] hover:text-[#1F6F43] transition-colors">FAQ</a>
                <a href="mailto:support@desti.app" className="block text-sm text-[#9CA3AF] hover:text-[#1F6F43] transition-colors">Contact</a>
              </div>
            </div>
          </div>
          <div className="border-t border-[#E0DDD8] pt-8 text-center">
            <p className="text-sm text-[#9CA3AF]">© 2026 Desti. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* ── AI CHATBOT ── */}
      <ChatbotButton />
    </div>
  )
}
