"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { toast } from "sonner"
import { Building2, Loader2, Lock, Mail, Activity } from "lucide-react"
import { logAction } from "@/app/actions/audit-actions"
import { resetAuthCache } from "@/hooks/use-auth"
import { createSessionAction } from "@/app/actions/auth-actions"
import { cn } from "@/lib/utils"

export default function LoginPage() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const router = useRouter()






    // Add state for session conflict dialog
    const [sessionConflict, setSessionConflict] = useState<{ isOpen: boolean; details?: any }>({ isOpen: false })
    const [isClosing, setIsClosing] = useState(false)

    const closeSessionConflict = () => {
        setIsClosing(true)
        setTimeout(() => {
            setSessionConflict({ isOpen: false })
            setIsClosing(false)
        }, 200) // Match duration-200
    }

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setSessionConflict({ isOpen: false })

        try {
            const { data: authData, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })
            if (error) throw error

            // Log login
            if (authData.user) {
                // Try create secure single session
                const sessionResult = await createSessionAction(authData.user.id)

                if (sessionResult.error) {
                    if (sessionResult.code === 'SESSION_EXISTS') {
                        // Sign out locally
                        await supabase.auth.signOut()
                        setSessionConflict({
                            isOpen: true,
                            details: sessionResult.details
                        })
                        setLoading(false)
                        return
                    }
                    throw new Error(sessionResult.error)
                }

                logAction({
                    user_id: authData.user.id,
                    user_name: authData.user.user_metadata?.full_name || email,
                    action: "Inicio de sesión",
                    module: "AUTH",
                    details: { email }
                })
            }

            // Reset auth cache to force fresh fetch on redirect
            resetAuthCache()
            window.location.href = "/"
        } catch (error: any) {
            let errorMessage = error.message || "Ocurrió un error al intentar autenticar"

            // Translate common auth errors
            if (errorMessage.includes("Invalid login credentials")) {
                errorMessage = "Correo o contraseña incorrectos"
            } else if (errorMessage.includes("Email not confirmed")) {
                errorMessage = "El correo electrónico no ha sido confirmado"
            }

            toast.error("Error de Acceso", {
                description: errorMessage,
            })
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden">
            {/* Professional Background Image */}
            <div
                className="absolute inset-0 bg-cover bg-center bg-no-repeat"
                style={{ backgroundImage: "url('/login-background.png')" }}
            />
            {/* Dark overlay for better contrast */}
            <div className="absolute inset-0 bg-gradient-to-br from-zinc-900/70 via-zinc-800/60 to-primary/40" />

            {/* Subtle blur overlay */}
            <div className="absolute inset-0 backdrop-blur-[2px]" />

            <Card className="w-full max-w-md border-white/20 bg-white/95 backdrop-blur-xl relative z-10 shadow-2xl">
                <CardHeader className="space-y-3 items-center text-center">
                    <div className="flex items-center justify-center mb-4">
                        <img
                            src="/logo-geofal.svg"
                            alt="Geofal CRM"
                            className="h-16 w-auto"
                        />
                    </div>
                    <CardTitle className="text-3xl font-bold tracking-tight text-zinc-900 font-outfit">Geofal CRM</CardTitle>
                    <CardDescription className="text-zinc-500 text-base">
                        Ingresa tus credenciales para continuar
                    </CardDescription>
                </CardHeader>
                <form onSubmit={handleAuth}>
                    <CardContent className="space-y-4 pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-zinc-700 ml-1">Correo Electrónico</Label>
                            <div className="relative">
                                <Mail className="absolute left-3 top-3 h-5 w-5 text-zinc-400" />
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="nombre@empresa.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="pl-10 h-11 bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-primary/50 focus:ring-primary/20 transition-all"
                                    required
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <div className="flex items-center justify-between ml-1">
                                <Label htmlFor="password" title="Contraseña" className="text-zinc-700">Contraseña</Label>
                            </div>
                            <div className="relative">
                                <Lock className="absolute left-3 top-3 h-5 w-5 text-zinc-400" />
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="pl-10 h-11 bg-white border-zinc-200 text-zinc-900 placeholder:text-zinc-400 focus:border-primary/50 focus:ring-primary/20 transition-all"
                                    required
                                />
                            </div>
                        </div>
                    </CardContent>
                    <CardFooter className="flex flex-col space-y-4 pt-6">
                        <Button type="submit" className="w-full h-11 text-base font-semibold transition-all hover:scale-[1.01] active:scale-[0.99] bg-primary text-primary-foreground" disabled={loading}>
                            {loading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    Iniciando sesión...
                                </>
                            ) : (
                                "Iniciar Sesión"
                            )}
                        </Button>
                    </CardFooter>
                </form>
            </Card>

            {/* Footer info */}
            <div className="absolute bottom-6 text-white/80 text-xs font-medium z-10">
                © 2026 Geofal CRM. Todos los derechos reservados.
            </div>

            {/* Session Conflict Dialog */}
            {(sessionConflict.isOpen || isClosing) && (
                <div className={cn(
                    "fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-200",
                    isClosing ? "opacity-0" : "opacity-100 animate-in fade-in"
                )}>
                    <Card className={cn(
                        "w-full max-w-md border-red-200 bg-white shadow-lg",
                        isClosing ? "animate-out fade-out zoom-out-0 duration-200" : "animate-in fade-in zoom-in-0 duration-200"
                    )}>
                        <CardHeader className="text-center pb-2">
                            <div className="mx-auto w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mb-4">
                                <Lock className="h-6 w-6 text-red-600" />
                            </div>
                            <CardTitle className="text-xl font-bold text-red-700">Acceso Denegado</CardTitle>
                            <CardDescription className="text-zinc-600">
                                Este usuario ya tiene una sesión activa (online) en otro dispositivo.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 pt-2">
                            <div className="bg-red-50 p-4 rounded-lg border border-red-100 text-sm">
                                <div className="flex items-center gap-2 mb-2 text-red-800 font-semibold">
                                    <Activity className="h-4 w-4" />
                                    Detalles de la sesión activa:
                                </div>
                                <div className="space-y-1 text-zinc-700 ml-6">
                                    <p>• <strong>Dispositivo:</strong> {sessionConflict.details?.device_info || 'Navegador Web'}</p>
                                    <p>• <strong>Inicio:</strong> {sessionConflict.details?.last_login_at ? new Date(sessionConflict.details.last_login_at).toLocaleString() : 'Recientemente'}</p>
                                </div>
                            </div>
                            <p className="text-center text-xs text-muted-foreground">
                                Solo se permite una sesión activa por seguridad. Cierre la otra sesión o espere a que expire.
                            </p>
                        </CardContent>
                        <CardFooter className="flex-col gap-2">
                            <Button
                                variant="outline"
                                className="w-full border-zinc-200 text-zinc-700 hover:bg-zinc-100 hover:text-zinc-900"
                                onClick={closeSessionConflict}
                            >
                                Entendido, cancelar
                            </Button>
                        </CardFooter>
                    </Card>
                </div>
            )}

        </div>
    )
}
