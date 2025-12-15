"use client"

import React, { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { WebSocketProvider } from "@/lib/ws/provider"
import { AppSidebar } from "@/components/app-sidebar"
import {
  SidebarProvider,
  SidebarInset,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Auto-collapse sidebar on session detail pages
  useEffect(() => {
    // Check if we're on a session detail page (/dashboard/sessions/[id])
    const isSessionDetailPage = /^\/dashboard\/sessions\/[^/]+$/.test(pathname)
    setSidebarOpen(!isSessionDetailPage)
  }, [pathname])

  // Generate breadcrumb items based on current path
  const generateBreadcrumbs = () => {
    const segments = pathname.split("/").filter(Boolean)
    const breadcrumbs: { label: string; href: string; active: boolean }[] = []

    breadcrumbs.push({ label: "Dashboard", href: "/dashboard", active: false })

    if (segments.includes("sessions")) {
      breadcrumbs.push({
        label: "Sessions",
        href: "/dashboard/sessions",
        active: !segments[segments.length - 1] || segments[segments.length - 1] === "sessions",
      })

      // If viewing a specific session
      if (segments.length > 2 && segments[0] === "dashboard") {
        const sessionId = segments[segments.length - 1]
        breadcrumbs.push({
          label: `Case ${sessionId.substring(0, 8)}`,
          href: pathname,
          active: true,
        })
      }
    }

    return breadcrumbs
  }

  const breadcrumbs = generateBreadcrumbs()

  return (
    <WebSocketProvider>
      <SidebarProvider open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <AppSidebar />
        <SidebarInset>
          <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60 px-4">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mr-2 h-4" />
            <Breadcrumb>
              <BreadcrumbList>
                {breadcrumbs.map((crumb, index) => (
                  <React.Fragment key={crumb.href}>
                    {index > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem>
                      {crumb.active ? (
                        <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink href={crumb.href}>{crumb.label}</BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  </React.Fragment>
                ))}
              </BreadcrumbList>
            </Breadcrumb>
          </header>

          <main className="flex-1 overflow-y-auto">
            <div className="flex flex-col gap-4 p-6">
              {children}
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </WebSocketProvider>
  )
}
