"use client"

import { useState, useCallback, useEffect, useMemo } from "react"
import { Plus, FileText, Clock, DollarSign, Loader2, RefreshCw, Search, Calendar, Building2, User2, Download, Eye, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CreateQuoteDialog } from "./create-quote-dialog"
import { ModernConfirmDialog } from "./modern-confirm-dialog"
import { QuotePreviewPanel } from "./quote-preview-panel"
import type { User } from "@/app/page"
import { supabase } from "@/lib/supabaseClient"
import { toast } from "sonner"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import { CheckCircle2, XCircle, AlertCircle, ChevronDown, Trash2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { isToday, isThisWeek, isThisMonth, parseISO, format } from "date-fns"
import { es } from "date-fns/locale"
import { logAction } from "@/app/actions/audit-actions"

export interface Quote {
  id: string
  numero: string
  year: number
  cliente: string
  monto: number
  estado: "pendiente" | "aprobada" | "rechazada" | "borrador"
  owner: string
  ownerId: string
  fecha: string
  itemsCount: number
  clienteRuc: string
  clienteEmail: string
  clienteTelefono: string
  clienteContacto: string
  proyectoNombre: string
  itemsJson: any[]
  objectKey: string
}

interface DbQuoteRow {
  id: string
  numero: string
  year: number
  cliente_nombre: string | null
  cliente_ruc: string | null
  cliente_email: string | null
  cliente_telefono: string | null
  cliente_contacto: string | null
  proyecto: string | null
  total: number
  estado: string
  vendedor_nombre: string | null
  user_created: string | null
  fecha_emision: string | null
  created_at: string
  items_count: number | null
  items_json: any[] | null
  object_key: string | null
}

const mapDbQuoteToUi = (row: any): Quote => ({
  id: row.id,
  numero: row.numero,
  year: row.year,
  cliente: row.cliente_nombre || "Cliente Sin Nombre",
  monto: Number(row.total),
  estado: (row.estado === "borrador" ? "pendiente" : row.estado) as Quote["estado"],
  owner: row.vendedor_nombre || "Sistema",
  ownerId: row.user_created || "",
  fecha: row.fecha_emision ? String(row.fecha_emision) : row.created_at.split("T")[0],
  itemsCount: row.items_count || (row.items_json ? row.items_json.length : 0),
  clienteRuc: row.cliente_ruc || "",
  clienteEmail: row.cliente_email || "",
  clienteTelefono: row.cliente_telefono || "",
  clienteContacto: row.cliente_contacto || "",
  proyectoNombre: row.proyecto || "Sin Proyecto",
  itemsJson: row.items_json || [],
  objectKey: row.object_key || "",
})

// Helper functions moved outside component for performance
const getStatusBadgeClass = (status: Quote["estado"]) => {
  const variants = {
    pendiente: "bg-amber-500/20 text-amber-600 border-amber-500/30",
    aprobada: "bg-emerald-500/20 text-emerald-600 border-emerald-500/30",
    rechazada: "bg-red-500/20 text-red-600 border-red-500/30",
    borrador: "bg-slate-500/20 text-slate-600 border-slate-500/30",
  }
  return variants[status] || variants.pendiente
}

const statusLabels: Record<string, string> = {
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
  borrador: "Borrador",
}

interface CotizadoraModuleProps {
  user: User
}

export function CotizadoraModule({ user }: CotizadoraModuleProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null)
  const [previewQuote, setPreviewQuote] = useState<Quote | null>(null)
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)

  // Advanced Filters
  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month">("all")
  const [clienteFilter, setClienteFilter] = useState<string>("all")
  const [vendedorFilter, setVendedorFilter] = useState<string>("all")

  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  // const { toast } = useToast() // Replaced by Sonner
  const cotizadorUrl = process.env.NEXT_PUBLIC_COTIZADOR_URL ?? undefined

  const fetchQuotes = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("cotizaciones")
        .select("*")
        .eq("visibilidad", "visible")
        .order("created_at", { ascending: false })

      if (error) throw error
      setQuotes((data || []).map(mapDbQuoteToUi))
    } catch (err: any) {
      toast.error("Error al cargar cotizaciones", {
        description: err.message,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchQuotes()
  }, [fetchQuotes])

  // Derived data for filters
  const uniqueClientes = useMemo(() =>
    [...new Set(quotes.map(q => q.cliente))].sort(),
    [quotes]
  )

  const uniqueVendedores = useMemo(() =>
    [...new Set(quotes.map(q => q.owner))].sort(),
    [quotes]
  )

  // Advanced filtering logic
  const filteredQuotes = useMemo(() => {
    return quotes.filter((q) => {
      const quoteDate = parseISO(q.fecha)

      // Search query (cliente, numero, proyecto)
      const matchesSearch = searchQuery === "" ||
        q.cliente.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.numero.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.proyectoNombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        q.clienteRuc.includes(searchQuery)

      // Status filter
      const matchesStatus = statusFilter === "all" || q.estado === statusFilter

      // Date filter
      let matchesDate = true
      if (dateFilter === "today") matchesDate = isToday(quoteDate)
      else if (dateFilter === "week") matchesDate = isThisWeek(quoteDate, { weekStartsOn: 1 })
      else if (dateFilter === "month") matchesDate = isThisMonth(quoteDate)

      // Cliente filter
      const matchesCliente = clienteFilter === "all" || q.cliente === clienteFilter

      // Vendedor filter (admin only)
      const matchesVendedor = vendedorFilter === "all" || q.owner === vendedorFilter

      return matchesSearch && matchesStatus && matchesDate && matchesCliente && matchesVendedor
    })
  }, [quotes, searchQuery, statusFilter, dateFilter, clienteFilter, vendedorFilter])

  // Stats calculations
  const stats = useMemo(() => {
    const filtered = filteredQuotes
    return {
      total: filtered.length,
      aprobadas: filtered.filter(q => q.estado === "aprobada").length,
      pendientes: filtered.filter(q => q.estado === "pendiente").length,
      montoAprobado: filtered.filter(q => q.estado === "aprobada").reduce((sum, q) => sum + q.monto, 0),
      montoTotal: filtered.reduce((sum, q) => sum + q.monto, 0),
    }
  }, [filteredQuotes])

  const changeQuoteStatus = async (quoteId: string, newStatus: Quote["estado"]) => {
    setUpdatingStatus(true)
    try {
      const dbStatus = newStatus === 'pendiente' ? 'borrador' : newStatus

      const { error } = await supabase
        .from("cotizaciones")
        .update({ estado: dbStatus })
        .eq("id", quoteId)

      if (error) throw error

      setQuotes(prev => prev.map(q => q.id === quoteId ? { ...q, estado: newStatus } : q))
      if (previewQuote?.id === quoteId) {
        setPreviewQuote({ ...previewQuote, estado: newStatus })
      }
      if (selectedQuote?.id === quoteId) {
        setSelectedQuote({ ...selectedQuote, estado: newStatus })
      }

      toast.success("Estado actualizado", {
        description: `La cotización ha sido marcada como ${statusLabels[newStatus]}.`,
      })

      logAction({
        user_id: user.id,
        user_name: user.name,
        action: `Cambió estado cotización: ${newStatus}`,
        module: "COTIZADORA",
        details: { quote_id: quoteId }
      })
    } catch (err: any) {
      toast.error("Error al actualizar estado", {
        description: err.message,
      })
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleDownload = async (quote: Quote) => {
    if (!quote.objectKey) {
      toast.error("Error", {
        description: "No se encontró el archivo de la cotización.",
      })
      return
    }

    try {
      const { data, error } = await supabase.storage
        .from("cotizaciones")
        .download(quote.objectKey)

      if (error) throw error

      const url = window.URL.createObjectURL(data)
      const link = document.createElement("a")
      link.href = url
      link.setAttribute("download", `COT-${quote.numero}-${quote.year}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()

      logAction({
        user_id: user.id,
        user_name: user.name,
        action: `Descargó cotización: ${quote.numero}`,
        module: "COTIZADORA",
        details: { quote_id: quote.id }
      })
    } catch (err: any) {
      toast.error("Error al descargar", {
        description: err.message,
      })
    }
  }

  const handleDeleteQuote = async () => {
    const quoteToDelete = previewQuote || selectedQuote
    if (!quoteToDelete) return

    try {
      const { error } = await supabase
        .from("cotizaciones")
        .update({ visibilidad: "no_visible" })
        .eq("id", quoteToDelete.id)

      if (error) throw error

      const deletedId = quoteToDelete.id
      setQuotes(prev => prev.filter(q => q.id !== deletedId))
      setIsViewDialogOpen(false)
      setIsDeleteConfirmOpen(false)
      setSelectedQuote(null)
      setPreviewQuote(null)

      toast.success("Cotización eliminada exitosamente")

      logAction({
        user_id: user.id,
        user_name: user.name,
        action: `Eliminó cotización (soft delete): ${deletedId}`,
        module: "COTIZADORA",
        details: { quote_id: deletedId }
      })
    } catch (err: any) {
      toast.error("Error al eliminar", {
        description: err.message,
      })
    }
  }

  const openViewDialog = (quote: Quote) => {
    setSelectedQuote(quote)
    setIsViewDialogOpen(true)
  }

  const clearFilters = () => {
    setSearchQuery("")
    setStatusFilter("all")
    setDateFilter("all")
    setClienteFilter("all")
    setVendedorFilter("all")
  }

  const hasActiveFilters = searchQuery || statusFilter !== "all" || dateFilter !== "all" || clienteFilter !== "all" || vendedorFilter !== "all"

  return (
    <div className="flex gap-4 h-[calc(100vh-120px)]">
      <div className="w-full h-full flex flex-col gap-4 min-w-0 overflow-hidden">
        {/* Header Row */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Centro de Cotizaciones</h1>
            <p className="text-sm text-muted-foreground">Gestiona y filtra todas tus cotizaciones</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" onClick={fetchQuotes} title="Recargar" className="h-9 w-9">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
            <Button onClick={() => setIsDialogOpen(true)} className="h-9 px-4 font-semibold">
              <Plus className="h-4 w-4 mr-1.5" />
              Nueva Cotización
            </Button>
          </div>
        </div>

        {/* Stats Cards - Compact */}
        <div className="grid grid-cols-4 gap-3">
          <Card className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'all' ? 'ring-2 ring-primary' : ''}`}
            onClick={() => setStatusFilter("all")}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.total}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'aprobada' ? 'ring-2 ring-emerald-500' : ''}`}
            onClick={() => setStatusFilter("aprobada")}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.aprobadas}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Aprobadas</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`cursor-pointer transition-all hover:shadow-md ${statusFilter === 'pendiente' ? 'ring-2 ring-amber-500' : ''}`}
            onClick={() => setStatusFilter("pendiente")}>
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-amber-500/20 flex items-center justify-center">
                  <Clock className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stats.pendientes}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">Pendientes</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
            <CardContent className="p-3">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
                  <DollarSign className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold text-primary">
                    S/. {stats.montoAprobado.toLocaleString("es-PE", { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-[10px] text-muted-foreground uppercase">Aprobado</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Advanced Filters Bar */}
        <div className="flex flex-wrap items-center gap-2 p-3 bg-card rounded-lg border border-border">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente, RUC, proyecto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Date Filter */}
          <Select value={dateFilter} onValueChange={(v: any) => setDateFilter(v)}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo el tiempo</SelectItem>
              <SelectItem value="today">Hoy</SelectItem>
              <SelectItem value="week">Esta semana</SelectItem>
              <SelectItem value="month">Este mes</SelectItem>
            </SelectContent>
          </Select>

          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[120px] h-9 text-xs">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="aprobada">Aprobada</SelectItem>
              <SelectItem value="rechazada">Rechazada</SelectItem>
            </SelectContent>
          </Select>

          {/* Cliente Filter */}
          <Select value={clienteFilter} onValueChange={setClienteFilter}>
            <SelectTrigger className="w-[160px] h-9 text-xs">
              <Building2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
              <SelectValue placeholder="Cliente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              {uniqueClientes.slice(0, 20).map((cliente) => (
                <SelectItem key={cliente} value={cliente} className="text-xs">
                  {cliente.length > 25 ? cliente.substring(0, 25) + "..." : cliente}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Vendedor Filter (Admin only) */}
          {user.role === "admin" && (
            <Select value={vendedorFilter} onValueChange={setVendedorFilter}>
              <SelectTrigger className="w-[140px] h-9 text-xs">
                <User2 className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue placeholder="Vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {uniqueVendedores.map((vendedor) => (
                  <SelectItem key={vendedor} value={vendedor} className="text-xs">
                    {vendedor}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Clear Filters */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 px-2 text-xs text-muted-foreground">
              <X className="h-3.5 w-3.5 mr-1" />
              Limpiar
            </Button>
          )}

          <div className="ml-auto text-xs text-muted-foreground">
            {filteredQuotes.length} resultados
          </div>
        </div>

        {/* High-Density Table */}
        <Card className="flex-1 overflow-hidden">
          <ScrollArea className="h-[calc(100vh-340px)]">
            {filteredQuotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FileText className="h-12 w-12 text-muted-foreground/20 mb-3" />
                <h3 className="text-base font-semibold text-muted-foreground mb-1">Sin resultados</h3>
                <p className="text-xs text-muted-foreground max-w-xs">
                  {hasActiveFilters ? "Intenta con otros filtros" : "No hay cotizaciones registradas"}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader className="sticky top-0 bg-card z-10">
                  <TableRow className="hover:bg-transparent border-b">
                    <TableHead className="text-xs font-semibold px-4 py-3 w-[100px]">ID</TableHead>
                    <TableHead className="text-xs font-semibold px-4 py-3 max-w-[300px] xl:max-w-[400px]">Cliente / Proyecto</TableHead>
                    <TableHead className="text-xs font-semibold px-4 py-3 w-[80px] text-center">Items</TableHead>
                    <TableHead className="text-xs font-semibold px-4 py-3 w-[120px] text-right">Monto</TableHead>
                    <TableHead className="text-xs font-semibold px-4 py-3 w-[100px]">Estado</TableHead>
                    {user.role === "admin" && <TableHead className="text-xs font-semibold px-4 py-3 w-[110px]">Vendedor</TableHead>}
                    <TableHead className="text-xs font-semibold px-4 py-3 w-[90px]">Fecha</TableHead>
                    <TableHead className="text-xs font-semibold px-4 py-3 w-[80px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredQuotes.map((quote) => (
                    <TableRow
                      key={quote.id}
                      className={`cursor-pointer group transition-colors ${previewQuote?.id === quote.id ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-secondary/30'}`}
                      onClick={() => setPreviewQuote(quote)}
                    >
                      <TableCell className="px-4 py-2.5">
                        <span className="font-mono text-xs font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          {quote.numero}-{String(quote.year).slice(-2)}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-2.5 max-w-[300px] xl:max-w-[400px]">
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-sm truncate" title={quote.cliente}>{quote.cliente}</span>
                          <span className="text-[10px] text-muted-foreground truncate" title={quote.proyectoNombre}>{quote.proyectoNombre}</span>
                        </div>
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-center">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-bold">
                          {quote.itemsCount}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-2.5 text-right">
                        <span className="font-bold text-sm">
                          S/. {quote.monto.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                        </span>
                      </TableCell>
                      <TableCell className="px-4 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${getStatusBadgeClass(quote.estado)}`}>
                          {statusLabels[quote.estado]}
                        </span>
                      </TableCell>
                      {user.role === "admin" && (
                        <TableCell className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[9px] font-bold text-primary">
                              {quote.owner.charAt(0)}
                            </div>
                            <span className="text-xs truncate max-w-[70px]">{quote.owner}</span>
                          </div>
                        </TableCell>
                      )}
                      <TableCell className="px-4 py-2.5 text-xs text-muted-foreground">
                        {quote.fecha}
                      </TableCell>
                      <TableCell className="px-4 py-2.5">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => { e.stopPropagation(); openViewDialog(quote) }}
                            title="Ver completo"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => { e.stopPropagation(); handleDownload(quote) }}
                            title="Descargar"
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedQuote(quote);
                              setIsDialogOpen(true);
                            }}
                            title="Editar"
                          >
                            <FileText className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </ScrollArea>
        </Card>
      </div>

      <Sheet open={!!previewQuote} onOpenChange={(open) => !open && setPreviewQuote(null)}>
        <SheetContent side="right" className="w-[400px] sm:w-[540px] p-0 border-l border-border bg-card">
          <QuotePreviewPanel
            quote={previewQuote}
            onDownload={handleDownload}
            onStatusChange={changeQuoteStatus}
            onViewFull={openViewDialog}
            onDelete={(quote) => { setPreviewQuote(quote); setIsDeleteConfirmOpen(true) }}
            onEdit={(quote) => { setSelectedQuote(quote); setIsDialogOpen(true) }}
            isUpdating={updatingStatus}
          />
        </SheetContent>
      </Sheet>

      <CreateQuoteDialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) setSelectedQuote(null); // Clear selection on close
        }}
        iframeUrl={cotizadorUrl}
        user={user}
        onSuccess={fetchQuotes}
        quoteId={selectedQuote?.id}
      />

      {/* Full View Dialog (for complete details) */}
      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent showCloseButton={false} className="sm:max-w-[650px] w-[95vw] max-h-[90vh] bg-card border-border p-0 flex flex-col overflow-hidden rounded-2xl">
          <DialogHeader className="p-6 shrink-0 border-b border-border/50">
            <DialogTitle className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-lg bg-primary/20 flex items-center justify-center">
                <FileText className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p>Cotización {selectedQuote?.numero}-{selectedQuote?.year}</p>
                <p className="text-sm font-normal text-muted-foreground">{selectedQuote?.proyectoNombre}</p>
              </div>
            </DialogTitle>
            <DialogDescription className="sr-only">
              Detalles completos de la cotización seleccionada.
            </DialogDescription>
          </DialogHeader>

          {selectedQuote && (
            <ScrollArea className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-6">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-3">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider border ${getStatusBadgeClass(selectedQuote.estado)}`}>
                      {statusLabels[selectedQuote.estado]}
                    </span>
                    <span className="text-sm text-muted-foreground">Emitida el {selectedQuote.fecha}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-2" disabled={updatingStatus}>
                          {updatingStatus ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronDown className="h-4 w-4" />}
                          Cambiar Estado
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => changeQuoteStatus(selectedQuote.id, "aprobada")} className="gap-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Aprobada
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => changeQuoteStatus(selectedQuote.id, "rechazada")} className="gap-2">
                          <XCircle className="h-4 w-4 text-red-500" /> Rechazada
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => changeQuoteStatus(selectedQuote.id, "pendiente")} className="gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-500" /> Pendiente
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button variant="default" size="sm" className="gap-2" onClick={() => handleDownload(selectedQuote)}>
                      <Download className="h-4 w-4" />
                      Descargar
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                      <Building2 className="h-4 w-4" />
                      Información del Cliente
                    </div>
                    <div className="space-y-2 bg-secondary/20 p-4 rounded-lg">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Empresa</p>
                        <p className="text-sm font-semibold">{selectedQuote.cliente}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">RUC</p>
                          <p className="text-sm">{selectedQuote.clienteRuc || "N/A"}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Contacto</p>
                          <p className="text-sm">{selectedQuote.clienteContacto || "N/A"}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-primary font-semibold text-sm">
                      <User2 className="h-4 w-4" />
                      Información Comercial
                    </div>
                    <div className="space-y-2 bg-secondary/20 p-4 rounded-lg">
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Vendedor</p>
                        <p className="text-sm font-semibold">{selectedQuote.owner}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Monto Total</p>
                        <p className="text-xl font-bold text-primary">S/. {selectedQuote.monto.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Items List */}
                {selectedQuote.itemsJson && selectedQuote.itemsJson.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-semibold flex items-center gap-2">
                      Detalle de Items ({selectedQuote.itemsCount})
                    </h4>
                    <div className="border border-border rounded-lg bg-secondary/10 divide-y divide-border/50">
                      {selectedQuote.itemsJson.map((item: any, idx: number) => (
                        <div key={idx} className="flex justify-between items-start text-sm p-3 hover:bg-background/50 transition-colors">
                          <div className="space-y-0.5 flex-1 min-w-0">
                            <p className="font-medium line-clamp-2">{item.descripcion || item.item}</p>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>Cant: <strong>{item.cantidad || 1}</strong></span>
                              <span>P.U: S/. {Number(item.costo_unitario || item.precio_unitario || item.pu || 0).toFixed(2)}</span>
                            </div>
                          </div>
                          <p className="font-semibold shrink-0 ml-2">S/. {Number(item.total || item.total_item || (item.costo_unitario || item.precio_unitario || 0) * (item.cantidad || 1)).toLocaleString("es-PE", { minimumFractionDigits: 2 })}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          <DialogFooter className="border-t border-border p-4 shrink-0 flex items-center justify-between bg-secondary/5">
            <Button
              variant="destructive"
              size="sm"
              className="gap-2"
              onClick={() => setIsDeleteConfirmOpen(true)}
            >
              <Trash2 className="h-4 w-4" />
              Eliminar
            </Button>
            <Button variant="outline" onClick={() => setIsViewDialogOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ModernConfirmDialog
        open={isDeleteConfirmOpen}
        onOpenChange={setIsDeleteConfirmOpen}
        onConfirm={handleDeleteQuote}
        title="¿Eliminar cotización?"
        description="Esta acción eliminará el registro de la vista del CRM. ¿Deseas continuar?"
        confirmText="Sí, eliminar"
        cancelText="No, cancelar"
      />
    </div>
  )
}
