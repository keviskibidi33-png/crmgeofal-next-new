"use client"

import React from "react"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { ShieldAlert, AlertTriangle } from "lucide-react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"

interface ModernConfirmDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: () => void
    title?: string
    description?: string
    confirmText?: string
    cancelText?: string
    variant?: "destructive" | "warning" | "default"
    showInput?: boolean
    inputPlaceholder?: string
    inputValue?: string
    onInputChange?: (value: string) => void
    expectedValue?: string
}

export function ModernConfirmDialog({
    open,
    onOpenChange,
    onConfirm,
    title = "Confirmar acción",
    description = "¿Estás seguro de que deseas realizar esta acción? Esta operación puede ser irreversible.",
    confirmText = "Confirmar",
    cancelText = "Cancelar",
    variant = "destructive",
    showInput = false,
    inputPlaceholder = "",
    inputValue = "",
    onInputChange,
    expectedValue,
}: ModernConfirmDialogProps) {
    return (
        <AlertDialog open={open} onOpenChange={onOpenChange}>
            <AlertDialogContent className="sm:max-w-[400px] bg-card border-border">
                <AlertDialogHeader>
                    <div className={cn(
                        "mx-auto flex h-12 w-12 items-center justify-center rounded-full mb-4",
                        variant === "destructive" ? "bg-red-500/10" : "bg-amber-500/10"
                    )}>
                        {variant === "destructive" ? (
                            <ShieldAlert className="h-6 w-6 text-red-500" />
                        ) : (
                            <AlertTriangle className="h-6 w-6 text-amber-500" />
                        )}
                    </div>
                    <AlertDialogTitle className="text-center text-xl font-bold">
                        {title}
                    </AlertDialogTitle>
                    <AlertDialogDescription className="text-center text-muted-foreground pt-2">
                        {description}
                    </AlertDialogDescription>
                </AlertDialogHeader>
                
                {showInput && (
                    <div className="px-6 pb-4">
                        <Input
                            value={inputValue}
                            onChange={(e) => onInputChange?.(e.target.value)}
                            placeholder={inputPlaceholder}
                            className="w-full"
                        />
                        {expectedValue && (
                            <p className="text-xs text-muted-foreground mt-2">
                                Escribe: <span className="font-semibold">{expectedValue}</span>
                            </p>
                        )}
                    </div>
                )}
                
                <AlertDialogFooter className={cn(
                    "sm:justify-center gap-3 pt-6 border-t border-border/50",
                    showInput && "border-t"
                )}>
                    <AlertDialogCancel className="mt-0 flex-1 border-border hover:bg-secondary/50 transition-colors">
                        {cancelText}
                    </AlertDialogCancel>
                    <AlertDialogAction
                        onClick={async (e) => {
                            e.preventDefault()
                            await onConfirm()
                        }}
                        className={cn(
                            "flex-1 font-semibold transition-all active:scale-[0.98]",
                            variant === "destructive"
                                ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/20"
                                : "bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20"
                        )}
                    >
                        {confirmText}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    )
}
