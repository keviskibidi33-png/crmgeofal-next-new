"use client"

import type React from "react"

import { cn } from "@/lib/utils"
import { Users, FileText, Settings, ChevronRight, FolderKanban, Shield, User as UserIcon, Activity, ClipboardList } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import type { ModuleType, User } from "@/hooks/use-auth"

interface SidebarProps {
  activeModule: ModuleType
  setActiveModule: (module: ModuleType) => void
  user: User
}

const modules: { id: ModuleType; label: string; icon: React.ElementType; adminOnly?: boolean }[] = [
  { id: "clientes", label: "Clientes", icon: Users },
  { id: "proyectos", label: "Proyectos", icon: FolderKanban },
  { id: "cotizadora", label: "Cotizadora", icon: FileText },
  { id: "programacion", label: "Programación", icon: ClipboardList },
  { id: "usuarios", label: "Usuarios", icon: Shield, adminOnly: true },
  { id: "permisos", label: "Permisos", icon: Shield, adminOnly: true },
  { id: "laboratorio", label: "Laboratorio", icon: Activity }, // Added Laboratorio
  { id: "auditoria", label: "Auditoría", icon: Activity, adminOnly: true },
  { id: "configuracion", label: "Configuración", icon: Settings },
]

export function DashboardSidebar({ activeModule, setActiveModule, user }: SidebarProps) {
  // DEBUG: Log user permissions on every render
  console.log("[SIDEBAR DEBUG] User object:", JSON.stringify({
    role: user.role,
    roleLabel: user.roleLabel,
    permissions: user.permissions
  }, null, 2))

  // Use granular permissions for filtering
  // Admin maintains full access fallback, but ideally should have all permissions true in DB
  const filteredModules = modules.filter((module) => {
    // 1. If user is admin, show everything
    if (user.role === "admin") return true

    // 2. If module has specific permission key, check it
    if (user.permissions && user.permissions[module.id]) {
      const hasAccess = user.permissions[module.id].read === true
      console.log(`[SIDEBAR DEBUG] Module ${module.id}: hasAccess=${hasAccess}`)
      return hasAccess
    }

    // 3. Fallback for legacy behavior (if no permissions loaded)
    console.log(`[SIDEBAR DEBUG] Module ${module.id}: Using fallback (no permissions), adminOnly=${module.adminOnly}`)
    return !module.adminOnly
  })

  const handleModuleClick = (id: ModuleType) => {
    console.log('[SIDEBAR] Click en módulo:', id)
    setActiveModule(id)
  }

  return (
    <aside className="w-64 bg-sidebar border-r border-sidebar-border flex flex-col">
      {/* Logo */}
      <div className="p-6 border-b border-sidebar-border">
        <div className="flex items-center gap-3">
          <img
            src="/logo-geofal.svg"
            alt="Geofal CRM"
            className="h-10 w-auto"
          />
          <div>
            <h1 className="font-semibold text-sidebar-foreground">Geofal CRM</h1>
            <p className="text-xs text-muted-foreground">Panel Administrativo</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {filteredModules.map((module) => {
          const Icon = module.icon
          const isActive = activeModule === module.id

          return (
            <button
              key={module.id}
              onClick={() => handleModuleClick(module.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="flex-1 text-left">{module.label}</span>
              {isActive && <ChevronRight className="h-4 w-4 text-primary" />}
            </button>
          )
        })}
      </nav>

      {/* User Profile */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center gap-3 p-3 rounded-lg bg-sidebar-accent/30">
          <Avatar className="h-10 w-10 border-2 border-primary/30">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
              <UserIcon className="h-4 w-4 text-primary" />
            </div>
            <AvatarFallback className="bg-primary/20 text-primary">
              {user.name
                .split(" ")
                .map((n) => n[0])
                .join("")}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
            <Badge
              variant="outline"
              className={cn(
                "text-xs mt-1",
                user.role === "admin"
                  ? "border-primary/50 text-primary"
                  : "border-muted-foreground/50 text-muted-foreground",
              )}
            >
              {user.roleLabel || (user.role === "admin" ? "Administrador" : "Vendedor")}
            </Badge>
          </div>
        </div>
      </div>
    </aside>
  )
}
