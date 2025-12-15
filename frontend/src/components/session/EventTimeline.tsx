"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Loader, Search, Filter, X, Download } from "lucide-react"
import { SessionEvent, EventCategory, transformSessionLogs, SessionLogResponse } from "@/lib/types/events"
import { toast } from "sonner"

interface EventTimelineProps {
  sessionId: string
  onEventReceived?: (event: SessionEvent) => void
}

interface FilterState {
  search: string
  category: EventCategory | "all"
  dateFrom: string
  dateTo: string
  severity: string | "all"
}

export function EventTimeline({ sessionId, onEventReceived }: EventTimelineProps) {
  const [events, setEvents] = useState<SessionEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [showFilters, setShowFilters] = useState(false)
  const [autoScroll, setAutoScroll] = useState(true)
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    category: "all",
    dateFrom: "",
    dateTo: "",
    severity: "all",
  })

  // Load events and set up polling
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await fetch(`/api/proxy/sessions/${sessionId}/events?limit=100`)
        if (!res.ok) {
          throw new Error(`Failed to fetch events: ${res.status}`)
        }

        const data = await res.json()
        const sessionLogs = data.results as SessionLogResponse[]
        const transformedEvents = transformSessionLogs(sessionLogs)
        setEvents(transformedEvents)
      } catch (err) {
        console.error("Failed to fetch events:", err)
        toast.error("Failed to load event timeline")
      } finally {
        setLoading(false)
      }
    }

    // Initial fetch
    fetchEvents()

    // Set up polling for active sessions (every 30 seconds)
    const pollInterval = setInterval(() => {
      fetchEvents()
    }, 30000)

    return () => clearInterval(pollInterval)
  }, [sessionId])

  // Filter events based on all criteria
  const filteredEvents = events.filter((event) => {
    // Text search
    const matchesSearch =
      !filters.search ||
      event.title.toLowerCase().includes(filters.search.toLowerCase()) ||
      event.description?.toLowerCase().includes(filters.search.toLowerCase())

    // Category filter
    const matchesCategory =
      filters.category === "all" || event.category === filters.category

    // Severity filter
    const matchesSeverity =
      filters.severity === "all" || event.severity === filters.severity

    // Date range filter
    let matchesDateRange = true
    if (filters.dateFrom || filters.dateTo) {
      const eventDate = new Date(event.timestamp)
      if (filters.dateFrom) {
        const fromDate = new Date(filters.dateFrom)
        fromDate.setHours(0, 0, 0, 0)
        matchesDateRange = matchesDateRange && eventDate >= fromDate
      }
      if (filters.dateTo) {
        const toDate = new Date(filters.dateTo)
        toDate.setHours(23, 59, 59, 999)
        matchesDateRange = matchesDateRange && eventDate <= toDate
      }
    }

    return matchesSearch && matchesCategory && matchesSeverity && matchesDateRange
  })

  // Format timestamp
  const formatTime = (isoString: string) => {
    const date = new Date(isoString)
    const now = new Date()
    const diffSeconds = (now.getTime() - date.getTime()) / 1000

    if (diffSeconds < 60) return "just now"
    if (diffSeconds < 3600) return `${Math.floor(diffSeconds / 60)}m ago`
    if (diffSeconds < 86400) return `${Math.floor(diffSeconds / 3600)}h ago`
    return date.toLocaleDateString()
  }

  // Get category color
  const getCategoryColor = (category: EventCategory) => {
    const colors: Record<EventCategory, string> = {
      user: "bg-blue-500/20 text-blue-400 border-blue-500/30",
      system: "bg-gray-500/20 text-gray-400 border-gray-500/30",
      agent: "bg-purple-500/20 text-purple-400 border-purple-500/30",
      error: "bg-red-500/20 text-red-400 border-red-500/30",
    }
    return colors[category]
  }

  // Get severity icon color
  const getSeverityColor = (severity?: string) => {
    switch (severity) {
      case "error":
        return "text-red-500"
      case "warning":
        return "text-yellow-500"
      case "success":
        return "text-green-500"
      default:
        return "text-blue-500"
    }
  }

  // Export events as CSV
  const handleExportCSV = () => {
    if (filteredEvents.length === 0) {
      toast.error("No events to export")
      return
    }

    const headers = ["Timestamp", "Title", "Category", "Severity", "Description"]
    const rows = filteredEvents.map((event) => [
      new Date(event.timestamp).toLocaleString(),
      event.title,
      event.category,
      event.severity || "info",
      event.description || "",
    ])

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)

    link.setAttribute("href", url)
    link.setAttribute("download", `events-${sessionId}-${Date.now()}.csv`)
    link.style.visibility = "hidden"

    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    toast.success(`Exported ${filteredEvents.length} events`)
  }

  // Reset all filters
  const handleResetFilters = () => {
    setFilters({
      search: "",
      category: "all",
      dateFrom: "",
      dateTo: "",
      severity: "all",
    })
    toast.success("Filters reset")
  }

  // Check if any filters are active
  const hasActiveFilters =
    filters.search !== "" ||
    filters.category !== "all" ||
    filters.severity !== "all" ||
    filters.dateFrom !== "" ||
    filters.dateTo !== ""

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">Event Timeline</CardTitle>
        <CardDescription>Real-time session events and actions</CardDescription>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col gap-3 min-h-0">
        {/* Top Controls */}
        <div className="flex items-center gap-2">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search events..."
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              className="pl-10 h-8 text-sm"
            />
          </div>

          {/* Filter Toggle Button */}
          <Button
            size="sm"
            variant={hasActiveFilters ? "default" : "outline"}
            onClick={() => setShowFilters(!showFilters)}
            className="h-8 px-2 flex items-center gap-1"
          >
            <Filter className="w-4 h-4" />
            <span className="text-xs hidden sm:inline">Filters</span>
          </Button>

          {/* Export Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportCSV}
            className="h-8 px-2 flex items-center gap-1"
            title="Export events as CSV"
          >
            <Download className="w-4 h-4" />
            <span className="text-xs hidden sm:inline">Export</span>
          </Button>
        </div>

        {/* Advanced Filters Panel */}
        {showFilters && (
          <div className="border rounded-lg p-3 space-y-3 bg-muted/30">
            {/* Category Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Category</label>
              <div className="flex gap-1 flex-wrap">
                {(["all", "user", "system", "agent", "error"] as const).map((cat) => (
                  <Button
                    key={cat}
                    size="sm"
                    variant={filters.category === cat ? "default" : "outline"}
                    onClick={() => setFilters({ ...filters, category: cat })}
                    className="h-6 text-xs capitalize"
                  >
                    {cat}
                  </Button>
                ))}
              </div>
            </div>

            {/* Severity Filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Severity</label>
              <div className="flex gap-1 flex-wrap">
                {(["all", "info", "success", "warning", "error"] as const).map((sev) => (
                  <Button
                    key={sev}
                    size="sm"
                    variant={filters.severity === sev ? "default" : "outline"}
                    onClick={() => setFilters({ ...filters, severity: sev })}
                    className="h-6 text-xs capitalize"
                  >
                    {sev}
                  </Button>
                ))}
              </div>
            </div>

            {/* Date Range Filter */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground block">From</label>
                <Input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  className="h-7 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground block">To</label>
                <Input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  className="h-7 text-xs"
                />
              </div>
            </div>

            {/* Reset Filters Button */}
            {hasActiveFilters && (
              <Button
                size="sm"
                variant="ghost"
                onClick={handleResetFilters}
                className="h-6 text-xs w-full"
              >
                <X className="w-3 h-3 mr-1" />
                Reset Filters
              </Button>
            )}
          </div>
        )}

        {/* Auto-scroll toggle */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setAutoScroll(!autoScroll)}
            className="h-7 text-xs"
          >
            {autoScroll ? "Auto-scroll" : "Manual"}
          </Button>
        </div>

        {/* Events List */}
        <ScrollArea className="flex-1 border rounded-lg bg-muted/30">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              No events found
            </div>
          ) : (
            <div className="space-y-2 p-3">
              {filteredEvents.map((event) => (
                <div
                  key={event.id}
                  className="p-2 rounded-lg border border-border/50 bg-background/50 hover:bg-background/80 transition-colors text-xs space-y-1"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div
                        className={`w-2 h-2 rounded-full flex-shrink-0 ${getSeverityColor(event.severity)}`}
                      />
                      <span className="font-semibold truncate">{event.title}</span>
                    </div>
                    <Badge variant="outline" className={`flex-shrink-0 h-5 text-xs ${getCategoryColor(event.category)}`}>
                      {event.category}
                    </Badge>
                  </div>

                  {event.description && (
                    <p className="text-muted-foreground pl-4">{event.description}</p>
                  )}

                  <div className="flex items-center justify-between pl-4 pt-1">
                    <span className="text-xs text-muted-foreground">{formatTime(event.timestamp)}</span>
                    {event.metadata?.agent && (
                      <span className="text-xs bg-primary/10 text-primary px-1.5 py-0.5 rounded">
                        {event.metadata.agent}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Info footer */}
        <div className="text-xs text-muted-foreground pt-2 border-t">
          <p>Showing {filteredEvents.length} of {events.length} events</p>
          <p className="mt-1">
            Event logs will auto-update as session progresses
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
