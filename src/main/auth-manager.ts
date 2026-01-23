/**
 * Auth Manager for kCode
 *
 * Supports two modes:
 * 1. Environment variables (for development/CI) - MAIN_VITE_* vars
 * 2. Stored credentials (for end users) - via AuthStore with encrypted storage
 */
import { app } from "electron"
import { AuthStore, type AzureConfig } from "./auth-store"

let authStore: AuthStore | null = null

function getAuthStore(): AuthStore {
  if (!authStore) {
    authStore = new AuthStore(app.getPath("userData"))
  }
  return authStore
}

export class AuthManager {
  constructor(_isDev: boolean = false) {
    // No-op - initialization handled lazily
  }

  /**
   * Check if credentials are configured (either env vars or stored)
   */
  isAuthenticated(): boolean {
    // First check environment variables (for dev/CI)
    const useFoundry = import.meta.env.MAIN_VITE_CLAUDE_CODE_USE_FOUNDRY
    const resource = import.meta.env.MAIN_VITE_ANTHROPIC_FOUNDRY_RESOURCE
    const apiKey = import.meta.env.MAIN_VITE_ANTHROPIC_FOUNDRY_API_KEY

    if (useFoundry && resource && apiKey) {
      console.log("[AuthManager] Using Foundry env vars")
      return true
    }

    // Then check stored Azure credentials
    const store = getAuthStore()
    const isConfigured = store.isConfigured()
    console.log("[AuthManager] Stored credentials:", isConfigured ? "configured" : "not configured")
    return isConfigured
  }

  /**
   * Get configuration from env vars or stored credentials
   */
  getConfig(): { resource?: string; apiKey: string; model?: string; endpoint?: string; deploymentName?: string } | null {
    // First check environment variables
    const useFoundry = import.meta.env.MAIN_VITE_CLAUDE_CODE_USE_FOUNDRY
    const resource = import.meta.env.MAIN_VITE_ANTHROPIC_FOUNDRY_RESOURCE
    const apiKey = import.meta.env.MAIN_VITE_ANTHROPIC_FOUNDRY_API_KEY
    const model = import.meta.env.MAIN_VITE_ANTHROPIC_DEFAULT_OPUS_MODEL

    if (useFoundry && resource && apiKey) {
      return { resource, apiKey, model: model || "claude-opus-4-5" }
    }

    // Then check stored Azure credentials
    const store = getAuthStore()
    const config = store.getConfig()
    if (config) {
      return {
        endpoint: config.endpoint,
        apiKey: config.apiKey,
        deploymentName: config.deploymentName,
      }
    }

    return null
  }

  /**
   * Save Azure configuration to secure storage
   */
  saveConfig(config: AzureConfig): void {
    const store = getAuthStore()
    store.save(config)
    console.log("[AuthManager] Azure config saved to secure storage")
  }

  /**
   * Get user info (stub for compatibility - returns null since we use API keys)
   */
  getUser(): null {
    return null
  }

  /**
   * Logout - clear stored credentials
   */
  logout(): void {
    const store = getAuthStore()
    store.clear()
    console.log("[AuthManager] Credentials cleared")
  }

  // Legacy methods for compatibility
  setOnTokenRefresh(_callback: (authData: any) => void): void {
    // No-op
  }

  startAuthFlow(_mainWindow: any): void {
    console.log("[Auth] startAuthFlow called - open settings to configure Azure credentials")
  }

  async getValidToken(): Promise<string | null> {
    const config = this.getConfig()
    return config?.apiKey || null
  }

  async updateUser(_updates: { name?: string }): Promise<null> {
    return null
  }
}
