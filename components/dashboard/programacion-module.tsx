"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
  Plus,
  Search,
  RefreshCw,
  Loader2,
  Calendar,
  FileText,
  Building,
  ChevronLeft,
  ChevronRight,
  Filter,
  Download,
  Save,
  X,
  CheckCircle,
  AlertCircle,
  Clock,
  Users,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { useToast } from "@/hooks/use-toast"
import { type User } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"

const API_URL = process.env.NEXT_PUBLIC_API_URL || "https://api-geofal-crm.onrender.com"

interface ProgramacionServicio {
  id: string
  item_numero: number
  recep_numero: string
  ot: string | null
  codigo_muestra: string | null
  fecha_recepcion: string | null
  fecha_inicio: string | null
  fecha_entrega_estimada: string | null
  cliente_nombre: string
  descripcion_servicio: string | null
  proyecto: string | null
  entrega_real: string | null
  estado_trabajo: string
  cotizacion_lab: string | null
  autorizacion_lab: string | null
  nota_lab: string | null
  dias_atraso_lab: number
  motivo_dias_atraso_lab: string | null
  evidencia_envio_recepcion: boolean
  envio_informes: boolean
  fecha_solicitud_com: string | null
  fecha_entrega_com: string | null
  evidencia_solicitud_envio: string | null
  dias_atraso_envio_coti: number
  motivo_dias_atraso_com: string | null
  numero_factura: string | null
  estado_pago: string | null
  estado_autorizar: string | null
  nota_admin: string | null
  created_at: string
  updated_at: string
  activo: boolean
}

interface Props {
  user: User
}

type TabType = "laboratorio" | "comercial" | "administracion"

// Colores de estado tipo Excel
const estadoColors: Record<string, string> = {
  PENDIENTE: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  PROCESO: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  COMPLETADO: "bg-green-500/20 text-green-400 border-green-500/30",
  CANCELADO: "bg-red-500/20 text-red-400 border-red-500/30",
}

const estadoPagoColors: Record<string, string> = {
  PENDIENTE: "bg-yellow-500/20 text-yellow-400",
  PAGADO: "bg-green-500/20 text-green-400",
  PARCIAL: "bg-blue-500/20 text-blue-400",
  VENCIDO: "bg-red-500/20 text-red-400",
}

const estadoAutorizarColors: Record<string, string> = {
  PENDIENTE: "bg-yellow-500/20 text-yellow-400",
  "ENTREGAR": "bg-green-500/20 text-green-400",
  "NO ENTREGAR": "bg-red-500/20 text-red-400",
}

export function ProgramacionModule({ user }: Props) {
  const [servicios, setServicios] = useState<ProgramacionServicio[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<TabType>("laboratorio")
  const [searchTerm, setSearchTerm] = useState("")
  const [estadoFilter, setEstadoFilter] = useState<string>("all")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null)
  const [editValue, setEditValue] = useState<string>("")
  const [saving, setSaving] = useState(false)
  const [nextNumbers, setNextNumbers] = useState<{ next_recep: string; next_ot: string } | null>(null)
  
  // Formulario nuevo registro
  const [newServicio, setNewServicio] = useState({
    codigo_muestra: "",
    fecha_recepcion: new Date().toISOString().split('T')[0],
    fecha_inicio: "",
    fecha_entrega_estimada: "",
    cliente_nombre: "",
    descripcion_servicio: "",
    estado_trabajo: "PROCESO",
    nota_lab: "",
  })
  
  const { toast } = useToast()

  // Cargar servicios
  const fetchServicios = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (estadoFilter !== "all") params.append("estado", estadoFilter)
      if (searchTerm) params.append("search", searchTerm)
      
      const response = await fetch(`${API_URL}/programacion?${params.toString()}`)
      if (!response.ok) throw new Error("Error al cargar servicios")
      
      const data = await response.json()
      setServicios(data)
    } catch (error) {
      console.error("Error:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los servicios",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [estadoFilter, searchTerm, toast])

  // Cargar próximos números
  const fetchNextNumbers = useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/programacion/next-numbers`)
      if (response.ok) {
        const data = await response.json()
        setNextNumbers(data)
      }
    } catch (error) {
      console.error("Error fetching next numbers:", error)
    }
  }, [])

  useEffect(() => {
    fetchServicios()
  }, [fetchServicios])

  useEffect(() => {
    if (showCreateDialog) {
      fetchNextNumbers()
    }
  }, [showCreateDialog, fetchNextNumbers])

  // Crear nuevo servicio
  const handleCreate = async () => {
    if (!newServicio.cliente_nombre || !newServicio.descripcion_servicio) {
      toast({
        title: "Campos requeridos",
        description: "Cliente y Descripción del Servicio son obligatorios",
        variant: "destructive",
      })
      return
    }
    
    setSaving(true)
    try {
      const response = await fetch(`${API_URL}/programacion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...newServicio,
          responsable_lab: user.name,
        }),
      })
      
      if (!response.ok) throw new Error("Error al crear servicio")
      
      toast({
        title: "Servicio creado",
        description: "El servicio se ha registrado correctamente",
      })
      
      setShowCreateDialog(false)
      setNewServicio({
        codigo_muestra: "",
        fecha_recepcion: new Date().toISOString().split('T')[0],
        fecha_inicio: "",
        fecha_entrega_estimada: "",
        cliente_nombre: "",
        descripcion_servicio: "",
        estado_trabajo: "PROCESO",
        nota_lab: "",
      })
      fetchServicios()
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo crear el servicio",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  // Editar celda inline
  const startEditing = (id: string, field: string, currentValue: string | null) => {
    setEditingCell({ id, field })
    setEditValue(currentValue || "")
  }

  const cancelEditing = () => {
    setEditingCell(null)
    setEditValue("")
  }

  const saveEdit = async () => {
    if (!editingCell) return
    
    setSaving(true)
    try {
      const endpoint = `${API_URL}/programacion/${editingCell.id}/${activeTab}`
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [editingCell.field]: editValue || null,
          [`responsable_${activeTab === "laboratorio" ? "lab" : activeTab}`]: user.name,
        }),
      })
      
      if (!response.ok) throw new Error("Error al guardar")
      
      // Actualizar localmente
      setServicios(prev => prev.map(s => 
        s.id === editingCell.id 
          ? { ...s, [editingCell.field]: editValue || null }
          : s
      ))
      
      toast({
        title: "Guardado",
        description: "Campo actualizado correctamente",
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo guardar el cambio",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
      cancelEditing()
    }
  }

  // Filtrar servicios
  const filteredServicios = useMemo(() => {
    return servicios.filter(s => {
      const matchesSearch = !searchTerm || 
        s.cliente_nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.descripcion_servicio?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.recep_numero.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.ot?.toLowerCase().includes(searchTerm.toLowerCase())
      
      const matchesEstado = estadoFilter === "all" || s.estado_trabajo === estadoFilter
      
      return matchesSearch && matchesEstado
    })
  }, [servicios, searchTerm, estadoFilter])

  // Columnas según el tab activo
  const getVisibleColumns = () => {
    const commonCols = ["item_numero", "recep_numero", "ot", "codigo_muestra", "cliente_nombre", "descripcion_servicio", "estado_trabajo"]
    
    switch (activeTab) {
      case "laboratorio":
        return [...commonCols, "fecha_recepcion", "fecha_inicio", "fecha_entrega_estimada", "nota_lab"]
      case "comercial":
        return [...commonCols, "fecha_solicitud_com", "fecha_entrega_com", "dias_atraso_envio_coti", "motivo_dias_atraso_com"]
      case "administracion":
        return [...commonCols, "numero_factura", "estado_pago", "estado_autorizar", "nota_admin"]
      default:
        return commonCols
    }
  }

  const columnLabels: Record<string, string> = {
    item_numero: "ITEM",
    recep_numero: "RECEP N",
    ot: "OT",
    codigo_muestra: "CÓDIGO MUESTRA",
    fecha_recepcion: "FECHA RECEPCIÓN",
    fecha_inicio: "INICIO",
    fecha_entrega_estimada: "ENTREGA ESTIMADA",
    cliente_nombre: "CLIENTE",
    descripcion_servicio: "SERVICIO",
    estado_trabajo: "ESTADO",
    nota_lab: "OBSERVACIONES",
    fecha_solicitud_com: "FECHA SOLICITUD",
    fecha_entrega_com: "FECHA ENTREGA",
    dias_atraso_envio_coti: "DÍAS ATRASO",
    motivo_dias_atraso_com: "MOTIVO ATRASO",
    numero_factura: "N° FACTURA",
    estado_pago: "ESTADO PAGO",
    estado_autorizar: "AUTORIZAR",
    nota_admin: "NOTA",
  }

  // Campos editables por sección
  const editableFields: Record<TabType, string[]> = {
    laboratorio: ["ot", "codigo_muestra", "fecha_recepcion", "fecha_inicio", "fecha_entrega_estimada", "cliente_nombre", "descripcion_servicio", "estado_trabajo", "nota_lab"],
    comercial: ["fecha_solicitud_com", "fecha_entrega_com", "dias_atraso_envio_coti", "motivo_dias_atraso_com"],
    administracion: ["numero_factura", "estado_pago", "estado_autorizar", "nota_admin"],
  }

  const isEditable = (field: string) => editableFields[activeTab]?.includes(field)

  // Renderizar celda
  const renderCell = (servicio: ProgramacionServicio, field: string) => {
    const value = (servicio as any)[field]
    const isCurrentlyEditing = editingCell?.id === servicio.id && editingCell?.field === field
    
    if (isCurrentlyEditing) {
      return (
        <div className="flex items-center gap-1">
          {field === "estado_trabajo" || field === "estado_pago" || field === "estado_autorizar" ? (
            <Select value={editValue} onValueChange={setEditValue}>
              <SelectTrigger className="h-7 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {field === "estado_trabajo" && (
                  <>
                    <SelectItem value="PROCESO">Proceso</SelectItem>
                    <SelectItem value="COMPLETADO">Completado</SelectItem>
                    <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                    <SelectItem value="CANCELADO">Cancelado</SelectItem>
                  </>
                )}
                {field === "estado_pago" && (
                  <>
                    <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                    <SelectItem value="PAGADO">Pagado</SelectItem>
                    <SelectItem value="PARCIAL">Parcial</SelectItem>
                    <SelectItem value="VENCIDO">Vencido</SelectItem>
                  </>
                )}
                {field === "estado_autorizar" && (
                  <>
                    <SelectItem value="ENTREGAR">Entregar</SelectItem>
                    <SelectItem value="NO ENTREGAR">No Entregar</SelectItem>
                    <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          ) : field.includes("fecha") ? (
            <Input
              type="date"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="h-7 text-xs w-32"
            />
          ) : field === "dias_atraso_lab" || field === "dias_atraso_envio_coti" ? (
            <Input
              type="number"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="h-7 text-xs w-16"
            />
          ) : (
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="h-7 text-xs"
              autoFocus
            />
          )}
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={saveEdit} disabled={saving}>
            <Save className="h-3 w-3" />
          </Button>
          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={cancelEditing}>
            <X className="h-3 w-3" />
          </Button>
        </div>
      )
    }

    // Renderizar valor con estilos
    if (field === "estado_trabajo") {
      return (
        <Badge variant="outline" className={cn("text-xs", estadoColors[value] || "")}>
          {value || "-"}
        </Badge>
      )
    }

    if (field === "estado_pago") {
      return (
        <Badge variant="outline" className={cn("text-xs", estadoPagoColors[value] || "")}>
          {value || "-"}
        </Badge>
      )
    }

    if (field === "estado_autorizar") {
      return (
        <Badge variant="outline" className={cn("text-xs", estadoAutorizarColors[value] || "")}>
          {value || "-"}
        </Badge>
      )
    }

    if (field === "dias_atraso" && value !== null && value > 0) {
      return <span className="text-red-400 font-medium">{value}</span>
    }

    if (field.includes("fecha") && value) {
      return new Date(value).toLocaleDateString("es-PE")
    }

    return value || "-"
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Control de Programación de Servicios</h1>
          <p className="text-muted-foreground">
            Gestión colaborativa de servicios entre Laboratorio, Comercial y Administración
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchServicios} disabled={loading}>
            <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
            Actualizar
          </Button>
          {activeTab === "laboratorio" && (
            <Button size="sm" onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Servicio
            </Button>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Servicios</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{servicios.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-400">
              {servicios.filter(s => s.estado_trabajo === "PENDIENTE").length}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Proceso</CardTitle>
            <Loader2 className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-400">
              {servicios.filter(s => s.estado_trabajo === "PROCESO").length}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completados</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-400">
              {servicios.filter(s => s.estado_trabajo === "COMPLETADO").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs por sección */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)} className="space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <TabsList className="bg-zinc-900/50 border border-zinc-800">
            <TabsTrigger value="laboratorio" className="data-[state=active]:bg-blue-600">
              🔬 Laboratorio
            </TabsTrigger>
            <TabsTrigger value="comercial" className="data-[state=active]:bg-green-600">
              💼 Comercial
            </TabsTrigger>
            <TabsTrigger value="administracion" className="data-[state=active]:bg-purple-600">
              📊 Administración
            </TabsTrigger>
          </TabsList>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, ensayo, RECEP..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64 bg-zinc-900/50 border-zinc-800"
              />
            </div>
            <Select value={estadoFilter} onValueChange={setEstadoFilter}>
              <SelectTrigger className="w-40 bg-zinc-900/50 border-zinc-800">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                <SelectItem value="PROCESO">En Proceso</SelectItem>
                <SelectItem value="COMPLETADO">Completado</SelectItem>
                <SelectItem value="CANCELADO">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tabla principal con scroll horizontal */}
        <Card className="bg-zinc-900/50 border-zinc-800">
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="min-w-max">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-zinc-800">
                    {getVisibleColumns().map((col) => (
                      <TableHead 
                        key={col} 
                        className={cn(
                          "text-xs font-semibold text-zinc-400 whitespace-nowrap",
                          (col === "item_numero" || col === "recep_numero") && "sticky left-0 bg-zinc-900 z-10"
                        )}
                      >
                        {columnLabels[col]}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={getVisibleColumns().length} className="text-center py-10">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      </TableCell>
                    </TableRow>
                  ) : filteredServicios.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={getVisibleColumns().length} className="text-center py-10 text-muted-foreground">
                        No se encontraron servicios
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredServicios.map((servicio) => (
                      <TableRow 
                        key={servicio.id} 
                        className="border-zinc-800 hover:bg-zinc-800/50"
                      >
                        {getVisibleColumns().map((col) => (
                          <TableCell 
                            key={col}
                            className={cn(
                              "text-sm whitespace-nowrap",
                              (col === "item_numero" || col === "recep_numero") && "sticky left-0 bg-zinc-900 z-10 font-medium",
                              isEditable(col) && "cursor-pointer hover:bg-zinc-700/50"
                            )}
                            onClick={() => isEditable(col) && startEditing(servicio.id, col, (servicio as any)[col])}
                          >
                            {renderCell(servicio, col)}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </Card>
      </Tabs>

      {/* Dialog para crear nuevo servicio */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-lg bg-zinc-900 border-zinc-800">
          <DialogHeader>
            <DialogTitle>Nuevo Servicio - Laboratorio</DialogTitle>
            <DialogDescription>
              Registrar un nuevo servicio. Los campos RECEP N y OT se generan automáticamente.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {nextNumbers && (
              <div className="flex gap-4 p-3 bg-zinc-800/50 rounded-lg">
                <div>
                  <Label className="text-xs text-muted-foreground">RECEP N (auto)</Label>
                  <p className="font-mono font-bold text-blue-400">{nextNumbers.next_recep}</p>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">OT (auto)</Label>
                  <p className="font-mono font-bold text-green-400">{nextNumbers.next_ot}</p>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código Muestra</Label>
                <Input
                  value={newServicio.codigo_muestra}
                  onChange={(e) => setNewServicio(prev => ({ ...prev, codigo_muestra: e.target.value }))}
                  placeholder="Ej: M-001"
                  className="bg-zinc-800 border-zinc-700"
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha Recepción</Label>
                <Input
                  type="date"
                  value={newServicio.fecha_recepcion}
                  onChange={(e) => setNewServicio(prev => ({ ...prev, fecha_recepcion: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cliente *</Label>
              <Input
                value={newServicio.cliente_nombre}
                onChange={(e) => setNewServicio(prev => ({ ...prev, cliente_nombre: e.target.value }))}
                placeholder="Nombre del cliente"
                className="bg-zinc-800 border-zinc-700"
              />
            </div>

            <div className="space-y-2">
              <Label>Descripción del Servicio *</Label>
              <Input
                value={newServicio.descripcion_servicio}
                onChange={(e) => setNewServicio(prev => ({ ...prev, descripcion_servicio: e.target.value }))}
                placeholder="Tipo de servicio/ensayo"
                className="bg-zinc-800 border-zinc-700"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fecha Inicio</Label>
                <Input
                  type="date"
                  value={newServicio.fecha_inicio}
                  onChange={(e) => setNewServicio(prev => ({ ...prev, fecha_inicio: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700"
                />
              </div>
              <div className="space-y-2">
                <Label>Fecha Entrega Estimada</Label>
                <Input
                  type="date"
                  value={newServicio.fecha_entrega_estimada}
                  onChange={(e) => setNewServicio(prev => ({ ...prev, fecha_entrega_estimada: e.target.value }))}
                  className="bg-zinc-800 border-zinc-700"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Estado</Label>
              <Select 
                value={newServicio.estado_trabajo} 
                onValueChange={(v) => setNewServicio(prev => ({ ...prev, estado_trabajo: v }))}
              >
                <SelectTrigger className="bg-zinc-800 border-zinc-700">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PROCESO">Proceso</SelectItem>
                  <SelectItem value="PENDIENTE">Pendiente</SelectItem>
                  <SelectItem value="COMPLETADO">Completado</SelectItem>
                  <SelectItem value="en_proceso">En Proceso</SelectItem>
                  <SelectItem value="completado">Completado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Observaciones</Label>
              <Input
                value={newServicio.nota_lab}
                onChange={(e) => setNewServicio(prev => ({ ...prev, nota_lab: e.target.value }))}
                placeholder="Notas adicionales"
                className="bg-zinc-800 border-zinc-700"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Crear Servicio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
