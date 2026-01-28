import { atom } from "jotai"
import { atomWithStorage } from "jotai/utils"

// ===== Composio Connectors State =====

export type ComposioConnectionStatus =
  | "connected"
  | "disconnected"
  | "pending"
  | "error"

export interface ComposioToolkit {
  name: string
  displayName: string
  description: string
  logo: string
  categories: string[]
  authSchemes: string[]
  status: ComposioConnectionStatus
  enabled: boolean
  connectedAt?: string | null
}

// Whether Composio is configured (API key available in build)
export const composioConfiguredAtom = atom<boolean>(false)

// Cached toolkit list (refreshed from tRPC)
export const composioToolkitsAtom = atom<ComposioToolkit[]>([])

// Connectors dropdown open state in prompt bar
export const composioDropdownOpenAtom = atom<boolean>(false)

// Filter for toolkit categories in settings
export const composioToolkitCategoryFilterAtom = atom<string | null>(null)

// Search query for toolkits in settings
export const composioToolkitSearchAtom = atom<string>("")

// Pending connection (polling for OAuth completion)
export const composioPendingConnectionAtom = atom<string | null>(null)

// Whether connectors settings tab is loading
export const composioLoadingAtom = atom<boolean>(false)

// Last sync timestamp (for refreshing connection status)
export const composioLastSyncAtom = atom<number>(0)

// Popular categories for filtering
export const COMPOSIO_CATEGORIES = [
  { id: null, label: "All" },
  { id: "productivity", label: "Productivity" },
  { id: "communication", label: "Communication" },
  { id: "developer_tools", label: "Developer" },
  { id: "marketing", label: "Marketing" },
  { id: "crm", label: "CRM" },
  { id: "storage", label: "Storage" },
  { id: "social_media", label: "Social Media" },
  { id: "finance", label: "Finance" },
] as const

// Popular toolkit icons mapping (fallback for toolkits without logos)
export const TOOLKIT_ICONS: Record<string, string> = {
  gmail: "https://www.gstatic.com/images/icons/material/product/2x/gmail_48dp.png",
  slack: "https://a.slack-edge.com/80588/marketing/img/icons/icon_slack_hash_colored.png",
  github: "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png",
  notion: "https://upload.wikimedia.org/wikipedia/commons/e/e9/Notion-logo.svg",
  discord: "https://assets-global.website-files.com/6257adef93867e50d84d30e2/636e0a6a49cf127bf92de1e2_icon_clyde_blurple_RGB.png",
  linear: "https://asset.brandfetch.io/iduDa181eM/idXYWPx96C.svg",
  asana: "https://d1gwm4cf8hecp4.cloudfront.net/images/favicons/android-chrome-512x512.png",
  jira: "https://wac-cdn.atlassian.com/assets/img/favicons/atlassian/apple-touch-icon.png",
  trello: "https://a.trellocdn.com/prgb/assets/images/icons/apple-touch-icon.png",
  google_drive: "https://ssl.gstatic.com/docs/doclist/images/drive_2022q3_32dp.png",
  google_sheets: "https://ssl.gstatic.com/docs/documents/images/kix-favicon7.ico",
  google_calendar: "https://ssl.gstatic.com/calendar/images/dynamiclogo_2020q4/calendar_31_2x.png",
  twitter: "https://abs.twimg.com/icons/apple-touch-icon-192x192.png",
  linkedin: "https://static.licdn.com/sc/h/al2o9zrvru7aqj8e1x2rzsrca",
  hubspot: "https://www.hubspot.com/hubfs/HubSpot_Logos/HubSpot-Inversed-Favicon.png",
  salesforce: "https://www.salesforce.com/favicon.ico",
  stripe: "https://stripe.com/img/v3/home/twitter.png",
  shopify: "https://cdn.shopify.com/static/shopify-favicon.png",
  airtable: "https://airtable.com/images/favicon/baymax/airtable-favicon-192.png",
  dropbox: "https://cfl.dropboxstatic.com/static/images/logo_catalog/blue_dropbox_glyph_m1.png",
  zoom: "https://st1.zoom.us/zoom.ico",
  figma: "https://static.figma.com/app/icon/1/favicon.png",
}
