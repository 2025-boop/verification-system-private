"use client"

import * as React from "react"
import {
  LayoutDashboard,
  MessageSquare,
  Shield,
} from "lucide-react"

import { generateAvatar, getCookie } from "@/lib/avatar"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"

const navMainItems = [
  {
    title: "Overview",
    url: "/dashboard",
    icon: LayoutDashboard,
    isActive: true,
  },
  {
    title: "Sessions",
    url: "/dashboard/sessions",
    icon: MessageSquare,
  },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const [username, setUsername] = React.useState("Agent")

  React.useEffect(() => {
    const user = getCookie("username")
    if (user) setUsername(user)
  }, [])

  const data = {
    user: {
      name: username,
      email: `${username.toLowerCase()}@controlroom.local`,
      avatar: generateAvatar(username),
    },
    navMain: navMainItems,
    navSecondary: [],
    projects: [],
  }

  return (
    <Sidebar variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <a href="/dashboard">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Shield className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Control Room</span>
                  <span className="truncate text-xs">Agent Dashboard</span>
                </div>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  )
}
