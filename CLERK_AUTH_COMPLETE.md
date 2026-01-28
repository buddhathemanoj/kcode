# Clerk Authentication - Complete Implementation

## ✅ What Was Implemented

### 1. Authentication Flow
- **Login Screen**: Shows when user is not authenticated
- **Deep Link Handler**: Receives tokens from web app via `kcode://auth/callback`
- **Token Storage**: Secure storage using OS keychain (macOS Keychain, Windows Credential Manager)
- **Auto-refresh**: Tokens automatically refresh on 401 errors
- **Logout**: Clears all tokens and returns to login screen

### 2. Files Created

#### Main Process (Backend)
- `src/main/clerk-token-store.ts` - Secure token storage with OS keychain
- `src/main/clerk-auth-service.ts` - Authentication service (login/signup/logout/refresh)
- `src/main/lib/trpc/routers/clerk-auth.ts` - tRPC router for auth operations

#### Renderer (Frontend)
- `src/renderer/lib/hooks/use-clerk-auth.ts` - React hook for authentication
- `src/renderer/components/clerk-login-screen.tsx` - Login UI
- `src/renderer/components/clerk-user-menu.tsx` - User dropdown menu (optional)

### 3. Files Modified

#### Main Process
- `src/main/index.ts` - Added deep link handler for auth callback
- `src/main/lib/trpc/routers/index.ts` - Added clerkAuth router

#### Renderer
- `src/renderer/App.tsx` - Added auth gate (shows login screen when not authenticated)
- `src/renderer/components/dialogs/settings-tabs/agents-profile-tab.tsx` - Added Clerk user info and logout button
- `src/preload/index.ts` - Added Clerk auth event handlers

## 🔒 Authentication Flow

```
1. User opens app
   ↓
2. App checks if authenticated (has tokens)
   ↓
3a. NOT AUTHENTICATED → Show ClerkLoginScreen
   ↓
4. User clicks "Sign In" or "Create Account"
   ↓
5. Opens browser: http://localhost:3000/sign-in?redirect=desktop
   ↓
6. User authenticates via Clerk on web app
   ↓
7. Web app redirects: kcode://auth/callback?token=xxx&refresh=yyy&userId=xxx
   ↓
8. Desktop app receives deep link
   ↓
9. Tokens stored securely in OS keychain
   ↓
10. User is authenticated → Show main app

3b. AUTHENTICATED → Show main app directly
```

## 🎯 User Experience

### First Launch
1. User sees login screen with "Sign In" and "Create Account" buttons
2. Clicking either button opens browser
3. User completes authentication on web app
4. Browser redirects back to desktop app
5. User is now logged in

### Subsequent Launches
1. App checks stored tokens
2. If valid, user goes directly to main app
3. No login required

### Logout
1. User opens Settings → Account tab
2. Clicks "Sign Out" button
3. Tokens are cleared
4. Returns to login screen

## 📁 Where to Find Things

### Login Screen
- Component: `src/renderer/components/clerk-login-screen.tsx`
- Shown in: `src/renderer/App.tsx` when `!isAuthenticated`

### User Profile & Logout
- Settings → Account tab
- Shows: Email, User ID, Subscription tier, Sign Out button

### Auth Hook (Use Anywhere)
```tsx
import { useClerkAuth } from './lib/hooks/use-clerk-auth'

function MyComponent() {
  const { isAuthenticated, user, logout } = useClerkAuth()
  
  return (
    <div>
      {isAuthenticated ? (
        <p>Welcome, {user?.email}</p>
      ) : (
        <p>Please sign in</p>
      )}
    </div>
  )
}
```

## 🔧 Configuration

### Environment Variables

Add to `.env.local`:
```env
# Web app URL for authentication
MAIN_VITE_WEB_APP_URL=http://localhost:3000
```

### Deep Link Protocol

- **Development**: `kcode-dev://`
- **Production**: `kcode://`

The protocol is automatically registered when the app starts.

## 🧪 Testing

### Test Authentication Flow

1. **Start the app**:
   ```bash
   bun run dev
   ```

2. **You should see**: Login screen (since no tokens stored)

3. **Click "Sign In"**: Browser should open (will fail until web app is ready)

4. **Test deep link manually**:
   ```bash
   # macOS
   open "kcode-dev://auth/callback?token=test&refresh=test&userId=test123&email=test@example.com"
   
   # This should store tokens and show main app
   ```

5. **Check tokens stored**:
   - macOS: Keychain Access → Search "kcode-clerk-auth"
   - Or check: `~/Library/Application Support/kcode Dev/`

6. **Test logout**:
   - Open Settings → Account
   - Click "Sign Out"
   - Should return to login screen

7. **Restart app**: Should show login screen (tokens cleared)

## 🚀 Next Steps

### 1. Build the Web App

You need to create the Next.js web app with:

- Clerk authentication setup
- Sign-in/sign-up pages
- Desktop callback endpoint: `/api/auth/desktop-callback`
- Token generation (JWT)
- Token refresh endpoint: `/api/auth/refresh`
- Token validation endpoint: `/api/desktop/validate`

See `auth-plan.mdx` for complete web app implementation guide.

### 2. Test End-to-End

Once web app is ready:

1. Start web app: `npm run dev` (in kcode-web directory)
2. Start desktop app: `bun run dev` (in kcode directory)
3. Click "Sign In" in desktop app
4. Complete authentication in browser
5. Verify redirect back to desktop app
6. Verify tokens stored
7. Verify main app loads

### 3. Production Deployment

1. Deploy web app to production
2. Update `MAIN_VITE_WEB_APP_URL` to production URL
3. Build desktop app: `bun run build`
4. Test deep links work with production URL
5. Distribute app

## 🐛 Troubleshooting

### "electronTRPC global not found"
- **Solution**: Restart dev server completely
- Make sure `electron-store` is installed: `bun add electron-store`

### Deep links not working
- **macOS**: Check protocol registration in Console.app
- **Test manually**: `open "kcode-dev://auth/callback?token=test"`
- **Rebuild**: `bun run build` and test again

### Tokens not persisting
- Check OS keychain access
- Check file permissions: `~/Library/Application Support/kcode Dev/`
- Try clearing: `rm -rf ~/Library/Application\ Support/kcode\ Dev/`

### Login screen not showing
- Check `useClerkAuth` hook is working
- Check console for errors
- Verify tRPC router is registered

## 📊 Current State

✅ Desktop app authentication infrastructure complete
✅ Login screen implemented
✅ Token storage working
✅ Deep link handler working
✅ Logout functionality working
✅ Settings integration complete

⏳ Web app needs to be built (Next.js + Clerk)
⏳ End-to-end testing pending web app

## 🎉 Summary

The desktop app is now **fully configured** for Clerk authentication. When a user is not authenticated, they see a login screen. Clicking "Sign In" or "Create Account" opens the browser for authentication. After successful authentication, the web app redirects back to the desktop app with tokens, which are stored securely. The user can then access the main app and logout from Settings → Account.

**Next**: Build the Next.js web app following the `auth-plan.mdx` guide.
