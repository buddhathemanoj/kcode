# Next.js Web App Development Guide for kcode Authentication

This guide walks you through building the Next.js web app that handles authentication for the kcode desktop app.

## Overview

The web app provides:
1. **Clerk Authentication** - Sign-in/sign-up pages
2. **Desktop Token Generation** - JWT tokens for desktop app
3. **Token Refresh** - Endpoint to refresh expired tokens
4. **Token Validation** - Verify desktop app tokens

---

## Step 1: Create Next.js Project

```bash
# Navigate to your projects directory
cd ~/projects

# Create new Next.js app
npx create-next-app@latest kcode-web

# Choose these options:
# ✓ TypeScript: Yes
# ✓ ESLint: Yes
# ✓ Tailwind CSS: Yes
# ✓ src/ directory: Yes
# ✓ App Router: Yes
# ✓ Import alias: Yes (@/*)

cd kcode-web
```

---

## Step 2: Install Dependencies

```bash
# Clerk for authentication
npm install @clerk/nextjs

# JWT for token generation
npm install jose

# Database (optional for now)
npm install drizzle-orm postgres
npm install -D drizzle-kit
```

---

## Step 3: Set Up Clerk

### 3.1 Create Clerk Account

1. Go to https://clerk.com
2. Sign up / Sign in
3. Create new application: **"kcode"**
4. Choose authentication methods: **Email, Google, GitHub**
5. Copy your API keys

### 3.2 Configure Environment Variables

Create `.env.local`:

```env
# Clerk Keys (from Clerk dashboard)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# App URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Desktop deep link
NEXT_PUBLIC_DESKTOP_REDIRECT_URL=kcode-dev://auth/callback

# JWT Secret for desktop tokens (generate a random 32+ character string)
JWT_SECRET=your-super-secret-key-at-least-32-characters-long-change-this-in-production
```

**Generate JWT Secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Step 4: Configure Clerk in Next.js

### 4.1 Update Root Layout

Create/update `src/app/layout.tsx`:

```typescript
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'
import type { Metadata } from 'next'
import { Inter } from 'next/font/google'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'kcode - AI-Powered Code Assistant',
  description: 'Best UI for Claude Code with local and remote agent execution',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={inter.className}>{children}</body>
      </html>
    </ClerkProvider>
  )
}
```

### 4.2 Create Middleware

Create `src/middleware.ts`:

```typescript
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/',
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/api/webhooks(.*)',
])

export default clerkMiddleware((auth, request) => {
  if (!isPublicRoute(request)) {
    auth().protect()
  }
})

export const config = {
  matcher: [
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
    '/(api|trpc)(.*)',
  ],
}
```

---

## Step 5: Create Landing Page

Create `src/app/page.tsx`:

```typescript
import Link from 'next/link'
import { SignedIn, SignedOut, UserButton } from '@clerk/nextjs'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 text-white">
      {/* Header */}
      <header className="container mx-auto px-4 py-6 flex justify-between items-center">
        <div className="text-2xl font-bold">kcode</div>
        <nav className="flex items-center gap-4">
          <SignedOut>
            <Link
              href="/sign-in"
              className="px-4 py-2 rounded-lg hover:bg-gray-700 transition"
            >
              Sign In
            </Link>
            <Link
              href="/sign-up"
              className="px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700 transition"
            >
              Get Started
            </Link>
          </SignedOut>
          <SignedIn>
            <Link
              href="/dashboard"
              className="px-4 py-2 rounded-lg hover:bg-gray-700 transition"
            >
              Dashboard
            </Link>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </nav>
      </header>

      {/* Hero Section */}
      <main className="container mx-auto px-4 py-20">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6">
            AI-Powered Code Assistant
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 mb-8">
            Best UI for Claude Code with local and remote agent execution
          </p>
          <div className="flex gap-4 justify-center">
            <SignedOut>
              <Link
                href="/sign-up"
                className="px-8 py-4 bg-blue-600 rounded-lg text-lg font-semibold hover:bg-blue-700 transition"
              >
                Get Started Free
              </Link>
            </SignedOut>
            <SignedIn>
              <Link
                href="/dashboard"
                className="px-8 py-4 bg-blue-600 rounded-lg text-lg font-semibold hover:bg-blue-700 transition"
              >
                Go to Dashboard
              </Link>
            </SignedIn>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-20">
          <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-xl font-bold mb-3">Git Worktree Isolation</h3>
            <p className="text-gray-400">
              Each chat session runs in its own isolated worktree
            </p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-xl font-bold mb-3">Real-time Execution</h3>
            <p className="text-gray-400">
              See bash commands, file edits, and web searches as they happen
            </p>
          </div>
          <div className="bg-gray-800 p-6 rounded-lg">
            <h3 className="text-xl font-bold mb-3">Built-in Git Client</h3>
            <p className="text-gray-400">
              Stage, commit, and manage branches without leaving the app
            </p>
          </div>
        </div>
      </main>
    </div>
  )
}
```

---

## Step 6: Create Auth Pages

### 6.1 Sign-In Page

Create `src/app/sign-in/[[...sign-in]]/page.tsx`:

```typescript
import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <SignIn
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'bg-gray-800 shadow-xl',
          },
        }}
      />
    </div>
  )
}
```

### 6.2 Sign-Up Page

Create `src/app/sign-up/[[...sign-up]]/page.tsx`:

```typescript
import { SignUp } from '@clerk/nextjs'

export default function SignUpPage() {
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <SignUp
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'bg-gray-800 shadow-xl',
          },
        }}
      />
    </div>
  )
}
```

---

## Step 7: Create Desktop Callback Endpoint

This is the **most important** endpoint - it generates JWT tokens for the desktop app.

Create `src/app/api/auth/desktop-callback/route.ts`:

```typescript
import { auth, clerkClient } from '@clerk/nextjs/server'
import { NextResponse } from 'next/server'
import { SignJWT } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-min-32-chars'
)

export async function GET(request: Request) {
  const { userId } = auth()

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get user details from Clerk
    const user = await clerkClient.users.getUser(userId)

    // Generate access token (short-lived: 1 hour)
    const accessToken = await new SignJWT({
      userId: user.id,
      email: user.emailAddresses[0]?.emailAddress,
      name: user.firstName || user.lastName ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : null,
      type: 'access',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(JWT_SECRET)

    // Generate refresh token (long-lived: 7 days)
    const refreshToken = await new SignJWT({
      userId: user.id,
      type: 'refresh',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(JWT_SECRET)

    // Redirect to desktop app with tokens
    const redirectUrl = new URL(
      process.env.NEXT_PUBLIC_DESKTOP_REDIRECT_URL || 'kcode://auth/callback'
    )
    redirectUrl.searchParams.set('token', accessToken)
    redirectUrl.searchParams.set('refresh', refreshToken)
    redirectUrl.searchParams.set('userId', user.id)
    redirectUrl.searchParams.set(
      'email',
      user.emailAddresses[0]?.emailAddress || ''
    )

    return NextResponse.redirect(redirectUrl.toString())
  } catch (error) {
    console.error('Desktop callback error:', error)
    return NextResponse.json(
      { error: 'Failed to generate tokens' },
      { status: 500 }
    )
  }
}
```

---

## Step 8: Create Token Refresh Endpoint

Create `src/app/api/auth/refresh/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { jwtVerify, SignJWT } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-min-32-chars'
)

export async function POST(request: Request) {
  try {
    const { refreshToken } = await request.json()

    if (!refreshToken) {
      return NextResponse.json(
        { error: 'Refresh token required' },
        { status: 400 }
      )
    }

    // Verify refresh token
    const { payload } = await jwtVerify(refreshToken, JWT_SECRET)

    if (payload.type !== 'refresh') {
      return NextResponse.json(
        { error: 'Invalid token type' },
        { status: 401 }
      )
    }

    // Generate new access token
    const accessToken = await new SignJWT({
      userId: payload.userId,
      type: 'access',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(JWT_SECRET)

    return NextResponse.json({ accessToken })
  } catch (error) {
    console.error('Token refresh error:', error)
    return NextResponse.json(
      { error: 'Invalid or expired refresh token' },
      { status: 401 }
    )
  }
}
```

---

## Step 9: Create Token Validation Endpoint

Create `src/app/api/desktop/validate/route.ts`:

```typescript
import { NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'your-secret-key-min-32-chars'
)

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization')

    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing or invalid authorization header' },
        { status: 401 }
      )
    }

    const token = authHeader.substring(7)
    const { payload } = await jwtVerify(token, JWT_SECRET)

    if (payload.type !== 'access') {
      return NextResponse.json(
        { error: 'Invalid token type' },
        { status: 401 }
      )
    }

    return NextResponse.json({
      valid: true,
      userId: payload.userId,
      email: payload.email,
      name: payload.name,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Invalid or expired token' },
      { status: 401 }
    )
  }
}
```

---

## Step 10: Create Dashboard (Protected Route)

Create `src/app/dashboard/page.tsx`:

```typescript
import { currentUser } from '@clerk/nextjs/server'
import { redirect } from 'next/navigation'

export default async function DashboardPage() {
  const user = await currentUser()

  if (!user) {
    redirect('/sign-in')
  }

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-4">
          Welcome, {user.firstName || user.emailAddresses[0].emailAddress}!
        </h1>
        <div className="bg-gray-800 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Your Account</h2>
          <div className="space-y-2">
            <p>
              <span className="text-gray-400">Email:</span>{' '}
              {user.emailAddresses[0].emailAddress}
            </p>
            <p>
              <span className="text-gray-400">User ID:</span> {user.id}
            </p>
            <p>
              <span className="text-gray-400">Subscription:</span>{' '}
              <span className="text-blue-400">Free Tier</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

## Step 11: Configure Clerk Dashboard

1. Go to https://dashboard.clerk.com
2. Select your **kcode** application
3. Go to **Paths** settings:
   - Sign-in URL: `/sign-in`
   - Sign-up URL: `/sign-up`
   - After sign-in URL: `/api/auth/desktop-callback`
   - After sign-up URL: `/api/auth/desktop-callback`

4. Go to **Allowed redirect URLs**:
   - Add: `http://localhost:3000`
   - Add: `kcode-dev://auth/callback`
   - Add: `kcode://auth/callback` (for production)

---

## Step 12: Run and Test

```bash
# Start the development server
npm run dev
```

Visit http://localhost:3000

### Test Flow:

1. **Landing page** loads
2. Click **"Get Started"** → Sign-up page
3. Create account → Redirects to `/api/auth/desktop-callback`
4. Should redirect to `kcode-dev://auth/callback?token=...`
5. If desktop app is running, it will receive the tokens!

---

## Step 13: Test Desktop Integration

### Terminal 1 (Web App):
```bash
cd ~/projects/kcode-web
npm run dev
```

### Terminal 2 (Desktop App):
```bash
cd ~/projects/kcode
bun run dev
```

### Test:
1. Desktop app shows login screen
2. Click "Sign In"
3. Browser opens to web app
4. Sign in with Clerk
5. Browser redirects to `kcode-dev://auth/callback`
6. Desktop app receives tokens
7. Desktop app shows main interface

---

## Project Structure

```
kcode-web/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── desktop-callback/
│   │   │   │   │   └── route.ts          # Generate tokens
│   │   │   │   └── refresh/
│   │   │   │       └── route.ts          # Refresh tokens
│   │   │   └── desktop/
│   │   │       └── validate/
│   │   │           └── route.ts          # Validate tokens
│   │   ├── dashboard/
│   │   │   └── page.tsx                  # Protected dashboard
│   │   ├── sign-in/
│   │   │   └── [[...sign-in]]/
│   │   │       └── page.tsx              # Sign-in page
│   │   ├── sign-up/
│   │   │   └── [[...sign-up]]/
│   │   │       └── page.tsx              # Sign-up page
│   │   ├── layout.tsx                    # Root layout with Clerk
│   │   └── page.tsx                      # Landing page
│   └── middleware.ts                     # Clerk middleware
├── .env.local                            # Environment variables
└── package.json
```

---

## Environment Variables Summary

```env
# Clerk
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Desktop
NEXT_PUBLIC_DESKTOP_REDIRECT_URL=kcode-dev://auth/callback

# JWT
JWT_SECRET=your-super-secret-key-at-least-32-characters-long
```

---

## Troubleshooting

### "Redirect URL not allowed"
- Add `kcode-dev://auth/callback` to Clerk's allowed redirect URLs

### Desktop app doesn't open
- Check protocol is registered: `open "kcode-dev://auth/callback?token=test"`
- Restart desktop app

### Tokens not working
- Check JWT_SECRET is the same length (32+ chars)
- Check token expiry times
- Check desktop app is reading tokens correctly

---

## Next Steps

1. ✅ Web app is now complete
2. ✅ Desktop app can authenticate
3. 🔄 Add usage tracking (later)
4. 🔄 Add billing/subscriptions (later)
5. 🔄 Deploy to production

---

## Production Deployment

### Deploy Web App (Vercel)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard
# Update NEXT_PUBLIC_DESKTOP_REDIRECT_URL to kcode://auth/callback
```

### Update Desktop App

Update `.env.local` in desktop app:
```env
MAIN_VITE_WEB_APP_URL=https://your-app.vercel.app
```

Rebuild desktop app:
```bash
bun run build
```

---

## 🎉 You're Done!

Your Next.js web app is now ready to handle authentication for the kcode desktop app. Users can sign in via the web, and tokens are securely passed back to the desktop app via deep links.
