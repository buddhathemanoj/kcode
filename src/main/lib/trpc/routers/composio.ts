import { router, publicProcedure } from "../index"
import { z } from "zod"
import { eq, and } from "drizzle-orm"
import { getComposioService } from "../../../composio-service"
import { getClerkAuthService } from "../../../clerk-auth-service"
import { getDatabase } from "../../db"
import { composioConnections, composioEnabledToolkits } from "../../db/schema"
import { TRPCError } from "@trpc/server"

/**
 * Get current Clerk user ID or throw unauthorized error
 */
async function requireAuth(): Promise<string> {
  const clerkAuth = getClerkAuthService()
  const user = await clerkAuth.getUser()
  if (!user?.id) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Login required for Connectors",
    })
  }
  return user.id
}

/**
 * Composio Connectors Router
 * Handles connector/app connections and management
 */
export const composioRouter = router({
  /**
   * Check if Composio is configured (API key available)
   */
  isConfigured: publicProcedure.query(() => {
    const service = getComposioService()
    return service.isConfigured()
  }),

  /**
   * List all available toolkits from Composio
   */
  listToolkits: publicProcedure.query(async () => {
    const service = getComposioService()

    if (!service.isConfigured()) {
      return { configured: false, toolkits: [] }
    }

    const toolkits = await service.listAvailableToolkits()

    // Get user's connection status for each toolkit
    let clerkUserId: string | null = null
    try {
      clerkUserId = await requireAuth()
    } catch {
      // User not logged in - return toolkits without connection status
      return {
        configured: true,
        toolkits: toolkits.map((t) => ({
          ...t,
          status: "disconnected" as const,
          enabled: false,
          connectedAt: null as Date | null,
        })),
      }
    }

    const db = getDatabase()

    // Get user's connections
    const connections = db
      .select()
      .from(composioConnections)
      .where(eq(composioConnections.clerkUserId, clerkUserId))
      .all()

    // Get user's enabled toolkits
    const enabled = db
      .select()
      .from(composioEnabledToolkits)
      .where(eq(composioEnabledToolkits.clerkUserId, clerkUserId))
      .all()

    const connectionMap = new Map(connections.map((c) => [c.toolkitName, c]))
    const enabledMap = new Map(enabled.map((e) => [e.toolkitName, e.enabled]))

    return {
      configured: true,
      toolkits: toolkits.map((toolkit) => ({
        ...toolkit,
        status: connectionMap.get(toolkit.name)?.status || "disconnected",
        enabled: enabledMap.get(toolkit.name) ?? false,
        connectedAt: connectionMap.get(toolkit.name)?.connectedAt,
      })),
    }
  }),

  /**
   * Get user's connected toolkits
   */
  getConnectedToolkits: publicProcedure.query(async () => {
    const clerkUserId = await requireAuth()
    const db = getDatabase()

    return db
      .select()
      .from(composioConnections)
      .where(
        and(
          eq(composioConnections.clerkUserId, clerkUserId),
          eq(composioConnections.status, "connected"),
        ),
      )
      .all()
  }),

  /**
   * Get user's enabled toolkits for Claude sessions
   */
  getEnabledToolkits: publicProcedure.query(async () => {
    const clerkUserId = await requireAuth()
    const db = getDatabase()

    return db
      .select()
      .from(composioEnabledToolkits)
      .where(
        and(
          eq(composioEnabledToolkits.clerkUserId, clerkUserId),
          eq(composioEnabledToolkits.enabled, true),
        ),
      )
      .all()
  }),

  /**
   * Toggle toolkit enabled state
   */
  toggleToolkit: publicProcedure
    .input(
      z.object({
        toolkitName: z.string(),
        enabled: z.boolean(),
      }),
    )
    .mutation(async ({ input }) => {
      const clerkUserId = await requireAuth()
      const db = getDatabase()
      const service = getComposioService()

      const existing = db
        .select()
        .from(composioEnabledToolkits)
        .where(
          and(
            eq(composioEnabledToolkits.clerkUserId, clerkUserId),
            eq(composioEnabledToolkits.toolkitName, input.toolkitName),
          ),
        )
        .get()

      if (existing) {
        db.update(composioEnabledToolkits)
          .set({ enabled: input.enabled })
          .where(eq(composioEnabledToolkits.id, existing.id))
          .run()
      } else {
        db.insert(composioEnabledToolkits)
          .values({
            clerkUserId,
            toolkitName: input.toolkitName,
            enabled: input.enabled,
          })
          .run()
      }

      // Invalidate session to apply changes
      service.invalidateSession()

      return { success: true }
    }),

  /**
   * Initiate connection to a toolkit (starts OAuth flow)
   */
  connect: publicProcedure
    .input(z.object({ toolkitName: z.string(), displayName: z.string() }))
    .mutation(async ({ input }) => {
      const clerkUserId = await requireAuth()
      const db = getDatabase()
      const service = getComposioService()

      // Update or insert connection with pending status
      const existing = db
        .select()
        .from(composioConnections)
        .where(
          and(
            eq(composioConnections.clerkUserId, clerkUserId),
            eq(composioConnections.toolkitName, input.toolkitName),
          ),
        )
        .get()

      if (existing) {
        db.update(composioConnections)
          .set({ status: "pending", updatedAt: new Date() })
          .where(eq(composioConnections.id, existing.id))
          .run()
      } else {
        db.insert(composioConnections)
          .values({
            clerkUserId,
            toolkitName: input.toolkitName,
            displayName: input.displayName,
            status: "pending",
          })
          .run()
      }

      // Start OAuth flow
      const result = await service.authorizeToolkit(input.toolkitName)

      if (!result) {
        // Update status to error
        db.update(composioConnections)
          .set({ status: "error", updatedAt: new Date() })
          .where(
            and(
              eq(composioConnections.clerkUserId, clerkUserId),
              eq(composioConnections.toolkitName, input.toolkitName),
            ),
          )
          .run()

        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Cannot connect to ${input.displayName}. This app may not support OAuth authentication or requires manual API key setup in Composio dashboard.`,
        })
      }

      return {
        connectionId: result.connectionId,
        redirectUrl: result.redirectUrl,
        status: "pending" as const,
      }
    }),

  /**
   * Disconnect from a toolkit
   */
  disconnect: publicProcedure
    .input(z.object({ toolkitName: z.string() }))
    .mutation(async ({ input }) => {
      const clerkUserId = await requireAuth()
      const db = getDatabase()
      const service = getComposioService()

      // Get connection to find connectionId for API call
      const connection = db
        .select()
        .from(composioConnections)
        .where(
          and(
            eq(composioConnections.clerkUserId, clerkUserId),
            eq(composioConnections.toolkitName, input.toolkitName),
          ),
        )
        .get()

      if (connection?.metadata) {
        try {
          const metadata = JSON.parse(connection.metadata)
          if (metadata.connectionId) {
            await service.disconnectToolkit(metadata.connectionId)
          }
        } catch {
          // Ignore metadata parse errors
        }
      }

      // Update local database
      db.update(composioConnections)
        .set({
          status: "disconnected",
          connectedAt: null,
          metadata: null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(composioConnections.clerkUserId, clerkUserId),
            eq(composioConnections.toolkitName, input.toolkitName),
          ),
        )
        .run()

      // Also disable the toolkit
      db.update(composioEnabledToolkits)
        .set({ enabled: false })
        .where(
          and(
            eq(composioEnabledToolkits.clerkUserId, clerkUserId),
            eq(composioEnabledToolkits.toolkitName, input.toolkitName),
          ),
        )
        .run()

      // Invalidate session
      service.invalidateSession()

      return { success: true }
    }),

  /**
   * Poll connection status (called after OAuth redirect)
   */
  pollConnectionStatus: publicProcedure
    .input(z.object({ toolkitName: z.string() }))
    .query(async ({ input }) => {
      const clerkUserId = await requireAuth()
      const db = getDatabase()
      const service = getComposioService()

      // Check status with Composio API
      const status = await service.getConnectionStatus(input.toolkitName)

      // Update database
      db.update(composioConnections)
        .set({
          status,
          connectedAt: status === "connected" ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(composioConnections.clerkUserId, clerkUserId),
            eq(composioConnections.toolkitName, input.toolkitName),
          ),
        )
        .run()

      // If connected, auto-enable the toolkit
      if (status === "connected") {
        const existing = db
          .select()
          .from(composioEnabledToolkits)
          .where(
            and(
              eq(composioEnabledToolkits.clerkUserId, clerkUserId),
              eq(composioEnabledToolkits.toolkitName, input.toolkitName),
            ),
          )
          .get()

        if (existing) {
          db.update(composioEnabledToolkits)
            .set({ enabled: true })
            .where(eq(composioEnabledToolkits.id, existing.id))
            .run()
        } else {
          db.insert(composioEnabledToolkits)
            .values({
              clerkUserId,
              toolkitName: input.toolkitName,
              enabled: true,
            })
            .run()
        }

        // Invalidate session to include new toolkit
        service.invalidateSession()
      }

      return { status }
    }),

  /**
   * Sync connection status from Composio API
   */
  syncConnections: publicProcedure.mutation(async () => {
    const clerkUserId = await requireAuth()
    const db = getDatabase()
    const service = getComposioService()

    // Get all connected accounts from Composio (v3 API)
    const accounts = await service.getConnectedAccounts()

    // Update local database with current status
    let syncedCount = 0
    for (const account of accounts) {
      // v3 API nests toolkit info: account.toolkit.slug (not account.toolkit_slug)
      const toolkitName =
        account.toolkit?.slug ||
        account.toolkit_slug ||
        account.toolkit_name ||
        account.appName

      // Skip accounts without a valid toolkit name
      if (!toolkitName) {
        console.warn("[Composio] Skipping account without toolkit name:", account.id)
        continue
      }

      const status =
        account.status?.toUpperCase() === "ACTIVE" ? "connected" : "disconnected"

      const existing = db
        .select()
        .from(composioConnections)
        .where(
          and(
            eq(composioConnections.clerkUserId, clerkUserId),
            eq(composioConnections.toolkitName, toolkitName),
          ),
        )
        .get()

      if (existing) {
        db.update(composioConnections)
          .set({
            status,
            connectedAt: status === "connected" ? new Date() : null,
            metadata: JSON.stringify({ connectionId: account.id }),
            updatedAt: new Date(),
          })
          .where(eq(composioConnections.id, existing.id))
          .run()
      } else {
        db.insert(composioConnections)
          .values({
            clerkUserId,
            toolkitName,
            displayName: account.toolkit?.name || account.toolkit_name || toolkitName,
            status,
            connectedAt: status === "connected" ? new Date() : null,
            metadata: JSON.stringify({ connectionId: account.id }),
          })
          .run()
      }

      // Auto-enable connected toolkits for Claude sessions
      if (status === "connected") {
        const existingEnabled = db
          .select()
          .from(composioEnabledToolkits)
          .where(
            and(
              eq(composioEnabledToolkits.clerkUserId, clerkUserId),
              eq(composioEnabledToolkits.toolkitName, toolkitName),
            ),
          )
          .get()

        if (existingEnabled) {
          // Enable if not already enabled
          if (!existingEnabled.enabled) {
            db.update(composioEnabledToolkits)
              .set({ enabled: true })
              .where(eq(composioEnabledToolkits.id, existingEnabled.id))
              .run()
          }
        } else {
          // Create new enabled entry
          db.insert(composioEnabledToolkits)
            .values({
              clerkUserId,
              toolkitName,
              enabled: true,
            })
            .run()
        }
      }

      syncedCount++
    }

    return { synced: syncedCount }
  }),

  /**
   * Get MCP config for Claude SDK (internal use)
   */
  getMcpConfig: publicProcedure.query(async () => {
    const service = getComposioService()

    if (!service.isConfigured()) {
      return null
    }

    // Get enabled toolkit names
    let enabledNames: string[] = []
    try {
      const clerkUserId = await requireAuth()
      const db = getDatabase()

      const enabled = db
        .select()
        .from(composioEnabledToolkits)
        .where(
          and(
            eq(composioEnabledToolkits.clerkUserId, clerkUserId),
            eq(composioEnabledToolkits.enabled, true),
          ),
        )
        .all()

      enabledNames = enabled.map((e) => e.toolkitName)
    } catch {
      // User not logged in
      return null
    }

    if (enabledNames.length === 0) {
      return null
    }

    return service.getMcpConfig(enabledNames)
  }),
})
