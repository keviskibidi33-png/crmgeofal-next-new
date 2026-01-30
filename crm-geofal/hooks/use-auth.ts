"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabaseClient"
import { deleteSessionAction } from "@/app/actions/auth-actions"

export type UserRole = "admin" | "vendor" | "manager" | "laboratorio" | "comercial" | "administracion" | string
export type ModuleType = "clientes" | "cotizadora" | "configuracion" | "proyectos" | "usuarios" | "auditoria" | "programacion" | "permisos" | "laboratorio"

export interface Permission {
    read: boolean
    write: boolean
    delete: boolean
}

export interface RolePermissions {
    [key: string]: Permission
}

export interface User {
    id: string
    name: string
    email: string
    phone?: string
    role: UserRole
    roleLabel?: string
    permissions?: RolePermissions
    avatar?: string
}

// Module-level cache - persists across component re-mounts
let cachedUser: User | null = null
let hasInitialized = false

// Function to reset cache (useful for fresh login)
export function resetAuthCache() {
    cachedUser = null
    hasInitialized = false
}

export function useAuth() {
    const [user, setUser] = useState<User | null>(cachedUser)
    const [loading, setLoading] = useState(!hasInitialized)
    const [isSessionTerminated, setIsSessionTerminated] = useState(false)
    const mountedRef = useRef(true)
    const sessionStartRef = useRef<string>(new Date().toISOString())

    const fetchProfile = async (userId: string): Promise<{ full_name?: string; role?: string; phone?: string; avatar_url?: string; last_force_logout_at?: string; role_definitions?: { label: string; permissions: any } | { label: string; permissions: any }[] } | null> => {
        try {
            // Explicitly specify the foreign key constraint if needed, or just standard join. 
            // Trying standard join first, but checking if there was a typo.
            const { data, error } = await supabase
                .from("perfiles")
                .select("full_name, role, phone, avatar_url, last_force_logout_at, role_definitions!fk_perfiles_role(label, permissions)")
                .eq("id", userId)
                .single()

            if (error) {
                console.error("[Auth] Error fetching profile:", error)
                // Fallback attempt without constraint name if first fails (optional, but good for robustness)
                return null
            }
            console.log("[Auth] Fetched profile:", data)
            return data
        } catch (e) {
            console.error("[Auth] Exception fetching profile:", e)
            return null
        }
    }

    const buildUser = async (session: any): Promise<User> => {
        const profile = await fetchProfile(session.user.id)

        // Default permissions for fallback (e.g. vendor)
        const defaultPermissions: RolePermissions = {
            clientes: { read: true, write: true, delete: false },
            proyectos: { read: true, write: true, delete: false },
            cotizadora: { read: true, write: true, delete: false },
            programacion: { read: true, write: false, delete: false },
        }

        const role = (profile?.role?.toLowerCase() as UserRole) || (session.user.user_metadata?.role?.toLowerCase() as UserRole) || "vendor"

        // Use permissions from DB if available, otherwise fallback
        // If role IS admin, we can implicitly grant all, but better to use DB truth if available.
        // For admin fallback we could grant all.

        // Handle role_definitions being an array or object
        const roleDef = Array.isArray(profile?.role_definitions)
            ? profile?.role_definitions[0]
            : profile?.role_definitions

        let permissions = roleDef?.permissions || defaultPermissions

        // Hardcode admin override if DB lookup failed but role is admin
        if (role === 'admin' && !roleDef) {
            // Grant all... (simplified)
        }

        return {
            id: session.user.id,
            name: profile?.full_name || session.user.email?.split("@")[0] || "Usuario",
            email: session.user.email!,
            role: role,
            roleLabel: roleDef?.label || (role === 'admin' ? "Administrador" : "Vendedor"),
            permissions: permissions,
            phone: profile?.phone,
            avatar: profile?.avatar_url
        }
    }


    // --- Heartbeat & Realtime Guard ---
    useEffect(() => {
        if (!user) return

        // 1. Heartbeat Function
        const sendHeartbeat = async () => {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'
            try {
                const res = await fetch(`${apiUrl}/users/heartbeat`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ user_id: user.id })
                })

                if (res.ok) {
                    const data = await res.json()
                    if (data.status === 'inactive') {
                        console.warn("User account is inactive. Logging out...")
                        setIsSessionTerminated(true) // Reuse termination logic or force logout
                        await signOut()
                    }
                }
            } catch (err) {
                // Heartbeat failures are expected if backend is unreachable; use warn to avoid spamming error console
                console.warn("Heartbeat skipped:", err)
            }
        }

        // Send initial heartbeat
        sendHeartbeat()
        // Interval for every 2 minutes
        const heartbeatInterval = setInterval(sendHeartbeat, 2 * 60 * 1000)

        // 2. Realtime Subscription
        // 2. Realtime Subscription (Robust Pattern)
        const channel = supabase
            .channel(`session_guard_${user.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'perfiles',
                    filter: `id=eq.${user.id}`,
                },
                (payload) => {
                    const newUser = payload.new as any
                    // Check if last_force_logout_at changed and is newer than our session start
                    if (newUser.last_force_logout_at) {
                        const logoutTime = new Date(newUser.last_force_logout_at).getTime()
                        const sessionTime = new Date(sessionStartRef.current).getTime()

                        if (logoutTime > sessionTime) {
                            console.warn("Force logout received via Realtime")
                            setIsSessionTerminated(true)
                            // Optional: disconnect purely to stop receiving more events
                            supabase.removeChannel(channel)
                        }
                    }
                }
            )
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    // console.log("Session Monitor: Connected")
                } else if (status === 'CHANNEL_ERROR') {
                    console.warn("Session Monitor: Connection Error")
                }
            })

        return () => {
            clearInterval(heartbeatInterval)
            supabase.removeChannel(channel)
        }
    }, [user])


    useEffect(() => {
        mountedRef.current = true

        // If already initialized with a user, skip
        if (hasInitialized && cachedUser) {
            setUser(cachedUser)
            setLoading(false)
            return
        }

        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession()

            if (!session) {
                cachedUser = null
                hasInitialized = true
                if (mountedRef.current) {
                    setUser(null)
                    setLoading(false)
                }
                return
            }

            const newUser = await buildUser(session)
            cachedUser = newUser
            hasInitialized = true

            if (mountedRef.current) {
                setUser(newUser)
                setLoading(false)
            }
        }

        init()

        // Auth state listener - only handle actual sign-in/out, ignore everything else
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
            // Ignore all events if we already have a user (prevents re-auth on tab switch)
            if (cachedUser && event !== "SIGNED_OUT") {
                return
            }

            if (event === "SIGNED_OUT") {
                cachedUser = null
                hasInitialized = false
                setUser(null)
                setLoading(false)
                if (typeof window !== "undefined" && window.location.pathname !== "/login") {
                    window.location.href = "/login"
                }
            } else if (event === "SIGNED_IN" && session && !cachedUser) {
                sessionStartRef.current = new Date().toISOString() // Reset session start on new login
                buildUser(session).then(newUser => {
                    cachedUser = newUser
                    hasInitialized = true
                    if (mountedRef.current) {
                        setUser(newUser)
                        setLoading(false)
                    }
                })
            }
        })

        return () => {
            mountedRef.current = false
            subscription.unsubscribe()
        }
    }, [])



    const signOut = async () => {
        setLoading(true)
        cachedUser = null
        hasInitialized = false
        try {
            await deleteSessionAction() // Clear server session first
            await supabase.auth.signOut()
            localStorage.clear()
            sessionStorage.clear()
        } catch (e) {
            console.error("Sign out error:", e)
        }
        setUser(null)
        setLoading(false)
        window.location.href = "/login"
    }

    const refreshUser = async () => {
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
            const newUser = await buildUser(session)
            cachedUser = newUser
            setUser(newUser)
        }
    }

    return { user, loading, signOut, refreshUser, isSessionTerminated }
}
