"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useAtom } from "jotai"
import {
  Plug,
  Search,
  Check,
  Loader2,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Star,
} from "lucide-react"
import { motion, AnimatePresence } from "motion/react"
import { toast } from "sonner"
import { cn } from "../../../lib/utils"
import { trpc } from "../../../lib/trpc"
import {
  composioConfiguredAtom,
  composioToolkitsAtom,
  composioToolkitCategoryFilterAtom,
  composioToolkitSearchAtom,
  composioPendingConnectionAtom,
  composioLoadingAtom,
  COMPOSIO_CATEGORIES,
  TOOLKIT_ICONS,
  type ComposioToolkit,
  type ComposioConnectionStatus,
} from "../../../lib/atoms/composio"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu"

// Popular apps to show first (order matters)
const POPULAR_TOOLKITS = [
  "github",
  "gmail",
  "slack",
  "notion",
  "google_calendar",
  "google_drive",
  "google_sheets",
  "linear",
  "jira",
  "discord",
  "twitter",
  "trello",
  "asana",
  "figma",
  "airtable",
  "hubspot",
  "salesforce",
  "stripe",
  "shopify",
  "dropbox",
]

// Items per page for pagination
const ITEMS_PER_PAGE = 20

// Auth schemes that support OAuth flow (connect button)
const OAUTH_SCHEMES = ["oauth2", "oauth1", "oauth"]

// Check if toolkit supports OAuth
function supportsOAuth(authSchemes: string[]): boolean {
  if (!authSchemes || authSchemes.length === 0) return true // Assume yes if unknown
  return authSchemes.some((scheme) =>
    OAUTH_SCHEMES.some((oauth) => scheme.toLowerCase().includes(oauth))
  )
}

// Skeleton loading component for toolkit cards
function ToolkitCardSkeleton() {
  return (
    <div className="bg-background border border-border rounded-lg p-4 animate-pulse">
      <div className="flex items-start gap-3">
        {/* Icon skeleton */}
        <div className="w-10 h-10 rounded-lg bg-muted shrink-0" />

        {/* Content skeleton */}
        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex items-center gap-2">
            <div className="h-4 w-24 bg-muted rounded" />
          </div>
          <div className="h-3 w-full bg-muted rounded" />
          <div className="h-3 w-2/3 bg-muted rounded" />
          <div className="flex items-center gap-2 mt-2">
            <div className="h-5 w-16 bg-muted rounded" />
            <div className="h-5 w-12 bg-muted rounded" />
          </div>
        </div>

        {/* Button skeleton */}
        <div className="h-8 w-20 bg-muted rounded-lg shrink-0" />
      </div>
    </div>
  )
}

// Hook to detect narrow screen
function useIsNarrowScreen(): boolean {
  const [isNarrow, setIsNarrow] = useState(false)

  useEffect(() => {
    const checkWidth = () => {
      setIsNarrow(window.innerWidth <= 768)
    }

    checkWidth()
    window.addEventListener("resize", checkWidth)
    return () => window.removeEventListener("resize", checkWidth)
  }, [])

  return isNarrow
}

// Status badge component
function StatusBadge({ status }: { status: ComposioToolkit["status"] }) {
  return (
    <span
      className={cn(
        "px-2 py-0.5 rounded-full text-xs font-medium",
        status === "connected" && "bg-green-500/10 text-green-500",
        status === "disconnected" && "bg-muted text-muted-foreground",
        status === "pending" && "bg-yellow-500/10 text-yellow-500",
        status === "error" && "bg-red-500/10 text-red-500"
      )}
    >
      {status === "connected" && "Connected"}
      {status === "disconnected" && "Not connected"}
      {status === "pending" && "Connecting..."}
      {status === "error" && "Error"}
    </span>
  )
}

// Toolkit card component
interface ToolkitCardProps {
  toolkit: ComposioToolkit
  onConnect: () => void
  onDisconnect: () => void
  onToggle: () => void
  isPending: boolean
  isPopular?: boolean
}

function ToolkitCard({
  toolkit,
  onConnect,
  onDisconnect,
  onToggle,
  isPending,
  isPopular,
}: ToolkitCardProps) {
  const iconUrl = toolkit.logo || TOOLKIT_ICONS[toolkit.name.toLowerCase()]

  return (
    <div className="bg-background border border-border rounded-lg p-4 hover:border-foreground/20 transition-colors">
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="relative w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
          {iconUrl ? (
            <img
              src={iconUrl}
              alt={toolkit.displayName}
              className="w-6 h-6 object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none"
                e.currentTarget.nextElementSibling?.classList.remove("hidden")
              }}
            />
          ) : null}
          <Plug className={cn("w-5 h-5 text-muted-foreground", iconUrl && "hidden")} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-medium text-foreground truncate">
              {toolkit.displayName}
            </h3>
            {isPopular && (
              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
            )}
            {isPending && (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
            )}
          </div>
          {toolkit.description && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">
              {toolkit.description}
            </p>
          )}
          <div className="flex items-center gap-2">
            <StatusBadge status={toolkit.status} />
            {toolkit.categories.slice(0, 2).map((cat) => (
              <span
                key={cat}
                className="px-1.5 py-0.5 rounded text-[10px] bg-muted text-muted-foreground"
              >
                {cat}
              </span>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {toolkit.status === "connected" ? (
            <>
              {/* Toggle enabled */}
              <button
                onClick={onToggle}
                disabled={isPending}
                className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                  toolkit.enabled
                    ? "bg-primary/10 text-primary hover:bg-primary/20"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                )}
              >
                <Check className="w-4 h-4" />
              </button>
              {/* Disconnect */}
              <button
                onClick={onDisconnect}
                disabled={isPending}
                className="px-3 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                Disconnect
              </button>
            </>
          ) : toolkit.status === "pending" ? (
            <button
              disabled
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground"
            >
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            </button>
          ) : supportsOAuth(toolkit.authSchemes) ? (
            <button
              onClick={onConnect}
              disabled={isPending}
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Connect"}
            </button>
          ) : (
            <span
              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-muted text-muted-foreground cursor-help"
              title="This app requires API key configuration in Composio dashboard"
            >
              API Key
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

export function AgentsConnectorsTab() {
  const isNarrowScreen = useIsNarrowScreen()
  const [configured, setConfigured] = useAtom(composioConfiguredAtom)
  const [toolkits, setToolkits] = useAtom(composioToolkitsAtom)
  const [categoryFilter, setCategoryFilter] = useAtom(composioToolkitCategoryFilterAtom)
  const [searchQuery, setSearchQuery] = useAtom(composioToolkitSearchAtom)
  const [pendingConnection, setPendingConnection] = useAtom(composioPendingConnectionAtom)
  const [isLoading, setIsLoading] = useAtom(composioLoadingAtom)

  // Local state for tracking which specific toolkit is being connected/disconnected
  const [connectingToolkit, setConnectingToolkit] = useState<string | null>(null)
  const [disconnectingToolkit, setDisconnectingToolkit] = useState<string | null>(null)
  const [togglingToolkit, setTogglingToolkit] = useState<string | null>(null)

  // Pagination state
  const [visibleCount, setVisibleCount] = useState(ITEMS_PER_PAGE)

  // tRPC queries
  const { data: isConfigured } = trpc.composio.isConfigured.useQuery()
  const {
    data: toolkitData,
    refetch: refetchToolkits,
    isRefetching,
    isLoading: isLoadingToolkits,
    isFetching,
  } = trpc.composio.listToolkits.useQuery(undefined, {
    enabled: configured,
  })

  // Show skeleton on initial load or when refetching with no data
  const showSkeleton = (isLoadingToolkits || (isFetching && toolkits.length === 0))

  // Mutations
  const connectMutation = trpc.composio.connect.useMutation({
    onMutate: ({ toolkitName }) => {
      setConnectingToolkit(toolkitName)
    },
    onSuccess: (data, { toolkitName }) => {
      setPendingConnection(toolkitName)
      // Note: service already opens the browser via shell.openExternal
      // No need to call window.open here
      toast.success(`Connecting to ${toolkitName}`, {
        description: "Complete authorization in the browser window",
      })
    },
    onError: (error, { toolkitName }) => {
      setConnectingToolkit(null)
      toast.error(`Failed to connect ${toolkitName}`, {
        description: error.message || "Please try again",
      })
    },
    onSettled: () => {
      setConnectingToolkit(null)
    },
  })

  const disconnectMutation = trpc.composio.disconnect.useMutation({
    onMutate: ({ toolkitName }) => {
      setDisconnectingToolkit(toolkitName)
    },
    onSuccess: (_, { toolkitName }) => {
      refetchToolkits()
      toast.success(`Disconnected ${toolkitName}`)
    },
    onError: (error, { toolkitName }) => {
      toast.error(`Failed to disconnect ${toolkitName}`, {
        description: error.message,
      })
    },
    onSettled: () => {
      setDisconnectingToolkit(null)
    },
  })

  const toggleMutation = trpc.composio.toggleToolkit.useMutation({
    onMutate: ({ toolkitName }) => {
      setTogglingToolkit(toolkitName)
    },
    onSuccess: () => {
      refetchToolkits()
    },
    onError: (error, { toolkitName }) => {
      toast.error(`Failed to update ${toolkitName}`, {
        description: error.message,
      })
    },
    onSettled: () => {
      setTogglingToolkit(null)
    },
  })

  const syncMutation = trpc.composio.syncConnections.useMutation({
    onSuccess: () => {
      refetchToolkits()
      toast.success("Synced connections")
    },
    onError: (error) => {
      toast.error("Failed to sync connections", {
        description: error.message,
      })
    },
  })

  // Poll for pending connection
  const { data: pollData } = trpc.composio.pollConnectionStatus.useQuery(
    { toolkitName: pendingConnection || "" },
    {
      enabled: !!pendingConnection,
      refetchInterval: pendingConnection ? 2000 : false,
    }
  )

  // Handle poll result
  useEffect(() => {
    if (pollData?.status === "connected") {
      setPendingConnection(null)
      refetchToolkits()
    } else if (pollData?.status === "error") {
      setPendingConnection(null)
    }
  }, [pollData, setPendingConnection, refetchToolkits])

  // Listen for OAuth callback from deep link
  useEffect(() => {
    const cleanup = window.desktopApi?.onComposioAuthComplete?.((data) => {
      console.log("[Composio] Auth callback received:", data)
      console.log("[Composio] Pending connection was:", pendingConnection)

      // Use pendingConnection as fallback since Composio may not include toolkit name in callback
      const toolkitName = data.toolkitName || pendingConnection || "app"

      if (data.status === "success" || data.status === "connected") {
        toast.success(`Connected to ${toolkitName}`)
        // Sync connections from Composio API to update local database
        syncMutation.mutate()
      } else if (data.status === "error" || data.status === "failed") {
        toast.error(`Failed to connect to ${toolkitName}`)
        refetchToolkits()
      }

      // Clear pending connection
      setPendingConnection(null)
    })

    return () => cleanup?.()
  }, [refetchToolkits, setPendingConnection, syncMutation, pendingConnection])

  // Sync state
  useEffect(() => {
    if (isConfigured !== undefined) {
      setConfigured(isConfigured)
    }
  }, [isConfigured, setConfigured])

  useEffect(() => {
    if (toolkitData?.toolkits) {
      // Cast status to ComposioConnectionStatus type
      setToolkits(
        toolkitData.toolkits.map((t) => ({
          ...t,
          status: t.status as ComposioConnectionStatus,
          connectedAt: t.connectedAt ? String(t.connectedAt) : null,
        }))
      )
    }
  }, [toolkitData, setToolkits])

  // Handlers
  const handleConnect = useCallback(
    (toolkit: ComposioToolkit) => {
      connectMutation.mutate({
        toolkitName: toolkit.name,
        displayName: toolkit.displayName,
      })
    },
    [connectMutation]
  )

  const handleDisconnect = useCallback(
    (toolkit: ComposioToolkit) => {
      disconnectMutation.mutate({ toolkitName: toolkit.name })
    },
    [disconnectMutation]
  )

  const handleToggle = useCallback(
    (toolkit: ComposioToolkit) => {
      toggleMutation.mutate({
        toolkitName: toolkit.name,
        enabled: !toolkit.enabled,
      })
    },
    [toggleMutation]
  )

  const handleSync = useCallback(() => {
    syncMutation.mutate()
  }, [syncMutation])

  // Reset pagination when search/filter changes
  useEffect(() => {
    setVisibleCount(ITEMS_PER_PAGE)
  }, [searchQuery, categoryFilter])

  // Filter and sort toolkits
  const { filteredToolkits, totalCount } = useMemo(() => {
    let result = toolkits

    // Filter by category
    if (categoryFilter) {
      result = result.filter((t) =>
        t.categories.some((c) => c.toLowerCase().includes(categoryFilter.toLowerCase()))
      )
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase()
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(query) ||
          t.displayName.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query)
      )
    }

    // Sort: connected first, then popular apps, then alphabetically
    result = [...result].sort((a, b) => {
      // Connected apps first
      if (a.status === "connected" && b.status !== "connected") return -1
      if (b.status === "connected" && a.status !== "connected") return 1

      // Popular apps second (only when not searching)
      if (!searchQuery) {
        const aPopularIndex = POPULAR_TOOLKITS.indexOf(a.name.toLowerCase())
        const bPopularIndex = POPULAR_TOOLKITS.indexOf(b.name.toLowerCase())
        const aIsPopular = aPopularIndex !== -1
        const bIsPopular = bPopularIndex !== -1

        if (aIsPopular && !bIsPopular) return -1
        if (bIsPopular && !aIsPopular) return 1
        if (aIsPopular && bIsPopular) return aPopularIndex - bPopularIndex
      }

      // Alphabetically
      return a.displayName.localeCompare(b.displayName)
    })

    const total = result.length
    return {
      filteredToolkits: result.slice(0, visibleCount),
      totalCount: total,
    }
  }, [toolkits, categoryFilter, searchQuery, visibleCount])

  // Check if more items available
  const hasMore = visibleCount < totalCount

  // Load more handler
  const handleLoadMore = useCallback(() => {
    setVisibleCount((prev) => prev + ITEMS_PER_PAGE)
  }, [])

  // Connected toolkits for summary
  const connectedCount = toolkits.filter((t) => t.status === "connected").length
  const enabledCount = toolkits.filter((t) => t.enabled && t.status === "connected").length

  // Loading state
  const loading = isLoading || isRefetching || syncMutation.isPending

  if (!configured) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <Plug className="w-12 h-12 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="text-lg font-medium mb-2">Connectors not available</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Connectors are not configured for this build. Contact your administrator
            to enable app integrations.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold mb-1">Connectors</h2>
        <p className="text-sm text-muted-foreground">
          Connect apps to give Claude access to your tools and data.
          {connectedCount > 0 && (
            <span className="ml-2">
              {connectedCount} connected, {enabledCount} enabled
            </span>
          )}
        </p>
      </div>

      {/* Search and filter bar */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search apps..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-muted/50 border border-transparent text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:bg-background transition-colors"
          />
        </div>

        {/* Category filter */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="h-9 px-3 rounded-lg bg-muted/50 border border-transparent hover:border-foreground/10 text-sm flex items-center gap-2 transition-colors">
              <span>
                {categoryFilter
                  ? COMPOSIO_CATEGORIES.find((c) => c.id === categoryFilter)?.label || "All"
                  : "All categories"}
              </span>
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {COMPOSIO_CATEGORIES.map((cat) => (
              <DropdownMenuItem
                key={cat.id ?? "all"}
                onClick={() => setCategoryFilter(cat.id)}
                className="justify-between"
              >
                <span>{cat.label}</span>
                {categoryFilter === cat.id && <Check className="w-3.5 h-3.5" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Sync button */}
        <button
          onClick={handleSync}
          disabled={loading}
          className="h-9 w-9 rounded-lg bg-muted/50 border border-transparent hover:border-foreground/10 flex items-center justify-center transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={cn("w-4 h-4 text-muted-foreground", loading && "animate-spin")}
          />
        </button>
      </div>

      {/* Toolkit grid */}
      <div className="space-y-3">
        {showSkeleton ? (
          // Skeleton loading state
          <div className="space-y-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <ToolkitCardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredToolkits.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-12"
              >
                <Plug className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery || categoryFilter
                    ? "No apps match your search"
                    : "No apps available"}
                </p>
              </motion.div>
            ) : (
              filteredToolkits.map((toolkit) => (
                <motion.div
                  key={toolkit.name}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.15 }}
                >
                  <ToolkitCard
                    toolkit={toolkit}
                    onConnect={() => handleConnect(toolkit)}
                    onDisconnect={() => handleDisconnect(toolkit)}
                    onToggle={() => handleToggle(toolkit)}
                    isPending={
                      pendingConnection === toolkit.name ||
                      connectingToolkit === toolkit.name ||
                      disconnectingToolkit === toolkit.name ||
                      togglingToolkit === toolkit.name
                    }
                    isPopular={POPULAR_TOOLKITS.includes(toolkit.name.toLowerCase())}
                  />
                </motion.div>
              ))
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Load More button */}
      {hasMore && (
        <div className="flex justify-center pt-2">
          <button
            onClick={handleLoadMore}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-muted hover:bg-muted/80 text-foreground transition-colors flex items-center gap-2"
          >
            Load More
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Footer info */}
      {totalCount > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          Showing {filteredToolkits.length} of {totalCount} apps
          {totalCount !== toolkits.length && ` (${toolkits.length} total)`}
        </p>
      )}
    </div>
  )
}
