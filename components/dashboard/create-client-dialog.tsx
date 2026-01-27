"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabaseClient"
import { logAction } from "@/app/actions/audit-actions"
import { useAuth } from "@/hooks/use-auth"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Building, User, Mail, Phone, MapPin, Loader2, Info } from "lucide-react"

interface CreateClientDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  userId?: string
}

interface ClientFormData {
  nombre: string
  email: string
  telefono: string
  empresa: string
  ruc: string
  sector: string
  direccion: string
  cargo: string
}

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

export function CreateClientDialog({ open, onOpenChange, onSuccess }: CreateClientDialogProps) {
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [selectedSector, setSelectedSector] = useState("")
  const { toast } = useToast()

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClientFormData>({
    defaultValues: {
      nombre: "",
      email: "",
      telefono: "",
      empresa: "",
      ruc: "",
      sector: "",
      direccion: "",
      cargo: "",
    },
  })

  const onSubmit = async (data: ClientFormData) => {
    if (!user) {
      toast({
        title: "Error",
        description: "No se identificó el usuario activo.",
        variant: "destructive",
      })
      return
    }

    setIsLoading(true)
    try {
      // 1. Crear el cliente
      const { data: clienteData, error: clienteError } = await supabase.from("clientes").insert({
        nombre: data.nombre,
        email: data.email,
        telefono: data.telefono,
        empresa: data.empresa,
        ruc: data.ruc,
        sector: selectedSector || null,
        direccion: data.direccion || null,
        vendedor_id: user.id,
      }).select('id').single()

      if (clienteError) throw clienteError

      // 2. Crear el contacto principal vinculado al cliente
      if (clienteData?.id && data.nombre) {
        const { error: contactoError } = await supabase.from("contactos").insert({
          cliente_id: clienteData.id,
          nombre: data.nombre,
          email: data.email || null,
          telefono: data.telefono || null,
          cargo: data.cargo || 'Contacto Principal',
          es_principal: true,
        })

        if (contactoError) {
          console.warn("No se pudo crear el contacto:", contactoError)
        }
      }

      toast({
        title: "✅ Cliente creado",
        description: `Se ha registrado exitosamente a ${data.empresa}.`,
      })

      logAction({
        user_id: user.id,
        user_name: user.name,
        action: `Creó cliente: ${data.empresa}`,
        module: "CLIENTES",
        details: { ruc: data.ruc, nombre: data.nombre, cargo: data.cargo }
      })

      reset()
      setSelectedSector("")
      onOpenChange(false)
      onSuccess?.()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el cliente.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={true}
        className="sm:max-w-[550px] w-[95vw] bg-card border-border p-0 overflow-hidden shadow-2xl h-[85vh] flex flex-col rounded-3xl"
      >
        {/* HEADER */}
        <DialogHeader className="p-6 border-b border-border/50 bg-slate-50/10 shrink-0">
          <DialogTitle className="text-xl font-bold tracking-tight text-slate-900 leading-tight">
            Nuevo Cliente
          </DialogTitle>
          <DialogDescription className="text-[10px] text-slate-400 mt-1 leading-tight">
            Ingresa los datos fiscales y de contacto para registrar una nueva empresa.
          </DialogDescription>
        </DialogHeader>

        {/* FORM CONTAINER */}
        <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="p-6 space-y-8">
              {/* Bloque 1: Identidad Corporativa */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-1.5 border-b border-[#0089b3]/10">
                  <div className="h-5 w-5 rounded-md bg-[#0089b3]/10 flex items-center justify-center">
                    <Building className="h-3 w-3 text-[#0089b3]" />
                  </div>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.1em] text-[#0089b3]">
                    Identidad Corporativa
                  </h4>
                </div>

                <div className="bg-[#f8fbff] p-4 rounded-2xl border border-blue-100/50 shadow-sm space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="empresa" className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
                      Razón Social / Empresa
                    </Label>
                    <Input
                      id="empresa"
                      {...register("empresa", { required: "Campo obligatorio" })}
                      placeholder="Nombre legal de la empresa"
                      className="h-10 text-xs font-semibold bg-white rounded-xl border-slate-200 focus:border-[#0089b3] shadow-none"
                    />
                    {errors.empresa && <p className="text-[9px] text-destructive font-bold">{errors.empresa.message}</p>}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="ruc" className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
                        RUC (11 dígitos)
                      </Label>
                      <Input
                        id="ruc"
                        {...register("ruc", {
                          required: "Requerido",
                          pattern: { value: /^\d{11}$/, message: "Debe ser de 11 dígitos" }
                        })}
                        maxLength={11}
                        placeholder="20XXXXXXXXX"
                        className="h-10 text-xs font-mono bg-white rounded-xl border-slate-200 focus:border-[#0089b3] shadow-none"
                      />
                      {errors.ruc && <p className="text-[9px] text-destructive font-bold">{errors.ruc.message}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="sector" className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
                        Rubro / Industria
                      </Label>
                      <Select value={selectedSector} onValueChange={setSelectedSector}>
                        <SelectTrigger className="h-10 text-xs font-semibold bg-white rounded-xl border-slate-200 shadow-none">
                          <SelectValue placeholder="Seleccionar..." />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {SECTORES.map((s) => (
                            <SelectItem key={s} value={s} className="text-xs">
                              {s}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bloque 2: Persona de Contacto */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-1.5 border-b border-[#0089b3]/10">
                  <div className="h-5 w-5 rounded-md bg-orange-500/10 flex items-center justify-center">
                    <User className="h-3 w-3 text-orange-500" />
                  </div>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.1em] text-orange-600">
                    Representante Directo
                  </h4>
                </div>

                <div className="bg-orange-50/20 p-4 rounded-2xl border border-orange-100/50 shadow-sm space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2 space-y-1.5">
                      <Label htmlFor="nombre" className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
                        Nombre Completo
                      </Label>
                      <Input
                        id="nombre"
                        {...register("nombre", { required: "Requerido" })}
                        placeholder="Nombre del contacto principal"
                        className="h-10 text-xs font-semibold bg-white rounded-xl border-slate-200 focus:border-orange-400 shadow-none"
                      />
                      {errors.nombre && <p className="text-[9px] text-destructive font-bold">{errors.nombre.message}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="cargo" className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
                        Cargo
                      </Label>
                      <Input
                        id="cargo"
                        {...register("cargo")}
                        placeholder="Ej: Gerente"
                        className="h-10 text-xs bg-white rounded-xl border-slate-200 focus:border-orange-400 shadow-none"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="email" className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 flex items-center gap-1">
                        <Mail className="h-2.5 w-2.5" /> Email corporativo
                      </Label>
                      <Input
                        id="email"
                        {...register("email", {
                          required: "Requerido",
                          pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: "Email inválido" }
                        })}
                        type="email"
                        placeholder="ejemplo@empresa.com"
                        className="h-10 text-xs bg-white rounded-xl border-slate-200 focus:border-orange-400 shadow-none"
                      />
                      {errors.email && <p className="text-[9px] text-destructive font-bold">{errors.email.message}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="telefono" className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400 flex items-center gap-1">
                        <Phone className="h-2.5 w-2.5" /> Teléfono / WhatsApp
                      </Label>
                      <Input
                        id="telefono"
                        {...register("telefono", { required: "Requerido" })}
                        placeholder="+51 9..."
                        className="h-10 text-xs bg-white rounded-xl border-slate-200 focus:border-orange-400 shadow-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Bloque 3: Ubicación y Datos Adicionales */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-1.5 border-b border-[#0089b3]/10">
                  <div className="h-5 w-5 rounded-md bg-slate-500/10 flex items-center justify-center">
                    <MapPin className="h-3 w-3 text-slate-500" />
                  </div>
                  <h4 className="text-[10px] font-black uppercase tracking-[0.1em] text-slate-600">
                    Información de Localización
                  </h4>
                </div>

                <div className="bg-slate-50/50 p-4 rounded-2xl border border-slate-200/50 shadow-sm space-y-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="direccion" className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
                      Dirección Fiscal
                    </Label>
                    <Input
                      id="direccion"
                      {...register("direccion")}
                      placeholder="Dirección completa de la empresa"
                      className="h-10 text-xs bg-white rounded-xl border-slate-200 focus:border-slate-400 shadow-none"
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
              disabled={isLoading}
              className="h-10 px-10 text-[11px] font-bold bg-[#0089b3] hover:bg-[#007499] text-white rounded-xl shadow-[0_4px_14px_rgba(0,137,179,0.3)] transition-all active:scale-[0.98]"
            >
              {isLoading && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
              Registrar Cliente
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
