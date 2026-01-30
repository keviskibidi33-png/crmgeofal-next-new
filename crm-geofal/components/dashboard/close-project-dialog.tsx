"use client"

import { useState } from "react"
import { CheckCircle2, XCircle, Archive, DollarSign, Loader2 } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { toast } from "sonner"
import type { Project } from "./proyectos-module"

interface CloseProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: Project
  onClose: (
    projectId: string,
    resultado: "venta_ganada" | "venta_perdida" | "archivado",
    montoFinal?: number,
    motivoPerdida?: Project["motivoPerdida"],
    notasCierre?: string,
  ) => void
}

const motivosPerdida = [
  { value: "competencia", label: "Eligió a la competencia" },
  { value: "precio", label: "Precio muy alto" },
  { value: "timing", label: "Mal timing / No es el momento" },
  { value: "sin_respuesta", label: "Sin respuesta del cliente" },
  { value: "cancelado_cliente", label: "Cancelado por el cliente" },
  { value: "otro", label: "Otro motivo" },
]

export function CloseProjectDialog({ open, onOpenChange, project, onClose }: CloseProjectDialogProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [resultado, setResultado] = useState<"venta_ganada" | "venta_perdida" | "archivado" | null>(null)
  const [montoFinal, setMontoFinal] = useState(project.presupuesto.toString())
  const [motivoPerdida, setMotivoPerdida] = useState<Project["motivoPerdida"]>()
  const [notasCierre, setNotasCierre] = useState("")
  // const { toast } = useToast() // Replaced by Sonner

  const handleSubmit = async () => {
    if (!resultado) {
      toast.error("Selecciona un resultado", {
        description: "Debes indicar si fue venta ganada, perdida o archivar.",
      })
      return
    }

    if (resultado === "venta_perdida" && !motivoPerdida) {
      toast.error("Selecciona el motivo", {
        description: "Debes indicar el motivo de la pérdida.",
      })
      return
    }

    setIsLoading(true)

    try {
      // TODO: Connect with FastAPI backend
      await new Promise((resolve) => setTimeout(resolve, 1000))

      onClose(
        project.id,
        resultado,
        resultado === "venta_ganada" ? Number.parseFloat(montoFinal) : undefined,
        resultado === "venta_perdida" ? motivoPerdida : undefined,
        notasCierre || undefined,
      )

      toast.success(
        resultado === "venta_ganada"
          ? "¡Venta registrada!"
          : resultado === "venta_perdida"
            ? "Pérdida registrada"
            : "Proyecto archivado",
        {
          description: `El proyecto "${project.nombre}" se ha movido a ${resultado === "venta_ganada" ? "Ventas" : resultado === "venta_perdida" ? "Perdidas" : "Archivados"}.`,
        }
      )

      // Reset form
      setResultado(null)
      setMontoFinal(project.presupuesto.toString())
      setMotivoPerdida(undefined)
      setNotasCierre("")
    } catch {
      toast.error("Error", {
        description: "No se pudo cerrar el proyecto.",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(amount)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] bg-card border-border">
        <DialogHeader>
          <DialogTitle>Cerrar Proyecto</DialogTitle>
          <DialogDescription>
            Registra el resultado de <span className="font-medium text-foreground">{project.nombre}</span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Project Summary */}
          <div className="bg-secondary/50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cliente:</span>
              <span className="font-medium">{project.cliente}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Presupuesto inicial:</span>
              <span className="font-medium">{formatCurrency(project.presupuesto)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Cotizaciones:</span>
              <span className="font-medium">{project.cotizaciones}</span>
            </div>
          </div>

          {/* Result Selection */}
          <div className="space-y-3">
            <Label>Resultado del proyecto</Label>
            <RadioGroup
              value={resultado || ""}
              onValueChange={(v) => setResultado(v as typeof resultado)}
              className="grid grid-cols-3 gap-3"
            >
              <Label
                htmlFor="venta_ganada"
                className={`flex flex-col items-center justify-center p-4 border rounded-lg cursor-pointer transition-colors ${resultado === "venta_ganada"
                    ? "border-emerald-500 bg-emerald-500/10"
                    : "border-border hover:border-emerald-500/50"
                  }`}
              >
                <RadioGroupItem value="venta_ganada" id="venta_ganada" className="sr-only" />
                <CheckCircle2
                  className={`h-8 w-8 mb-2 ${resultado === "venta_ganada" ? "text-emerald-400" : "text-muted-foreground"}`}
                />
                <span className={`text-sm font-medium ${resultado === "venta_ganada" ? "text-emerald-400" : ""}`}>
                  Venta Ganada
                </span>
              </Label>
              <Label
                htmlFor="venta_perdida"
                className={`flex flex-col items-center justify-center p-4 border rounded-lg cursor-pointer transition-colors ${resultado === "venta_perdida"
                    ? "border-red-500 bg-red-500/10"
                    : "border-border hover:border-red-500/50"
                  }`}
              >
                <RadioGroupItem value="venta_perdida" id="venta_perdida" className="sr-only" />
                <XCircle
                  className={`h-8 w-8 mb-2 ${resultado === "venta_perdida" ? "text-red-400" : "text-muted-foreground"}`}
                />
                <span className={`text-sm font-medium ${resultado === "venta_perdida" ? "text-red-400" : ""}`}>
                  Venta Perdida
                </span>
              </Label>
              <Label
                htmlFor="archivado"
                className={`flex flex-col items-center justify-center p-4 border rounded-lg cursor-pointer transition-colors ${resultado === "archivado"
                    ? "border-gray-500 bg-gray-500/10"
                    : "border-border hover:border-gray-500/50"
                  }`}
              >
                <RadioGroupItem value="archivado" id="archivado" className="sr-only" />
                <Archive
                  className={`h-8 w-8 mb-2 ${resultado === "archivado" ? "text-gray-400" : "text-muted-foreground"}`}
                />
                <span className={`text-sm font-medium ${resultado === "archivado" ? "text-gray-400" : ""}`}>
                  Archivar
                </span>
              </Label>
            </RadioGroup>
          </div>

          {/* Conditional fields based on result */}
          {resultado === "venta_ganada" && (
            <div className="space-y-2">
              <Label htmlFor="montoFinal">Monto final de venta (MXN)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="montoFinal"
                  type="number"
                  value={montoFinal}
                  onChange={(e) => setMontoFinal(e.target.value)}
                  className="pl-10"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Diferencia con presupuesto: {formatCurrency(Number.parseFloat(montoFinal || "0") - project.presupuesto)}
              </p>
            </div>
          )}

          {resultado === "venta_perdida" && (
            <div className="space-y-2">
              <Label>Motivo de la pérdida</Label>
              <Select value={motivoPerdida} onValueChange={(v) => setMotivoPerdida(v as Project["motivoPerdida"])}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el motivo..." />
                </SelectTrigger>
                <SelectContent>
                  {motivosPerdida.map((motivo) => (
                    <SelectItem key={motivo.value} value={motivo.value}>
                      {motivo.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Notes field */}
          {resultado && (
            <div className="space-y-2">
              <Label htmlFor="notas">Notas adicionales (opcional)</Label>
              <Textarea
                id="notas"
                value={notasCierre}
                onChange={(e) => setNotasCierre(e.target.value)}
                placeholder={
                  resultado === "venta_ganada"
                    ? "Detalles de la negociación, términos especiales..."
                    : resultado === "venta_perdida"
                      ? "Detalles sobre por qué se perdió..."
                      : "Razón por la que se archiva..."
                }
                rows={3}
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !resultado}
            className={
              resultado === "venta_ganada"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : resultado === "venta_perdida"
                  ? "bg-red-600 hover:bg-red-700"
                  : ""
            }
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {resultado === "venta_ganada"
              ? "Registrar Venta"
              : resultado === "venta_perdida"
                ? "Registrar Pérdida"
                : resultado === "archivado"
                  ? "Archivar"
                  : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
