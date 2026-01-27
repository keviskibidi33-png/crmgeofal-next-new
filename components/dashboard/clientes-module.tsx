"use client"

import { useState, useMemo, useEffect, useCallback } from "react"
import {
  Plus,
  Users,
  Mail,
  Phone,
  Building,
  Search,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  Filter,
  MoreVertical,
  Eye,
  Pencil,
  Trash2,
  FolderKanban,
  FileText,
  Calendar,
  Clock,
  AlertTriangle,
  RefreshCw,
  Loader2,
  MapPin,
  Copy,
  Check,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { ModernConfirmDialog } from "./modern-confirm-dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { CreateClientDialog } from "./create-client-dialog"
import { type User } from "@/hooks/use-auth"
import { supabase } from "@/lib/supabaseClient"
import { useToast } from "@/hooks/use-toast"
import { logAction } from "@/app/actions/audit-actions"
import { ContactAgendaDialog } from "./contact-agenda-dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { deleteClientAction } from "@/app/actions/delete-actions"

interface Client {
  id: string
  nombre: string
  email: string
  telefono: string
  direccion?: string
  empresa: string
  estado: "activo" | "inactivo" | "prospecto"
  sector: string
  ruc?: string
  tipoDocumento?: string
  fechaRegistro: string
  cotizaciones: number
  proyectos: number
  proyectosGanados: number
  valorTotal: number
  tasaConversion: number
  cargo?: string
}

type DbClientRow = {
  id: string
  nombre: string
  email: string
  telefono: string
  direccion: string | null
  empresa: string
  ruc: string | null
  tipo_documento: string | null
  estado: string
  sector: string | null
  fecha_registro: string | null
  cotizaciones: number | null
  proyectos: number | null
  proyectos_ganados: number | null
  valor_total: number | null
  tasa_conversion: number | null
}

const mapDbClientToUi = (row: any): Client => ({
  id: row.id,
  nombre: row.nombre,
  email: row.email,
  telefono: row.telefono,
  empresa: row.empresa,
  ruc: row.ruc ?? "",
  tipoDocumento: row.tipo_documento ?? "",
  direccion: row.direccion ?? "",
  estado: (row.estado as Client["estado"]) || "prospecto",
  sector: row.sector ?? "General",
  fechaRegistro: row.fecha_registro ?? new Date().toISOString(),
  cotizaciones: row.cotizaciones ?? 0,
  proyectos: row.proyectos ?? 0,
  proyectosGanados: row.proyectos_ganados ?? 0,
  valorTotal: row.valor_total ?? 0,
  tasaConversion: row.tasa_conversion ?? 0,
  cargo: row.contactos?.[0]?.cargo ?? "",
})

const mapClientToDbPayload = (client: Partial<Client>) => {
  const mapping: Record<keyof Client, string> = {
    id: "id",
    nombre: "nombre",
    email: "email",
    telefono: "telefono",
    empresa: "empresa",
    estado: "estado",
    sector: "sector",
    direccion: "direccion",
    fechaRegistro: "fecha_registro",
    cotizaciones: "cotizaciones",
    proyectos: "proyectos",
    proyectosGanados: "proyectos_ganados",
    valorTotal: "valor_total",
    tasaConversion: "tasa_conversion",
    ruc: "ruc",
    tipoDocumento: "tipo_documento",
    cargo: "cargo", // Note: handled separately in handleEditSave, but needed for type Record<keyof Client, string>
  }

  return Object.entries(mapping).reduce<Record<string, unknown>>((acc, [key, dbKey]) => {
    const value = client[key as keyof Client]
    if (value !== undefined && key !== "id" && key !== "cargo") {
      acc[dbKey] = value
    }
    return acc
  }, {})
}

interface ClientesModuleProps {
  user: User
}

// Default items per page if not in localStorage
const DEFAULT_ITEMS_PER_PAGE = 20

const SECTORES = [
  "Minería",
  "Construcción",
  "Industria",
  "Energía",
  "Gobierno",
  "Agroindustria",
  "Transporte",
  "Comercio",
  "Servicios",
  "Otro"
]

export function ClientesModule({ user }: ClientesModuleProps) {
  const [clients, setClients] = useState<Client[]>([])
  const [itemsPerPage, setItemsPerPage] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return Number(localStorage.getItem("clientesItemsPerPage")) || DEFAULT_ITEMS_PER_PAGE
    }
    return DEFAULT_ITEMS_PER_PAGE
  })

  useEffect(() => {
    localStorage.setItem("clientesItemsPerPage", itemsPerPage.toString())
  }, [itemsPerPage])

  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('clientesViewMode') as "grid" | "list") || "grid"
    }
    return "grid"
  })

  useEffect(() => {
    localStorage.setItem('clientesViewMode', viewMode)
  }, [viewMode])
  const [estadoFilter, setEstadoFilter] = useState<string>("todos")
  const [sectorFilter, setSectorFilter] = useState<string>("todos")
  const [antiguedadFilter, setAntiguedadFilter] = useState<string>("todos")
  const [currentPage, setCurrentPage] = useState(1)

  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isAgendaOpen, setIsAgendaOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(1)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [editForm, setEditForm] = useState<Partial<Client>>({})
  const { toast } = useToast()

  const fetchClients = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const { data, error } = await supabase
        .from("clientes")
        .select(`
          *,
          contactos (cargo)
        `)
        .eq("contactos.es_principal", true)
        .is("deleted_at", null)
        .order("fecha_registro", { ascending: false })

      if (error) throw error
      setClients((data as any[] | null)?.map(mapDbClientToUi) ?? [])
    } catch (error) {
      const message = error instanceof Error ? error.message : "No fue posible cargar los clientes"
      setFetchError(message)
      toast({ title: "Error al cargar clientes", description: message, variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    void fetchClients()
  }, [fetchClients])

  const sectores = useMemo(() => [...new Set(clients.map((c) => c.sector))], [clients])

  const getClientAge = (fechaRegistro: string) => {
    const registro = new Date(fechaRegistro)
    const now = new Date()
    const months = (now.getFullYear() - registro.getFullYear()) * 12 + (now.getMonth() - registro.getMonth())
    return months
  }

  const getAntiguedadLabel = (months: number) => {
    if (months < 3) return "Nuevo"
    if (months < 12) return "Reciente"
    if (months < 24) return "Establecido"
    return "Antiguo"
  }

  const filteredClients = useMemo(() => {
    return clients.filter((client) => {
      const matchesSearch =
        client.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.empresa.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (client.email && client.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (client.ruc && client.ruc.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchesEstado = estadoFilter === "todos" || client.estado === estadoFilter
      const matchesSector = sectorFilter === "todos" || client.sector === sectorFilter

      const clientAge = getClientAge(client.fechaRegistro)
      let matchesAntiguedad = true
      if (antiguedadFilter === "nuevo") matchesAntiguedad = clientAge < 3
      else if (antiguedadFilter === "reciente") matchesAntiguedad = clientAge >= 3 && clientAge < 12
      else if (antiguedadFilter === "establecido") matchesAntiguedad = clientAge >= 12 && clientAge < 24
      else if (antiguedadFilter === "antiguo") matchesAntiguedad = clientAge >= 24

      return matchesSearch && matchesEstado && matchesSector && matchesAntiguedad
    })
  }, [clients, searchQuery, estadoFilter, sectorFilter, antiguedadFilter])

  const totalPages = Math.ceil(filteredClients.length / itemsPerPage)
  const paginatedClients = filteredClients.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const getEstadoBadgeClass = (estado: string) => {
    switch (estado) {
      case "activo":
        return "bg-green-500/20 text-green-400"
      case "inactivo":
        return "bg-red-500/20 text-red-400"
      case "prospecto":
        return "bg-yellow-500/20 text-yellow-400"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount)
  }

  const formatDate = (date: string | null | undefined) => {
    if (!date || date === "" || isNaN(new Date(date).getTime())) return "Por definir"
    return new Date(date).toLocaleDateString("es-PE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: "Copiado",
      description: "Correo copiado al portapapeles",
    })
  }

  const openViewDialog = (client: Client) => {
    setSelectedClient(client)
    setIsViewDialogOpen(true)
  }

  const openEditDialog = (client: Client) => {
    setSelectedClient(client)
    setEditForm({ ...client })
    setIsEditDialogOpen(true)
  }

  const handleEditSave = async () => {
    if (!selectedClient) return
    try {
      const payload = mapClientToDbPayload(editForm)
      if (Object.keys(payload).length === 0) {
        setIsEditDialogOpen(false)
        return
      }
      const { error: clientError } = await supabase.from("clientes").update(payload).eq("id", selectedClient.id)
      if (clientError) throw clientError

      // Update contact info if changed
      const contactPayload: any = {
        nombre: editForm.nombre,
        email: editForm.email,
        telefono: editForm.telefono,
        cargo: editForm.cargo,
      }

      const { error: contactError } = await supabase
        .from("contactos")
        .update(contactPayload)
        .eq("cliente_id", selectedClient.id)
        .eq("es_principal", true)

      if (contactError) throw contactError

      // Optimistic update
      setClients((prev) =>
        prev.map((c) =>
          c.id === selectedClient.id
            ? {
              ...c,
              empresa: editForm.empresa || c.empresa,
              nombre: editForm.nombre || c.nombre,
              email: editForm.email || c.email,
              telefono: editForm.telefono || c.telefono,
              direccion: editForm.direccion || c.direccion,
              estado: editForm.estado || c.estado,
              ruc: editForm.ruc || c.ruc,
              cargo: editForm.cargo || c.cargo
            }
            : c
        )
      )

      toast({ title: "Cliente actualizado" })

      // Log action
      logAction({
        user_id: user.id,
        user_name: user.name,
        action: `Editó perfil completo: ${editForm.empresa}`,
        module: "CLIENTES",
        details: { client_id: selectedClient.id }
      })

      setIsEditDialogOpen(false)
      setSelectedClient(null)
      setEditForm({})
      void fetchClients()
    } catch (error) {
      toast({
        title: "No se pudo actualizar",
        description: error instanceof Error ? error.message : "Revisa la información e intenta de nuevo",
        variant: "destructive",
      })
    }
  }

  const openDeleteDialog = (client: Client) => {
    setSelectedClient(client)
    setDeleteConfirmStep(1)
    setDeleteConfirmText("")
    setIsDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (deleteConfirmStep === 1) {
      setDeleteConfirmStep(2)
      return
    }
    
    if (deleteConfirmStep === 2 && deleteConfirmText === selectedClient?.empresa && selectedClient) {
      try {
        // Use server action for secure deletion
        const result = await deleteClientAction(selectedClient.id)

        if (result.error) {
          throw new Error(result.error)
        }

        setClients(prev => prev.filter(c => c.id !== selectedClient.id))

        toast({
          title: "Cliente eliminado exitosamente",
        })

        // Log action
        logAction({
          user_id: user.id,
          user_name: user.name,
          action: `Eliminó cliente: ${selectedClient.empresa}`,
          module: "CLIENTES",
          details: { client_id: selectedClient.id }
        })

        setIsDeleteDialogOpen(false)
        setSelectedClient(null)
        setDeleteConfirmStep(1)
        setDeleteConfirmText("")
      } catch (error) {
        toast({
          title: "No se pudo eliminar",
          description: error instanceof Error ? error.message : "Intenta nuevamente",
          variant: "destructive",
        })
      }
    }
  }

  const changeClientStatus = async (clientId: string, newStatus: Client["estado"]) => {
    try {
      const { error } = await supabase
        .from("clientes")
        .update({ estado: newStatus })
        .eq("id", clientId)
      if (error) throw error
      setClients((prev) => prev.map((c) => (c.id === clientId ? { ...c, estado: newStatus } : c)))
      setSelectedClient((prev) => (prev && prev.id === clientId ? { ...prev, estado: newStatus } : prev))
      toast({ title: "Estado actualizado" })

      // Log action
      logAction({
        user_id: user.id,
        user_name: user.name,
        action: `Cambió estado cliente: ${newStatus}`,
        module: "CLIENTES",
        details: { client_id: clientId }
      })
    } catch (error) {

      toast({
        title: "Error al actualizar estado",
        description: error instanceof Error ? error.message : "No fue posible guardar los cambios",
        variant: "destructive",
      })
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Cargando clientes...
      </div>
    )
  }

  if (fetchError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <p className="text-lg font-medium">No pudimos cargar los clientes</p>
        <p className="text-sm text-muted-foreground">{fetchError}</p>
        <Button onClick={() => void fetchClients()} className="mt-2">
          Reintentar
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="text-muted-foreground">Gestiona tu cartera de clientes</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => { fetchClients() }} title="Recargar lista">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Button onClick={() => setIsDialogOpen(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Cliente
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar clientes..."
              className="pl-10 w-64"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
            />
          </div>
          <Select
            value={estadoFilter}
            onValueChange={(v) => {
              setEstadoFilter(v)
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los estados</SelectItem>
              <SelectItem value="activo">Activo</SelectItem>
              <SelectItem value="inactivo">Inactivo</SelectItem>
              <SelectItem value="prospecto">Prospecto</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={sectorFilter}
            onValueChange={(v) => {
              setSectorFilter(v)
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Sector" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos los sectores</SelectItem>
              {sectores.map((sector) => (
                <SelectItem key={sector} value={sector}>
                  {sector}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={antiguedadFilter}
            onValueChange={(v) => {
              setAntiguedadFilter(v)
              setCurrentPage(1)
            }}
          >
            <SelectTrigger className="w-40">
              <Clock className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Antigüedad" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todas las antigüedades</SelectItem>
              <SelectItem value="nuevo">Nuevo (3 meses)</SelectItem>
              <SelectItem value="reciente">Reciente (3-12 meses)</SelectItem>
              <SelectItem value="establecido">Establecido (1-2 años)</SelectItem>
              <SelectItem value="antiguo">Antiguo (+2 años)</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {/* View Toggle and Items Per Page */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground whitespace-nowrap hidden sm:inline">Mostrar:</span>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(v) => {
                setItemsPerPage(Number(v))
                setCurrentPage(1)
              }}
            >
              <SelectTrigger className="w-[70px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="50">50</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1 bg-secondary/50 rounded-lg p-1">
            <Button variant={viewMode === "grid" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("grid")} className="h-8 w-8 p-0">
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button variant={viewMode === "list" ? "secondary" : "ghost"} size="sm" onClick={() => setViewMode("list")} className="h-8 w-8 p-0">
              <List className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Clients Display */}
      {paginatedClients.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Users className="h-16 w-16 text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-1">No hay clientes</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {searchQuery || estadoFilter !== "todos" || sectorFilter !== "todos" || antiguedadFilter !== "todos"
                ? "No se encontraron clientes con ese criterio"
                : "Añade tu primer cliente para comenzar"}
            </p>
            {!searchQuery && estadoFilter === "todos" && sectorFilter === "todos" && antiguedadFilter === "todos" && (
              <Button onClick={() => setIsDialogOpen(true)} variant="outline">
                <Plus className="h-4 w-4 mr-2" />
                Añadir Cliente
              </Button>
            )}
          </CardContent>
        </Card>
      ) : viewMode === "grid" ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedClients.map((client) => {
            const clientAge = getClientAge(client.fechaRegistro)
            return (
              <Card
                key={client.id}
                className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer group"
                onClick={() => openViewDialog(client)}
              >
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-semibold flex items-start gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5 border border-primary/20">
                      <span className="text-primary font-bold text-xs">
                        {(client.empresa || client.nombre)
                          .split(" ")
                          .filter(word => word.length > 0)
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 3)
                          .toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col items-start pt-0.5">
                      <p className="group-hover:text-primary transition-colors line-clamp-2 w-full leading-tight font-bold text-sm">
                        {client.empresa || client.nombre}
                      </p>
                      <p className="text-[10px] font-normal text-muted-foreground truncate w-full mt-1 uppercase tracking-wider">
                        {client.nombre}
                      </p>
                      {client.ruc && (
                        <p className="text-[10px] text-muted-foreground/70 font-mono mt-1 bg-secondary/30 px-1.5 py-0.5 rounded border border-border/50">
                          RUC: {client.ruc}
                        </p>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            openViewDialog(client)
                          }}
                        >
                          <Eye className="h-4 w-4 mr-2" />
                          Ver detalles
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            openEditDialog(client)
                          }}
                        >
                          <Pencil className="h-4 w-4 mr-2" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            changeClientStatus(client.id, "activo")
                          }}
                        >
                          Marcar Activo
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            changeClientStatus(client.id, "inactivo")
                          }}
                        >
                          Marcar Inactivo
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            changeClientStatus(client.id, "prospecto")
                          }}
                        >
                          Marcar Prospecto
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            openDeleteDialog(client)
                          }}
                          className="text-red-400 focus:text-red-400"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-xs px-2 py-1 rounded-full ${getEstadoBadgeClass(client.estado)}`}>
                      {client.estado}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      {getAntiguedadLabel(clientAge)}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span className="truncate">{client.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Building className="h-4 w-4" />
                    <span>{client.sector || "Sin sector"}</span>
                  </div>
                  {client.direccion && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" />
                      <span className="truncate">{client.direccion}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-4 pt-2 border-t border-border mt-2">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <FileText className="h-3.5 w-3.5" />
                      <span>{client.cotizaciones} cot.</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <FolderKanban className="h-3.5 w-3.5" />
                      <span>{client.proyectos} proy.</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-green-400">
                      <span>{client.proyectosGanados} ganados</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card className="bg-card border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Sector</TableHead>
                <TableHead>Cotizaciones</TableHead>
                <TableHead>Proyectos</TableHead>
                <TableHead>Valor Total</TableHead>
                <TableHead>Antigüedad</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedClients.map((client) => {
                const clientAge = getClientAge(client.fechaRegistro)
                return (
                  <TableRow
                    key={client.id}
                    className="cursor-pointer hover:bg-secondary/30"
                    onClick={() => openViewDialog(client)}
                  >
                    <TableCell className="font-medium max-w-[200px]">
                      <div className="flex flex-col">
                        <span className="truncate">{client.nombre}</span>
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[250px] py-4">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-bold line-clamp-2 leading-tight">{client.empresa}</span>
                        {client.ruc && <span className="text-[10px] text-muted-foreground font-mono">RUC: {client.ruc}</span>}
                      </div>
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">{client.sector}</TableCell>
                    <TableCell>{client.cotizaciones}</TableCell>
                    <TableCell>
                      {client.proyectos} <span className="text-green-400">({client.proyectosGanados})</span>
                    </TableCell>
                    <TableCell>{formatCurrency(client.valorTotal)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {getAntiguedadLabel(clientAge)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className={`text-xs px-2 py-1 rounded-full ${getEstadoBadgeClass(client.estado)}`}>
                        {client.estado}
                      </span>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              openViewDialog(client)
                            }}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            Ver detalles
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditDialog(client)
                            }}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              changeClientStatus(client.id, "activo")
                            }}
                          >
                            Marcar Activo
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              changeClientStatus(client.id, "inactivo")
                            }}
                          >
                            Marcar Inactivo
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              changeClientStatus(client.id, "prospecto")
                            }}
                          >
                            Marcar Prospecto
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation()
                              openDeleteDialog(client)
                            }}
                            className="text-red-400 focus:text-red-400"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Pagination Footer */}
      {filteredClients.length > itemsPerPage && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t mt-4">
          <p className="text-sm text-muted-foreground">
            Mostrando {(currentPage - 1) * itemsPerPage + 1} -{" "}
            {Math.min(currentPage * itemsPerPage, filteredClients.length)} de {filteredClients.length} clientes
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            {/* Logic for Ellipsis Pagination */}
            {(() => {
              const pages = []
              const showEllipsis = totalPages > 7

              if (!showEllipsis) {
                for (let i = 1; i <= totalPages; i++) pages.push(i)
              } else {
                if (currentPage <= 4) {
                  for (let i = 1; i <= 5; i++) pages.push(i)
                  pages.push("ellipsis-end")
                  pages.push(totalPages)
                } else if (currentPage >= totalPages - 3) {
                  pages.push(1)
                  pages.push("ellipsis-start")
                  for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i)
                } else {
                  pages.push(1)
                  pages.push("ellipsis-start")
                  for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i)
                  pages.push("ellipsis-end")
                  pages.push(totalPages)
                }
              }

              return pages.map((page, index) => {
                if (page === "ellipsis-start" || page === "ellipsis-end") {
                  return (
                    <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">
                      ...
                    </span>
                  )
                }
                return (
                  <Button
                    key={`page-${page}`}
                    variant={currentPage === page ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(page as number)}
                    className="h-8 w-8 p-0"
                  >
                    {page}
                  </Button>
                )
              })
            })()}

            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <CreateClientDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} onSuccess={fetchClients} userId={user.id} />

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent showCloseButton={true} className="sm:max-w-[600px] w-[95vw] max-h-[90vh] bg-card border-border p-0 overflow-hidden flex flex-col rounded-2xl">
          {selectedClient && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <DialogHeader className="sr-only">
                <DialogTitle>{selectedClient.empresa}</DialogTitle>
                <DialogDescription>Detalles del perfil corporativo de {selectedClient.empresa}</DialogDescription>
              </DialogHeader>
              {/* HEADER: Identidad Corporativa (B2B Focus) */}
              <div className="p-5 border-b border-border/50 bg-secondary/5 relative">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <Badge className={`${getEstadoBadgeClass(selectedClient.estado)} px-1.5 py-0 text-[8px] uppercase font-bold tracking-wider`}>
                        {selectedClient.estado}
                      </Badge>
                      <Badge variant="outline" className="text-[8px] uppercase font-bold tracking-wider px-1.5 py-0">
                        {getAntiguedadLabel(getClientAge(selectedClient.fechaRegistro))}
                      </Badge>
                    </div>
                    <h2 className="text-lg font-black leading-tight tracking-tight uppercase mb-0.5">
                      {selectedClient.empresa}
                    </h2>
                    <div className="flex items-center gap-1.5 text-muted-foreground/70">
                      <div className="h-4 w-4 rounded-full bg-primary/20 flex items-center justify-center text-[9px] font-bold text-primary border border-primary/10">
                        {selectedClient.nombre.charAt(0)}
                      </div>
                      <span className="text-[10px] font-semibold">Contacto Principal:</span>
                      <span className="text-[10px] font-bold text-foreground underline decoration-primary/20 underline-offset-2">
                        {selectedClient.nombre}
                      </span>
                    </div>
                  </div>
                  <div className="text-right flex flex-col items-end gap-0.5">
                    <p className="text-[8px] text-muted-foreground uppercase font-bold">Cliente desde</p>
                    <p className="text-xs font-bold">{formatDate(selectedClient.fechaRegistro)}</p>
                  </div>
                </div>
              </div>

              {/* BODY: Contact Grid & KPIs */}
              <ScrollArea className="flex-1 overflow-y-auto">
                <div className="p-5 space-y-5">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    <div className="space-y-3">
                      <div className="space-y-1">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                          <Mail className="h-2.5 w-2.5" /> Correo electrónico
                        </p>
                        <div className="flex items-center gap-1.5 group">
                          <p className="text-xs font-semibold truncate hover:text-primary transition-colors cursor-pointer"
                            onClick={() => copyToClipboard(selectedClient.email.split(' / ')[0])}>
                            {selectedClient.email.split(' / ')[0]}
                          </p>
                          <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => copyToClipboard(selectedClient.email.split(' / ')[0])}>
                            <Copy className="h-2.5 w-2.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                          <Phone className="h-2.5 w-2.5" /> Teléfono
                        </p>
                        <p className="text-xs font-bold">{selectedClient.telefono || "Sin registrar"}</p>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                          <MapPin className="h-2.5 w-2.5" /> Dirección Fiscal
                        </p>
                        <p className="text-xs font-semibold line-clamp-2 leading-snug">
                          {selectedClient.direccion || "Sin dirección"}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                          <Building className="h-2.5 w-2.5" /> Sector
                        </p>
                        <p className="text-xs font-bold uppercase tracking-tight text-primary/80">
                          {selectedClient.sector || "General"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-border/40">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border border-border/40 rounded-xl overflow-hidden shadow-sm bg-slate-50/20">
                      <div className="p-3 border-r border-b md:border-b-0 border-border/40 text-center">
                        <span className="text-[8px] font-bold uppercase text-muted-foreground block mb-0.5 tracking-tighter">Cotizaciones</span>
                        <p className="text-base font-black">{selectedClient.cotizaciones}</p>
                      </div>
                      <div className="p-3 border-b md:border-b-0 md:border-r border-border/40 text-center">
                        <span className="text-[8px] font-bold uppercase text-muted-foreground block mb-0.5 tracking-tighter">Proyectos</span>
                        <p className="text-base font-black">{selectedClient.proyectos}</p>
                      </div>
                      <div className="p-3 border-r border-border/40 text-center">
                        <span className="text-[8px] font-bold uppercase text-muted-foreground block mb-0.5 tracking-tighter">Ganados</span>
                        <p className="text-base font-black text-emerald-500">{selectedClient.proyectosGanados}</p>
                      </div>
                      <div className="p-3 text-center flex flex-col justify-center">
                        <span className="text-[8px] font-bold uppercase text-muted-foreground block mb-0.5 tracking-tighter">Valor Total</span>
                        <p className="text-xs font-black text-primary truncate px-1">{formatCurrency(selectedClient.valorTotal)}</p>
                      </div>
                    </div>

                    <div className="mt-3 px-1">
                      <div className="flex justify-between items-center text-[8px] font-bold uppercase tracking-widest text-muted-foreground mb-1 px-0.5">
                        <span>Conversión</span>
                        <span className="text-primary font-black">
                          {selectedClient.proyectos > 0 ? ((selectedClient.proyectosGanados / selectedClient.proyectos) * 100).toFixed(0) : 0}%
                        </span>
                      </div>
                      <Progress value={selectedClient.proyectos > 0 ? (selectedClient.proyectosGanados / selectedClient.proyectos) * 100 : 0}
                        className="h-1 bg-secondary/30" />
                    </div>
                  </div>
                </div>
              </ScrollArea>

              {/* DIALOG FOOTER */}
              <DialogFooter className="p-4 bg-secondary/10 border-t border-border/50 gap-2 shrink-0">
                <Button variant="ghost" className="h-9 text-xs" onClick={() => setIsViewDialogOpen(false)}>
                  Cerrar
                </Button>
                <div className="flex-1" />
                <Button
                  variant="outline"
                  className="h-9 text-xs"
                  onClick={() => {
                    setIsViewDialogOpen(false)
                    openEditDialog(selectedClient)
                  }}
                >
                  <Pencil className="h-3.5 w-3.5 mr-2" />
                  Editar Perfil
                </Button>
                <Button className="h-9 px-6 font-bold shadow-lg shadow-primary/20" onClick={() => setIsViewDialogOpen(false)}>
                  Aceptar
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent showCloseButton={true} className="sm:max-w-[620px] w-[95vw] bg-card border-border p-0 overflow-hidden shadow-2xl h-[85vh] flex flex-col rounded-3xl">
          <DialogHeader className="p-6 border-b border-border/50 bg-slate-50/10 shrink-0">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1">
                <DialogTitle className="text-lg font-bold tracking-tight text-slate-900 leading-tight">Editar Perfil de Cliente</DialogTitle>
                <DialogDescription className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                  Separa los datos fiscales de la empresa de la información del contacto principal.
                </DialogDescription>
              </div>
              <div className="flex flex-col gap-1 min-w-[130px]">
                <Label className="text-[8px] font-black uppercase tracking-[0.15em] text-slate-400">Estado</Label>
                <Select
                  value={editForm.estado}
                  onValueChange={(v) => {
                    const newStatus = v as Client["estado"]
                    setEditForm({ ...editForm, estado: newStatus })
                    if (selectedClient) {
                      changeClientStatus(selectedClient.id, newStatus)
                    }
                  }}
                >
                  <SelectTrigger className="h-9 text-[10px] font-bold bg-white shadow-sm border-primary/20 rounded-xl focus:ring-primary/10" id="client-status-trigger">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border/40">
                    <SelectItem value="activo" className="text-xs">Activo</SelectItem>
                    <SelectItem value="inactivo" className="text-xs">Inactivo</SelectItem>
                    <SelectItem value="prospecto" className="text-xs">Prospecto</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-8">
              {/* SECCIÓN A: Datos Fiscales (La Empresa) */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-1 w-1 rounded-full bg-primary" />
                  <h3 className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-500/80">Sección A: Datos Fiscales (Empresa)</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor="edit-empresa" className="text-[9px] font-black uppercase tracking-wider text-slate-400">Razón Social / Empresa</Label>
                    <Input
                      id="edit-empresa"
                      value={editForm.empresa || ""}
                      onChange={(e) => setEditForm({ ...editForm, empresa: e.target.value })}
                      className="h-10 font-bold text-xs text-slate-900 rounded-xl border-slate-200 focus:border-primary/40 bg-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-ruc" className="text-[9px] font-black uppercase tracking-wider text-slate-400">RUC / Documento</Label>
                    <Input
                      id="edit-ruc"
                      value={editForm.ruc || ""}
                      onChange={(e) => setEditForm({ ...editForm, ruc: e.target.value })}
                      className="h-10 text-xs font-mono text-slate-700 rounded-xl border-slate-200 bg-slate-50/30"
                      readOnly
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-sector" className="text-[9px] font-black uppercase tracking-wider text-slate-400">Sector Económico</Label>
                    <Select
                      value={editForm.sector || ""}
                      onValueChange={(v) => setEditForm({ ...editForm, sector: v })}
                    >
                      <SelectTrigger className="h-10 text-xs rounded-xl border-slate-200 bg-white shadow-none">
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl">
                        {SECTORES.map((sector) => (
                          <SelectItem key={sector} value={sector} className="text-xs">
                            {sector}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label htmlFor="edit-direccion" className="text-[9px] font-black uppercase tracking-wider text-slate-400">Dirección Fiscal</Label>
                    <Input
                      id="edit-direccion"
                      value={editForm.direccion || ""}
                      onChange={(e) => setEditForm({ ...editForm, direccion: e.target.value })}
                      placeholder="Calle, Número, Distrito"
                      className="h-10 text-xs rounded-xl border-slate-200 bg-white shadow-none"
                    />
                  </div>
                </div>
              </div>

              {/* SECCIÓN B: Contacto Principal (Agenda) */}
              <div className="p-6 rounded-[24px] bg-[#f8fbff] border border-blue-100/50 shadow-sm space-y-4 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-[0.02] group-hover:opacity-[0.04] transition-opacity">
                  <Users className="h-12 w-12 text-primary" />
                </div>

                <div className="flex items-center gap-2 mb-1">
                  <div className="h-1 w-1 rounded-full bg-blue-500" />
                  <h3 className="text-[9px] font-black uppercase tracking-[0.15em] text-blue-500/80">Sección B: Contacto Principal (Agenda)</h3>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="edit-nombre" className="text-[9px] font-black uppercase tracking-wider text-slate-400">Nombre Completo</Label>
                    <Input
                      id="edit-nombre"
                      value={editForm.nombre || ""}
                      onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                      placeholder="Ej: Juan Pérez"
                      className="h-10 text-xs rounded-xl border-blue-100/60 bg-white focus:bg-white shadow-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-cargo" className="text-[9px] font-black uppercase tracking-wider text-slate-400">Cargo / Función</Label>
                    <Input
                      id="edit-cargo"
                      value={editForm.cargo || ""}
                      onChange={(e) => setEditForm({ ...editForm, cargo: e.target.value })}
                      placeholder="Cargo"
                      className="h-10 text-xs rounded-xl border-blue-100/60 bg-white focus:bg-white shadow-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-email" className="text-[9px] font-black uppercase tracking-wider text-slate-400">Email Corporativo</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={editForm.email || ""}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                      placeholder="email@empresa.com"
                      className="h-10 text-xs rounded-xl border-blue-100/60 bg-white focus:bg-white shadow-none"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="edit-telefono" className="text-[9px] font-black uppercase tracking-wider text-slate-400">Teléfono / WhatsApp</Label>
                    <Input
                      id="edit-telefono"
                      value={editForm.telefono || ""}
                      onChange={(e) => setEditForm({ ...editForm, telefono: e.target.value })}
                      placeholder="+51 9..."
                      className="h-10 text-xs rounded-xl border-blue-100/60 bg-white focus:bg-white shadow-none"
                    />
                  </div>
                </div>

                <div className="pt-1">
                  <Button
                    variant="outline"
                    className="w-full border-dashed border-blue-200 text-[#0089b3] bg-white hover:bg-blue-50/20 hover:border-primary/30 h-10 text-[10px] font-bold rounded-xl transition-all shadow-none"
                    onClick={() => setIsAgendaOpen(true)}
                  >
                    <Plus className="h-3.5 w-3.5 mr-2" />
                    Gestionar Agenda
                  </Button>
                </div>
              </div>
            </div>
          </ScrollArea>

          <DialogFooter className="px-8 pt-4 pb-8 bg-white border-t border-slate-100 gap-4 shrink-0">
            <Button
              variant="ghost"
              className="h-10 px-6 text-xs font-semibold text-slate-400 hover:text-slate-800 hover:bg-slate-50 rounded-xl"
              onClick={() => setIsEditDialogOpen(false)}
            >
              Cerrar
            </Button>
            <div className="flex-1" />
            <Button
              className="h-10 px-9 font-bold bg-[#0089b3] hover:bg-[#007499] text-white rounded-xl shadow-[0_4px_12px_rgba(0,137,179,0.2)] transition-all active:scale-[0.98] text-xs"
              onClick={handleEditSave}
            >
              Guardar Cambios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ContactAgendaDialog
        open={isAgendaOpen}
        onOpenChange={setIsAgendaOpen}
        clienteId={selectedClient?.id || null}
        clienteNombre={selectedClient?.empresa || null}
        onPrincipalUpdated={() => {
          void fetchClients()
          // Update local edit form if principal changed
          if (selectedClient) {
            supabase
              .from("clientes")
              .select("nombre, email, telefono, cargo")
              .eq("id", selectedClient.id)
              .single()
              .then(({ data }) => {
                if (data) {
                  setEditForm(prev => ({
                    ...prev,
                    nombre: data.nombre,
                    email: data.email,
                    telefono: data.telefono,
                    cargo: data.cargo
                  }))
                }
              })
          }
        }}
      />

      <ModernConfirmDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        onConfirm={handleDeleteConfirm}
        title="¿Eliminar cliente?"
        description={`¿Estás seguro de que deseas eliminar a ${selectedClient?.empresa}? Esta acción no se puede deshacer.`}
        confirmText="Sí, eliminar"
        cancelText="No, cancelar"
        showInput={deleteConfirmStep === 2}
        inputPlaceholder="Escribe el nombre del cliente para confirmar"
        inputValue={deleteConfirmText}
        onInputChange={setDeleteConfirmText}
        expectedValue={selectedClient?.empresa}
      />
    </div >
  )
}
