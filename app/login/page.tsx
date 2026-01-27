"use client"

import type React from "react"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { supabase } from "@/lib/supabaseClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { Building2, Loader2, Lock, Mail } from "lucide-react"
import { logAction } from "@/app/actions/audit-actions"
import { resetAuthCache } from "@/hooks/use-auth"

export default function LoginPage() {
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const { toast } = useToast()

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)

        try {
            const { data: authData, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            })
            if (error) throw error

            // Log login
            if (authData.user) {
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
            
            // Use window.location for a full page reload to ensure auth state is fresh
            window.location.href = "/"
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Ocurrió un error al intentar autenticar",
                variant: "destructive",
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
                            src="/Logo Geofal.svg"
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
        </div>
    )
}
