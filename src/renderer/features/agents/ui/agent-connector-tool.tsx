"use client"

import { memo, useState, useMemo } from "react"
import { ChevronRight, Plug } from "lucide-react"
import { TextShimmer } from "../../../components/ui/text-shimmer"
import { areToolPropsEqual } from "./agent-tool-utils"
import { cn } from "../../../lib/utils"
import { TOOLKIT_ICONS } from "../../../lib/atoms/composio"

// Map toolkit names to display names
const TOOLKIT_DISPLAY_NAMES: Record<string, string> = {
  gmail: "Gmail",
  github: "GitHub",
  slack: "Slack",
  notion: "Notion",
  google_sheets: "Google Sheets",
  googlesheets: "Google Sheets",
  google_drive: "Google Drive",
  googledrive: "Google Drive",
  google_calendar: "Google Calendar",
  googlecalendar: "Google Calendar",
  outlook: "Outlook",
  linear: "Linear",
  jira: "Jira",
  discord: "Discord",
  twitter: "Twitter",
  reddit: "Reddit",
  trello: "Trello",
  asana: "Asana",
  airtable: "Airtable",
  dropbox: "Dropbox",
  exa: "Exa",
  figma: "Figma",
  hubspot: "HubSpot",
  salesforce: "Salesforce",
  stripe: "Stripe",
  shopify: "Shopify",
  zoom: "Zoom",
  linkedin: "LinkedIn",
  composio: "Composio",
}

// Convert action name to human readable format
// e.g., "FETCH_EMAILS" -> "Fetch emails"
function formatActionName(action: string): string {
  return action
    .split("_")
    .map((word, index) =>
      index === 0
        ? word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        : word.toLowerCase()
    )
    .join(" ")
}

// Parse tool type to extract toolkit and action
// Format: "tool-mcp__composio__TOOLKIT_ACTION" or "tool-mcp__composio__COMPOSIO_SEARCH_TOOLS"
function parseComposioToolType(type: string): { toolkit: string; action: string; displayName: string } {
  // Remove "tool-" prefix and split by "__"
  const withoutPrefix = type.replace("tool-", "")
  const parts = withoutPrefix.split("__")

  // Format: mcp__composio__TOOLKIT_ACTION
  // parts[0] = "mcp", parts[1] = "composio", parts[2] = "TOOLKIT_ACTION"
  if (parts.length >= 3) {
    const fullAction = parts.slice(2).join("__") // Handle nested __ in action names

    // Try to find a known toolkit prefix
    const actionUpper = fullAction.toUpperCase()
    for (const knownToolkit of Object.keys(TOOLKIT_DISPLAY_NAMES)) {
      const prefix = knownToolkit.toUpperCase() + "_"
      if (actionUpper.startsWith(prefix)) {
        const action = fullAction.slice(prefix.length)
        return {
          toolkit: knownToolkit.toLowerCase(),
          action: formatActionName(action),
          displayName: TOOLKIT_DISPLAY_NAMES[knownToolkit.toLowerCase()] || knownToolkit,
        }
      }
    }

    // If no known toolkit found, use the first part of the action as toolkit
    const actionParts = fullAction.split("_")
    if (actionParts.length > 1) {
      const toolkit = actionParts[0].toLowerCase()
      const action = actionParts.slice(1).join("_")
      return {
        toolkit,
        action: formatActionName(action),
        displayName: TOOLKIT_DISPLAY_NAMES[toolkit] || actionParts[0].charAt(0).toUpperCase() + actionParts[0].slice(1).toLowerCase(),
      }
    }

    return {
      toolkit: "composio",
      action: formatActionName(fullAction),
      displayName: "Composio",
    }
  }

  return {
    toolkit: "composio",
    action: type.replace("tool-", ""),
    displayName: "Composio",
  }
}

interface AgentConnectorToolProps {
  part: {
    type: string
    toolCallId: string
    state: string
    input?: Record<string, unknown>
    output?: unknown
    result?: unknown
  }
  chatStatus?: string
}

export const AgentConnectorTool = memo(
  function AgentConnectorTool({
    part,
    chatStatus,
  }: AgentConnectorToolProps) {
    const [isExpanded, setIsExpanded] = useState(false)

    const isPending =
      part.state !== "output-available" && part.state !== "output-error" && part.state !== "result"
    const isActivelyStreaming = chatStatus === "streaming" || chatStatus === "submitted"
    const isStreaming = isPending && isActivelyStreaming

    // Parse the tool type to get toolkit info
    const { toolkit, action, displayName } = useMemo(
      () => parseComposioToolType(part.type),
      [part.type]
    )

    // Get the logo URL for this toolkit
    const logoUrl = TOOLKIT_ICONS[toolkit] || TOOLKIT_ICONS[toolkit.replace("_", "")]

    // Format input preview for display
    const inputPreview = useMemo(() => {
      if (!part.input || Object.keys(part.input).length === 0) return ""
      const entries = Object.entries(part.input)
      const preview = entries
        .slice(0, 2)
        .map(([k, v]) => {
          const valueStr = typeof v === "string" ? v : JSON.stringify(v)
          const truncated = valueStr.length > 25 ? valueStr.slice(0, 22) + "..." : valueStr
          return `${k}: ${truncated}`
        })
        .join(", ")
      return entries.length > 2 ? preview + ` +${entries.length - 2}` : preview
    }, [part.input])

    // Check if we have details to show
    const hasDetails = part.input && Object.keys(part.input).length > 0

    // Title text
    const title = `${displayName} · ${action}`

    return (
      <div>
        {/* Header - matches WebSearch style exactly */}
        <div
          onClick={() => hasDetails && !isPending && setIsExpanded(!isExpanded)}
          className={cn(
            "group flex items-start gap-1.5 py-0.5 px-2",
            hasDetails && !isPending && "cursor-pointer",
          )}
        >
          {/* Logo */}
          <div className="flex-shrink-0 flex items-center justify-center w-4 h-4 mt-[1px]">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={displayName}
                className="w-3.5 h-3.5 object-contain"
                onError={(e) => {
                  e.currentTarget.style.display = "none"
                  const fallback = e.currentTarget.nextElementSibling as HTMLElement
                  if (fallback) fallback.style.display = "block"
                }}
              />
            ) : null}
            <Plug
              className={cn(
                "w-3.5 h-3.5 text-muted-foreground",
                logoUrl && "hidden"
              )}
            />
          </div>

          {/* Content container - matches WebSearch exactly */}
          <div className="flex-1 min-w-0 flex items-center gap-1">
            <div className="text-xs flex items-center gap-1.5 min-w-0">
              <span className="font-medium whitespace-nowrap flex-shrink-0 text-muted-foreground">
                {isStreaming ? (
                  <TextShimmer
                    as="span"
                    duration={1.2}
                    className="inline-flex items-center text-xs leading-none h-4 m-0"
                  >
                    {title}
                  </TextShimmer>
                ) : (
                  title
                )}
              </span>
              {/* Input preview when collapsed */}
              {!isExpanded && inputPreview && (
                <span className="text-muted-foreground/60 truncate">
                  {inputPreview}
                </span>
              )}
              {/* Chevron - rotates when expanded, visible on hover when collapsed */}
              {hasDetails && !isPending && (
                <ChevronRight
                  className={cn(
                    "w-3.5 h-3.5 text-muted-foreground/60 transition-transform duration-200 ease-out flex-shrink-0",
                    isExpanded && "rotate-90",
                    !isExpanded && "opacity-0 group-hover:opacity-100",
                  )}
                />
              )}
            </div>
          </div>
        </div>

        {/* Expanded details - matches other tools */}
        {isExpanded && hasDetails && (
          <div className="px-2 pb-1">
            <div className="ml-5 space-y-1">
              {part.input && Object.entries(part.input).map(([key, value]) => (
                <div key={key} className="text-xs flex gap-2">
                  <span className="text-muted-foreground/60 flex-shrink-0">{key}:</span>
                  <span className="text-muted-foreground break-all">
                    {typeof value === "string"
                      ? value.length > 80 ? value.slice(0, 80) + "..." : value
                      : JSON.stringify(value).slice(0, 80)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    )
  },
  areToolPropsEqual,
)
