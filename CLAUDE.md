# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What is this?

**Anchor** (formerly kcode) - A local-first Electron desktop app for AI-powered code assistance. Users create chat sessions linked to local project folders, interact with Claude in Plan or Agent mode, and see real-time tool execution (bash, file edits, web search, etc.). Includes 800+ app connectors via Composio integration (GitHub, Gmail, Slack, etc.).

## Commands

```bash
# Development
bun run dev              # Start Electron with hot reload

# Build
bun run build            # Compile app
bun run package          # Package for current platform (dir)
bun run package:mac      # Build macOS (DMG + ZIP) for both arm64 and x64
bun run package:mac:arm64 # Build macOS for arm64 only
bun run package:win      # Build Windows (NSIS + portable)
bun run package:linux    # Build Linux (AppImage + DEB)

# Release
bun run release:local    # Build macOS arm64 locally (fast, for testing)
bun run release          # Full release (all archs + upload to CDN)

# Database (Drizzle + SQLite)
bun run db:generate      # Generate migrations from schema
bun run db:push          # Push schema directly (dev only)
```

## Architecture

```
src/
├── main/                    # Electron main process
│   ├── index.ts             # App entry, window lifecycle
│   ├── auth-manager.ts      # Azure credentials management
│   ├── auth-store.ts        # Encrypted credential storage (safeStorage)
│   ├── windows/main.ts      # Window creation, IPC handlers
│   └── lib/
│       ├── db/              # Drizzle + SQLite
│       │   ├── index.ts     # DB init, auto-migrate on startup
│       │   ├── schema/      # Drizzle table definitions
│       │   └── utils.ts     # ID generation
│       └── trpc/routers/    # tRPC routers (projects, chats, claude)
│
├── preload/                 # IPC bridge (context isolation)
│   └── index.ts             # Exposes desktopApi + tRPC bridge
│
└── renderer/                # React 19 UI
    ├── App.tsx              # Root with providers
    ├── features/
    │   ├── agents/          # Main chat interface
    │   │   ├── main/        # active-chat.tsx, new-chat-form.tsx
    │   │   ├── ui/          # Tool renderers, preview, diff view
    │   │   ├── commands/    # Slash commands (/plan, /agent, /clear)
    │   │   ├── atoms/       # Jotai atoms for agent state
    │   │   └── stores/      # Zustand store for sub-chats
    │   ├── sidebar/         # Chat list, archive, navigation
    │   ├── sub-chats/       # Tab/sidebar sub-chat management
    │   └── layout/          # Main layout with resizable panels
    ├── components/ui/       # Radix UI wrappers (button, dialog, etc.)
    └── lib/
        ├── atoms/           # Global Jotai atoms
        ├── stores/          # Global Zustand stores
        ├── trpc.ts          # Real tRPC client
        └── mock-api.ts      # DEPRECATED - being replaced with real tRPC
```

## Database (Drizzle ORM)

**Location:** `{userData}/data/agents.db` (SQLite)

**Schema:** `src/main/lib/db/schema/index.ts`

```typescript
// Three main tables:
projects    → id, name, path (local folder), timestamps
chats       → id, name, projectId, worktree fields, timestamps
sub_chats   → id, name, chatId, sessionId, mode, messages (JSON)
```

**Auto-migration:** On app start, `initDatabase()` runs migrations from `drizzle/` folder (dev) or `resources/migrations` (packaged).

**Queries:**
```typescript
import { getDatabase, projects, chats } from "../lib/db"
import { eq } from "drizzle-orm"

const db = getDatabase()
const allProjects = db.select().from(projects).all()
const projectChats = db.select().from(chats).where(eq(chats.projectId, id)).all()
```

## Key Patterns

### IPC Communication
- Uses **tRPC** with `trpc-electron` for type-safe main↔renderer communication
- All backend calls go through tRPC routers, not raw IPC
- Preload exposes `window.desktopApi` for native features (window controls, clipboard, notifications)

### State Management
- **Jotai**: UI state (selected chat, sidebar open, preview settings)
- **Zustand**: Sub-chat tabs and pinned state (persisted to localStorage)
- **React Query**: Server state via tRPC (auto-caching, refetch)

### Claude Integration
- Dynamic import of `@anthropic-ai/claude-agent-sdk`
- Two modes: "plan" (read-only) and "agent" (full permissions)
- Session resume via `sessionId` stored in SubChat
- Message streaming via tRPC subscription (`claude.onMessage`)
- Uses Azure Claude API credentials stored locally

## Authentication (Microsoft Foundry)

kcode uses **Microsoft Azure AI Foundry** for Claude API access. This is the recommended approach for production builds.

### How It Works

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Credential Flow                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  .env.local                electron.vite.config.ts                   │
│  ┌──────────────┐          ┌─────────────────────┐                  │
│  │ MAIN_VITE_*  │ ──────▶  │ loadEnv() loads    │                   │
│  │ credentials  │          │ vars into process  │                   │
│  └──────────────┘          │ .env at build time │                   │
│                            └─────────┬───────────┘                  │
│                                      │                               │
│                                      ▼                               │
│                            ┌─────────────────────┐                  │
│                            │ define: {} inlines  │                   │
│                            │ vars into bundle    │                   │
│                            └─────────┬───────────┘                  │
│                                      │                               │
│                                      ▼                               │
│                            ┌─────────────────────┐                  │
│                            │ import.meta.env.*   │                   │
│                            │ available at runtime│                   │
│                            └─────────┬───────────┘                  │
│                                      │                               │
│                                      ▼                               │
│                            ┌─────────────────────┐                  │
│                            │ getFoundryConfig()  │                   │
│                            │ reads credentials   │                   │
│                            └─────────┬───────────┘                  │
│                                      │                               │
│                                      ▼                               │
│                            ┌─────────────────────┐                  │
│                            │ Claude SDK uses     │                   │
│                            │ Foundry natively    │                   │
│                            └─────────────────────┘                  │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Configuration

**1. Create `.env.local` in project root:**

```bash
# Microsoft Foundry Claude Configuration (required)
MAIN_VITE_CLAUDE_CODE_USE_FOUNDRY=1
MAIN_VITE_ANTHROPIC_FOUNDRY_RESOURCE=your-resource-name
MAIN_VITE_ANTHROPIC_FOUNDRY_API_KEY=your-api-key
MAIN_VITE_ANTHROPIC_DEFAULT_OPUS_MODEL=claude-opus-4-5
```

**2. Get credentials from Azure AI Foundry:**
- Go to [Azure AI Foundry](https://ai.azure.com/)
- Create or select a project with Claude models deployed
- Get the resource name and API key from the deployment

**3. Run dev mode:**

```bash
bun run dev
```

You should see in the logs:
```
[Build] Foundry credentials status:
  MAIN_VITE_CLAUDE_CODE_USE_FOUNDRY: SET
  MAIN_VITE_ANTHROPIC_FOUNDRY_RESOURCE: SET
  MAIN_VITE_ANTHROPIC_FOUNDRY_API_KEY: SET (hidden)
  MAIN_VITE_ANTHROPIC_DEFAULT_OPUS_MODEL: claude-opus-4-5
```

### Key Files

| File | Purpose |
|------|---------|
| `.env.local` | Local credentials (git-ignored) |
| `electron.vite.config.ts` | Loads env vars via `loadEnv()` and inlines them via `define` |
| `src/main/lib/trpc/routers/claude.ts` | `getFoundryConfig()` reads credentials at runtime |

### Troubleshooting

**"Foundry credentials status: NOT SET"**
- Ensure `.env.local` exists in project root
- Check that variable names have `MAIN_VITE_` prefix
- Restart `bun run dev` after changing `.env.local`

**"API Error: api_not_supported"**
- The Azure resource doesn't have Claude models deployed
- Check Azure AI Foundry portal for correct resource name
- Verify the API key is valid

**Using localStorage config instead of Foundry**
- If Foundry env vars are set, they take precedence over localStorage
- Clear localStorage config: DevTools → Application → Local Storage → delete `agents:claude-custom-config`

### CI/CD Builds

For GitHub Actions, set these secrets:
- `MAIN_VITE_CLAUDE_CODE_USE_FOUNDRY`
- `MAIN_VITE_ANTHROPIC_FOUNDRY_RESOURCE`
- `MAIN_VITE_ANTHROPIC_FOUNDRY_API_KEY`
- `MAIN_VITE_ANTHROPIC_DEFAULT_OPUS_MODEL`

The credentials get baked into the build via the `define` block in `electron.vite.config.ts`.

## Connectors (Composio Integration)

Anchor integrates with **Composio** to provide 800+ app connectors (GitHub, Gmail, Slack, Notion, etc.) that Claude can use as MCP tools during agent sessions.

### How It Works

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Composio Connector Flow                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Settings → Connectors Tab                                           │
│  ┌──────────────────────┐                                           │
│  │ Browse 800+ apps     │                                           │
│  │ (GitHub, Gmail, etc) │                                           │
│  └──────────┬───────────┘                                           │
│             │ Click "Connect"                                        │
│             ▼                                                        │
│  ┌──────────────────────┐                                           │
│  │ Get/Create AuthConfig│  ← Composio v3 API                        │
│  │ (OAuth2/API Key)     │                                           │
│  └──────────┬───────────┘                                           │
│             │                                                        │
│             ▼                                                        │
│  ┌──────────────────────┐                                           │
│  │ Create Connection    │  → Opens OAuth popup                      │
│  │ Link with callback   │                                           │
│  └──────────┬───────────┘                                           │
│             │ anchor-dev://composio-callback                         │
│             ▼                                                        │
│  ┌──────────────────────┐                                           │
│  │ Sync to local DB     │  → composio_connections table             │
│  │ (status, metadata)   │                                           │
│  └──────────┬───────────┘                                           │
│             │                                                        │
│             ▼                                                        │
│  ┌──────────────────────┐                                           │
│  │ Claude SDK uses      │  → MCP server with Composio tools         │
│  │ connected tools      │                                           │
│  └──────────────────────┘                                           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Configuration

**1. Add Composio API key to `.env.local`:**

```bash
# Composio Configuration (optional - enables connectors)
MAIN_VITE_COMPOSIO_API_KEY=your-composio-api-key
```

**2. Get API key from Composio:**
- Go to [Composio Dashboard](https://app.composio.dev/)
- Navigate to Settings → API Keys
- Copy your API key

**3. Run dev mode:**

```bash
bun run dev
```

You should see in the logs:
```
[Build] Foundry credentials status:
  ...
  MAIN_VITE_COMPOSIO_API_KEY: SET (hidden)
```

### Key Files

| File | Purpose |
|------|---------|
| `src/main/composio-service.ts` | Core Composio API client (v3 API) |
| `src/main/lib/trpc/routers/composio.ts` | tRPC router for connector operations |
| `src/main/lib/db/schema/index.ts` | `composio_connections` table schema |
| `src/renderer/components/dialogs/settings-tabs/agents-connectors-tab.tsx` | UI for browsing/connecting apps |
| `src/renderer/features/agents/ui/connectors-dropdown.tsx` | Dropdown to toggle connectors in chat |
| `src/renderer/lib/atoms/composio.ts` | Jotai atoms for connector state |

### Database Schema

```typescript
// composio_connections table
composioConnections = sqliteTable("composio_connections", {
  id: text("id").primaryKey().$defaultFn(() => generateId()),
  clerkUserId: text("clerk_user_id").notNull(),
  toolkitName: text("toolkit_name").notNull(),    // e.g., "github", "gmail"
  displayName: text("display_name"),               // Human-readable name
  status: text("status").notNull(),                // "connected" | "disconnected" | "pending" | "error"
  enabled: integer("enabled", { mode: "boolean" }).default(true),
  connectedAt: integer("connected_at", { mode: "timestamp" }),
  metadata: text("metadata"),                      // JSON with connectionId, etc.
  createdAt: integer("created_at", { mode: "timestamp" }),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
})
```

### Composio v3 API

The integration uses Composio's v3 API which has a different structure from v1:

```typescript
// v3 API endpoints (backend.composio.dev/api/v3/)
GET  /toolkits                    // List all available apps (863+)
GET  /auth_configs?toolkit=name   // Get auth configs for a toolkit
POST /auth_configs                // Create auth config (managed OAuth)
POST /connected_accounts/link     // Generate OAuth connection link
GET  /connected_accounts?user_ids[]=id  // Get user's connected accounts

// v3 response structure for connected accounts
{
  "toolkit": { "slug": "github", "name": "GitHub" },  // Nested toolkit object
  "status": "ACTIVE",
  "id": "ca_xxxxx",
  "user_id": "user_xxxxx"
}
```

### OAuth Callback Flow

1. User clicks "Connect" on a toolkit
2. `authorizeToolkit()` creates connection link with callback URL
3. OAuth popup opens → user authenticates
4. Composio redirects to `anchor-dev://composio-callback?status=success&connected_account_id=...`
5. Deep link handler in `src/main/index.ts` catches the callback
6. UI calls `syncConnections` mutation to update local database
7. Toolkit shows as "Connected" in the UI

### tRPC Router Methods

```typescript
// src/main/lib/trpc/routers/composio.ts
composio.isConfigured()           // Check if Composio API key is set
composio.listToolkits()           // Get all 800+ available toolkits
composio.getConnectionStatus(name) // Check if a toolkit is connected
composio.authorize(name)          // Start OAuth flow for a toolkit
composio.disconnect(name)         // Disconnect a toolkit
composio.syncConnections()        // Sync all connections from Composio API
composio.listConnections()        // Get local connection records
composio.toggleConnection(name, enabled) // Enable/disable a connector
composio.getMcpConfig()           // Get MCP config for Claude SDK
```

### Using Connectors in Chat

When connectors are enabled:
1. Claude SDK receives MCP tools from Composio via `getMcpConfig()`
2. User can toggle specific connectors via the dropdown in chat input
3. Enabled connectors' tools appear in Claude's available tools
4. Claude can use tools like `GITHUB_CREATE_ISSUE`, `GMAIL_SEND_EMAIL`, etc.

### Troubleshooting

**"No auth config found for toolkit"**
- The app auto-creates auth configs with `use_composio_managed_auth: true`
- If still failing, check Composio dashboard for existing configs

**OAuth callback not updating UI**
- Check that protocol is registered: `[Protocol] Verification - isDefaultProtocolClient: true`
- Verify callback URL format: `anchor-dev://composio-callback`
- Check logs for: `[DeepLink] Composio OAuth callback detected`

**Connections showing in Composio but not in app**
- Run `syncConnections` mutation to refresh local database
- Check logs for: `[Composio] Connected accounts found: X`
- Verify toolkit slug is being read from `account.toolkit.slug`

**Toolkit tools not appearing in Claude**
- Ensure connector is enabled (toggle in dropdown)
- Check `getMcpConfig()` is returning the toolkit
- Verify Claude SDK is receiving MCP tools

## Tech Stack

| Layer | Tech |
|-------|------|
| Desktop | Electron 33.4.5, electron-vite, electron-builder |
| UI | React 19, TypeScript 5.4.5, Tailwind CSS |
| Components | Radix UI, Lucide icons, Motion, Sonner |
| State | Jotai, Zustand, React Query |
| Backend | tRPC, Drizzle ORM, better-sqlite3 |
| AI | @anthropic-ai/claude-agent-sdk |
| Package Manager | bun |

## File Naming

- Components: PascalCase (`ActiveChat.tsx`, `AgentsSidebar.tsx`)
- Utilities/hooks: camelCase (`useFileUpload.ts`, `formatters.ts`)
- Stores: kebab-case (`sub-chat-store.ts`, `agent-chat-store.ts`)
- Atoms: camelCase with `Atom` suffix (`selectedAgentChatIdAtom`)

## Important Files

- `electron.vite.config.ts` - Build config (main/preload/renderer entries)
- `src/main/lib/db/schema/index.ts` - Drizzle schema (source of truth)
- `src/main/lib/db/index.ts` - DB initialization + auto-migrate
- `src/main/auth-manager.ts` - Azure credentials management
- `src/main/auth-store.ts` - Encrypted credential storage
- `src/main/composio-service.ts` - Composio API client for connectors
- `src/main/lib/trpc/routers/composio.ts` - Composio tRPC router
- `src/renderer/features/agents/atoms/index.ts` - Agent UI state atoms
- `src/renderer/features/agents/main/active-chat.tsx` - Main chat component
- `src/main/lib/trpc/routers/claude.ts` - Claude SDK integration

## Debugging First Install Issues

When testing behavior for new users, you need to simulate a fresh install:

```bash
# 1. Clear all app data (config, database, settings)
rm -rf ~/Library/Application\ Support/anchor\ Dev/

# 2. Reset macOS protocol handler registration (if testing deep links)
/System/Library/Frameworks/CoreServices.framework/Versions/A/Frameworks/LaunchServices.framework/Versions/A/Support/lsregister -kill -r -domain local -domain system -domain user

# 3. Clear app preferences
defaults delete io.kosal.anchor.dev  # Dev mode
defaults delete io.kosal.anchor      # Production

# 4. Run in dev mode with clean state
bun run dev
```

**Dev vs Production App:**
- Dev mode uses `anchor-dev://` protocol
- Dev mode uses separate userData path (`~/Library/Application Support/anchor Dev/`)
- This prevents conflicts between dev and production installs

## Releasing a New Version

### Local macOS Build (Recommended for Development)

```bash
# Build arm64 only - fast local build for testing
bun run release:local

# Install to Applications
hdiutil attach release/kcode-*.dmg
cp -R /Volumes/kcode*/kcode.app /Applications/
hdiutil detach /Volumes/kcode*
```

### CI/CD Builds (GitHub Actions)

GitHub Actions builds **Windows and Linux** automatically. macOS is built locally due to code signing requirements.

```bash
# Trigger CI build manually
gh workflow run build.yml

# Or push a tag for full release
git tag v0.0.28 && git push origin v0.0.28
```

### Full Release (All Platforms)

```bash
# Bump version first
npm version patch --no-git-tag-version  # 0.0.27 → 0.0.28

# Full release with upload to CDN (macOS both archs)
bun run release
```

### Files Uploaded to CDN

| File | Purpose |
|------|---------|
| `latest-mac.yml` | Manifest for arm64 auto-updates |
| `latest-mac-x64.yml` | Manifest for Intel auto-updates |
| `kcode-{version}-arm64-mac.zip` | Auto-update payload (arm64) |
| `kcode-{version}-mac.zip` | Auto-update payload (Intel) |
| `kcode-{version}-arm64.dmg` | Manual download (arm64) |
| `kcode-{version}.dmg` | Manual download (Intel) |

### Auto-Update Flow

1. App checks `https://cdn.kosal.io/releases/kcode/latest-mac.yml` on startup and when window regains focus (with 1 min cooldown)
2. If version in manifest > current version, shows "Update Available" banner
3. User clicks Download → downloads ZIP in background
4. User clicks "Restart Now" → installs update and restarts

## Current Status (WIP)

**Done:**
- Drizzle ORM setup with schema (projects, chats, sub_chats, composio_connections)
- Auto-migration on app startup
- tRPC routers structure
- Azure Claude credentials integration
- Composio Connectors integration (800+ apps)
- OAuth flow for app connections
- Deep link protocol handling (anchor-dev://)

**In Progress:**
- Settings UI for Azure credentials configuration
- Replacing `mock-api.ts` with real tRPC calls in renderer
- MCP tools integration with Claude SDK

**Planned:**
- Git worktree per chat (isolation)
- Claude Code execution in worktree path
