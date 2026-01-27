"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import {
    Activity,
    Search,
    RefreshCw,
    Download,
    Trash2,
    Calendar,
    Users,
    ChevronLeft,
    ChevronRight,
    Loader2,
    AlertTriangle,
    FileText,
    Clock,
    Filter,
} from "lucide-react"
import { supabase } from "@/lib/supabaseClient"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { getAuditLogs, purgeLogsAction, manualRangePurge } from "@/app/actions/audit-actions"
import { cn } from "@/lib/utils"

interface AuditoriaModuleProps {
    user: any
}

export function AuditoriaModule({ user }: AuditoriaModuleProps) {
    const [logs, setLogs] = useState<any[]>([])
    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [totalCount, setTotalCount] = useState(0)
    const [currentPage, setCurrentPage] = useState(1)
    const [pageSize] = useState(20)

    // Filters
    const [userIdFilter, setUserIdFilter] = useState("all")
    const [startDate, setStartDate] = useState("")
    const [endDate, setEndDate] = useState("")

    // Dialogs
    const [isPurgeDialogOpen, setIsPurgeDialogOpen] = useState(false)
    const [isManualPurgeOpen, setIsManualPurgeOpen] = useState(false)
    const [purgeRange, setPurgeRange] = useState({ start: "", end: "" })
    const [isProcessing, setIsProcessing] = useState(false)

    const { toast } = useToast()

    const fetchUsers = async () => {
        const { data } = await supabase.from("vendedores").select("id, full_name").order("full_name")
        if (data) setUsers(data)
    }

    const fetchLogs = useCallback(async () => {
        setLoading(true)
        try {
            const result = await getAuditLogs({
                userId: userIdFilter,
                startDate: startDate ? new Date(startDate).toISOString() : undefined,
                endDate: endDate ? new Date(endDate).toISOString() : undefined,
                page: currentPage,
                pageSize: pageSize
            })

            if (result.error) throw new Error(result.error)

            setLogs(result.data || [])
            setTotalCount(result.count || 0)
        } catch (err: any) {
            toast({
                title: "Error al cargar logs",
                description: err.message,
                variant: "destructive",
            })
        } finally {
            setLoading(false)
        }
    }, [userIdFilter, startDate, endDate, currentPage, pageSize, toast])

    useEffect(() => {
        fetchUsers()
    }, [])

    useEffect(() => {
        fetchLogs()
    }, [fetchLogs])

    const handleDownloadTxt = (content: string, filename: string) => {
        const element = document.createElement("a")
        const file = new Blob([content], { type: "text/plain" })
        element.href = URL.createObjectURL(file)
        element.download = filename
        document.body.appendChild(element)
        element.click()
        document.body.removeChild(element)
    }

    const handleAutoPurge = async () => {
        setIsProcessing(true)
        try {
            const result = await purgeLogsAction(6) // 6 days
            if (result.error) throw new Error(result.error)

            if (result.data) {
                handleDownloadTxt(result.data, result.filename || "audit_logs.txt")
                toast({
                    title: "Limpieza automática completada",
                    description: `Se eliminaron ${result.count || 0} logs antiguos y se descargó el respaldo.`,
                })
                fetchLogs()
            } else {
                toast({
                    title: "Sin logs antiguos",
                    description: "No se encontraron logs de más de 6 días para eliminar.",
                })
            }
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" })
        } finally {
            setIsProcessing(false)
            setIsPurgeDialogOpen(false)
        }
    }

    const handleManualPurge = async () => {
        if (!purgeRange.start || !purgeRange.end) {
            toast({ title: "Error", description: "Seleccione un rango de fechas", variant: "destructive" })
            return
        }

        setIsProcessing(true)
        try {
            const result = await manualRangePurge(
                new Date(purgeRange.start).toISOString(),
                new Date(purgeRange.end).toISOString()
            )

            if (result.error) throw new Error(result.error)

            if (result.count && result.count > 0 && result.data) {
                handleDownloadTxt(result.data, result.filename || "manual_purge.txt")
                toast({
                    title: "Purga manual completada",
                    description: `Se eliminaron ${result.count} logs y se descargó el respaldo.`,
                })
                fetchLogs()
            } else {
                toast({ title: "Sin resultados", description: "No se encontraron logs en ese rango." })
            }
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" })
        } finally {
            setIsProcessing(false)
            setIsManualPurgeOpen(false)
        }
    }

    const totalPages = Math.ceil(totalCount / pageSize)

    const getSeverityBadge = (severity: string) => {
        switch (severity) {
            case 'error': return "bg-red-500/20 text-red-600 dark:text-red-400 border-red-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm"
            case 'warning': return "bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm"
            default: return "bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider shadow-sm"
        }
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Activity className="h-6 w-6 text-primary" />
                        Módulo de Auditoría
                    </h1>
                    <p className="text-muted-foreground">Monitoreo de actividad y gestión de logs del sistema</p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={fetchLogs} disabled={loading}>
                        {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                        Recargar
                    </Button>
                    <Button variant="secondary" onClick={() => setIsPurgeDialogOpen(true)}>
                        <Clock className="h-4 w-4 mr-2" />
                        Limpieza {">"} 6 días
                    </Button>
                    <Button variant="destructive" onClick={() => setIsManualPurgeOpen(true)}>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Purga Manual
                    </Button>
                </div>
            </div>

            <Card className="bg-card border-border">
                <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                        <Filter className="h-4 w-4" />
                        Filtros
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="space-y-2">
                            <Label>Usuario</Label>
                            <Select value={userIdFilter} onValueChange={setUserIdFilter}>
                                <SelectTrigger>
                                    <Users className="h-4 w-4 mr-2 text-muted-foreground" />
                                    <SelectValue placeholder="Todos los usuarios" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todos los usuarios</SelectItem>
                                    {users.map(u => (
                                        <SelectItem key={u.id} value={u.id}>{u.full_name}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label>Desde</Label>
                            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
                        </div>
                        <div className="space-y-2">
                            <Label>Hasta</Label>
                            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
                        </div>
                        <div className="flex items-end">
                            <Button
                                variant="ghost"
                                className="w-full text-muted-foreground"
                                onClick={() => {
                                    setUserIdFilter("all")
                                    setStartDate("")
                                    setEndDate("")
                                    setCurrentPage(1)
                                }}
                            >
                                Limpiar Filtros
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-card border-border overflow-hidden">
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader className="bg-secondary/30">
                            <TableRow>
                                <TableHead className="w-[180px]">Fecha/Hora</TableHead>
                                <TableHead>Usuario</TableHead>
                                <TableHead>Acción</TableHead>
                                <TableHead>Módulo</TableHead>
                                <TableHead>Detalles</TableHead>
                                <TableHead className="text-right">Estado</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <TableRow key={i}>
                                        <TableCell colSpan={6} className="h-16 text-center">
                                            <Loader2 className="h-5 w-5 animate-spin mx-auto text-muted-foreground" />
                                        </TableCell>
                                    </TableRow>
                                ))
                            ) : logs.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={6} className="h-32 text-center">
                                        <FileText className="h-10 w-10 mx-auto text-muted-foreground/30 mb-2" />
                                        <p className="text-muted-foreground">No se encontraron logs</p>
                                    </TableCell>
                                </TableRow>
                            ) : (
                                logs.map((log) => (
                                    <TableRow key={log.id} className="hover:bg-secondary/10 transition-colors">
                                        <TableCell className="text-xs font-mono">
                                            {new Date(log.created_at).toLocaleString('es-PE')}
                                        </TableCell>
                                        <TableCell className="font-medium">{log.user_name || "Sistema"}</TableCell>
                                        <TableCell>
                                            <span className="text-sm">{log.action}</span>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider opacity-70">
                                                {log.module || "N/A"}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="max-w-[300px]">
                                            <span className="text-xs text-muted-foreground truncate block italic">
                                                {log.details ? JSON.stringify(log.details).substring(0, 100) : "-"}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Badge className={getSeverityBadge(log.severity)}>
                                                {log.severity}
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-4 border-t border-border flex items-center justify-between bg-secondary/10">
                        <p className="text-xs text-muted-foreground">
                            Mostrando logs {(currentPage - 1) * pageSize + 1} a {Math.min(currentPage * pageSize, totalCount)} de {totalCount}
                        </p>
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                            >
                                <ChevronLeft className="h-4 w-4" />
                            </Button>
                            <span className="text-xs font-medium px-3">Página {currentPage} de {totalPages}</span>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                disabled={currentPage === totalPages}
                            >
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                )}
            </Card>

            {/* Auto Purge Dialog */}
            <Dialog open={isPurgeDialogOpen} onOpenChange={setIsPurgeDialogOpen}>
                <DialogContent className="sm:max-w-[425px] bg-card border-border" showCloseButton={false}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-primary">
                            <Clock className="h-5 w-5" />
                            Limpieza Automática
                        </DialogTitle>
                        <DialogDescription>
                            Se eliminarán todos los logs con más de **6 días de antigüedad**.
                            Se generará un archivo .txt con el respaldo antes de borrar.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-sm text-primary/80">
                        Esta acción es irreversible una vez borrada la base de datos, pero conservará el archivo descargado.
                    </div>
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button variant="outline" onClick={() => setIsPurgeDialogOpen(false)} disabled={isProcessing}>
                            Cancelar
                        </Button>
                        <Button onClick={handleAutoPurge} disabled={isProcessing}>
                            {isProcessing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Procesar y Descargar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Manual Purge Dialog */}
            <Dialog open={isManualPurgeOpen} onOpenChange={setIsManualPurgeOpen}>
                <DialogContent className="sm:max-w-[425px] bg-card border-border" showCloseButton={false}>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-500">
                            <AlertTriangle className="h-5 w-5" />
                            Purga Manual de Logs
                        </DialogTitle>
                        <DialogDescription>
                            Seleccione un rango de fechas para eliminar logs permanentemente.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="start" className="text-right">Desde</Label>
                            <Input
                                id="start"
                                type="date"
                                className="col-span-3"
                                value={purgeRange.start}
                                onChange={e => setPurgeRange(prev => ({ ...prev, start: e.target.value }))}
                            />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="end" className="text-right">Hasta</Label>
                            <Input
                                id="end"
                                type="date"
                                className="col-span-3"
                                value={purgeRange.end}
                                onChange={e => setPurgeRange(prev => ({ ...prev, end: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsManualPurgeOpen(false)} disabled={isProcessing}>
                            Cancelar
                        </Button>
                        <Button variant="destructive" onClick={handleManualPurge} disabled={isProcessing}>
                            {isProcessing && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                            Eliminar Rango y Descargar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
