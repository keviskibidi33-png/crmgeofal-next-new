"use client"

import { Download, Eye, FileText, Building2, User2, Package, Clock, CheckCircle2, XCircle, AlertCircle, ChevronDown, Loader2, Mail, Phone, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { Quote } from "./cotizadora-module"

interface QuotePreviewPanelProps {
    quote: Quote | null
    onDownload: (quote: Quote) => void
    onStatusChange: (quoteId: string, status: Quote["estado"]) => void
    onViewFull: (quote: Quote) => void
    onDelete: (quote: Quote) => void
    isUpdating?: boolean
}

const statusConfig = {
    pendiente: {
        color: "bg-amber-500/20 text-amber-600 border-amber-500/30",
        icon: AlertCircle,
        label: "Pendiente"
    },
    aprobada: {
        color: "bg-emerald-500/20 text-emerald-600 border-emerald-500/30",
        icon: CheckCircle2,
        label: "Aprobada"
    },
    rechazada: {
        color: "bg-red-500/20 text-red-600 border-red-500/30",
        icon: XCircle,
        label: "Rechazada"
    },
    borrador: {
        color: "bg-slate-500/20 text-slate-600 border-slate-500/30",
        icon: FileText,
        label: "Borrador"
    }
}

export function QuotePreviewPanel({
    quote,
    onDownload,
    onStatusChange,
    onViewFull,
    onDelete,
    isUpdating = false
}: QuotePreviewPanelProps) {
    if (!quote) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center p-8 bg-card rounded-xl border border-border">
                <div className="h-16 w-16 rounded-full bg-muted/30 flex items-center justify-center mb-4">
                    <FileText className="h-8 w-8 text-muted-foreground/40" />
                </div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-1">
                    Vista Previa
                </h3>
                <p className="text-xs text-muted-foreground/70 max-w-[200px]">
                    Selecciona una cotización de la tabla para ver sus detalles aquí
                </p>
            </div>
        )
    }

    const status = statusConfig[quote.estado] || statusConfig.pendiente
    const StatusIcon = status.icon

    return (
        <div className="h-full max-h-full flex flex-col bg-card rounded-xl border border-border overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                            <FileText className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-bold text-primary text-sm">
                                COT-{quote.numero}-{quote.year}
                            </h3>
                            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                                {quote.proyectoNombre}
                            </p>
                        </div>
                    </div>
                    <span className={`px-2 py-1 rounded-full text-[9px] font-bold uppercase tracking-wider border flex items-center gap-1 ${status.color}`}>
                        <StatusIcon className="h-3 w-3" />
                        {status.label}
                    </span>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-2">
                    <div className="bg-background/50 rounded-lg p-2 text-center border border-border/50">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Monto</p>
                        <p className="text-sm font-bold text-primary">
                            S/. {quote.monto.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                    <div className="bg-background/50 rounded-lg p-2 text-center border border-border/50">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Items</p>
                        <p className="text-sm font-bold">{quote.itemsCount}</p>
                    </div>
                    <div className="bg-background/50 rounded-lg p-2 text-center border border-border/50">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Fecha</p>
                        <p className="text-sm font-bold">{quote.fecha}</p>
                    </div>
                </div>
            </div>

            {/* Content */}
            <ScrollArea className="flex-1 min-h-0">
                <div className="p-4 space-y-4">
                    {/* Cliente Info */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                            <Building2 className="h-3.5 w-3.5" />
                            Cliente
                        </div>
                        <div className="bg-secondary/30 rounded-lg p-3 space-y-2">
                            <div>
                                <p className="font-semibold text-sm">{quote.cliente}</p>
                                <p className="text-xs text-muted-foreground">{quote.clienteRuc || "Sin RUC"}</p>
                            </div>
                            {quote.clienteContacto && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <User2 className="h-3 w-3" />
                                    {quote.clienteContacto}
                                </div>
                            )}
                            {quote.clienteEmail && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Mail className="h-3 w-3" />
                                    {quote.clienteEmail}
                                </div>
                            )}
                            {quote.clienteTelefono && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Phone className="h-3 w-3" />
                                    {quote.clienteTelefono}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Vendedor */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                            <User2 className="h-3.5 w-3.5" />
                            Vendedor
                        </div>
                        <div className="bg-secondary/30 rounded-lg p-3 space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                                    {quote.owner.charAt(0)}
                                </div>
                                <span className="text-sm font-medium">{quote.owner}</span>
                            </div>
                            {(quote as any).correo_vendedor && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Mail className="h-3 w-3" />
                                    {(quote as any).correo_vendedor}
                                </div>
                            )}
                            {(quote as any).telefono_comercial && (
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Phone className="h-3 w-3" />
                                    {(quote as any).telefono_comercial}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Condiciones comerciales */}
                    {((quote as any).plazo_dias || (quote as any).condicion_pago) && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                                <Clock className="h-3.5 w-3.5" />
                                Condiciones Comerciales
                            </div>
                            <div className="bg-secondary/30 rounded-lg p-3 space-y-2">
                                {(quote as any).plazo_dias > 0 && (
                                    <div className="text-xs">
                                        <span className="text-muted-foreground">Plazo: </span>
                                        <span className="font-semibold">{(quote as any).plazo_dias} días hábiles</span>
                                    </div>
                                )}
                                {(quote as any).condicion_pago && (
                                    <div className="text-xs">
                                        <span className="text-muted-foreground">Pago: </span>
                                        <span className="font-semibold capitalize">{(quote as any).condicion_pago.replace(/_/g, ' ')}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Condiciones específicas */}
                    {(quote as any).condiciones_textos && (quote as any).condiciones_textos.length > 0 && (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                                <FileText className="h-3.5 w-3.5" />
                                Condiciones Específicas ({(quote as any).condiciones_textos.length})
                            </div>
                            <div className="bg-secondary/30 rounded-lg p-3 space-y-2">
                                {(quote as any).condiciones_textos.map((cond: string, idx: number) => (
                                    <div key={idx} className="flex gap-2 text-xs">
                                        <span className="text-primary shrink-0">•</span>
                                        <span className="text-muted-foreground">{cond}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <Separator />

                    {/* Items List - Enhanced */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
                                <Package className="h-3.5 w-3.5" />
                                Detalle de Items ({quote.itemsCount})
                            </div>
                        </div>

                        {quote.itemsJson && quote.itemsJson.length > 0 ? (
                            <div className="space-y-2">
                                {quote.itemsJson.map((item: any, idx: number) => (
                                    <div
                                        key={idx}
                                        className="bg-secondary/20 rounded-lg p-3 border border-border/30 hover:border-primary/20 transition-colors"
                                    >
                                        <div className="flex justify-between items-start gap-2 mb-1.5">
                                            <p className="font-medium text-xs line-clamp-2 flex-1">
                                                {item.descripcion || item.item || `Item ${idx + 1}`}
                                            </p>
                                            <span className="text-xs font-bold text-primary shrink-0">
                                                S/. {Number(item.total || item.total_item || (item.costo_unitario || item.precio_unitario || 0) * (item.cantidad || 1)).toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                                            <span className="bg-background/60 px-1.5 py-0.5 rounded">
                                                Cant: <strong className="text-foreground">{item.cantidad || 1}</strong>
                                            </span>
                                            <span className="bg-background/60 px-1.5 py-0.5 rounded">
                                                P.U: <strong className="text-foreground">S/. {Number(item.costo_unitario || item.precio_unitario || item.pu || 0).toFixed(2)}</strong>
                                            </span>
                                            {item.unidad && (
                                                <span className="bg-background/60 px-1.5 py-0.5 rounded">
                                                    {item.unidad}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                {/* Total Summary */}
                                <div className="bg-primary/5 rounded-lg p-3 border border-primary/20 flex justify-between items-center">
                                    <span className="text-xs font-semibold text-muted-foreground uppercase">Total Cotización</span>
                                    <span className="text-lg font-bold text-primary">
                                        S/. {quote.monto.toLocaleString("es-PE", { minimumFractionDigits: 2 })}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-6 text-muted-foreground text-xs">
                                No hay items disponibles
                            </div>
                        )}
                    </div>
                </div>
            </ScrollArea>

            {/* Actions Footer */}
            <div className="p-3 border-t border-border bg-secondary/10 space-y-2">
                <div className="flex gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" className="flex-1 h-9 text-xs gap-1.5" disabled={isUpdating}>
                                {isUpdating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                Cambiar Estado
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-40">
                            <DropdownMenuItem onClick={() => onStatusChange(quote.id, "aprobada")} className="gap-2 text-xs">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" /> Aprobar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onStatusChange(quote.id, "rechazada")} className="gap-2 text-xs">
                                <XCircle className="h-3.5 w-3.5 text-red-500" /> Rechazar
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => onStatusChange(quote.id, "pendiente")} className="gap-2 text-xs">
                                <AlertCircle className="h-3.5 w-3.5 text-amber-500" /> Pendiente
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <Button
                        variant="default"
                        size="sm"
                        className="flex-1 h-9 text-xs gap-1.5"
                        onClick={() => onDownload(quote)}
                    >
                        <Download className="h-3.5 w-3.5" />
                        Descargar
                    </Button>
                </div>

                <div className="flex gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 h-8 text-xs text-muted-foreground hover:text-foreground"
                        onClick={() => onViewFull(quote)}
                    >
                        <Eye className="h-3.5 w-3.5 mr-1.5" />
                        Ver Completo
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 text-xs text-destructive/70 hover:text-destructive hover:bg-destructive/10"
                        onClick={() => onDelete(quote)}
                    >
                        <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                </div>
            </div>
        </div>
    )
}
