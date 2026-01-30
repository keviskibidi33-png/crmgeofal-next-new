"use client"

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ShieldAlert } from "lucide-react"

interface SessionTerminatedDialogProps {
    open: boolean
    onConfirm: () => void
}

export function SessionTerminatedDialog({ open, onConfirm }: SessionTerminatedDialogProps) {
    return (
        <AlertDialog open={open}>
            <AlertDialogContent className="max-w-[400px] border-l-4 border-l-destructive bg-card shadow-2xl">
                <AlertDialogHeader className="space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center">
                            <ShieldAlert className="h-5 w-5 text-destructive" />
                        </div>
                        <AlertDialogTitle className="text-xl font-bold">Sesión Finalizada</AlertDialogTitle>
                    </div>
                    <AlertDialogDescription className="text-slate-600 font-medium">
                        Tu sesión ha sido cerrada por un administrador o ha expirado por motivos de seguridad.
                        <br /><br />
                        Por favor, inicia sesión nuevamente para continuar.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="mt-4">
                    <AlertDialogAction
                        onClick={onConfirm}
                        className="w-full bg-destructive text-destructive-foreground hover:bg-destructive/90 font-bold"
                    >
                        Entendido, ir al Login
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
