/// <reference types="vite/client" />

// Extend Vite's ImportMetaEnv with our custom env vars
declare global {
  interface ImportMetaEnv {
    // Main process (MAIN_VITE_ prefix)
    readonly MAIN_VITE_SENTRY_DSN?: string
    readonly MAIN_VITE_POSTHOG_KEY?: string
    readonly MAIN_VITE_POSTHOG_HOST?: string

    // Foundry credentials (baked in at build time for CI)
    readonly MAIN_VITE_CLAUDE_CODE_USE_FOUNDRY?: string
    readonly MAIN_VITE_ANTHROPIC_FOUNDRY_RESOURCE?: string
    readonly MAIN_VITE_ANTHROPIC_FOUNDRY_API_KEY?: string
    readonly MAIN_VITE_ANTHROPIC_DEFAULT_OPUS_MODEL?: string

    // Renderer process (VITE_ prefix)
    readonly VITE_POSTHOG_KEY?: string
    readonly VITE_POSTHOG_HOST?: string
  }
}

export {}
