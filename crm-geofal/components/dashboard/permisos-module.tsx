"use client"

import { useState, useEffect, useCallback } from "react"
import { Shield, Save, Loader2, Check, X, AlertTriangle, Users } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea" // Assuming you have this or use Input
import { toast } from "sonner"
import { useAuth } from "@/hooks/use-auth"
import { supabase } from "@/lib/supabaseClient"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

// --- Types matching Backend ---
type ModulePermission = {
    read: boolean
    write: boolean
    delete: boolean
}

type RolePermissions = {
    clientes: ModulePermission
    proyectos: ModulePermission
    cotizadora: ModulePermission
    programacion: ModulePermission
    usuarios: ModulePermission
    auditoria: ModulePermission
    configuracion: ModulePermission
    laboratorio: ModulePermission
    permisos: ModulePermission
    [key: string]: ModulePermission // Index signature for dynamic modules
}

type RoleDefinition = {
    role_id: string
    label: string
    description?: string
    permissions: RolePermissions
    is_system: boolean
}

const MODULES = [
    { id: "clientes", label: "Clientes" },
    { id: "proyectos", label: "Proyectos" },
    { id: "cotizadora", label: "Cotizadora" },
    { id: "programacion", label: "Programación" },
    { id: "usuarios", label: "Gestión Usuarios" },
    { id: "auditoria", label: "Auditoría" },
    { id: "configuracion", label: "Configuración" },
    { id: "laboratorio", label: "Laboratorio" },
    { id: "permisos", label: "Matriz Permisos" },
]

export function PermisosModule() {
    const { user } = useAuth()
    // const { toast } = useToast() // Replaced by Sonner
    const [roles, setRoles] = useState<RoleDefinition[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [activeRole, setActiveRole] = useState<RoleDefinition | null>(null)

    const fetchRoles = useCallback(async () => {
        setLoading(true)
        try {
            // Fetch from your FastAPI backend
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/roles`)
            if (!res.ok) throw new Error("Failed to fetch roles")
            const data = await res.json()
            setRoles(data)
            if (data.length > 0 && !activeRole) {
                setActiveRole(data[0])
            }
        } catch (error) {
            toast.error("Error al cargar roles", {
                description: "No se pudieron obtener los permisos del servidor.",
            })
        } finally {
            setLoading(false)
        }
    }, [activeRole])

    useEffect(() => {
        fetchRoles()

        // Realtime Subscription
        const channel = supabase
            .channel('roles_realtime')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'role_definitions' },
                () => {
                    console.log("Roles updated via Realtime")
                    fetchRoles()
                }
            )
            .subscribe((status) => {
                if (status === 'CHANNEL_ERROR') {
                    console.warn("Realtime connection error in PermisosModule")
                }
            })

        return () => {
            supabase.removeChannel(channel)
        }
    }, [fetchRoles])

    const handlePermissionChange = (
        module: string,
        action: "read" | "write" | "delete",
        value: boolean
    ) => {
        if (!activeRole) return

        // Create deep copy to avoid mutating state directly
        const updatedPermissions: any = JSON.parse(JSON.stringify(activeRole.permissions))

        if (!updatedPermissions[module]) {
            updatedPermissions[module] = { read: false, write: false, delete: false }
        }

        updatedPermissions[module][action] = value

        // Logic: If Write/Delete is true, Read must be true
        if ((action === "write" || action === "delete") && value === true) {
            updatedPermissions[module].read = true
        }
        // Logic: If Read is false, Write/Delete must be false
        if (action === "read" && value === false) {
            updatedPermissions[module].write = false
            updatedPermissions[module].delete = false
        }

        setActiveRole({
            ...activeRole,
            permissions: updatedPermissions
        })
    }

    const handleSave = async () => {
        if (!activeRole) return
        setSaving(true)
        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'}/roles/${activeRole.role_id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    label: activeRole.label,
                    description: activeRole.description,
                    permissions: activeRole.permissions
                })
            })

            if (!res.ok) throw new Error("Failed to update role")

            toast.success("Permisos actualizados", {
                description: `Se han guardado los cambios para el rol ${activeRole.label}.`
            })

            // Refresh list to sync state
            const updatedRole = await res.json()
            setRoles(roles.map(r => r.role_id === updatedRole.role_id ? updatedRole : r))

        } catch (error) {
            toast.error("Error al guardar", {
                description: "No se pudieron guardar los cambios.",
            })
        } finally {
            setSaving(false)
        }
    }

    if (loading) {
        return (
            <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex justify-between items-center shrink-0">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Shield className="h-6 w-6 text-primary" />
                        Matriz de Permisos
                    </h1>
                    <p className="text-muted-foreground">Configura qué puede ver y editar cada rol en el sistema.</p>
                </div>
                <div className="flex gap-2">
                    {/* Future: Add New Role Button */}
                </div>
            </div>

            <div className="flex flex-1 gap-6 overflow-hidden">
                {/* Roles List Sidebar */}
                <Card className="w-1/4 h-full flex flex-col">
                    <CardHeader className="pb-3 border-b">
                        <CardTitle className="text-sm font-medium uppercase tracking-wider text-muted-foreground">Roles Definidos</CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 overflow-y-auto">
                        <div className="flex flex-col">
                            {roles.map((role) => (
                                <button
                                    key={role.role_id}
                                    onClick={() => setActiveRole(role)}
                                    className={`flex flex-col items-start p-4 border-b text-left hover:bg-muted/50 transition-colors ${activeRole?.role_id === role.role_id ? 'bg-primary/5 border-l-4 border-l-primary' : 'border-l-4 border-l-transparent'}`}
                                >
                                    <span className="font-semibold text-sm">{role.label}</span>
                                    <span className="text-xs text-muted-foreground mt-1 line-clamp-2">{role.description}</span>
                                    {role.is_system && <Badge variant="secondary" className="mt-2 text-[10px] h-5">Sistema</Badge>}
                                </button>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                {/* Permissions Matrix */}
                <Card className="flex-1 h-full flex flex-col shadow-md border-primary/20">
                    <CardHeader className="pb-4 border-b bg-card rounded-t-xl">
                        <div className="flex justify-between items-center">
                            <div>
                                <CardTitle>{activeRole?.label}</CardTitle>
                                <CardDescription>{activeRole?.description}</CardDescription>
                            </div>
                            <Button onClick={handleSave} disabled={saving || !activeRole}>
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Guardar Cambios
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 overflow-auto">
                        <Table>
                            <TableHeader className="bg-muted/50 sticky top-0 z-10">
                                <TableRow>
                                    <TableHead className="w-[250px]">Módulo</TableHead>
                                    <TableHead className="text-center w-[120px]">Ver (Solo Lectura)</TableHead>
                                    <TableHead className="text-center w-[120px]">Crear / Editar</TableHead>
                                    <TableHead className="text-center w-[120px]">Eliminar</TableHead>
                                    <TableHead>Detalle de Acceso</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {MODULES.map((module) => {
                                    const perms = activeRole?.permissions?.[module.id] || { read: false, write: false, delete: false }
                                    return (
                                        <TableRow key={module.id} className="hover:bg-muted/20">
                                            <TableCell className="font-medium">
                                                <div className="flex items-center gap-2">
                                                    {/* Icons mapping could go here */}
                                                    {module.label}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex justify-center">
                                                    <Switch
                                                        checked={perms.read}
                                                        onCheckedChange={(c) => handlePermissionChange(module.id, "read", c)}
                                                    />
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex justify-center">
                                                    <Switch
                                                        checked={perms.write}
                                                        disabled={!perms.read}
                                                        onCheckedChange={(c) => handlePermissionChange(module.id, "write", c)}
                                                        className="data-[state=checked]:bg-blue-600"
                                                    />
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex justify-center">
                                                    <Switch
                                                        checked={perms.delete}
                                                        disabled={!perms.write}
                                                        onCheckedChange={(c) => handlePermissionChange(module.id, "delete", c)}
                                                        className="data-[state=checked]:bg-red-500"
                                                    />
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs text-muted-foreground">
                                                {perms.delete ? (
                                                    <span className="text-red-500 font-medium flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> Control Total</span>
                                                ) : perms.write ? (
                                                    <span className="text-blue-500 font-medium">Lectura y Edición</span>
                                                ) : perms.read ? (
                                                    <span className="text-green-600">Solo Lectura</span>
                                                ) : (
                                                    <span className="text-slate-400">Sin Acceso</span>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
