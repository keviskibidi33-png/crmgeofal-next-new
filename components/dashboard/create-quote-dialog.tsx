"use client"

const DEFAULT_COTIZADOR_URL = "http://localhost:5173"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { AlertCircle, ExternalLink } from "lucide-react"
import { useEffect } from "react"
import { logAction } from "@/app/actions/audit-actions"

interface CreateQuoteDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  iframeUrl?: string
  user?: { id: string; name: string; email?: string; phone?: string }
  onSuccess?: () => void
  proyectoId?: string
  clienteId?: string
}
export function CreateQuoteDialog({ open, onOpenChange, iframeUrl, user, onSuccess, proyectoId, clienteId }: CreateQuoteDialogProps) {
  const { toast } = useToast()
  const baseUrl = iframeUrl ?? process.env.NEXT_PUBLIC_COTIZADOR_URL ?? DEFAULT_COTIZADOR_URL

  // Build URL with user params and context for auto-fill
  let resolvedIframeUrl = baseUrl
  const params = new URLSearchParams()

  if (user) {
    params.set('user_id', user.id)
    params.set('name', user.name)
    if (user.email) params.set('email', user.email)
    if (user.phone) params.set('phone', user.phone)
  }

  if (proyectoId) params.set('proyecto_id', proyectoId)
  if (clienteId) params.set('cliente_id', clienteId)

  const queryString = params.toString()
  if (queryString) {
    resolvedIframeUrl += (resolvedIframeUrl.includes('?') ? '&' : '?') + queryString
  }
  const iframeAvailable = baseUrl.length > 0

  // Listen for messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Security: In production we should check event.origin
      if (event.data?.type === 'QUOTE_CREATED') {
        toast({
          title: "Cotización creada",
          description: "La cotización se ha generado y guardado correctamente.",
        })
        if (onSuccess) onSuccess()

        // Log action
        if (user) {
          logAction({
            user_id: user.id,
            user_name: user.name,
            action: `Generó cotización desde CRM`,
            module: "COTIZADORA"
          })
        }

        // Optionally close dialog after short delay
        setTimeout(() => onOpenChange(false), 1500)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [onOpenChange, onSuccess, toast])

  const handleUnavailable = () => {
    toast({
      title: "Cotizadora no configurada",
      description:
        "Define la variable NEXT_PUBLIC_COTIZADOR_URL o pasa iframeUrl al componente para habilitar la cotizadora.",
      variant: "destructive",
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[98vw] w-full h-[95vh] bg-card border-border flex flex-col gap-2 overflow-hidden p-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <DialogTitle className="text-base">Generar cotización</DialogTitle>
              <DialogDescription className="text-xs">
                Completa la cotización sin salir del CRM
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="whitespace-nowrap text-xs">
                Integrada
              </Badge>
              <Button variant="outline" size="sm" asChild disabled={!iframeAvailable}>
                <a
                  href={iframeAvailable ? baseUrl : undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={!iframeAvailable ? (e) => {
                    e.preventDefault()
                    handleUnavailable()
                  } : undefined}
                >
                  <ExternalLink className="mr-1 h-3 w-3" />
                  Nueva pestaña
                </a>
              </Button>
              <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden">
          <div className="h-full bg-white overflow-hidden flex flex-col">
            {iframeAvailable ? (
              <iframe
                src={resolvedIframeUrl}
                className="w-full flex-1 border-0 rounded-b-lg"
                title="Generador de Cotizaciones"
                allow="clipboard-write"
              />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center px-8">
                <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-base font-medium">Configura la URL de la cotizadora</p>
                <p className="text-sm text-muted-foreground">
                  Define la variable <code className="px-1 py-0.5 rounded bg-muted">NEXT_PUBLIC_COTIZADOR_URL</code> en tu
                  entorno.
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
