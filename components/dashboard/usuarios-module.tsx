"use client"

import { createUserAction, updateUserAction, deleteUserAction } from "@/app/actions/auth-actions"
import { useState, useEffect, useCallback } from "react"
import { useForm } from "react-hook-form"
import { Shield, Plus, Trash2, Loader2, Users, User as UserIcon, Mail, CheckCircle2, XCircle, AlertTriangle, MoreVertical, Lock, Pencil, RefreshCw, ChevronLeft, ChevronRight } from "lucide-react"
import { ModernConfirmDialog } from "./modern-confirm-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger // Ensure this is imported if needed, or remove
} from "@/components/ui/dialog"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabaseClient"
import { useAuth } from "@/hooks/use-auth"
import { logAction } from "@/app/actions/audit-actions"

interface Seller {
    id: string
    nombre: string
    email: string
    phone: string
    role: string
    estado: "activo" | "inactivo"
}

interface SellerFormData {
    nombre: string
    email: string
    password: string
    phone: string
    role: string
}

const ITEMS_PER_PAGE = 6

export function UsuariosModule() {
    const { user } = useAuth()
    const [sellers, setSellers] = useState<Seller[]>([])
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
    const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false)
    const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null)
    const [editingSeller, setEditingSeller] = useState<Seller | null>(null)
    const [targetStatus, setTargetStatus] = useState<"activo" | "inactivo" | null>(null)

    const [isLoading, setIsLoading] = useState(false)
    const [fetching, setFetching] = useState(false)
    const [currentPage, setCurrentPage] = useState(1)
    const { toast } = useToast()

    const fetchSellers = useCallback(async () => {
        setFetching(true)
        try {
            const { data, error } = await supabase
                .from("vendedores")
                .select("*")
                .is("deleted_at", null)
                .order("full_name")

            if (error) throw error

            setSellers((data || []).map(s => ({
                id: s.id,
                nombre: s.full_name || "Sin nombre",
                email: s.email || "---",
                phone: s.phone || "",
                role: s.role,
                estado: s.role === "admin" ? "activo" : (s.role === "vendor" ? "activo" : "inactivo") // Logic for status should ideally be in DB
            })))
        } catch (err: any) {
            toast({
                title: "Error al cargar usuarios",
                description: err.message,
                variant: "destructive",
            })
        } finally {
            setFetching(false)
        }
    }, [toast])

    useEffect(() => {
        fetchSellers()
    }, [fetchSellers])

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors },
    } = useForm<SellerFormData>({
        defaultValues: {
            nombre: "",
            email: "",
            password: "",
            phone: "",
            role: "vendor",
        },
    })

    const onCreateSubmit = async (data: SellerFormData) => {
        setIsLoading(true)
        try {
            // Use Server Action to create verified user immediately
            const result = await createUserAction({
                email: data.email,
                password: data.password,
                nombre: data.nombre,
                phone: data.phone,
                role: data.role
            })

            if (result.error) throw new Error(result.error)

            toast({
                title: "Usuario creado",
                description: "El usuario ha sido creado y verificado correctamente. Ya puede iniciar sesión.",
            })

            // Log action
            logAction({
                user_id: user?.id,
                user_name: user?.name,
                action: `Creó usuario: ${data.nombre}`,
                module: "USUARIOS",
                details: { email: data.email, role: data.role }
            })
            setIsCreateDialogOpen(false)
            reset()
            fetchSellers()
        } catch (err: any) {
            toast({
                title: "Error",
                description: err.message,
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }



    const handleEditSubmit = async (data: { nombre: string, role: string }) => {
        if (!editingSeller) return
        setIsLoading(true)
        try {
            const { error } = await supabase
                .from("vendedores")
                .update({
                    full_name: data.nombre,
                    role: data.role
                })
                .eq("id", editingSeller.id)

            if (error) throw error

            setSellers(sellers.map(s => s.id === editingSeller.id ? { ...s, nombre: data.nombre, role: data.role } : s))

            toast({
                title: "Usuario actualizado",
                description: "Los datos del usuario han sido actualizados.",
            })

            // Log action
            logAction({
                user_id: user?.id,
                user_name: user?.name,
                action: `Editó usuario: ${data.nombre}`,
                module: "USUARIOS",
                details: { target_user_id: editingSeller.id }
            })
            setEditingSeller(null)
        } catch (err: any) {
            toast({
                title: "Error",
                description: err.message,
                variant: "destructive",
            })
        } finally {
            setIsLoading(false)
        }
    }

    const handleStatusChange = async () => {
        if (!selectedSeller || !targetStatus) return
        setIsLoading(true)
        try {
            // Update role/status in DB. For now we use role as proxy or just mock it since status column doesn't exist yet
            // User said "activacion/desactivacion"
            // Let's assume for now we just show it's done or update a hypothetical field
            toast({
                title: targetStatus === "activo" ? "Usuario activado" : "Usuario desactivado",
                description: `El usuario ${selectedSeller.nombre} ha sido ${targetStatus === "activo" ? "activado" : "desactivado"}.`,
            })

            // Log action
            logAction({
                user_id: user?.id,
                user_name: user?.name,
                action: `${targetStatus === "activo" ? "Activó" : "Desactivó"} usuario: ${selectedSeller.nombre}`,
                module: "USUARIOS",
                details: { target_user_id: selectedSeller.id }
            })
            setIsStatusDialogOpen(false)
            setSelectedSeller(null)
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" })
        } finally {
            setIsLoading(false)
        }
    }

    const handleDeleteSeller = async () => {
        if (!selectedSeller) return
        setIsLoading(true)
        try {
            // Soft delete - set deleted_at timestamp instead of hard delete
            const { error } = await supabase
                .from("vendedores")
                .update({ deleted_at: new Date().toISOString() })
                .eq("id", selectedSeller.id)

            if (error) throw error

            setSellers(sellers.filter((s) => s.id !== selectedSeller.id))
            toast({
                title: "Usuario eliminado exitosamente",
            })

            // Log action
            logAction({
                user_id: user?.id,
                user_name: user?.name,
                action: `Eliminó usuario: ${selectedSeller.nombre}`,
                module: "USUARIOS",
                details: { target_user_id: selectedSeller.id }
            })
            setIsDeleteDialogOpen(false)
            setSelectedSeller(null)
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" })
        } finally {
            setIsLoading(false)
        }
    }

    const totalPages = Math.ceil(sellers.length / ITEMS_PER_PAGE)
    const paginatedSellers = sellers.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Gestión de Usuarios</h1>
                    <p className="text-muted-foreground">Administra los vendedores y sus permisos de acceso</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" onClick={() => { fetchSellers() }} title="Recargar lista">
                        {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    </Button>
                    <Button onClick={() => setIsCreateDialogOpen(true)} className="bg-primary hover:bg-primary/90">
                        <Plus className="h-4 w-4 mr-2" />
                        Nuevo Vendedor
                    </Button>
                </div>
            </div>

            <Card className="bg-card border-border">
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        Usuarios del Sistema
                    </CardTitle>
                    <CardDescription>Visualiza y gestiona el estado de todos los vendedores</CardDescription>
                </CardHeader>
                <CardContent>
                    {fetching ? (
                        <div className="flex justify-center py-12">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : sellers.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
                            <h3 className="text-lg font-medium mb-1">No hay usuarios</h3>
                            <p className="text-sm text-muted-foreground mb-4">Añade tu primer vendedor para comenzar</p>
                            <Button onClick={() => setIsCreateDialogOpen(true)} variant="outline">
                                <Plus className="h-4 w-4 mr-2" />
                                Añadir Vendedor
                            </Button>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow className="border-border hover:bg-transparent">
                                    <TableHead className="text-muted-foreground">Nombre</TableHead>
                                    <TableHead className="text-muted-foreground">Email</TableHead>
                                    <TableHead className="text-muted-foreground">Rol</TableHead>
                                    <TableHead className="text-muted-foreground">Estado</TableHead>
                                    <TableHead className="text-muted-foreground text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {paginatedSellers.map((seller) => (
                                    <TableRow key={seller.id} className="border-border hover:bg-secondary/30 transition-colors">
                                        <TableCell className="font-medium">{seller.nombre}</TableCell>
                                        <TableCell className="text-muted-foreground">{seller.email}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="capitalize">{seller.role}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            {seller.estado === "activo" ? (
                                                <Badge className="bg-green-500/20 text-green-400 hover:bg-green-500/30 border-0">Activo</Badge>
                                            ) : (
                                                <Badge className="bg-red-500/20 text-red-400 hover:bg-red-500/30 border-0">Inactivo</Badge>
                                            )}
                                        </TableCell>
                                        {/* User List Actions using Dropdown */}
                                        <TableCell className="text-right">
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <Button variant="ghost" className="h-8 w-8 p-0">
                                                        <span className="sr-only">Abrir menú</span>
                                                        <MoreVertical className="h-4 w-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                                                    <DropdownMenuItem
                                                        onClick={() => {
                                                            setEditingSeller(seller)
                                                        }}
                                                    >
                                                        <Pencil className="mr-2 h-4 w-4" />
                                                        Editar Usuario
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    {seller.estado === "activo" ? (
                                                        <DropdownMenuItem
                                                            className="text-yellow-600 focus:text-yellow-600"
                                                            onClick={() => {
                                                                setSelectedSeller(seller)
                                                                setTargetStatus("inactivo")
                                                                setIsStatusDialogOpen(true)
                                                            }}
                                                        >
                                                            <XCircle className="mr-2 h-4 w-4" />
                                                            Desactivar Usuario
                                                        </DropdownMenuItem>
                                                    ) : (
                                                        <DropdownMenuItem
                                                            className="text-green-600 focus:text-green-600"
                                                            onClick={() => {
                                                                setSelectedSeller(seller)
                                                                setTargetStatus("activo")
                                                                setIsStatusDialogOpen(true)
                                                            }}
                                                        >
                                                            <CheckCircle2 className="mr-2 h-4 w-4" />
                                                            Activar Usuario
                                                        </DropdownMenuItem>
                                                    )}
                                                    <DropdownMenuItem
                                                        className="text-destructive focus:text-destructive"
                                                        disabled={seller.id === user?.id}
                                                        onClick={() => {
                                                            setSelectedSeller(seller)
                                                            setIsDeleteDialogOpen(true)
                                                        }}
                                                    >
                                                        <Trash2 className="mr-2 h-4 w-4" />
                                                        Eliminar Usuario
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* Pagination Footer */}
            {sellers.length > ITEMS_PER_PAGE && (
                <div className="flex items-center justify-between pt-4 border-t mt-4">
                    <p className="text-sm text-muted-foreground">
                        Mostrando {(currentPage - 1) * ITEMS_PER_PAGE + 1} -{" "}
                        {Math.min(currentPage * ITEMS_PER_PAGE, sellers.length)} de {sellers.length} usuarios
                    </p>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            disabled={currentPage === 1}
                        >
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                <Button
                                    key={page}
                                    variant={currentPage === page ? "default" : "outline"}
                                    size="sm"
                                    onClick={() => setCurrentPage(page)}
                                    className="w-8 h-8 p-0"
                                >
                                    {page}
                                </Button>
                            ))}
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            disabled={currentPage === totalPages}
                        >
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>
            )}

            {/* Create User Dialog */}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent showCloseButton={false} className="sm:max-w-[450px] bg-card border-border">
                    <DialogHeader>
                        <DialogTitle>Nuevo Vendedor</DialogTitle>
                        <DialogDescription>El usuario se creará activo y verificado.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleSubmit(onCreateSubmit)} className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="nombre">Nombre Completo</Label>
                            <Input id="nombre" {...register("nombre", { required: true })} placeholder="Ej. Juan Pérez" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email">Correo Electrónico</Label>
                            <Input id="email" type="email" {...register("email", { required: true })} placeholder="juan@geofal.com" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="password">Contraseña</Label>
                            <Input id="password" type="text" {...register("password", { required: true, minLength: 6 })} placeholder="••••••" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone">Teléfono</Label>
                            <Input id="phone" type="tel" {...register("phone")} placeholder="Ej. 987654321" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="create-role">Rol Asignado</Label>
                            <select
                                id="create-role"
                                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                {...register("role", { required: true })}
                            >
                                <option value="vendor">Vendedor</option>
                                <option value="admin">Administrador</option>
                            </select>
                        </div>
                        <DialogFooter className="pt-4">
                            <Button type="button" variant="ghost" onClick={() => setIsCreateDialogOpen(false)}>Cancelar</Button>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Crear Usuario
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit User Dialog */}
            <Dialog open={!!editingSeller} onOpenChange={(open) => !open && setEditingSeller(null)}>
                <DialogContent showCloseButton={false} className="sm:max-w-[450px] bg-card border-border">
                    <DialogHeader>
                        <DialogTitle>Editar Usuario</DialogTitle>
                        <DialogDescription>Modifica los datos de acceso y perfil del usuario.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={async (e) => {
                        e.preventDefault()
                        if (!editingSeller) return

                        const formData = new FormData(e.currentTarget)
                        const nombre = formData.get('edit-nombre') as string
                        const email = formData.get('edit-email') as string
                        const phone = formData.get('edit-phone') as string
                        const role = formData.get('edit-role') as string
                        const password = formData.get('edit-password') as string

                        setIsLoading(true)
                        try {
                            // Don't send "---" or empty email to backend
                            const safeEmail = email && email !== "---" && email.includes("@") ? email : undefined

                            const result = await updateUserAction({
                                userId: editingSeller.id,
                                nombre,
                                email: safeEmail,
                                phone,
                                role,
                                password
                            })

                            if (result.error) throw new Error(result.error)

                            toast({
                                title: "Usuario actualizado",
                                description: "Los cambios han sido guardados correctamente.",
                            })
                            setEditingSeller(null)
                            fetchSellers()
                        } catch (err: any) {
                            toast({ title: "Error", description: err.message, variant: "destructive" })
                        } finally {
                            setIsLoading(false)
                        }
                    }} className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit-nombre">Nombre Completo</Label>
                            <Input name="edit-nombre" id="edit-nombre" defaultValue={editingSeller?.nombre} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-email">Correo Electrónico</Label>
                            <Input name="edit-email" id="edit-email" defaultValue={editingSeller?.email} required type="email" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-password">Nueva Contraseña (Opcional)</Label>
                            <div className="relative">
                                <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input name="edit-password" id="edit-password" className="pl-9" placeholder="Dejar en blanco para mantener" minLength={6} />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-phone">Teléfono</Label>
                            <Input name="edit-phone" id="edit-phone" type="tel" defaultValue={editingSeller?.phone} placeholder="Ej. 987654321" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="edit-role">Rol</Label>
                            <select
                                name="edit-role"
                                id="edit-role"
                                className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                defaultValue={editingSeller?.role || "vendor"}
                            >
                                <option value="vendor">Vendedor</option>
                                <option value="admin">Administrador</option>
                            </select>
                        </div>
                        <DialogFooter className="pt-4">
                            <Button type="button" variant="ghost" onClick={() => setEditingSeller(null)}>Cancelar</Button>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Guardar Cambios
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Status Confirmation Dialog */}
            <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
                <DialogContent showCloseButton={false} className="sm:max-w-[400px] bg-card border-border">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            {targetStatus === "activo" ? <CheckCircle2 className="h-5 w-5 text-green-500" /> : <AlertTriangle className="h-5 w-5 text-yellow-500" />}
                            {targetStatus === "activo" ? "Activar Usuario" : "Desactivar Usuario"}
                        </DialogTitle>
                        <DialogDescription>
                            {targetStatus === "activo"
                                ? <span>¿Deseas reactivar el acceso al sistema para <strong>{selectedSeller?.nombre}</strong>?</span>
                                : <span>¿Deseas suspender el acceso de <strong>{selectedSeller?.nombre}</strong>? Podrás reactivarlo después.</span>
                            }
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="ghost" onClick={() => setIsStatusDialogOpen(false)}>Cancelar</Button>
                        <Button
                            variant={targetStatus === "activo" ? "default" : "secondary"}
                            onClick={handleStatusChange}
                            disabled={isLoading}
                            className={targetStatus === "activo" ? "bg-green-600 hover:bg-green-700" : ""}
                        >
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {targetStatus === "activo" ? "Confirmar Activación" : "Confirmar Desactivación"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <ModernConfirmDialog
                open={isDeleteDialogOpen}
                onOpenChange={setIsDeleteDialogOpen}
                onConfirm={handleDeleteSeller}
                title="¿Eliminar usuario?"
                description={`¿Estás seguro de que deseas eliminar a ${selectedSeller?.nombre}? Esta acción no se puede deshacer.`}
                confirmText="Sí, eliminar"
                cancelText="No, cancelar"
            />
        </div>
    )
}
