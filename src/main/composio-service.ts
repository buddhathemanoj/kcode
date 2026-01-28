import { shell, app } from "electron"
import { getClerkAuthService } from "./clerk-auth-service"

// Composio API base URL (v3 is the latest)
const COMPOSIO_API_URL = "https://backend.composio.dev/api/v3"

// Protocol for deep links (matches main/index.ts)
const IS_DEV = !app.isPackaged
const PROTOCOL = IS_DEV ? "anchor-dev" : "anchor"

// Get API key from environment (baked in at build time)
const getComposioApiKey = (): string => {
  const apiKey =
    (import.meta as unknown as { env: Record<string, string> }).env
      .MAIN_VITE_COMPOSIO_API_KEY || ""
  return apiKey
}

export interface ComposioSession {
  id: string
  mcp: {
    url: string
    headers: Record<string, string>
  }
  tools: string[]
  toolkits: string[]
}

export interface McpServer {
  id: string
  name: string
  toolkits: string[]
}

export interface ComposioToolkit {
  name: string
  displayName: string
  description: string
  logo: string
  categories: string[]
  authSchemes: string[]
}

export type ConnectionStatus = "connected" | "disconnected" | "pending" | "error"

/**
 * Composio Service
 * Manages Composio MCP servers and connections for the connectors feature
 */
export class ComposioService {
  private cachedMcpServer: McpServer | null = null
  private cachedMcpUrl: string | null = null
  private mcpUrlExpiry: number = 0
  private cachedUserId: string | null = null
  private cachedToolkits: string[] = []

  /**
   * Check if Composio is configured (API key available)
   */
  isConfigured(): boolean {
    const apiKey = getComposioApiKey()
    return apiKey.length > 0
  }

  /**
   * Get the current Clerk user ID
   */
  private async getClerkUserId(): Promise<string | null> {
    const clerkAuth = getClerkAuthService()
    const user = await clerkAuth.getUser()
    return user?.id || null
  }

  /**
   * Create or get an MCP server for the given toolkits
   */
  private async getOrCreateMcpServer(
    toolkits: string[],
  ): Promise<McpServer | null> {
    const apiKey = getComposioApiKey()

    // Check if we have a cached server with the same toolkits
    if (
      this.cachedMcpServer &&
      this.arraysEqual(this.cachedToolkits, toolkits)
    ) {
      return this.cachedMcpServer
    }

    try {
      // First, check if we have an existing MCP server
      const listResponse = await fetch(`${COMPOSIO_API_URL}/mcp/servers`, {
        headers: {
          "x-api-key": apiKey,
        },
      })

      if (listResponse.ok) {
        const listData = await listResponse.json()
        const servers = listData.items || []

        // Find a server that matches our toolkits
        const existingServer = servers.find((s: { toolkits?: string[]; name?: string }) =>
          s.toolkits && this.arraysEqual(s.toolkits.sort(), toolkits.sort())
        )

        if (existingServer) {
          console.log("[Composio] Found existing MCP server:", existingServer.id)
          this.cachedMcpServer = {
            id: existingServer.id,
            name: existingServer.name,
            toolkits: existingServer.toolkits || toolkits,
          }
          this.cachedToolkits = toolkits
          return this.cachedMcpServer
        }
      }

      // Create a new MCP server with the custom toolkits
      const serverName = `anchor-${Date.now()}`
      console.log("[Composio] Creating new MCP server:", serverName, "with toolkits:", toolkits)

      const createResponse = await fetch(`${COMPOSIO_API_URL}/mcp/servers/custom`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: serverName,
          toolkits: toolkits,
        }),
      })

      if (!createResponse.ok) {
        const errorText = await createResponse.text()
        console.error("[Composio] MCP server creation failed:", createResponse.status, errorText)
        return null
      }

      const createData = await createResponse.json()
      const serverId = createData.id || createData.mcp_server?.id

      if (!serverId) {
        console.error("[Composio] MCP server creation returned no ID:", createData)
        return null
      }

      console.log("[Composio] MCP server created:", serverId)
      this.cachedMcpServer = {
        id: serverId,
        name: serverName,
        toolkits: toolkits,
      }
      this.cachedToolkits = toolkits
      return this.cachedMcpServer
    } catch (error) {
      console.error("[Composio] MCP server error:", error)
      return null
    }
  }

  /**
   * Generate MCP URL for the current user and server
   */
  private async generateMcpUrl(
    serverId: string,
    userId: string,
  ): Promise<string | null> {
    const apiKey = getComposioApiKey()

    // Check cache validity
    if (
      this.cachedMcpUrl &&
      this.cachedUserId === userId &&
      Date.now() < this.mcpUrlExpiry
    ) {
      return this.cachedMcpUrl
    }

    try {
      const response = await fetch(`${COMPOSIO_API_URL}/mcp/servers/generate`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mcp_server_id: serverId,
          user_ids: [userId],
          managed_auth_by_composio: true,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("[Composio] MCP URL generation failed:", response.status, errorText)
        return null
      }

      const data = await response.json()
      console.log("[Composio] MCP URL generation response:", JSON.stringify(data, null, 2))

      // Use user_ids_url which contains the complete URL with user_id parameter
      // The mcp_url is just the base URL without user context
      const mcpUrl = data.user_ids_url?.[0] || data.url || data.mcp_url

      if (!mcpUrl) {
        console.error("[Composio] MCP URL generation returned no URL:", data)
        return null
      }

      console.log("[Composio] MCP URL generated successfully:", mcpUrl)
      this.cachedMcpUrl = mcpUrl
      this.cachedUserId = userId
      this.mcpUrlExpiry = Date.now() + 30 * 60 * 1000 // 30 min cache

      return mcpUrl
    } catch (error) {
      console.error("[Composio] MCP URL generation error:", error)
      return null
    }
  }

  /**
   * Helper to compare arrays
   */
  private arraysEqual(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false
    const sortedA = [...a].sort()
    const sortedB = [...b].sort()
    return sortedA.every((val, idx) => val === sortedB[idx])
  }

  /**
   * Get MCP config for Claude SDK integration
   */
  async getMcpConfig(
    enabledToolkits?: string[],
  ): Promise<{ url: string; headers: Record<string, string> } | null> {
    if (!this.isConfigured()) {
      console.log("[Composio] Not configured - no API key")
      return null
    }

    const userId = await this.getClerkUserId()
    if (!userId) {
      console.log("[Composio] No authenticated user")
      return null
    }

    const toolkits = enabledToolkits || []
    if (toolkits.length === 0) {
      console.log("[Composio] No toolkits enabled")
      return null
    }

    // Step 1: Get or create MCP server with these toolkits
    const mcpServer = await this.getOrCreateMcpServer(toolkits)
    if (!mcpServer) {
      console.error("[Composio] Failed to get/create MCP server")
      return null
    }

    // Step 2: Generate MCP URL for this user
    const mcpUrl = await this.generateMcpUrl(mcpServer.id, userId)
    if (!mcpUrl) {
      console.error("[Composio] Failed to generate MCP URL")
      return null
    }

    const apiKey = getComposioApiKey()

    const config = {
      url: mcpUrl,
      headers: {
        "x-api-key": apiKey,
      },
    }
    console.log("[Composio] Returning MCP config:", JSON.stringify({ url: mcpUrl, hasApiKey: !!apiKey }, null, 2))
    return config
  }

  /**
   * Get or create auth config ID for a toolkit
   * First tries to get existing configs, then creates one if none exist
   */
  private async getAuthConfigId(toolkitSlug: string): Promise<string | null> {
    const apiKey = getComposioApiKey()

    try {
      // First try to get existing auth configs for this toolkit
      const params = new URLSearchParams({
        toolkit_slug: toolkitSlug,
      })

      console.log("[Composio] Fetching auth configs for:", toolkitSlug)

      let response = await fetch(`${COMPOSIO_API_URL}/auth_configs?${params}`, {
        headers: {
          "x-api-key": apiKey,
        },
      })

      if (!response.ok) {
        console.error("[Composio] Failed to get auth configs:", response.status)
        return null
      }

      let data = await response.json()
      let configs = data.items || []

      console.log("[Composio] Existing configs found:", configs.length)

      // If no configs exist, create one with Composio-managed auth
      if (configs.length === 0) {
        console.log("[Composio] No auth configs found, creating one...")

        const createResponse = await fetch(`${COMPOSIO_API_URL}/auth_configs`, {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            toolkit: { slug: toolkitSlug },
            use_composio_managed_auth: true,
          }),
        })

        if (!createResponse.ok) {
          const errorText = await createResponse.text()
          console.error("[Composio] Failed to create auth config:", createResponse.status, errorText)
          return null
        }

        const createData = await createResponse.json()
        const authConfigId = createData.auth_config?.id

        if (authConfigId) {
          console.log("[Composio] Created auth config:", authConfigId)
          return authConfigId
        }

        console.error("[Composio] Auth config creation returned no ID")
        return null
      }

      // Log available configs for debugging
      console.log(
        "[Composio] Available auth configs:",
        configs.map((c: { id: string; auth_scheme?: string; status?: string }) => ({
          id: c.id,
          scheme: c.auth_scheme,
          status: c.status,
        })),
      )

      // Find the first enabled/active auth config (prefer Composio-managed)
      const composioManaged = configs.find(
        (c: { is_composio_managed?: boolean }) => c.is_composio_managed,
      )
      const enabledConfig = configs.find(
        (c: { status?: string; is_disabled?: boolean }) =>
          c.status === "ACTIVE" || !c.is_disabled,
      )

      const selectedId = composioManaged?.id || enabledConfig?.id || configs[0]?.id || null
      console.log("[Composio] Selected auth config:", selectedId)

      return selectedId
    } catch (error) {
      console.error("[Composio] Get auth config error:", error)
      return null
    }
  }

  /**
   * Initiate OAuth flow for a toolkit
   */
  async authorizeToolkit(
    toolkitName: string,
  ): Promise<{ redirectUrl: string; connectionId: string } | null> {
    if (!this.isConfigured()) return null

    const userId = await this.getClerkUserId()
    if (!userId) return null

    const apiKey = getComposioApiKey()

    try {
      // Step 1: Get auth config ID for this toolkit
      const authConfigId = await this.getAuthConfigId(toolkitName)
      if (!authConfigId) {
        console.error("[Composio] No auth config found for toolkit:", toolkitName)
        return null
      }

      console.log("[Composio] Using auth config:", authConfigId, "for toolkit:", toolkitName)

      // Step 2: Create connection link using v3 API
      const response = await fetch(
        `${COMPOSIO_API_URL}/connected_accounts/link`,
        {
          method: "POST",
          headers: {
            "x-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            auth_config_id: authConfigId,
            user_id: userId,
            callback_url: `${PROTOCOL}://composio-callback`,
          }),
        },
      )

      if (!response.ok) {
        const errorText = await response.text()
        console.error("[Composio] Authorization failed:", response.status, errorText)
        return null
      }

      const data = await response.json()
      console.log("[Composio] Connection link response:", Object.keys(data))

      // v3 returns redirect_url (snake_case)
      const redirectUrl = data.redirect_url || data.redirectUrl || data.url
      const connectionId = data.connected_account_id || data.connectionId || data.id

      // Open authorization URL in default browser
      if (redirectUrl) {
        await shell.openExternal(redirectUrl)
      }

      return {
        redirectUrl,
        connectionId,
      }
    } catch (error) {
      console.error("[Composio] Authorization error:", error)
      return null
    }
  }

  /**
   * Get connection status for a toolkit
   */
  async getConnectionStatus(toolkitName: string): Promise<ConnectionStatus> {
    if (!this.isConfigured()) return "disconnected"

    const userId = await this.getClerkUserId()
    if (!userId) return "disconnected"

    const apiKey = getComposioApiKey()

    try {
      // v3 API uses connected_accounts with user_ids array
      const params = new URLSearchParams({
        "user_ids[]": userId,
        "toolkit_slugs[]": toolkitName,
      })
      const response = await fetch(
        `${COMPOSIO_API_URL}/connected_accounts?${params}`,
        {
          headers: {
            "x-api-key": apiKey,
          },
        },
      )

      if (!response.ok) {
        return "error"
      }

      const data = await response.json()
      const connections = data.items || []

      const connection = connections.find(
        (c: { toolkit?: { slug?: string }; toolkit_slug?: string; toolkitSlug?: string }) =>
          c.toolkit?.slug === toolkitName ||
          c.toolkit_slug === toolkitName ||
          c.toolkitSlug === toolkitName,
      )

      if (!connection) return "disconnected"

      // Map Composio status to our status
      const status = connection.status?.toUpperCase()
      if (status === "ACTIVE") return "connected"
      if (status === "INITIATED" || status === "INITIALIZING") return "pending"
      if (status === "FAILED" || status === "EXPIRED" || status === "INACTIVE") return "error"

      return "disconnected"
    } catch (error) {
      console.error("[Composio] Connection status error:", error)
      return "error"
    }
  }

  /**
   * Get all connected accounts for the current user
   */
  async getConnectedAccounts(): Promise<
    Array<{
      id: string
      // v3 API returns nested toolkit object
      toolkit?: {
        slug?: string
        name?: string
      }
      // Legacy fields (may still be present)
      toolkit_slug?: string
      toolkit_name?: string
      appName?: string
      status: string
      created_at: string
    }>
  > {
    if (!this.isConfigured()) return []

    const userId = await this.getClerkUserId()
    if (!userId) return []

    const apiKey = getComposioApiKey()

    try {
      // v3 API uses connected_accounts with user_ids array
      const params = new URLSearchParams({
        "user_ids[]": userId,
      })
      const response = await fetch(
        `${COMPOSIO_API_URL}/connected_accounts?${params}`,
        {
          headers: {
            "x-api-key": apiKey,
          },
        },
      )

      if (!response.ok) {
        console.error("[Composio] Get connected accounts failed:", response.status)
        return []
      }

      const data = await response.json()
      const items = data.items || []

      console.log("[Composio] Connected accounts found:", items.length)
      if (items.length > 0) {
        console.log("[Composio] First account structure:", JSON.stringify(items[0], null, 2))
      }

      return items
    } catch (error) {
      console.error("[Composio] Get connected accounts error:", error)
      return []
    }
  }

  /**
   * List all available toolkits from Composio
   */
  async listAvailableToolkits(): Promise<ComposioToolkit[]> {
    if (!this.isConfigured()) {
      console.log("[Composio] listAvailableToolkits: not configured")
      return []
    }

    const apiKey = getComposioApiKey()
    console.log("[Composio] listAvailableToolkits: API key length =", apiKey.length)

    try {
      // v3 API uses /toolkits endpoint (not /apps)
      const url = `${COMPOSIO_API_URL}/toolkits`
      console.log("[Composio] Fetching toolkits from:", url)

      const response = await fetch(url, {
        headers: {
          "x-api-key": apiKey,
        },
      })

      console.log("[Composio] Toolkits response status:", response.status)

      if (!response.ok) {
        const errorText = await response.text()
        console.error("[Composio] Toolkits fetch failed:", response.status, errorText)
        return []
      }

      const data = await response.json()
      console.log("[Composio] Toolkits response keys:", Object.keys(data))

      // v3 API returns { items: [...] } with pagination
      const toolkits = data.items || data.toolkits || (Array.isArray(data) ? data : [])
      console.log("[Composio] Toolkits count:", toolkits.length)

      return toolkits.map(
        (toolkit: {
          name?: string
          slug?: string
          displayName?: string
          description?: string
          logo?: string
          meta?: { logo?: string; description?: string }
          categories?: string[]
          authSchemes?: string[]
        }) => ({
          // v3 uses 'slug' as the identifier
          name: toolkit.slug || toolkit.name,
          displayName: toolkit.name || toolkit.displayName || toolkit.slug,
          description: toolkit.meta?.description || toolkit.description || "",
          logo: toolkit.meta?.logo || toolkit.logo || "",
          categories: toolkit.categories || [],
          authSchemes: toolkit.authSchemes || [],
        }),
      )
    } catch (error) {
      console.error("[Composio] List toolkits error:", error)
      return []
    }
  }

  /**
   * Disconnect a toolkit
   */
  async disconnectToolkit(connectionId: string): Promise<boolean> {
    if (!this.isConfigured()) return false

    const apiKey = getComposioApiKey()

    try {
      // v3 API uses connected_accounts (snake_case)
      const response = await fetch(
        `${COMPOSIO_API_URL}/connected_accounts/${connectionId}`,
        {
          method: "DELETE",
          headers: {
            "x-api-key": apiKey,
          },
        },
      )

      if (response.ok) {
        // Invalidate session cache
        this.invalidateSession()
        return true
      }

      return false
    } catch (error) {
      console.error("[Composio] Disconnect error:", error)
      return false
    }
  }

  /**
   * Invalidate cached MCP server and URL (force refresh on next request)
   */
  invalidateSession(): void {
    this.cachedMcpServer = null
    this.cachedMcpUrl = null
    this.mcpUrlExpiry = 0
    this.cachedUserId = null
    this.cachedToolkits = []
    console.log("[Composio] MCP cache invalidated")
  }
}

// Singleton instance
let composioService: ComposioService | null = null

export function getComposioService(): ComposioService {
  if (!composioService) {
    composioService = new ComposioService()
  }
  return composioService
}
