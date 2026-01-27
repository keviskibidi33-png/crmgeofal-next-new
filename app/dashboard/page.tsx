"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { DashboardSidebar } from "@/components/dashboard/sidebar"
import { DashboardHeader } from "@/components/dashboard/header"
import { ClientesModule } from "@/components/dashboard/clientes-module"
import { CotizadoraModule } from "@/components/dashboard/cotizadora-module"
import { ConfiguracionModule } from "@/components/dashboard/configuracion-module"
import { UsuariosModule } from "@/components/dashboard/usuarios-module"
import { ProyectosModule } from "@/components/dashboard/proyectos-module"
import { AuditoriaModule } from "@/components/dashboard/auditoria-module"
import { RoleGuard } from "@/components/dashboard/role-guard"
import { useAuth, type User, type UserRole, type ModuleType } from "@/hooks/use-auth"
import { Loader2 } from "lucide-react"

export default function DashboardPage() {
  const [activeModule, setActiveModule] = useState<ModuleType>("cotizadora")
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    const saved = localStorage.getItem("crm-active-module") as ModuleType
    if (saved) setActiveModule(saved)
  }, [])

  useEffect(() => {
    localStorage.setItem("crm-active-module", activeModule)
  }, [activeModule])

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-zinc-950">
        <Loader2 className="h-10 w-10 text-primary animate-spin" />
      </div>
    )
  }

  if (!user) return null

  const dashboardUser = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role === "admin" ? "admin" : "vendor",
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
      case "usuarios":
        return (
          <RoleGuard user={dashboardUser} allowedRoles={["admin"]}>
            <UsuariosModule />
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
