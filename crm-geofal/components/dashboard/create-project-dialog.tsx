"use client"

import { useCallback, useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { Loader2, Building, MapPin, DollarSign, Briefcase, Calendar, User as UserIcon, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Check, ChevronsUpDown } from "lucide-react"
import { toast } from "sonner"
import { supabase } from "@/lib/supabaseClient"
import { type User } from "@/hooks/use-auth"
import { logAction } from "@/app/actions/audit-actions"
import { ContactSelector } from "./contact-selector"
import { ScrollArea } from "@/components/ui/scroll-area"

interface CreateProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  user: User
}

interface ProjectFormData {
  nombre: string
  clienteId: string
  contactoId: string
  ubicacion?: string
  fechaInicio: string
  fechaFin: string
  presupuesto?: number
}

interface Cliente {
  id: string
  nombre: string
  empresa: string
  ruc: string
  proyectos_count?: number
  cotizaciones_pendientes?: number
  cotizaciones_aprobadas?: number
}

export function CreateProjectDialog({ open, onOpenChange, onSuccess, user }: CreateProjectDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [clienteSearch, setClienteSearch] = useState('')
  const [openClientePopover, setOpenClientePopover] = useState(false)
  const [selectedCliente, setSelectedCliente] = useState<string | null>(null)
  const [selectedContacto, setSelectedContacto] = useState<string | null>(null)
  // const { toast } = useToast() // Replaced by Sonner

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<ProjectFormData>()

  const fetchClientes = useCallback(async () => {
    const { data, error } = await supabase
      .from("clientes")
      .select("id, nombre, empresa, ruc, proyectos, cotizaciones")
      .is("deleted_at", null)
      .order("empresa", { ascending: true })

    if (!error && data) {
      setClientes(data.map(c => ({
        ...c,
        proyectos_count: c.proyectos || 0,
        cotizaciones_pendientes: c.cotizaciones || 0
      })))
    }
  }, [])

  // Filtrar clientes por búsqueda con múltiples palabras
  const clientesFiltrados = useCallback(() => {
    if (!clienteSearch || clienteSearch.length < 2) return clientes.slice(0, 50)

    const palabras = clienteSearch.toLowerCase().split(/\s+/).filter(p => p.length > 0)

    const filtrados = clientes.filter(c => {
      const textoCompleto = `${c.empresa} ${c.ruc} ${c.nombre}`.toLowerCase()
      return palabras.every(palabra => textoCompleto.includes(palabra))
    })

    return filtrados.slice(0, 50)
  }, [clientes, clienteSearch])

  useEffect(() => {
    if (open) {
      fetchClientes()
      setClienteSearch('')
      setSelectedCliente(null)
      setSelectedContacto(null)
      reset()
    }
  }, [open, fetchClientes, reset])

  const onSubmit = async (data: ProjectFormData) => {
    if (!user) {
      toast.error("Error", { description: "Usuario no autenticado" })
      return
    }
    if (!selectedCliente) {
      toast.error("Error", { description: "Selecciona una empresa" })
      return
    }
    if (!selectedContacto) {
      toast.error("Error", { description: "Selecciona un contacto para el proyecto" })
      return
    }

    setIsLoading(true)
    try {
      const { error } = await supabase.from("proyectos").insert({
        nombre: data.nombre,
        cliente_id: selectedCliente,
        contacto_principal_id: selectedContacto,
        vendedor_id: user.id,
        ubicacion: data.ubicacion,
        fecha_inicio: data.fechaInicio,
        fecha_fin: data.fechaFin,
        estado: "prospecto",
        etapa: "pipeline",
        progreso: 0,
        presupuesto: data.presupuesto || 0,
      })

      if (error) throw error

      const empresaSeleccionada = clientes.find((c) => c.id === selectedCliente)

      toast.success("✅ Proyecto creado", {
        description: `"${data.nombre}" para ${empresaSeleccionada?.empresa || "empresa"} se creó exitosamente.`,
      })

      logAction({
        user_id: user.id,
        user_name: user.name,
        action: `Creó proyecto: ${data.nombre}`,
        module: "PROYECTOS",
        details: { client_id: selectedCliente, contact_id: selectedContacto }
      })

      reset()
      setSelectedCliente(null)
      setSelectedContacto(null)
      onOpenChange(false)
      onSuccess?.()
    } catch (err: any) {
      toast.error("Error", {
        description: err.message || "No se pudo crear el proyecto.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-[550px] w-[95vw] bg-card border-border p-0 overflow-hidden shadow-2xl h-[85vh] flex flex-col rounded-3xl"
      >
        {/* HEADER */}
        <DialogHeader className="p-6 border-b border-border/50 bg-slate-50/10 shrink-0">
          <DialogTitle className="text-xl font-bold tracking-tight text-slate-900 leading-tight">
            Nuevo Proyecto
          </DialogTitle>
          <DialogDescription className="text-[10px] text-slate-400 mt-1 leading-tight">
            Vincula un nuevo proyecto a una empresa existente y asigna un responsable.
          </DialogDescription>
        </DialogHeader>

        {/* FORM CONTAINER */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-8">

              {/* Bloque 1: Identificación del Proyecto */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-1.5 border-b border-[#0089b3]/10">
                  <div className="h-5 w-5 rounded-md bg-[#0089b3]/10 flex items-center justify-center">
                    <Briefcase className="h-3 w-3 text-[#0089b3]" />
                  </div>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.1em] text-[#0089b3]">
                    Datos del Proyecto
                  </h4>
                </div>

                <div className="bg-[#f8fbff] p-4 rounded-2xl border border-blue-100/50 shadow-sm">
                  <div className="space-y-1.5">
                    <Label htmlFor="nombre" className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
                      Nombre del Proyecto / Obra
                    </Label>
                    <Input
                      id="nombre"
                      {...register("nombre", { required: "Campo obligatorio" })}
                      placeholder="Ej: Mantenimiento Preventivo Subestación"
                      className="h-10 text-xs font-semibold bg-white rounded-xl border-slate-200 focus:border-[#0089b3] shadow-none"
                    />
                    {errors.nombre && <p className="text-[9px] text-destructive font-bold">{errors.nombre.message}</p>}
                  </div>
                </div>
              </div>

              {/* Bloque 2: Vinculación B2B */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-1.5 border-b border-[#0089b3]/10">
                  <div className="h-5 w-5 rounded-md bg-blue-500/10 flex items-center justify-center">
                    <Building className="h-3 w-3 text-blue-500" />
                  </div>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.1em] text-blue-600">
                    Empresa y Representante
                  </h4>
                </div>

                <div className="bg-blue-50/20 p-4 rounded-2xl border border-blue-100/50 shadow-sm space-y-4">
                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
                      Empresa (Cliente Legal)
                    </Label>
                    <Popover open={openClientePopover} onOpenChange={setOpenClientePopover}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          role="combobox"
                          className="w-full h-10 justify-between text-xs font-semibold bg-white rounded-xl border-slate-200 shadow-none hover:bg-white"
                        >
                          {selectedCliente
                            ? clientes.find((c) => c.id === selectedCliente)?.empresa
                            : "Buscar empresa..."}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[500px] p-0 rounded-xl" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Buscar por nombre, RUC..."
                            value={clienteSearch}
                            onValueChange={setClienteSearch}
                            className="h-10 text-xs"
                          />
                          <CommandList>
                            <CommandEmpty className="py-6 text-center text-xs text-slate-500">
                              No se encontraron empresas.
                            </CommandEmpty>
                            <CommandGroup>
                              {clientesFiltrados().length >= 50 && clienteSearch.length >= 2 && (
                                <div className="px-2 py-2 bg-yellow-50 border-b border-yellow-200 text-[10px] text-yellow-800">
                                  Mostrando primeros 50 resultados. Escribe más palabras para filtrar mejor.
                                </div>
                              )}
                              {clientesFiltrados().map((cliente) => (
                                <CommandItem
                                  key={cliente.id}
                                  value={cliente.id}
                                  onSelect={(value) => {
                                    setSelectedCliente(value)
                                    setSelectedContacto(null)
                                    setValue("clienteId", value)
                                    setOpenClientePopover(false)
                                  }}
                                  className="text-xs"
                                >
                                  <Check
                                    className={"mr-2 h-4 w-4 " + (selectedCliente === cliente.id ? "opacity-100" : "opacity-0")}
                                  />
                                  <div className="flex items-center gap-2 flex-1">
                                    <div className="flex flex-col flex-1">
                                      <span className="font-bold">{cliente.empresa}</span>
                                      <span className="text-[9px] opacity-60">RUC: {cliente.ruc}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {cliente.proyectos_count && cliente.proyectos_count > 0 ? (
                                        <div className="flex items-center gap-0.5" title={`${cliente.proyectos_count} proyectos`}>
                                          <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                                          <span className="text-[8px] text-blue-600 font-medium">{cliente.proyectos_count}</span>
                                        </div>
                                      ) : null}
                                      {cliente.cotizaciones_pendientes && cliente.cotizaciones_pendientes > 0 ? (
                                        <div className="flex items-center gap-0.5" title={`${cliente.cotizaciones_pendientes} cotizaciones`}>
                                          <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                                          <span className="text-[8px] text-amber-600 font-medium">{cliente.cotizaciones_pendientes}</span>
                                        </div>
                                      ) : null}
                                    </div>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 flex items-center gap-1.5">
                      <UserIcon className="h-2.5 w-2.5" /> Contacto Responsable
                    </Label>
                    <ContactSelector
                      clienteId={selectedCliente}
                      value={selectedContacto}
                      onValueChange={(value) => {
                        setSelectedContacto(value)
                        if (value) setValue("contactoId", value)
                      }}
                      disabled={!selectedCliente}
                    />
                  </div>
                </div>
              </div>

              {/* Bloque 3: Logística y Tiempos */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-1.5 border-b border-[#0089b3]/10">
                  <div className="h-5 w-5 rounded-md bg-emerald-500/10 flex items-center justify-center">
                    <MapPin className="h-3 w-3 text-emerald-500" />
                  </div>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.1em] text-emerald-600">
                    Planificación y Logística
                  </h4>
                </div>

                <div className="bg-emerald-50/20 p-4 rounded-2xl border border-emerald-100/50 shadow-sm space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="ubicacion" className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
                      Ubicación de la Obra / Servicio
                    </Label>
                    <Input
                      id="ubicacion"
                      {...register("ubicacion")}
                      placeholder="Ej: Planta Industrial, Callao"
                      className="h-10 text-xs bg-white rounded-xl border-slate-200 focus:border-emerald-400 shadow-none"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="fechaInicio" className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
                        <Calendar className="h-2.5 w-2.5 inline mr-1" /> Inicio Estimado
                      </Label>
                      <Input
                        id="fechaInicio"
                        {...register("fechaInicio", { required: "Requerido" })}
                        type="date"
                        className="h-10 text-xs bg-white rounded-xl border-slate-200 focus:border-emerald-400 shadow-none"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="fechaFin" className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
                        <Calendar className="h-2.5 w-2.5 inline mr-1" /> Cierre Objetivo
                      </Label>
                      <Input
                        id="fechaFin"
                        {...register("fechaFin", { required: "Requerido" })}
                        type="date"
                        className="h-10 text-xs bg-white rounded-xl border-slate-200 focus:border-emerald-400 shadow-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="presupuesto" className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 flex items-center gap-1">
                      <DollarSign className="h-2.5 w-2.5" /> Presupuesto Estimado
                    </Label>
                    <Input
                      id="presupuesto"
                      {...register("presupuesto", { valueAsNumber: true })}
                      type="number"
                      placeholder="0.00"
                      className="h-10 text-xs font-bold bg-white rounded-xl border-slate-200 focus:border-emerald-400 shadow-none"
                    />
                  </div>
                </div>
              </div>

            </div>
          </ScrollArea>

          {/* FOOTER: Fixed to Bottom */}
          <DialogFooter className="p-6 border-t border-slate-100 bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.02)] shrink-0 gap-4">
            <Button
              type="button"
              variant="ghost"
              className="h-10 px-6 text-[11px] font-semibold text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <div className="flex-1" />
            <Button
              type="submit"
              disabled={isLoading || !selectedCliente || !selectedContacto}
              className="h-10 px-10 text-[11px] font-bold bg-[#0089b3] hover:bg-[#007499] text-white rounded-xl shadow-[0_4px_14px_rgba(0,137,179,0.3)] transition-all active:scale-[0.98]"
            >
              {isLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Crear Proyecto
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
