"use client"

import { useState, useMemo, useCallback, useEffect } from "react"
import {
  Plus,
  FolderKanban,
  Search,
  LayoutGrid,
  List,
  ChevronLeft,
  ChevronRight,
  Filter,
  Calendar,
  Users,
  FileText,
  DollarSign,
  Pencil,
  Check,
  X,
  CheckCircle2,
  RefreshCw,
  XCircle,
  Archive,
  TrendingUp,
  TrendingDown,
  Clock,
  MoreVertical,
  Eye,
  Trash2,
  AlertTriangle,
  ArrowRight,
  Loader2,
  Building,
  MapPin,
  Download,
} from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { toast } from "sonner"
import { deleteProjectAction } from "@/app/actions/delete-actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Progress } from "@/components/ui/progress"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { CreateProjectDialog } from "./create-project-dialog"
import { CloseProjectDialog } from "./close-project-dialog"
import { CreateQuoteDialog } from "./create-quote-dialog"
import { type User } from "@/hooks/use-auth"
import { logAction } from "@/app/actions/audit-actions"
import { ContactSelector } from "./contact-selector"

export interface Project {
  id: string
  nombre: string
  cliente: string
  clienteId: string
  cotizaciones: number
  estado:
  | "prospecto"
  | "en_negociacion"
  | "propuesta_enviada"
  | "venta_ganada"
  | "venta_perdida"
  | "en_ejecucion"
  | "completado"
  | "archivado"
  etapa: "pipeline" | "ventas" | "perdidas" | "archivados" | "ventas_archivadas"
  fechaInicio: string
  fechaFin: string
  fechaCierre?: string
  fechaCreacion: string
  presupuesto: number // Will be montoTotal
  montoTotal: number
  montoAprobado: number
  montoFinal?: number
  progreso: number
  motivoPerdida?: "competencia" | "precio" | "timing" | "sin_respuesta" | "cancelado_cliente" | "otro"
  notasCierre?: string
  vendedor?: string
  responsable?: string
  descripcion?: string
  ubicacion?: string
  empresa?: string
  // Nuevos campos de contacto
  contactoNombre?: string
  contactoCargo?: string
  contactoEmail?: string
  contactoTelefono?: string
  contactoPrincipalId?: string
  ruc?: string
}

const initialProjects: Project[] = []

interface DbProjectRow {
  id: string
  nombre: string
  descripcion: string | null
  cliente_id: string
  ubicacion: string | null
  direccion: string | null
  vendedor_id: string
  estado: string
  etapa: string
  presupuesto: number
  progreso: number
  fecha_inicio: string | null
  fecha_fin: string | null
  motivo_perdida: string | null
  created_at: string
  clientes?: { nombre: string; empresa: string; ruc: string }
}

const mapDbProjectToUi = (row: any): Project => {
  let etapa = row.etapa as Project["etapa"]
  if (row.estado === "completado") {
    etapa = "ventas_archivadas"
  } else if (row.estado === "archivado") {
    etapa = "archivados"
  } else if (row.estado === "venta_perdida") {
    etapa = "perdidas"
  } else if (["venta_ganada", "en_ejecucion"].includes(row.estado)) {
    etapa = "ventas"
  } else if (["prospecto", "en_negociacion", "propuesta_enviada"].includes(row.estado)) {
    etapa = "pipeline"
  }

  // Calcular presupuestos dinámicos de cotizaciones
  const quotes = row.cotizaciones || []
  const montoTotal = quotes.reduce((sum: number, q: any) => sum + Number(q.total || 0), 0)
  const montoAprobado = quotes.filter((q: any) => q.estado === "aprobada")
    .reduce((sum: number, q: any) => sum + Number(q.total || 0), 0)

  // Extraer datos del contacto
  const contacto = row.contactos || null

  return {
    id: row.id,
    nombre: row.nombre,
    cliente: row.clientes?.nombre || "Cliente Desconocido",
    empresa: row.clientes?.empresa || "",
    responsable: row.clientes?.nombre || "",
    clienteId: row.cliente_id,
    cotizaciones: quotes.length,
    estado: row.estado as Project["estado"],
    etapa,
    fechaInicio: row.fecha_inicio || "",
    fechaFin: row.fecha_fin || "",
    fechaCreacion: row.created_at,
    presupuesto: row.presupuesto || 0,
    montoTotal: montoTotal > 0 ? montoTotal : (row.presupuesto || 0),
    montoAprobado,
    montoFinal: row.monto_final || montoAprobado,
    progreso: row.progreso,
    motivoPerdida: row.motivo_perdida as Project["motivoPerdida"],
    descripcion: row.descripcion || "",
    ubicacion: row.ubicacion || row.direccion || "",
    // Datos del contacto
    contactoNombre: contacto?.nombre,
    contactoCargo: contacto?.cargo,
    contactoEmail: contacto?.email,
    contactoTelefono: contacto?.telefono,
    contactoPrincipalId: row.contacto_principal_id,
    ruc: row.clientes?.ruc || "",
  }
}

interface ProyectosModuleProps {
  user: User
}

// Default items per page if not in localStorage
const DEFAULT_ITEMS_PER_PAGE = 10

export function ProyectosModule({ user }: ProyectosModuleProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [isQuoteDialogOpen, setIsQuoteDialogOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window !== 'undefined') {
      return (localStorage.getItem('proyectosViewMode') as "grid" | "list") || "grid"
    }
    return "grid"
  })

  useEffect(() => {
    localStorage.setItem('proyectosViewMode', viewMode)
  }, [viewMode])
  const [estadoFilter, setEstadoFilter] = useState<string>("todos")
  const [clienteFilter, setClienteFilter] = useState<string>("todos")
  const [currentPage, setCurrentPage] = useState(1)
  const [projects, setProjects] = useState<Project[]>(initialProjects)
  const [editingProgressId, setEditingProgressId] = useState<string | null>(null)
  const [itemsPerPage, setItemsPerPage] = useState<number>(() => {
    if (typeof window !== "undefined") {
      return Number(localStorage.getItem("proyectosItemsPerPage")) || DEFAULT_ITEMS_PER_PAGE
    }
    return DEFAULT_ITEMS_PER_PAGE
  })

  useEffect(() => {
    localStorage.setItem("proyectosItemsPerPage", itemsPerPage.toString())
  }, [itemsPerPage])

  const [isGrouped, setIsGrouped] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("proyectosGrouped") === "true"
    }
    return false
  })

  useEffect(() => {
    localStorage.setItem("proyectosGrouped", isGrouped.toString())
  }, [isGrouped])

  const [loading, setLoading] = useState(false)
  // const { toast } = useToast() // Replaced by Sonner

  const fetchProjects = useCallback(async () => {
    setLoading(true)
    try {
      const { data, error } = await supabase
        .from("proyectos")
        .select(`
          *,
          clientes (nombre, empresa, ruc),
          cotizaciones (total, estado),
          contactos!proyectos_contacto_principal_id_fkey (nombre, cargo, email, telefono)
        `)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })

      if (error) throw error
      setProjects((data || []).map(mapDbProjectToUi))
    } catch (err: any) {
      toast.error("Error al cargar proyectos", {
        description: err.message,
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchProjects()
  }, [fetchProjects])
  const [tempProgress, setTempProgress] = useState<number>(0)
  const [activeTab, setActiveTab] = useState<Project["etapa"] | "todos">("pipeline")

  const [isViewDialogOpen, setIsViewDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false)
  const [deleteConfirmStep, setDeleteConfirmStep] = useState(1)
  const [deleteConfirmText, setDeleteConfirmText] = useState("")
  const [editForm, setEditForm] = useState<Partial<Project>>({})
  const [breakdownType, setBreakdownType] = useState<"pipeline" | "ventas" | "perdidas" | null>(null)

  // Historial de Cotizaciones
  const [isHistoryDialogOpen, setIsHistoryDialogOpen] = useState(false)
  const [projectQuotes, setProjectQuotes] = useState<any[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const fetchProjectQuotes = async (projectId: string) => {
    setLoadingHistory(true)
    try {
      const { data, error } = await supabase
        .from("cotizaciones")
        .select("*")
        .eq("proyecto_id", projectId) // Ajustar según nombre real de la columna si es diferente
        .eq("visibilidad", "visible")
        .order("created_at", { ascending: false })

      if (error) {
        // Reintento con filtro por texto si proyecto_id no existe o falla (fallback dinámico)
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("cotizaciones")
          .select("*")
          .eq("proyecto", selectedProject?.nombre)
          .eq("visibilidad", "visible")
          .order("created_at", { ascending: false })

        if (fallbackError) throw fallbackError
        setProjectQuotes(fallbackData || [])
      } else {
        setProjectQuotes(data || [])
      }
    } catch (err: any) {
      console.error("Error fetching quotes:", err)
      toast.error("Error", {
        description: "No se pudo cargar el historial de cotizaciones",
      })
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleOpenHistory = (project: Project) => {
    setSelectedProject(project)
    setIsHistoryDialogOpen(true)
    fetchProjectQuotes(project.id)
  }

  const handleDownloadQuote = async (quote: any) => {
    if (!quote.object_key) return
    try {
      const { data, error } = await supabase.storage
        .from("cotizaciones")
        .download(quote.object_key)
      if (error) throw error
      const url = window.URL.createObjectURL(data)
      const link = document.createElement("a")
      link.href = url
      link.setAttribute("download", `COT-${quote.numero}-${quote.year}.xlsx`)
      document.body.appendChild(link)
      link.click()
      link.remove()
    } catch (err: any) {
      toast.error("Error al descargar", { description: err.message })
    }
  }

  const clientesConRuc = useMemo(() => {
    const unique = new Map<string, string>()
    projects.forEach(p => {
      if (p.empresa) {
        unique.set(p.empresa, p.ruc || "")
      }
    })
    return Array.from(unique.entries()).map(([nombre, ruc]) => ({ nombre, ruc }))
  }, [projects])

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesTab = project.etapa === activeTab
      const matchesSearch =
        project.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.cliente.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (project.ruc && project.ruc.toLowerCase().includes(searchQuery.toLowerCase()))
      const matchesEstado = estadoFilter === "todos" || project.estado === estadoFilter
      const matchesCliente = clienteFilter === "todos" || project.empresa === clienteFilter
      return matchesTab && matchesSearch && matchesEstado && matchesCliente
    })
  }, [projects, activeTab, searchQuery, estadoFilter, clienteFilter])

  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage)
  const paginatedProjects = filteredProjects.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const metrics = useMemo(() => {
    const pipeline = projects.filter((p) => p.etapa === "pipeline")
    const ventas = projects.filter((p) => p.etapa === "ventas")
    const perdidas = projects.filter((p) => p.etapa === "perdidas")
    const archivados = projects.filter((p) => p.etapa === "archivados")
    const vArchivadas = projects.filter((p) => p.etapa === "ventas_archivadas")

    const pipelineValue = pipeline.reduce((sum, p) => sum + p.montoTotal, 0)
    const ventasValue = ventas.reduce((sum, p) => sum + p.montoAprobado, 0)
    const perdidasValue = perdidas.reduce((sum, p) => sum + p.montoTotal, 0)
    const vArchivadasValue = vArchivadas.reduce((sum: number, p: Project) => sum + p.montoAprobado, 0)

    const totalCerrados = ventas.length + perdidas.length + vArchivadas.length
    const tasaConversion = totalCerrados > 0 ? (((ventas.length + vArchivadas.length) / totalCerrados) * 100).toFixed(1) : "0"

    return {
      pipeline: { count: pipeline.length, value: pipelineValue },
      ventas: { count: ventas.length, value: ventasValue },
      perdidas: { count: perdidas.length, value: perdidasValue },
      archivados: { count: archivados.length },
      ventasArchivadas: { count: vArchivadas.length, value: vArchivadasValue },
      tasaConversion,
    }
  }, [projects])

  const startEditingProgress = (projectId: string, currentProgress: number) => {
    setEditingProgressId(projectId)
    setTempProgress(currentProgress)
  }

  const saveProgress = async (projectId: string) => {
    const newStatus = tempProgress === 100 ? "completado" : projects.find(p => p.id === projectId)?.estado === "completado" ? "en_ejecucion" : undefined;

    try {
      const updateData: any = { progreso: tempProgress };
      if (newStatus) {
        updateData.estado = newStatus;
        if (newStatus === "completado") updateData.etapa = "ventas_archivadas";
        else if (newStatus === "en_ejecucion") updateData.etapa = "ventas";
      }

      const { error } = await supabase
        .from("proyectos")
        .update(updateData)
        .eq("id", projectId);

      if (error) throw error;

      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? {
              ...p,
              progreso: tempProgress,
              estado: newStatus || p.estado,
              etapa: updateData.etapa || p.etapa,
            }
            : p,
        ),
      );

      toast.success("Progreso actualizado", {
        description: `El progreso se ha guardado correctamente (${tempProgress}%).`,
      });

      // Log action
      logAction({
        user_id: user.id,
        user_name: user.name,
        action: `Actualizó progreso: ${tempProgress}%`,
        module: "PROYECTOS",
        details: { project_id: projectId, project_name: projects.find(p => p.id === projectId)?.nombre }
      })
    } catch (err: any) {
      toast.error("Error", {
        description: err.message || "No se pudo actualizar el progreso.",
      });
    } finally {
      setEditingProgressId(null);
    }
  }

  const cancelEditingProgress = () => {
    setEditingProgressId(null)
    setTempProgress(0)
  }

  const handleCloseProject = async (
    projectId: string,
    resultado: "venta_ganada" | "venta_perdida" | "archivado",
    montoFinal?: number,
    motivoPerdida?: Project["motivoPerdida"],
    notasCierre?: string,
  ) => {
    const targetProject = projects.find(p => p.id === projectId);
    if (!targetProject) return;

    const newEtapa = resultado === "venta_ganada" ? "ventas" : resultado === "venta_perdida" ? "perdidas" : "archivados";
    const finalAmount = montoFinal || targetProject.presupuesto;
    const finalProgreso = resultado === "venta_ganada" ? 0 : targetProject.progreso;
    const cierreDate = new Date().toISOString().split("T")[0];

    try {
      const { error } = await supabase
        .from("proyectos")
        .update({
          estado: resultado,
          etapa: newEtapa,
          fecha_fin: cierreDate,
          presupuesto: finalAmount, // We use presupuesto as the final amount storage in DB for simplicity if monto_final doesn't exist, but checking mapDbProjectToUi...
          motivo_perdida: motivoPerdida,
          notas_cierre: notasCierre,
          progreso: finalProgreso
        })
        .eq("id", projectId);

      if (error) throw error;

      setProjects((prev) =>
        prev.map((p) =>
          p.id === projectId
            ? {
              ...p,
              estado: resultado,
              etapa: newEtapa,
              fechaFin: cierreDate,
              montoFinal: finalAmount,
              motivoPerdida,
              notasCierre,
              progreso: finalProgreso,
            }
            : p,
        ),
      );

      toast.success("Proyecto cerrado", {
        description: `El proyecto se ha marcado como ${resultado === "venta_ganada" ? "ganado" : resultado === "venta_perdida" ? "perdido" : "archivado"}.`,
      });

      // Log action
      logAction({
        user_id: user.id,
        user_name: user.name,
        action: `Cerró proyecto (${resultado}): ${targetProject.nombre}`,
        module: "PROYECTOS",
        details: { project_id: projectId }
      })
    } catch (err: any) {
      toast.error("Error", {
        description: err.message || "No se pudo cerrar el proyecto.",
      });
    } finally {
      setIsCloseDialogOpen(false);
      setSelectedProject(null);
    }
  }

  const startExecution = async (projectId: string) => {
    const { error } = await supabase
      .from("proyectos")
      .update({ estado: "en_ejecucion", etapa: "ventas" })
      .eq("id", projectId)

    if (error) {
      toast.error("Error", {
        description: "No se pudo iniciar la ejecución del proyecto",
      })
      return
    }

    setProjects((prev) =>
      prev.map((p) => (p.id === projectId && p.estado === "venta_ganada" ? { ...p, estado: "en_ejecucion", etapa: "ventas" } : p)),
    )

    toast.success("Proyecto iniciado", {
      description: "El proyecto ahora está en ejecución",
    })

    // Log action
    logAction({
      user_id: user.id,
      user_name: user.name,
      action: `Inició ejecución: ${projects.find(p => p.id === projectId)?.nombre || 'Proyecto'}`,
      module: "PROYECTOS",
      details: { project_id: projectId }
    })

  }

  const changeProjectStatus = async (projectId: string, newStatus: Project["estado"]) => {
    // 1. Determine the new etapa based on status
    let newEtapa: Project["etapa"] = "pipeline"
    if (["prospecto", "en_negociacion", "propuesta_enviada"].includes(newStatus)) {
      newEtapa = "pipeline"
    } else if (["venta_ganada", "en_ejecucion"].includes(newStatus)) {
      newEtapa = "ventas"
    } else if (newStatus === "completado") {
      newEtapa = "ventas_archivadas"
    } else if (newStatus === "venta_perdida") {
      newEtapa = "perdidas"
    } else if (newStatus === "archivado") {
      newEtapa = "archivados"
    }

    // 2. Update in Supabase
    const { error } = await supabase
      .from("proyectos")
      .update({ estado: newStatus, etapa: newEtapa })
      .eq("id", projectId)

    if (error) {
      toast.error("Error", {
        description: "No se pudo cambiar el estado del proyecto",
      })
      return
    }

    // 3. Update local state only after DB success
    setProjects((prev) =>
      prev.map((p) => p.id === projectId ? { ...p, estado: newStatus, etapa: newEtapa } : p)
    )

    toast.success("Estado actualizado", {
      description: `El proyecto cambió a "${getEstadoLabel(newStatus)}"`,
    })

    // Log action
    logAction({
      user_id: user.id,
      user_name: user.name,
      action: `Cambió estado: ${getEstadoLabel(newStatus)}`,
      module: "PROYECTOS",
      details: { project_id: projectId, status: newStatus }
    })


  }

  const openViewDialog = (project: Project) => {
    setSelectedProject(project)
    setIsViewDialogOpen(true)
  }

  const openEditDialog = (project: Project) => {
    setSelectedProject(project)
    setEditForm({ ...project })
    setIsEditDialogOpen(true)
  }

  const handleEditSave = async () => {
    if (selectedProject && editForm) {
      setLoading(true)
      try {
        const newStatus = editForm.estado || selectedProject.estado
        let newEtapa = selectedProject.etapa
        if (newStatus === "archivado") newEtapa = "archivados"
        else if (newStatus === "venta_ganada" || newStatus === "en_ejecucion") newEtapa = "ventas"
        else if (newStatus === "venta_perdida") newEtapa = "perdidas"
        else if (newStatus === "completado") newEtapa = "ventas_archivadas"
        else if (["prospecto", "en_negociacion", "propuesta_enviada"].includes(newStatus)) newEtapa = "pipeline"

        const { data: updatedProject, error } = await supabase
          .from("proyectos")
          .update({
            nombre: editForm.nombre,
            descripcion: editForm.descripcion,
            ubicacion: editForm.ubicacion,
            fecha_inicio: editForm.fechaInicio || null,
            fecha_fin: editForm.fechaFin || null,
            estado: newStatus,
            etapa: newEtapa,
            presupuesto: editForm.presupuesto || 0,
            contacto_principal_id: editForm.contactoPrincipalId || null,
          })
          .eq("id", selectedProject.id)
          .select(`
            *,
            clientes (nombre, empresa, ruc),
            cotizaciones (total, estado),
            contactos!proyectos_contacto_principal_id_fkey (nombre, cargo, email, telefono)
          `)
          .single()

        if (error) throw error

        if (updatedProject) {
          const mappedProject = mapDbProjectToUi(updatedProject)
          setProjects((prev) =>
            prev.map((p) => p.id === selectedProject.id ? mappedProject : p)
          )
        }

        toast.success("Proyecto actualizado", {
          description: "Los cambios se han guardado correctamente.",
        })

        // Log action
        logAction({
          user_id: user.id,
          user_name: user.name,
          action: `Editó proyecto: ${selectedProject.nombre}`,
          module: "PROYECTOS",
          details: { project_id: selectedProject.id }
        })

        void fetchProjects() // Refresh list in background
        setIsEditDialogOpen(false)
        setSelectedProject(null)
        setEditForm({})
      } catch (err: any) {
        toast.error("Error", {
          description: err.message || "No se pudo actualizar el proyecto.",
        })
      } finally {
        setLoading(false)
      }
    }
  }

  const openDeleteDialog = (project: Project) => {
    setSelectedProject(project)
    setDeleteConfirmStep(1)
    setDeleteConfirmText("")
    setIsDeleteDialogOpen(true)
  }

  const handleDeleteConfirm = async () => {
    if (deleteConfirmStep === 1) {
      setDeleteConfirmStep(2)
    } else if (deleteConfirmStep === 2 && deleteConfirmText === selectedProject?.nombre) {
      // Soft delete - set deleted_at timestamp
      try {
        // Use server action for secure deletion
        const result = await deleteProjectAction(selectedProject.id)

        if (result.error) {
          throw new Error(result.error)
        }

        setProjects((prev) => prev.filter((p) => p.id !== selectedProject?.id))
        toast.success("✅ Proyecto eliminado", {
          description: "El proyecto ha sido eliminado del dashboard correctamente."
        })

        // Log action
        logAction({
          user_id: user.id,
          user_name: user.name,
          action: `Eliminó proyecto: ${selectedProject?.nombre}`,
          module: "PROYECTOS",
          details: { project_id: selectedProject?.id }
        })
      } catch (err: any) {
        toast.error("Error", { description: err.message })
      }
      setIsDeleteDialogOpen(false)
      setSelectedProject(null)
      setDeleteConfirmStep(1)
      setDeleteConfirmText("")
    }
  }

  const getEstadoBadgeClass = (estado: string) => {
    switch (estado) {
      case "prospecto":
        return "bg-slate-500/20 text-slate-400"
      case "en_negociacion":
        return "bg-blue-500/20 text-blue-400"
      case "propuesta_enviada":
        return "bg-cyan-500/20 text-cyan-400"
      case "venta_ganada":
        return "bg-emerald-500/20 text-emerald-400"
      case "venta_perdida":
        return "bg-red-500/20 text-red-400"
      case "en_ejecucion":
        return "bg-amber-500/20 text-amber-400"
      case "completado":
        return "bg-green-500/20 text-green-400"
      case "archivado":
        return "bg-gray-500/20 text-gray-400"
      default:
        return "bg-muted text-muted-foreground"
    }
  }

  const getAvailableStatusTransitions = (currentStatus: string) => {
    const all = [
      { value: "prospecto", label: "Prospecto" },
      { value: "en_negociacion", label: "En Negociación" },
      { value: "propuesta_enviada", label: "Propuesta Enviada" },
      { value: "venta_ganada", label: "Venta Ganada" },
      { value: "en_ejecucion", label: "En Ejecución" },
      { value: "completado", label: "Completado" },
      { value: "venta_perdida", label: "Venta Perdida" },
      { value: "archivado", label: "Archivado" },
    ]
    return all.filter((s) => s.value !== currentStatus)
  }

  const getEstadoLabel = (estado: string) => {
    const labels: Record<string, string> = {
      prospecto: "Prospecto",
      en_negociacion: "En Negociación",
      propuesta_enviada: "Propuesta Enviada",
      venta_ganada: "Venta Ganada",
      venta_perdida: "Venta Perdida",
      en_ejecucion: "En Ejecución",
      completado: "Completado",
      archivado: "Archivado",
    }
    return labels[estado] || estado
  }

  const getMotivoLabel = (motivo?: string) => {
    const labels: Record<string, string> = {
      competencia: "Eligió competencia",
      precio: "Precio muy alto",
      timing: "Mal timing",
      sin_respuesta: "Sin respuesta",
      cancelado_cliente: "Cancelado por cliente",
      otro: "Otro motivo",
    }
    return motivo ? labels[motivo] || motivo : ""
  }

  const getProgressColor = (progreso: number) => {
    if (progreso >= 75) return "text-green-500"
    if (progreso >= 50) return "text-blue-500"
    if (progreso >= 25) return "text-yellow-500"
    return "text-red-500"
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(amount)
  }

  const formatDate = (date: string | null | undefined) => {
    if (!date || date === "" || isNaN(new Date(date).getTime())) return "Por definir"
    return new Date(date).toLocaleDateString("es-PE", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  const getEstadosForTab = () => {
    switch (activeTab) {
      case "pipeline":
        return [
          { value: "prospecto", label: "Prospecto" },
          { value: "en_negociacion", label: "En Negociación" },
          { value: "propuesta_enviada", label: "Propuesta Enviada" },
        ]
      case "ventas":
        return [
          { value: "venta_ganada", label: "Venta Ganada" },
          { value: "en_ejecucion", label: "En Ejecución" },
          { value: "completado", label: "Completado" },
        ]
      case "perdidas":
        return [{ value: "venta_perdida", label: "Venta Perdida" }]
      case "archivados":
        return [{ value: "archivado", label: "Archivado" }]
      case "ventas_archivadas":
        return [
          { value: "completado", label: "Venta Archivada" },
          { value: "venta_ganada", label: "Venta Ganada" }
        ]
      default:
        return []
    }
  }

  const canCloseProject = (project: Project) => {
    return project.etapa === "pipeline"
  }

  const renderProjectCard = (project: Project) => (
    <Card
      key={project.id}
      className="bg-card border-border hover:border-primary/50 transition-colors cursor-pointer group h-full flex flex-col"
      onClick={() => openViewDialog(project)}
    >
      <CardHeader className="pb-3 px-4 pt-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold leading-tight group-hover:text-primary transition-colors line-clamp-3">
              {project.nombre}
            </h3>
            <div className="flex items-start gap-1.5 text-sm text-foreground/80 mt-1.5 min-w-0">
              <Building className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground mt-0.5" />
              <div className="flex-1 min-w-0 flex flex-col">
                <span className="line-clamp-2 leading-tight font-medium uppercase text-[11px] text-muted-foreground/90">
                  {project.empresa || "Empresa no definida"}
                </span>
                {project.ruc && (
                  <span className="text-[10px] text-muted-foreground/70 font-mono mt-0.5">
                    {project.ruc}
                  </span>
                )}
              </div>
            </div>
          </div>
          <Badge className={`${getEstadoBadgeClass(project.estado)} whitespace-nowrap`}>
            {getEstadoLabel(project.estado)}
          </Badge>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 -mr-2 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  openViewDialog(project)
                }}
              >
                <Eye className="h-4 w-4 mr-2" />
                Ver detalles
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  openEditDialog(project)
                }}
              >
                <Pencil className="h-4 w-4 mr-2" />
                Editar
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <ArrowRight className="h-4 w-4 mr-2" />
                  Cambiar estado
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  {getAvailableStatusTransitions(project.estado).map((status) => (
                    <DropdownMenuItem
                      key={status.value}
                      onClick={(e) => {
                        e.stopPropagation()
                        changeProjectStatus(project.id, status.value as Project["estado"])
                      }}
                    >
                      <span
                        className={`w-2 h-2 rounded-full mr-2 ${getEstadoBadgeClass(status.value).split(" ")[0]}`}
                      />
                      {status.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  openDeleteDialog(project)
                }}
                className="text-red-400 focus:text-red-400"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-4 flex-1 flex flex-col">
        {/* Contact Zone */}
        <div className="bg-secondary/30 rounded-lg p-3 space-y-1.5 border border-border/50">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 text-primary font-bold text-xs">
              {project.contactoNombre ? project.contactoNombre.charAt(0) : <Users className="h-4 w-4" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">
                {project.contactoNombre || "Sin contacto"}
              </p>
              {project.contactoCargo && (
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium truncate">
                  {project.contactoCargo}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Meta info */}
        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 flex-shrink-0 text-primary/60" />
            <span className="truncate">{project.ubicacion || "Ubicación por definir"}</span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4 flex-shrink-0 text-orange-400/70" />
              <span>{formatDate(project.fechaInicio)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm font-medium">
              <FileText className="h-4 w-4 text-blue-400/70" />
              <span>{project.cotizaciones}</span>
            </div>
          </div>
        </div>

        <div className="flex-1" />

        {/* Progress for execution */}
        {project.etapa === "ventas" && (project.estado === "en_ejecucion" || project.estado === "completado") && (
          <div className="space-y-2 pt-1">
            <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-tight text-muted-foreground">
              <span>Progreso Real</span>
              {editingProgressId === project.id ? (
                <div className="flex items-center gap-2">
                  <span className={`${getProgressColor(tempProgress)}`}>{tempProgress}%</span>
                  <Button size="icon" variant="ghost" className="h-5 w-5 text-green-500" onClick={(e) => { e.stopPropagation(); saveProgress(project.id) }}>
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-5 w-5 text-red-500" onClick={(e) => { e.stopPropagation(); cancelEditingProgress() }}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
                  <span className={`${getProgressColor(project.progreso)}`}>{project.progreso}%</span>
                  <Button size="icon" variant="ghost" className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); startEditingProgress(project.id, project.progreso) }}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
            {editingProgressId === project.id ? (
              <Slider value={[tempProgress]} onValueChange={(v) => setTempProgress(v[0])} max={100} step={5} className="py-1" onClick={(e) => e.stopPropagation()} />
            ) : (
              <Progress value={project.progreso} className="h-1.5" />
            )}
          </div>
        )}

        {/* Financials highlight */}
        <div className="pt-3 border-t border-border/50 flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">Presupuesto</span>
            <span className="text-sm font-semibold">{formatCurrency(project.montoTotal)}</span>
          </div>
          <div className="flex flex-col items-end text-right">
            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight text-emerald-500/80">Aprobado</span>
            <span className="text-sm font-bold text-emerald-500">{formatCurrency(project.montoAprobado)}</span>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-xs text-primary border-primary/30 hover:bg-primary/10 bg-transparent"
            onClick={(e) => {
              e.stopPropagation()
              setSelectedProject(project)
              setIsQuoteDialogOpen(true)
            }}
          >
            <FileText className="h-3.5 w-3.5 mr-1" />
            Cotización
          </Button>
          {canCloseProject(project) && (
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 bg-transparent"
              onClick={(e) => {
                e.stopPropagation()
                setSelectedProject(project)
                setIsCloseDialogOpen(true)
              }}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
              Cerrar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Proyectos</h1>
          <p className="text-muted-foreground">Gestiona el ciclo de ventas completo</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => { fetchProjects() }} title="Recargar lista">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Button onClick={() => setIsDialogOpen(true)} className="bg-primary hover:bg-primary/90">
            <Plus className="h-4 w-4 mr-2" />
            Nuevo Proyecto
          </Button>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card
          className={`bg-card border-border cursor-pointer transition-all hover:shadow-lg active:scale-[0.98] group ${activeTab === 'pipeline' ? 'ring-2 ring-blue-500' : ''}`}
          onClick={() => {
            setBreakdownType("pipeline")
            setActiveTab("pipeline")
          }}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pipeline</p>
                <p className="text-2xl font-bold">{metrics.pipeline.count}</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(metrics.pipeline.value)}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center group-hover:bg-blue-500/30 transition-colors">
                <Clock className="h-5 w-5 text-blue-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`bg-card border-border cursor-pointer transition-all hover:shadow-lg active:scale-[0.98] group ${activeTab === 'ventas' ? 'ring-2 ring-emerald-500' : ''}`}
          onClick={() => {
            setBreakdownType("ventas")
            setActiveTab("ventas")
          }}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Ventas</p>
                <p className="text-2xl font-bold text-emerald-400">{metrics.ventas.count}</p>
                <p className="text-xs text-emerald-400">{formatCurrency(metrics.ventas.value)}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-emerald-500/20 flex items-center justify-center group-hover:bg-emerald-500/30 transition-colors">
                <TrendingUp className="h-5 w-5 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card
          className={`bg-card border-border cursor-pointer transition-all hover:shadow-lg active:scale-[0.98] group ${activeTab === 'perdidas' ? 'ring-2 ring-red-500' : ''}`}
          onClick={() => {
            setBreakdownType("perdidas")
            setActiveTab("perdidas")
          }}
        >
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Perdidas</p>
                <p className="text-2xl font-bold text-red-400">{metrics.perdidas.count}</p>
                <p className="text-xs text-red-400">{formatCurrency(metrics.perdidas.value)}</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-red-500/20 flex items-center justify-center group-hover:bg-red-500/30 transition-colors">
                <TrendingDown className="h-5 w-5 text-red-400" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tasa Conversión</p>
                <p className="text-2xl font-bold text-primary">{metrics.tasaConversion}%</p>
                <p className="text-xs text-muted-foreground">{metrics.ventasArchivadas.count} ventas archivadas</p>
              </div>
              <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v as typeof activeTab)
          setCurrentPage(1)
          setEstadoFilter("todos")
        }}
      >
        <TabsList className="grid w-full grid-cols-5 bg-secondary/50">
          <TabsTrigger
            value="pipeline"
            className="data-[state=active]:bg-blue-500/20 data-[state=active]:text-blue-400"
          >
            <Clock className="h-4 w-4 mr-2" />
            Pipeline ({metrics.pipeline.count})
          </TabsTrigger>
          <TabsTrigger
            value="ventas"
            className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400"
          >
            <TrendingUp className="h-4 w-4 mr-2" />
            Ventas ({metrics.ventas.count})
          </TabsTrigger>
          <TabsTrigger value="perdidas" className="data-[state=active]:bg-red-500/20 data-[state=active]:text-red-400">
            <XCircle className="h-4 w-4 mr-2" />
            Perdidas ({metrics.perdidas.count})
          </TabsTrigger>
          <TabsTrigger
            value="archivados"
            className="data-[state=active]:bg-gray-500/20 data-[state=active]:text-gray-400"
          >
            <Archive className="h-4 w-4 mr-2" />
            Archivados ({metrics.archivados.count})
          </TabsTrigger>
          <TabsTrigger
            value="ventas_archivadas"
            className="data-[state=active]:bg-emerald-500/20 data-[state=active]:text-emerald-400"
          >
            <CheckCircle2 className="h-4 w-4 mr-2" />
            Ventas Archivadas ({metrics.ventasArchivadas.count})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6 space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar proyectos..."
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
                <SelectTrigger className="w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los estados</SelectItem>
                  {getEstadosForTab().map((estado) => (
                    <SelectItem key={estado.value} value={estado.value}>
                      {estado.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={clienteFilter}
                onValueChange={(v) => {
                  setClienteFilter(v)
                  setCurrentPage(1)
                }}
              >
                <SelectTrigger className="w-44">
                  <Users className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Cliente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos los clientes</SelectItem>
                  {clientesConRuc.map((c) => (
                    <SelectItem key={c.nombre} value={c.nombre}>
                      {c.nombre} {c.ruc ? `(${c.ruc})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* View Toggle and Items Per Page */}
            <div className="flex items-center gap-3">
              <Button
                variant={isGrouped ? "default" : "outline"}
                size="sm"
                onClick={() => setIsGrouped(!isGrouped)}
                className="h-8 text-xs gap-2"
              >
                <FolderKanban className="h-3.5 w-3.5" />
                {isGrouped ? "Desagrupar" : "Agrupar por Empresa"}
              </Button>
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
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === "grid" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("grid")}
                  className="h-8 w-8 p-0"
                >
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "secondary" : "ghost"}
                  size="sm"
                  onClick={() => setViewMode("list")}
                  className="h-8 w-8 p-0"
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* Projects Display */}
          {paginatedProjects.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="flex flex-col items-center justify-center py-16">
                <FolderKanban className="h-16 w-16 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium mb-1">No hay proyectos</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchQuery || estadoFilter !== "todos" || clienteFilter !== "todos"
                    ? "No se encontraron proyectos con ese criterio"
                    : `No hay proyectos en ${activeTab}`}
                </p>
              </CardContent>
            </Card>
          ) : isGrouped ? (
            <Accordion type="multiple" className="space-y-4">
              {Object.entries(
                paginatedProjects.reduce((acc, p) => {
                  const empresa = p.empresa || "Sin Empresa"
                  if (!acc[empresa]) acc[empresa] = []
                  acc[empresa].push(p)
                  return acc
                }, {} as Record<string, Project[]>)
              ).map(([empresa, items]) => (
                <AccordionItem key={empresa} value={empresa} className="border border-border/50 rounded-xl bg-card overflow-hidden px-0">
                  <AccordionTrigger className="hover:no-underline px-4 py-3 hover:bg-secondary/20 transition-colors">
                    <div className="flex items-center justify-between w-full pr-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Building className="h-5 w-5 text-primary" />
                        </div>
                        <div className="text-left min-w-0 flex-1">
                          <h4 className="font-bold text-base leading-tight line-clamp-1 group-hover:text-primary transition-colors">{empresa}</h4>
                          <div className="flex items-center gap-2 mt-0.5">
                            <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">{items.length} Proyecto{items.length !== 1 ? 's' : ''}</p>
                            <span className="text-[10px] text-muted-foreground/50">|</span>
                            {items[0]?.ruc && <span className="text-[10px] text-muted-foreground font-mono">RUC: {items[0].ruc}</span>}
                          </div>
                        </div>
                      </div>
                      <div className="hidden sm:flex flex-col items-end">
                        <span className="text-xs text-muted-foreground uppercase font-bold tracking-tight">Total Empresa</span>
                        <span className="text-sm font-bold text-primary">
                          {formatCurrency(items.reduce((sum, p) => sum + p.montoTotal, 0))}
                        </span>
                      </div>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-0">
                    <div className="border-t border-border/40 bg-secondary/5">
                      {viewMode === "grid" ? (
                        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {items.map((project) => renderProjectCard(project))}
                        </div>
                      ) : (
                        <div className="p-4 overflow-x-auto">
                          {/* Reuse table rendering logic or simplified list for accordion */}
                          <Table className="bg-transparent border-0">
                            <TableHeader>
                              <TableRow className="hover:bg-transparent border-border/40">
                                <TableHead className="py-2">Proyecto</TableHead>
                                <TableHead className="py-2">Cot.</TableHead>
                                <TableHead className="py-2">Monto</TableHead>
                                <TableHead className="py-2">Estado</TableHead>
                                <TableHead className="py-2 w-10"></TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {items.map((project) => (
                                <TableRow key={project.id} className="cursor-pointer hover:bg-secondary/20 border-border/40" onClick={() => openViewDialog(project)}>
                                  <TableCell className="py-2 font-medium">{project.nombre}</TableCell>
                                  <TableCell className="py-2">{project.cotizaciones}</TableCell>
                                  <TableCell className="py-2 font-semibold text-primary">{formatCurrency(project.montoTotal)}</TableCell>
                                  <TableCell className="py-2">
                                    <Badge className={`${getEstadoBadgeClass(project.estado)} text-[10px] py-0 h-5`}>
                                      {getEstadoLabel(project.estado)}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="py-2">
                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={(e) => { e.stopPropagation(); openViewDialog(project) }}>
                                      <Eye className="h-3 w-3" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paginatedProjects.map((project) => renderProjectCard(project))}
            </div>
          ) : (
            <Card className="bg-card border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Proyecto / Cliente</TableHead>
                    <TableHead>Cotizaciones</TableHead>
                    <TableHead>Monto</TableHead>
                    {activeTab === "ventas" && <TableHead className="w-[200px]">Progreso</TableHead>}
                    {activeTab === "perdidas" && <TableHead>Motivo</TableHead>}
                    <TableHead>Estado</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedProjects.map((project) => (
                    <TableRow
                      key={project.id}
                      className="cursor-pointer hover:bg-secondary/30"
                      onClick={() => openViewDialog(project)}
                    >
                      <TableCell className="max-w-[200px]">
                        <div className="flex flex-col">
                          <span className="font-bold text-sm truncate">{project.nombre}</span>
                          <span className="text-xs text-muted-foreground truncate">{project.empresa || project.cliente}</span>
                        </div>
                      </TableCell>
                      <TableCell>{project.cotizaciones}</TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="text-xs text-muted-foreground">T: {formatCurrency(project.montoTotal)}</span>
                          <span className="text-sm font-bold text-success">A: {formatCurrency(project.montoAprobado)}</span>
                        </div>
                      </TableCell>
                      {activeTab === "ventas" && (
                        <TableCell>
                          {project.estado === "en_ejecucion" || project.estado === "completado" ? (
                            editingProgressId === project.id ? (
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <Slider
                                  value={[tempProgress]}
                                  onValueChange={(value) => setTempProgress(value[0])}
                                  max={100}
                                  step={5}
                                  className="w-24"
                                />
                                <span className={`text-sm font-bold w-10 ${getProgressColor(tempProgress)}`}>
                                  {tempProgress}%
                                </span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-green-500 hover:text-green-400"
                                  onClick={() => saveProgress(project.id)}
                                >
                                  <Check className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 text-red-500 hover:text-red-400"
                                  onClick={cancelEditingProgress}
                                >
                                  <X className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 group/progress">
                                <Progress value={project.progreso} className="h-2 w-20" />
                                <span className={`text-sm w-10 ${getProgressColor(project.progreso)}`}>
                                  {project.progreso}%
                                </span>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-6 w-6 opacity-0 group-hover/progress:opacity-100 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    startEditingProgress(project.id, project.progreso)
                                  }}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            )
                          ) : (
                            <span className="text-muted-foreground text-sm">—</span>
                          )}
                        </TableCell>
                      )}
                      {activeTab === "perdidas" && (
                        <TableCell>
                          <span className="text-sm text-red-400">{getMotivoLabel(project.motivoPerdida)}</span>
                        </TableCell>
                      )}
                      <TableCell>
                        <span className={`text-xs px-2 py-1 rounded-full ${getEstadoBadgeClass(project.estado)}`}>
                          {getEstadoLabel(project.estado)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={(e: React.MouseEvent) => e.stopPropagation()}>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                openViewDialog(project)
                              }}
                            >
                              <Eye className="h-4 w-4 mr-2" />
                              Ver detalles
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                openEditDialog(project)
                              }}
                            >
                              <Pencil className="h-4 w-4 mr-2" />
                              Editar
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedProject(project)
                                setIsQuoteDialogOpen(true)
                              }}
                            >
                              <FileText className="h-4 w-4 mr-2" />
                              Generar Cotización
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuSub>
                              <DropdownMenuSubTrigger>
                                <ArrowRight className="h-4 w-4 mr-2" />
                                Cambiar estado
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent>
                                {getAvailableStatusTransitions(project.estado).map((status) => (
                                  <DropdownMenuItem
                                    key={status.value}
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      changeProjectStatus(project.id, status.value as Project["estado"])
                                    }}
                                  >
                                    <span
                                      className={`w-2 h-2 rounded-full mr-2 ${getEstadoBadgeClass(status.value).split(" ")[0]}`}
                                    />
                                    {status.label}
                                  </DropdownMenuItem>
                                ))}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={(e) => {
                                e.stopPropagation()
                                openDeleteDialog(project)
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
                  ))}
                </TableBody>
              </Table>
            </Card>
          )
          }

          {/* Pagination */}
          {filteredProjects.length > itemsPerPage && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t mt-4">
              <p className="text-sm text-muted-foreground">
                Mostrando {(currentPage - 1) * itemsPerPage + 1} -{" "}
                {Math.min(currentPage * itemsPerPage, filteredProjects.length)} de {filteredProjects.length} proyectos
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
        </TabsContent>
      </Tabs>

      <CreateProjectDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} onSuccess={fetchProjects} user={user} />

      {selectedProject && (
        <CloseProjectDialog
          open={isCloseDialogOpen}
          onOpenChange={setIsCloseDialogOpen}
          project={selectedProject}
          onClose={handleCloseProject}
        />
      )}

      <Dialog open={isViewDialogOpen} onOpenChange={setIsViewDialogOpen}>
        <DialogContent className="sm:max-w-[650px] w-[95vw] bg-card border-border p-0 overflow-hidden shadow-2xl h-[85vh] flex flex-col rounded-3xl">
          {selectedProject && (
            <>
              <DialogHeader className="sr-only">
                <DialogTitle>{selectedProject.nombre}</DialogTitle>
                <DialogDescription>Detalles y métricas del proyecto {selectedProject.nombre}</DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1 overflow-y-auto">
                {/* HEADER: Identidad */}
                <div className="p-6 border-b border-border/50 bg-slate-50/10">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0 border border-primary/20 shadow-sm">
                        <FolderKanban className="h-6 w-6 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Badge className={`${getEstadoBadgeClass(selectedProject.estado)} px-2 py-0 rounded-full text-[9px] uppercase font-bold tracking-wider`}>
                            {getEstadoLabel(selectedProject.estado)}
                          </Badge>
                          <span className="text-[9px] text-slate-400 font-mono tracking-tighter">ID: {selectedProject.id.slice(0, 8)}</span>
                        </div>
                        <h2 className="text-xl font-black leading-tight text-slate-900 mb-1 tracking-tight">
                          {selectedProject.nombre}
                        </h2>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                          <div className="flex items-center gap-1.5 text-xs">
                            <Building className="h-3.5 w-3.5 text-primary/70" />
                            <span className="font-bold text-slate-700 uppercase tracking-tight text-[10px]">
                              {selectedProject.empresa || "Sin Empresa"}
                            </span>
                            {selectedProject.ruc && <span className="text-[9px] text-slate-400 font-mono">({selectedProject.ruc})</span>}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs">
                            <Users className="h-3.5 w-3.5 text-orange-400" />
                            <span className="text-slate-600 font-medium text-[11px]">
                              {selectedProject.contactoNombre || "Sin contacto"}
                              {selectedProject.contactoCargo && <span className="ml-1 text-[9px] text-slate-400">({selectedProject.contactoCargo})</span>}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* BODY: Metrics Grid */}
                <div className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-0 rounded-2xl border border-slate-100 overflow-hidden shadow-sm">
                    {/* Presupuesto */}
                    <div className="p-4 bg-white flex flex-col justify-center border-b md:border-b-0 md:border-r border-slate-100 transition-colors hover:bg-slate-50/30">
                      <div className="flex items-center gap-2 text-slate-400 mb-1">
                        <DollarSign className="h-3 w-3" />
                        <span className="text-[9px] font-black uppercase tracking-[0.15em]">Presupuesto</span>
                      </div>
                      <p className="text-base font-black text-slate-900 tracking-tight">{formatCurrency(selectedProject.montoTotal)}</p>
                    </div>

                    {/* Fechas */}
                    <div className="p-4 bg-white border-b md:border-b-0 md:border-r border-slate-100 flex flex-col justify-center gap-2 transition-colors hover:bg-slate-50/30">
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Calendar className="h-3 w-3" />
                          <span className="text-[9px] font-black uppercase tracking-[0.15em]">Inicio</span>
                        </div>
                        <p className="text-xs font-bold text-slate-700">{formatDate(selectedProject.fechaInicio)}</p>
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2 text-slate-400">
                          <Clock className="h-3 w-3" />
                          <span className="text-[9px] font-black uppercase tracking-[0.15em]">Fin esperado</span>
                        </div>
                        <p className="text-xs font-bold text-slate-700">{formatDate(selectedProject.fechaFin)}</p>
                      </div>
                    </div>

                    {/* Ubicación */}
                    <div className="p-4 bg-white flex flex-col justify-center gap-1 transition-colors hover:bg-slate-50/30">
                      <div className="flex items-center gap-2 text-slate-400">
                        <MapPin className="h-3.5 w-3.5" />
                        <span className="text-[9px] font-black uppercase tracking-[0.15em]">Ubicación</span>
                      </div>
                      <p className="text-xs font-bold text-slate-800 leading-snug truncate">{selectedProject.ubicacion || "Sin ubicación"}</p>
                    </div>
                  </div>

                  {/* Sección de Progreso */}
                  {(selectedProject.estado === "en_ejecucion" || selectedProject.estado === "completado") && (
                    <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2.5">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary" />
                          <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Estado de Ejecución</h3>
                        </div>
                        <Badge variant="secondary" className="bg-white text-primary border-primary/20 font-bold px-3 py-0.5 rounded-lg text-xs">
                          {selectedProject.progreso}% completado
                        </Badge>
                      </div>
                      <Progress value={selectedProject.progreso} className="h-3" />
                      <p className="text-[10px] text-slate-400 text-center font-medium italic mt-2">Datos actualizados en tiempo real mediante Supabase</p>
                    </div>
                  )}

                  {/* Actionable: Cotizaciones */}
                  <div className="pt-2">
                    <div className="flex items-center justify-between mb-4">
                      <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Cotizaciones ({selectedProject.cotizaciones})
                      </h4>
                    </div>

                    {selectedProject.cotizaciones === 0 ? (
                      <Button
                        variant="outline"
                        className="w-full border-dashed border-2 py-8 h-auto flex flex-col gap-2 hover:bg-primary/5 hover:border-primary/50 transition-all hover:text-primary group rounded-2xl"
                        onClick={() => {
                          setIsViewDialogOpen(false)
                          setSelectedProject(selectedProject)
                          setIsQuoteDialogOpen(true)
                        }}
                      >
                        <Plus className="h-6 w-6 text-slate-300 group-hover:scale-110 transition-transform" />
                        <span className="font-semibold text-sm">Crear primera cotización</span>
                        <span className="text-[10px] text-slate-400">Vincular presupuesto oficial a este proyecto</span>
                      </Button>
                    ) : (
                      <div
                        className="flex items-center gap-3 bg-white border border-slate-100 p-4 rounded-2xl hover:bg-slate-50 transition-colors cursor-pointer group shadow-sm"
                        onClick={() => handleOpenHistory(selectedProject)}
                      >
                        <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm text-slate-900">Historial de cotizaciones</p>
                          <p className="text-[10px] text-slate-400 uppercase tracking-tighter">{selectedProject.cotizaciones} documentos generados</p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-300 group-hover:translate-x-1 transition-transform" />
                      </div>
                    )}
                  </div>
                </div>
              </ScrollArea>

              {/* DIALOG FOOTER */}
              <DialogFooter className="px-8 pt-4 pb-8 bg-white border-t border-slate-100 gap-4 shrink-0">
                <Button variant="ghost" className="h-10 px-6 text-xs font-semibold text-slate-400 hover:text-slate-800 rounded-xl" onClick={() => setIsViewDialogOpen(false)}>
                  Cerrar
                </Button>
                <div className="flex-1" />
                <Button
                  variant="outline"
                  className="h-10 px-6 text-xs font-bold border-slate-200 text-slate-700 hover:bg-slate-50 rounded-xl"
                  onClick={() => {
                    setIsViewDialogOpen(false)
                    openEditDialog(selectedProject)
                  }}
                >
                  <Pencil className="h-3 w-3 mr-2 text-primary" />
                  Editar
                </Button>
                <Button className="h-10 px-10 font-bold bg-[#0089b3] hover:bg-[#007499] text-white rounded-xl shadow-[0_4px_12px_rgba(0,137,179,0.2)] transition-all active:scale-[0.98] text-xs" onClick={() => setIsViewDialogOpen(false)}>
                  Aceptar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[620px] w-[95vw] bg-card border-border p-0 overflow-hidden shadow-2xl h-[85vh] flex flex-col rounded-3xl">
          {selectedProject && (
            <>
              <DialogHeader className="p-6 border-b border-border/50 bg-slate-50/10 shrink-0">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1">
                    <DialogTitle className="text-lg font-bold tracking-tight text-slate-900 leading-tight">Editar Proyecto</DialogTitle>
                    <DialogDescription className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                      Modifica la configuración y el responsable del proyecto.
                    </DialogDescription>
                  </div>
                  <div className="flex flex-col gap-1 min-w-[150px]">
                    <Label className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Estado</Label>
                    <Select
                      value={editForm.estado || selectedProject.estado}
                      onValueChange={(v) => setEditForm({ ...editForm, estado: v as Project["estado"] })}
                    >
                      <SelectTrigger className="h-9 text-[10px] font-bold bg-white shadow-sm border-primary/20 rounded-xl focus:ring-primary/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border/40">
                        <SelectItem value="prospecto" className="text-xs">Prospecto</SelectItem>
                        <SelectItem value="en_negociacion" className="text-xs">En Negociación</SelectItem>
                        <SelectItem value="propuesta_enviada" className="text-xs">Propuesta Enviada</SelectItem>
                        <SelectItem value="venta_ganada" className="text-xs">Venta Ganada</SelectItem>
                        <SelectItem value="en_ejecucion" className="text-xs">En Ejecución</SelectItem>
                        <SelectItem value="venta_perdida" className="text-xs">Venta Perdida</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </DialogHeader>

              <ScrollArea className="flex-1 overflow-y-auto">
                <div className="p-6 space-y-8">
                  {/* BLOQUE 1: Contexto B2B */}
                  <div className="bg-[#f8fbff] rounded-[24px] p-5 border border-blue-100/50 shadow-sm relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-[0.02] group-hover:opacity-[0.04] transition-opacity">
                      <Building className="h-12 w-12 text-primary" />
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="bg-primary/10 p-2.5 rounded-xl">
                        <Building className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-[9px] font-black uppercase tracking-[0.15em] text-blue-500/60 leading-none mb-1.5">Empresa del Cliente</span>
                        <span className="font-bold text-slate-900 tracking-tight text-base leading-tight">{selectedProject.empresa}</span>
                      </div>
                      <Badge variant="outline" className="text-[9px] ml-auto font-mono py-0 h-5 px-2 rounded-lg bg-white border-blue-100/40 shadow-none">{selectedProject.ruc}</Badge>
                    </div>
                  </div>

                  {/* BLOQUE 2: Datos del Proyecto */}
                  <div className="space-y-5">
                    <div className="space-y-1.5">
                      <Label htmlFor="edit-nombre" className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Nombre del Proyecto</Label>
                      <Input
                        id="edit-nombre"
                        value={editForm.nombre || ""}
                        onChange={(e) => setEditForm({ ...editForm, nombre: e.target.value })}
                        className="h-10 font-bold text-xs text-slate-900 rounded-xl border-slate-200 focus:border-primary/40 bg-white"
                      />
                    </div>

                    <div className="w-full">
                      <ContactSelector
                        clienteId={selectedProject.clienteId}
                        value={editForm.contactoPrincipalId || null}
                        onValueChange={(val) => setEditForm(prev => ({ ...prev, contactoPrincipalId: val || undefined }))}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <Label className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Responsable / Etapa</Label>
                        <Select
                          value={editForm.estado}
                          onValueChange={(val) => setEditForm(prev => ({ ...prev, estado: val as Project["estado"] }))}
                        >
                          <SelectTrigger className="h-10 text-xs rounded-xl border-slate-200 bg-white shadow-none">
                            <SelectValue placeholder="Estado" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {getAvailableStatusTransitions(selectedProject.estado).concat({ value: selectedProject.estado, label: getEstadoLabel(selectedProject.estado) }).map(s => (
                              <SelectItem key={s.value} value={s.value} className="text-xs">{s.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label htmlFor="edit-presupuesto" className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 flex items-center gap-1.5">
                          <DollarSign className="h-2.5 w-2.5 text-primary" /> Presupuesto
                        </Label>
                        <Input
                          id="edit-presupuesto"
                          type="number"
                          value={editForm.presupuesto || 0}
                          onChange={(e) => setEditForm({ ...editForm, presupuesto: Number(e.target.value) })}
                          placeholder="0.00"
                          className="h-10 font-bold text-xs text-slate-900 rounded-xl border-slate-200 focus:border-primary/40 bg-white shadow-none"
                        />
                      </div>
                    </div>
                  </div>

                  {/* BLOQUE 3: Ubicación y Fechas */}
                  <div className="space-y-5">
                    <div className="space-y-1.5 text-slate-700 font-bold">
                      <Label htmlFor="edit-ubicacion" className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 flex items-center gap-1.5">
                        <MapPin className="h-2.5 w-2.5" /> Ubicación / Obra
                      </Label>
                      <Input
                        id="edit-ubicacion"
                        value={editForm.ubicacion || ""}
                        onChange={(e) => setEditForm({ ...editForm, ubicacion: e.target.value })}
                        placeholder="Dirección o nombre de la obra"
                        className="h-10 text-xs rounded-xl border-slate-200 bg-white shadow-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-5">
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-fechaInicio" className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Inicio</Label>
                        <Input
                          id="edit-fechaInicio"
                          type="date"
                          value={editForm.fechaInicio || ""}
                          onChange={(e) => setEditForm({ ...editForm, fechaInicio: e.target.value })}
                          className="h-10 text-xs rounded-xl border-slate-200 bg-white"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="edit-fechaFin" className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">Fin Estimado</Label>
                        <Input
                          id="edit-fechaFin"
                          type="date"
                          value={editForm.fechaFin || ""}
                          onChange={(e) => setEditForm({ ...editForm, fechaFin: e.target.value })}
                          className="h-10 text-xs rounded-xl border-slate-200 bg-white"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </ScrollArea>

              <DialogFooter className="px-8 pt-4 pb-8 bg-white border-t border-slate-100 gap-4 shrink-0">
                <Button
                  variant="ghost"
                  className="h-10 px-6 text-xs font-semibold text-slate-400 hover:text-slate-800 rounded-xl"
                  onClick={() => setIsEditDialogOpen(false)}
                >
                  Cerrar
                </Button>
                <div className="flex-1" />
                <Button
                  className="h-10 px-9 font-bold bg-[#0089b3] hover:bg-[#007499] text-white rounded-xl shadow-[0_4px_12px_rgba(0,137,179,0.2)] transition-all active:scale-[0.98] text-xs"
                  onClick={handleEditSave}
                  disabled={loading}
                >
                  {loading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                  Guardar Cambios
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[450px] bg-card border-border">
          <DialogHeader className="p-6 pb-2">
            <DialogTitle className="flex items-center gap-2 text-red-400">
              <AlertTriangle className="h-5 w-5" />
              Eliminar Proyecto
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Esta acción eliminará el proyecto y todos sus datos asociados.
            </DialogDescription>
          </DialogHeader>

          {deleteConfirmStep === 1 ? (
            <div className="space-y-4">
              <p className="text-muted-foreground">
                ¿Estás seguro de que deseas eliminar el proyecto{" "}
                <strong className="text-foreground">{selectedProject?.nombre}</strong>?
              </p>
              <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                <p className="text-sm text-red-400">Esta acción eliminará permanentemente:</p>
                <ul className="text-sm text-red-400/80 mt-2 space-y-1 list-disc list-inside">
                  <li>{selectedProject?.cotizaciones} cotizaciones vinculadas</li>
                  <li>Todo el historial de progreso</li>
                  <li>Notas y archivos asociados</li>
                </ul>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-muted-foreground">Para confirmar la eliminación, escribe el nombre del proyecto:</p>
              <div className="bg-secondary/50 rounded-lg p-3 text-center">
                <code className="text-primary font-mono">{selectedProject?.nombre}</code>
              </div>
              <Input
                placeholder="Escribe el nombre del proyecto"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                className="border-red-500/30 focus:border-red-500"
              />
            </div>
          )}

          <DialogFooter className="pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsDeleteDialogOpen(false)
                setDeleteConfirmStep(1)
                setDeleteConfirmText("")
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={deleteConfirmStep === 2 && deleteConfirmText !== selectedProject?.nombre}
            >
              {deleteConfirmStep === 1 ? "Continuar" : "Eliminar Definitivamente"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={breakdownType !== null} onOpenChange={(open) => !open && setBreakdownType(null)}>
        <DialogContent className="sm:max-w-2xl md:max-w-3xl w-[95vw] h-[85vh] bg-card border-border p-0 overflow-hidden flex flex-col rounded-2xl shadow-2xl">
          <DialogHeader className="p-4 sm:p-6 pb-2 shrink-0 border-b border-border">
            <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl font-bold">
              {breakdownType === "ventas" && <TrendingUp className="h-5 w-5 text-success shrink-0" />}
              {breakdownType === "pipeline" && <Clock className="h-5 w-5 text-blue-400 shrink-0" />}
              {breakdownType === "perdidas" && <TrendingDown className="h-5 w-5 text-red-400 shrink-0" />}
              {breakdownType === "ventas" ? "Ventas Ganadas" : breakdownType === "perdidas" ? "Venta Perdida" : "Pipeline"}
              <Badge variant="secondary" className="ml-2 text-xs">
                {projects.filter((p) => p.etapa === breakdownType).length} proyectos
              </Badge>
            </DialogTitle>
            <DialogDescription className="sr-only">
              Lista de proyectos en la etapa {breakdownType}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            <ScrollArea className="flex-1">
              <div className="overflow-x-auto">
                <Table className="w-full min-w-[500px]">
                  <TableHeader className="sticky top-0 bg-card z-10 shadow-sm">
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="font-semibold text-xs px-3 sm:px-4 w-[55%] min-w-[200px]">Proyecto</TableHead>
                      <TableHead className="font-semibold text-xs text-center w-[15%] min-w-[80px]">Cot.</TableHead>
                      <TableHead className="font-semibold text-xs text-right px-3 sm:px-4 w-[30%] min-w-[100px]">Monto</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {projects
                      .filter((p) => p.etapa === breakdownType)
                      .map((project) => (
                        <TableRow
                          key={project.id}
                          className="border-border hover:bg-secondary/50 transition-colors cursor-pointer group"
                          onClick={() => {
                            setBreakdownType(null)
                            openViewDialog(project)
                          }}
                        >
                          <TableCell className="py-2.5 px-3 sm:px-4">
                            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                              <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                <FolderKanban className="h-4 w-4 text-primary" />
                              </div>
                              <div className="flex flex-col min-w-0 flex-1 max-w-[280px] sm:max-w-[350px] md:max-w-[400px]">
                                <span className="font-semibold text-xs sm:text-sm group-hover:text-primary transition-colors line-clamp-2" title={project.nombre}>
                                  {project.nombre}
                                </span>
                                <span className="text-[10px] sm:text-xs text-muted-foreground truncate" title={project.cliente}>
                                  {project.cliente}
                                </span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-center py-2.5">
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-primary/5 text-primary border-primary/20">
                              {project.cotizaciones}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-bold text-xs sm:text-sm text-primary py-2.5 px-3 sm:px-4 whitespace-nowrap">
                            {formatCurrency(breakdownType === 'ventas' ? project.montoAprobado : project.montoTotal)}
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            </ScrollArea>
          </div>

          <div className="p-3 sm:p-4 border-t border-border shrink-0 space-y-3">
            <div className="bg-primary/5 p-3 sm:p-4 rounded-lg flex items-center justify-between border border-primary/10">
              <div className="flex flex-col">
                <span className="text-[10px] sm:text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Acumulado</span>
              </div>
              <span className="text-lg sm:text-xl font-bold text-primary">
                {formatCurrency(
                  projects
                    .filter((p) => p.etapa === breakdownType)
                    .reduce((sum, p) => sum + (breakdownType === 'ventas' ? p.montoAprobado : p.montoTotal), 0)
                )}
              </span>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={() => setBreakdownType(null)}>Cerrar</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      <CreateQuoteDialog
        open={isQuoteDialogOpen}
        onOpenChange={setIsQuoteDialogOpen}
        user={user}
        proyectoId={selectedProject?.id}
        clienteId={selectedProject?.clienteId}
        onSuccess={() => {
          fetchProjects()
          // Optionally refresh quotes in cotizadora if they were linked
        }}
      />
      <Dialog open={isHistoryDialogOpen} onOpenChange={setIsHistoryDialogOpen}>
        <DialogContent className="sm:max-w-xl md:max-w-2xl w-[95vw] bg-card border-border p-0 overflow-hidden rounded-2xl shadow-2xl flex flex-col max-h-[85vh]">
          <DialogHeader className="p-4 sm:p-6 border-b border-border/50 bg-slate-50/30 shrink-0">
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl sm:rounded-2xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <FileText className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="min-w-0 flex-1">
                <DialogTitle className="text-lg sm:text-xl font-bold">Historial de Cotizaciones</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground truncate" title={selectedProject?.nombre}>
                  {selectedProject?.nombre}
                </DialogDescription>
              </div>
              <Badge variant="secondary" className="shrink-0 text-xs">
                {projectQuotes.length} docs
              </Badge>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-[200px] max-h-[50vh]">
            <div className="p-4 sm:p-6 space-y-2 sm:space-y-3">
              {loadingHistory ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary/40" />
                  <p className="text-xs text-muted-foreground animate-pulse">Obteniendo documentos...</p>
                </div>
              ) : projectQuotes.length === 0 ? (
                <div className="text-center py-12 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
                  <FileText className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                  <p className="text-sm font-medium text-slate-400">No se encontraron cotizaciones</p>
                </div>
              ) : (
                projectQuotes.map((quote) => (
                  <div
                    key={quote.id}
                    className="flex items-center justify-between p-3 sm:p-4 bg-white border border-slate-100 rounded-xl sm:rounded-2xl hover:border-primary/20 hover:shadow-md transition-all group gap-3"
                  >
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-primary/5 transition-colors shrink-0">
                        <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400 group-hover:text-primary transition-colors" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-xs sm:text-sm text-slate-900 truncate">COT-{quote.numero}-{quote.year}</p>
                        <p className="text-[10px] text-slate-400 font-medium">{quote.fecha_emision || quote.created_at.split('T')[0]}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                      <div className="text-right">
                        <p className="text-xs sm:text-sm font-black text-slate-900 whitespace-nowrap">S/. {Number(quote.total || 0).toLocaleString('es-PE', { minimumFractionDigits: 2 })}</p>
                        <Badge variant="outline" className="text-[9px] h-4 font-bold uppercase tracking-wider py-0 px-1.5 border-slate-200 text-slate-400">
                          {quote.estado}
                        </Badge>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg sm:rounded-xl hover:bg-primary/10 hover:text-primary"
                        onClick={() => handleDownloadQuote(quote)}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>

          <DialogFooter className="p-4 bg-slate-50/50 border-t border-border/40 shrink-0">
            <Button
              className="w-full h-10 sm:h-11 font-bold rounded-xl sm:rounded-2xl bg-slate-900 hover:bg-slate-800 text-white shadow-lg transition-all active:scale-[0.98]"
              onClick={() => setIsHistoryDialogOpen(false)}
            >
              Cerrar Historial
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}