"use client"

import { useEffect, useState, useRef } from "react"
import { supabase } from "@/lib/supabaseClient"

export type UserRole = "admin" | "vendor" | "manager"
export type ModuleType = "clientes" | "cotizadora" | "configuracion" | "proyectos" | "usuarios" | "auditoria"

export interface User {
    id: string
    name: string
    email: string
    phone?: string
    role: UserRole
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
    const mountedRef = useRef(true)

    const fetchProfile = async (userId: string): Promise<{ full_name?: string; role?: string; phone?: string; avatar_url?: string } | null> => {
        try {
            const { data, error } = await supabase
                .from("vendedores")
                .select("full_name, role, phone, avatar_url")
                .eq("id", userId)
                .single()

            if (error) return null
            return data
        } catch {
            return null
        }
    }

    const buildUser = async (session: any): Promise<User> => {
        const profile = await fetchProfile(session.user.id)
        return {
            id: session.user.id,
            name: profile?.full_name || session.user.email?.split("@")[0] || "Usuario",
            email: session.user.email || "",
            phone: profile?.phone || "",
            role: (profile?.role as UserRole) || "vendor",
            avatar: profile?.avatar_url
        }
    }

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

    return { user, loading, signOut, refreshUser }
}


