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
import { ProgramacionModule } from "@/components/dashboard/programacion-module"
import { RoleGuard } from "@/components/dashboard/role-guard"
import { PermisosModule } from "@/components/dashboard/permisos-module"
import { SessionTerminatedDialog } from "@/components/dashboard/session-terminated-dialog"
import { useAuth, type User, type UserRole, type ModuleType } from "@/hooks/use-auth"
import { Loader2 } from "lucide-react"

export default function DashboardPage() {
  const [activeModule, setActiveModule] = useState<ModuleType>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem("crm-active-module") as ModuleType
      console.log('[CRM] Valor recuperado de localStorage:', saved)
      return saved || "clientes"
    }
    return "clientes"
  })
  const { user, loading, isSessionTerminated, signOut } = useAuth()
  const router = useRouter()


  useEffect(() => {
    localStorage.setItem("crm-active-module", activeModule)
    console.log('[CRM] Nuevo valor de activeModule:', activeModule)
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
    console.log('[CRM] Renderizando módulo:', activeModule)
    switch (activeModule) {
      case "clientes":
        return <ClientesModule user={dashboardUser} />
      case "proyectos":
        return <ProyectosModule user={dashboardUser} />
      case "cotizadora":
        return <CotizadoraModule user={dashboardUser} />
      case "programacion": {
        try {
          console.log('[CRM] Intentando renderizar ProgramacionModule', dashboardUser)
          return <ProgramacionModule user={dashboardUser} />
        } catch (err) {
          console.error('[CRM] Error al renderizar ProgramacionModule:', err)
          return <div style={{ color: 'red' }}>Error al renderizar Programación: {String(err)}</div>
        }
      }
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
        console.warn('[CRM] Modulo no reconocido:', activeModule)
        return (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <h2 className="text-xl font-bold">Módulo no encontrado</h2>
            <p>El módulo "{activeModule}" no está configurado o no existe.</p>
          </div>
        )
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <DashboardSidebar activeModule={activeModule} setActiveModule={setActiveModule} user={dashboardUser} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <DashboardHeader user={dashboardUser} setActiveModule={setActiveModule} />
        <main className="flex-1 overflow-auto p-6">{renderModule()}</main>
      </div>

      {/* Session Termination Guard */}
      <SessionTerminatedDialog
        open={!!isSessionTerminated}
        onConfirm={() => signOut()}
      />
    </div>
  )
}
