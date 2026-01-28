"use client"

import { memo, useCallback, useState, useEffect } from "react"
import { useAtom, useAtomValue, useSetAtom } from "jotai"
import { ChevronDown, Plug, Settings2, Check, Loader2, ExternalLink } from "lucide-react"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu"
import { cn } from "../../../lib/utils"
import { trpc } from "../../../lib/trpc"
import {
  composioConfiguredAtom,
  composioToolkitsAtom,
  composioDropdownOpenAtom,
  composioPendingConnectionAtom,
  composioLastSyncAtom,
  TOOLKIT_ICONS,
  type ComposioToolkit,
} from "../../../lib/atoms/composio"
import { agentsSettingsDialogOpenAtom, agentsSettingsTabAtom } from "../../../lib/atoms"

/**
 * ConnectorsDropdown - Dropdown for managing Composio app connections
 *
 * Placed in the prompt bar next to Mode/Model selectors.
 * Shows:
 * - Count badge of enabled connectors
 * - List of connected apps with toggle switches
 * - Link to "Manage Connectors" in settings
 */
export const ConnectorsDropdown = memo(function ConnectorsDropdown() {
  const [dropdownOpen, setDropdownOpen] = useAtom(composioDropdownOpenAtom)
  const [toolkits, setToolkits] = useAtom(composioToolkitsAtom)
  const [configured, setConfigured] = useAtom(composioConfiguredAtom)
  const [pendingConnection, setPendingConnection] = useAtom(composioPendingConnectionAtom)
  const [lastSync, setLastSync] = useAtom(composioLastSyncAtom)

  const setSettingsDialogOpen = useSetAtom(agentsSettingsDialogOpenAtom)
  const setSettingsTab = useSetAtom(agentsSettingsTabAtom)

  // tRPC queries
  const { data: isConfigured } = trpc.composio.isConfigured.useQuery()
  const { data: toolkitData, refetch: refetchToolkits } = trpc.composio.listToolkits.useQuery(
    undefined,
    { enabled: configured }
  )

  // Mutations
  const toggleMutation = trpc.composio.toggleToolkit.useMutation({
    onSuccess: () => {
      refetchToolkits()
    },
  })

  const pollConnectionMutation = trpc.composio.pollConnectionStatus.useQuery(
    { toolkitName: pendingConnection || "" },
    {
      enabled: !!pendingConnection,
      refetchInterval: pendingConnection ? 2000 : false, // Poll every 2s while pending
    }
  )

  // Sync configuration state
  useEffect(() => {
    if (isConfigured !== undefined) {
      setConfigured(isConfigured)
    }
  }, [isConfigured, setConfigured])

  // Sync toolkit data
  useEffect(() => {
    if (toolkitData?.toolkits) {
      // Cast status to proper type
      setToolkits(
        toolkitData.toolkits.map((t) => ({
          ...t,
          status: t.status as ComposioToolkit["status"],
          connectedAt: t.connectedAt ? String(t.connectedAt) : null,
        }))
      )
    }
  }, [toolkitData, setToolkits])

  // Handle pending connection polling result
  useEffect(() => {
    if (pollConnectionMutation.data?.status === "connected") {
      setPendingConnection(null)
      refetchToolkits()
    } else if (pollConnectionMutation.data?.status === "error") {
      setPendingConnection(null)
    }
  }, [pollConnectionMutation.data, setPendingConnection, refetchToolkits])

  // Listen for Composio OAuth callback from deep link
  useEffect(() => {
    if (!window.desktopApi?.onComposioAuthComplete) return

    const cleanup = window.desktopApi.onComposioAuthComplete((data) => {
      console.log("[ConnectorsDropdown] OAuth callback received:", data)
      // Refresh toolkits after OAuth completion
      refetchToolkits()
      // Clear pending state if it matches
      if (data.toolkitName && pendingConnection === data.toolkitName) {
        setPendingConnection(null)
      }
    })

    return cleanup
  }, [refetchToolkits, pendingConnection, setPendingConnection])

  // Get enabled and connected toolkits
  const connectedToolkits = toolkits.filter(t => t.status === "connected")
  const enabledToolkits = toolkits.filter(t => t.enabled && t.status === "connected")
  const enabledCount = enabledToolkits.length

  // Handle toggle
  const handleToggle = useCallback((toolkit: ComposioToolkit) => {
    toggleMutation.mutate({
      toolkitName: toolkit.name,
      enabled: !toolkit.enabled,
    })
  }, [toggleMutation])

  // Open settings to connectors tab
  const handleManageConnectors = useCallback(() => {
    setDropdownOpen(false)
    setSettingsTab("connectors")
    setSettingsDialogOpen(true)
  }, [setDropdownOpen, setSettingsTab, setSettingsDialogOpen])

  // Get icon for toolkit
  const getToolkitIcon = (toolkit: ComposioToolkit) => {
    const iconUrl = toolkit.logo || TOOLKIT_ICONS[toolkit.name.toLowerCase()]
    if (iconUrl) {
      return (
        <div className="w-5 h-5 rounded bg-background border border-border flex items-center justify-center shrink-0">
          <img
            src={iconUrl}
            alt={toolkit.displayName}
            className="w-3.5 h-3.5 object-contain"
            onError={(e) => {
              // Fallback to generic icon on error
              e.currentTarget.style.display = 'none'
            }}
          />
        </div>
      )
    }
    return (
      <div className="w-5 h-5 rounded bg-muted flex items-center justify-center shrink-0">
        <Plug className="w-3 h-3 text-muted-foreground" />
      </div>
    )
  }

  // Don't render if not configured
  if (!configured) {
    return null
  }

  return (
    <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-md hover:bg-accent border border-transparent hover:border-border outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70">
          <Plug className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            Connectors
            {enabledCount > 0 && (
              <span className="ml-1.5 text-xs font-medium bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full min-w-[1.25rem] text-center">
                {enabledCount}
              </span>
            )}
          </span>
          <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="w-[240px] max-h-[320px] overflow-y-auto"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {connectedToolkits.length === 0 ? (
          <div className="px-4 py-5 text-center">
            <div className="w-10 h-10 rounded-full bg-muted mx-auto mb-3 flex items-center justify-center">
              <Plug className="w-5 h-5 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              No apps connected
            </p>
            <p className="text-xs text-muted-foreground mb-3">
              Connect apps to use them with Claude
            </p>
            <button
              onClick={handleManageConnectors}
              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Connect your first app →
            </button>
          </div>
        ) : (
          <>
            {/* Connected apps with toggle */}
            {connectedToolkits.map((toolkit) => {
              const isPending = pendingConnection === toolkit.name
              return (
                <DropdownMenuItem
                  key={toolkit.name}
                  className="justify-between gap-2 cursor-pointer"
                  onSelect={(e) => {
                    e.preventDefault() // Prevent dropdown from closing
                    handleToggle(toolkit)
                  }}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {getToolkitIcon(toolkit)}
                    <span className="truncate">{toolkit.displayName}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isPending ? (
                      <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                    ) : toolkit.enabled ? (
                      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/40 bg-background" />
                    )}
                  </div>
                </DropdownMenuItem>
              )
            })}
          </>
        )}

        <DropdownMenuSeparator />

        {/* Manage Connectors link */}
        <DropdownMenuItem onClick={handleManageConnectors} className="gap-2">
          <Settings2 className="w-4 h-4 text-muted-foreground" />
          <span>Manage Connectors</span>
          <ExternalLink className="w-3 h-3 ml-auto text-muted-foreground" />
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
})
