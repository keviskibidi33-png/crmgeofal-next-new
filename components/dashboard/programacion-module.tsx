"use client"

import { useState, useMemo, useCallback } from "react"
import { User } from "@/hooks/use-auth"
import { useProgramacionData } from "@/hooks/use-programacion-data"
import { useProgramacionIframe } from "@/hooks/use-programacion-iframe"
import { DialogFullscreen as Dialog, DialogFullscreenTrigger as DialogTrigger, DialogFullscreenContent as DialogContent } from "@/components/ui/dialog-fullscreen"
import { Button } from "@/components/ui/button"
import { Clock, CheckCircle2, AlertTriangle, FlaskConical, Briefcase, Building2, ChevronRight, BarChart3, X } from "lucide-react"
import { DialogTitle, DialogDescription } from "@/components/ui/dialog"
import * as DialogPrimitive from "@radix-ui/react-dialog"

interface ProgramacionModuleProps {
    user: User
}

type ViewMode = 'LAB' | 'COMERCIAL' | 'ADMIN'

export function ProgramacionModule({ user }: ProgramacionModuleProps) {
    const { data, isLoading, realtimeStatus, refetch } = useProgramacionData()
    const [isOpen, setIsOpen] = useState(false)
    const [currentMode, setCurrentMode] = useState<ViewMode>('LAB')

    const handleIframeUpdate = useCallback(() => {
        refetch()
    }, [refetch])

    const { sendMessage } = useProgramacionIframe(handleIframeUpdate)

    // KPI Calculations
    const kpis = useMemo(() => {
        const total = data.length
        const pendientes = data.filter(r => r.estado_trabajo === 'PENDIENTE').length
        const proceso = data.filter(r => r.estado_trabajo === 'PROCESO').length
        const finalizados = data.filter(r => r.estado_trabajo === 'COMPLETADO' || r.estado_trabajo === 'FINALIZADO').length

        const atrasados = data.filter(r => {
            if (!r.fecha_entrega_estimada) return false
            const est = new Date(r.fecha_entrega_estimada)
            const real = r.entrega_real ? new Date(r.entrega_real) : new Date()
            est.setHours(0, 0, 0, 0)
            real.setHours(0, 0, 0, 0)
            return !r.entrega_real && real > est
        }).length

        return { total, pendientes, proceso, finalizados, atrasados }
    }, [data])

    const getModuleConfig = (mode: ViewMode) => {
        switch (mode) {
            case 'LAB':
                return {
                    title: 'Laboratorio', icon: FlaskConical, metrics: [
                        { label: 'En Proceso', value: kpis.proceso, color: 'text-amber-600' },
                        { label: 'Pendientes', value: kpis.pendientes, color: 'text-zinc-600' }
                    ]
                }
            case 'COMERCIAL':
                return {
                    title: 'Comercial', icon: Briefcase, metrics: [
                        { label: 'Con Atraso', value: kpis.atrasados, color: 'text-red-600' },
                        { label: 'Total OTs', value: kpis.total, color: 'text-zinc-600' }
                    ]
                }
            case 'ADMIN':
                return {
                    title: 'Administración', icon: Building2, metrics: [
                        { label: 'Por Facturar', value: kpis.finalizados, color: 'text-emerald-600' },
                        { label: 'Total Mes', value: kpis.total, color: 'text-zinc-600' }
                    ]
                }
        }
    }

    const openModule = (mode: ViewMode) => {
        setCurrentMode(mode)
        setIsOpen(true)
    }

    const ModuleRow = ({ mode }: { mode: ViewMode }) => {
        const config = getModuleConfig(mode)
        const { title, icon: Icon, metrics } = config

        return (
            <div
                onClick={() => openModule(mode)}
                className="group flex items-center justify-between p-4 bg-white border border-zinc-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer"
            >
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-zinc-100 rounded-md group-hover:bg-blue-50 text-zinc-600 group-hover:text-blue-600 transition-colors">
                        <Icon className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-zinc-900 group-hover:text-blue-700 transition-colors">{title}</h3>
                        <p className="text-xs text-zinc-500">Vista detallada y gestión</p>
                    </div>
                </div>

                <div className="flex items-center gap-8">
                    <div className="flex items-center gap-6 mr-4">
                        {metrics.map((m, i) => (
                            <div key={i} className="flex flex-col items-end">
                                <span className={`font-bold text-lg ${m.color}`}>{m.value}</span>
                                <span className="text-[10px] uppercase tracking-wider text-zinc-400 font-medium">{m.label}</span>
                            </div>
                        ))}
                    </div>
                    <Button variant="ghost" size="icon" className="text-zinc-400 group-hover:text-blue-600">
                        <ChevronRight className="w-5 h-5" />
                    </Button>
                </div>
            </div>
        )
    }

    const currentConfig = getModuleConfig(currentMode)
    const { title, icon: Icon } = currentConfig
    const iframeUrl = process.env.NEXT_PUBLIC_PROGRAMACION_URL ||
        (typeof window !== 'undefined' && window.location.hostname === 'crm.geofal.com.pe'
            ? 'https://programacion.geofal.com.pe'
            : 'http://localhost:8472')
    const fullUrl = `${iframeUrl}?mode=${currentMode.toLowerCase()}&userId=${user.id}`

    return (
        <>
            <div className="flex flex-col h-full space-y-6 p-6 bg-zinc-50/50 overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Dashboard de Operaciones</h1>
                        <p className="text-sm text-zinc-500">Resumen general y accesos directos.</p>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1 bg-white border border-zinc-200 rounded-full shadow-sm">
                        <span className={`h-2 w-2 rounded-full ${realtimeStatus === 'SUBSCRIBED' ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
                        <span className="text-xs text-zinc-600 font-medium uppercase tracking-wide">
                            {realtimeStatus === 'SUBSCRIBED' ? 'Sistema Online' : 'Desconectado'}
                        </span>
                    </div>
                </div>

                {/* Global KPI Strip */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="p-4 bg-white rounded-lg border border-zinc-100 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Total Activos</p>
                            <p className="text-2xl font-bold text-zinc-900">{kpis.total}</p>
                        </div>
                        <BarChart3 className="w-8 h-8 text-zinc-100" />
                    </div>
                    <div className="p-4 bg-white rounded-lg border border-zinc-100 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Pendientes</p>
                            <p className="text-2xl font-bold text-zinc-700">{kpis.pendientes}</p>
                        </div>
                        <Clock className="w-8 h-8 text-zinc-100" />
                    </div>
                    <div className="p-4 bg-white rounded-lg border border-zinc-100 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Atrasados</p>
                            <p className="text-2xl font-bold text-red-600">{kpis.atrasados}</p>
                        </div>
                        <AlertTriangle className="w-8 h-8 text-red-50" />
                    </div>
                    <div className="p-4 bg-white rounded-lg border border-zinc-100 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Completados</p>
                            <p className="text-2xl font-bold text-emerald-600">{kpis.finalizados}</p>
                        </div>
                        <CheckCircle2 className="w-8 h-8 text-emerald-50" />
                    </div>
                </div>

                <div className="h-px bg-zinc-200" />

                {/* Active Modules List */}
                <div className="space-y-3">
                    <h2 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider mb-4">Módulos de Gestión</h2>
                    <ModuleRow mode="LAB" />
                    <ModuleRow mode="COMERCIAL" />
                    <ModuleRow mode="ADMIN" />
                </div>
            </div>

            {/* Modal con Iframe */}
            <Dialog open={isOpen} onOpenChange={setIsOpen}>
                <DialogContent
                    style={{ backgroundColor: '#fff' }}
                    onInteractOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={() => setIsOpen(false)}
                >
                    {/* Header minimalista */}
                    <div className="flex-none flex items-center justify-between px-4 py-3 bg-white border-b border-zinc-200">
                        <div className="flex items-center gap-3">
                            <Icon className="w-5 h-5 text-blue-600" />
                            <DialogTitle className="font-semibold text-zinc-900 text-base m-0">{title}</DialogTitle>
                        </div>
                        <DialogDescription className="sr-only">
                            Módulo de gestión de programación: {title}
                        </DialogDescription>
                        <DialogPrimitive.Close asChild>
                            <Button variant="ghost" size="icon" className="w-8 h-8">
                                <X className="w-4 h-4" />
                            </Button>
                        </DialogPrimitive.Close>
                    </div>

                    {/* Iframe */}
                    <div className="flex-1 min-h-0 relative">
                        <iframe
                            data-programacion-iframe
                            src={fullUrl}
                            className="w-full h-full border-0"
                            title="Programación"
                            allow="clipboard-write; clipboard-read"
                        />
                    </div>
                </DialogContent>
            </Dialog>
        </>
    )
}
