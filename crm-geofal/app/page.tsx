"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import { ClientesModule } from "@/components/dashboard/clientes-module"
import { CotizadoraModule } from "@/components/dashboard/cotizadora-module"
import { ConfiguracionModule } from "@/components/dashboard/configuracion-module"
import { ProyectosModule } from "@/components/dashboard/proyectos-module"
import { PermisosModule } from "@/components/dashboard/permisos-module"
import { UsuariosModule } from "@/components/dashboard/usuarios-module"
import { AuditoriaModule } from "@/components/dashboard/auditoria-module"
import { ProgramacionModule } from "@/components/dashboard/programacion-module"
import { RoleGuard } from "@/components/dashboard/role-guard"
import { useAuth, type User, type UserRole, type ModuleType } from "@/hooks/use-auth"
import { Loader2 } from "lucide-react"

// Re-export types from single source of truth (use-auth.ts)
export type { User, UserRole, ModuleType }

export default function HomePage() {
  const [activeModule, setActiveModule] = useState<ModuleType>("cotizadora")
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="flex h-screen bg-background">
        {/* Skeleton Sidebar */}
        <div className="w-64 bg-sidebar border-r border-sidebar-border hidden md:flex flex-col">
          <div className="p-6 border-b border-sidebar-border h-24">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-zinc-800 animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 w-24 bg-zinc-800 rounded animate-pulse" />
                <div className="h-3 w-16 bg-zinc-800 rounded animate-pulse" />
              </div>
            </div>
          </div>
          <div className="p-4 space-y-2 flex-1">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-10 w-full bg-zinc-800/50 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>

        {/* Skeleton Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="h-16 border-b border-border bg-card/50 flex items-center justify-between px-6">
            <div className="h-9 w-64 bg-zinc-800/50 rounded animate-pulse" />
            <div className="flex items-center gap-4">
              <div className="h-9 w-9 bg-zinc-800/50 rounded animate-pulse" />
              <div className="h-9 w-32 bg-zinc-800/50 rounded animate-pulse" />
            </div>
          </div>
          <main className="flex-1 p-6 space-y-6">
            <div className="h-32 w-full bg-zinc-800/20 rounded-xl animate-pulse" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <div className="h-64 bg-zinc-800/20 rounded-xl animate-pulse" />
              <div className="h-64 bg-zinc-800/20 rounded-xl animate-pulse" />
              <div className="h-64 bg-zinc-800/20 rounded-xl animate-pulse" />
            </div>
          </main>
        </div>
      </div>
    )
  }

  if (!user) return null

  // Transform User from useAuth to what components expect if they differ
  const dashboardUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatar: user.avatar || "/professional-man-avatar.png",
    phone: user.phone || "",
  } as any

  const renderModule = () => {
    switch (activeModule) {
      case "clientes":
        return <ClientesModule user={dashboardUser} />
      case "proyectos":
        return <ProyectosModule user={dashboardUser} />
      case "cotizadora":
        return <CotizadoraModule user={dashboardUser} />
      case "programacion":
        return <ProgramacionModule user={dashboardUser} />
      case "usuarios":
        return (
          <RoleGuard user={dashboardUser} allowedRoles={["admin"]}>
            <UsuariosModule />
          </RoleGuard>
        )
      case "permisos":
        return (
          <RoleGuard user={dashboardUser} allowedRoles={["admin"]}>
            <PermisosModule />
          </RoleGuard>
        )
      case "auditoria":
        return (
          <RoleGuard user={dashboardUser} allowedRoles={["admin"]}>
            <AuditoriaModule user={dashboardUser} />
          </RoleGuard>
        )
      case "configuracion":
        return (
          <RoleGuard user={dashboardUser} allowedRoles={["admin", "vendor"]}>
            <ConfiguracionModule />
          </RoleGuard>
        )
      default:
        return <CotizadoraModule user={dashboardUser} />
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <DashboardSidebar activeModule={activeModule} setActiveModule={setActiveModule} user={dashboardUser} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader user={dashboardUser} setActiveModule={setActiveModule} />
        <main className="flex-1 overflow-auto p-6">{renderModule()}</main>
      </div>
    </div>
  )
}
