# Clerk Authentication Setup - Desktop App

## What Was Implemented

I've added Clerk authentication support to your kcode desktop app. Here's what was created:

### Main Process Files (Backend)

1. **`src/main/clerk-token-store.ts`** - Secure token storage using OS keychain
2. **`src/main/clerk-auth-service.ts`** - Authentication service with login/signup/logout
3. **`src/main/lib/trpc/routers/clerk-auth.ts`** - tRPC router for auth operations
4. **Updated `src/main/lib/trpc/routers/index.ts`** - Added clerkAuth router
5. **Updated `src/main/index.ts`** - Added deep link handler for auth callback

### Renderer Files (Frontend)

1. **`src/renderer/lib/hooks/use-clerk-auth.ts`** - React hook for authentication
2. **`src/renderer/components/clerk-login-screen.tsx`** - Login UI component
3. **Updated `src/preload/index.ts`** - Added Clerk auth event handlers

## Next Steps

### 1. Install Dependencies

The `electron-store` package has been installed. Restart your dev server:

```bash
# Stop the current dev server (Ctrl+C)
# Then restart:
bun run dev
```

### 2. Add Environment Variable

Add this to your `.env.local` file:

```env
# Web app URL for authentication
MAIN_VITE_WEB_APP_URL=http://localhost:3000
```

### 3. Test the Authentication Flow

Once your Next.js web app is ready with Clerk, you can test:

1. **Start the desktop app**: `bun run dev`
2. **Click "Sign In"** - Opens browser to `http://localhost:3000/sign-in?redirect=desktop`
3. **User authenticates** via Clerk on web app
4. **Web app redirects** to `kcode://auth/callback?token=xxx&refresh=yyy&userId=xxx`
5. **Desktop app receives** tokens via deep link
6. **Tokens stored** securely in OS keychain
7. **User is authenticated** in desktop app

## How to Use in Your App

### Option 1: Add Login Screen to Existing App

Update your main `App.tsx` to show login screen when not authenticated:

```tsx
import { useClerkAuth } from './lib/hooks/use-clerk-auth'
import { ClerkLoginScreen } from './components/clerk-login-screen'

function App() {
  const { isAuthenticated, isLoading } = useClerkAuth()

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (!isAuthenticated) {
    return <ClerkLoginScreen />
  }

  return (
    // Your existing app
    <YourMainApp />
  )
}
```

### Option 2: Use Auth Hook Anywhere

```tsx
import { useClerkAuth } from './lib/hooks/use-clerk-auth'

function MyComponent() {
  const { user, logout, validateToken } = useClerkAuth()

  return (
    <div>
      <p>Welcome, {user?.email}</p>
      <button onClick={logout}>Sign Out</button>
    </div>
  )
}
```

## Available tRPC Endpoints

The following endpoints are now available via `trpc.clerkAuth.*`:

- `getAuthState` - Get current auth state (query)
- `login` - Open browser for sign in (mutation)
- `signup` - Open browser for sign up (mutation)
- `logout` - Clear tokens and sign out (mutation)
- `validateToken` - Validate token with server (query)
- `refreshToken` - Refresh access token (mutation)
- `apiRequest` - Make authenticated API calls (mutation)

## Deep Link Protocol

The app is registered to handle `kcode://` (production) or `kcode-dev://` (development) URLs.

**Auth callback format:**
```
kcode://auth/callback?token=<jwt>&refresh=<jwt>&userId=<id>&email=<email>
```

## Token Storage

Tokens are stored securely using:
- **macOS**: Keychain
- **Windows**: Credential Manager
- **Linux**: Secret Service

Fallback: electron-store with encryption if OS keychain unavailable.

## Security Features

1. ✅ Tokens encrypted at rest
2. ✅ Access tokens short-lived (1 hour)
3. ✅ Refresh tokens long-lived (7 days)
4. ✅ Auto-refresh on 401 errors
5. ✅ Deep link validation
6. ✅ Context isolation in preload

## Troubleshooting

### "electronTRPC global not found"

**Solution**: Restart the dev server completely:
```bash
# Kill the process
# Then restart
bun run dev
```

### Deep links not working

**macOS**: 
```bash
# Check registration
open kcode-dev://auth/callback?token=test

# If not working, rebuild
bun run build
```

**Windows**: Run as administrator on first launch

**Linux**: Update desktop database
```bash
update-desktop-database ~/.local/share/applications
```

### Tokens not persisting

Check that `electron-store` is installed:
```bash
bun add electron-store
```

## Next: Web App Setup

You still need to create the Next.js web app with:

1. Clerk authentication
2. JWT token generation endpoint (`/api/auth/desktop-callback`)
3. Token refresh endpoint (`/api/auth/refresh`)
4. Token validation endpoint (`/api/desktop/validate`)

Refer to the `auth-plan.mdx` file for the complete web app implementation guide.

## File Structure

```
src/
├── main/
│   ├── clerk-auth-service.ts          # Auth service
│   ├── clerk-token-store.ts           # Token storage
│   ├── index.ts                       # Deep link handler
│   └── lib/trpc/routers/
│       ├── clerk-auth.ts              # Auth router
│       └── index.ts                   # Router registry
├── preload/
│   └── index.ts                       # Clerk event handlers
└── renderer/
    ├── components/
    │   └── clerk-login-screen.tsx     # Login UI
    └── lib/hooks/
        └── use-clerk-auth.ts          # Auth hook
```

## Testing Checklist

- [ ] Dev server restarts without errors
- [ ] `useClerkAuth` hook works in components
- [ ] Login button opens browser
- [ ] Deep link callback is received
- [ ] Tokens are stored securely
- [ ] Auth state persists across app restarts
- [ ] Logout clears tokens
- [ ] Token refresh works on 401 errors
