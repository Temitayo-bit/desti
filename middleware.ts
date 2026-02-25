import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublic = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api(.*)',
])

export default clerkMiddleware((auth, req) => {
  // Minimal middleware - no protect()
  if (!isPublic(req)) {
    // Just log for now
    console.log('Protected route accessed:', req.nextUrl.pathname)
  }
})

export const config = {
  matcher: ['/((?!.*\\..*|_next).*)', '/', '/(api|trpc)(.*)'],
}
