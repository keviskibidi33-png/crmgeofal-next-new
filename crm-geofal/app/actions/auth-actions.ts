"use server"

import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import { randomUUID } from "crypto"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Helper to verify admin role
async function verifyAdminRole() {
    const cookieStore = await cookies()
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } })

    // Get the session ID from the cookie
    const sessionId = cookieStore.get('crm_session')?.value
    if (!sessionId) return false

    // Look up the user ID from the active session
    const { data: sessionData } = await supabaseAdmin
        .from('active_sessions')
        .select('user_id')
        .eq('session_id', sessionId)
        .single()

    if (!sessionData) return false

    // Check the user's role in perfiles
    const { data: userProfile } = await supabaseAdmin
        .from('perfiles')
        .select('role')
        .eq('id', sessionData.user_id)
        .single()

    return userProfile?.role === 'admin'
}

export async function createUserAction(data: {
    email: string
    password: string
    nombre: string
    phone?: string
    role: string
}) {
    if (!supabaseServiceKey) {
        return {
            error: "Configuración del servidor incompleta (Falta Service Role Key). Por favor contacte a soporte."
        }
    }

    if (!(await verifyAdminRole())) {
        return { error: "No tiene permisos para realizar esta acción." }
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })

    try {
        const { data: userData, error } = await supabaseAdmin.auth.admin.createUser({
            email: data.email,
            password: data.password,
            email_confirm: true, // Auto-confirm the user
            user_metadata: {
                full_name: data.nombre,
                role: data.role // Set role immediately in metadata
            }
        })

        if (error) {
            console.error("Error creating user:", error)
            return { error: error.message }
        }

        // Note: The triggers on the 'users' table should handle the creation of the 'vendedores' record.
        // However, we explicitly upsert to ensure the EMAIL and other fields are strictly in sync

        const { error: syncError } = await supabaseAdmin
            .from('perfiles')
            .upsert({
                id: userData.user.id,
                full_name: data.nombre,
                email: data.email,
                phone: data.phone || null,
                role: data.role,
                updated_at: new Date().toISOString()
            }, { onConflict: 'id' })

        if (syncError) {
            console.warn("Manual sync of new user failed:", syncError)
        }

        return { success: true, user: userData.user }
    } catch (err: any) {
        console.error("Server action error:", err)
        return { error: err.message || "Error interno del servidor" }
    }
}

export async function updateUserAction(data: {
    userId: string
    nombre?: string
    email?: string
    password?: string
    phone?: string
    role?: string
}) {
    if (!supabaseServiceKey) {
        return {
            error: "Configuración del servidor incompleta (Falta Service Role Key)."
        }
    }

    if (!(await verifyAdminRole())) {
        return { error: "No tiene permisos para realizar esta acción." }
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })

    try {
        const updates: any = {
            user_metadata: {}
        }

        if (data.email) updates.email = data.email
        if (data.password && data.password.trim() !== "") updates.password = data.password
        if (data.nombre) updates.user_metadata.full_name = data.nombre
        if (data.role) updates.user_metadata.role = data.role
        if (data.phone) updates.user_metadata.phone = data.phone

        // Update auth user (password, email, metadata)
        const { data: userData, error: authError } = await supabaseAdmin.auth.admin.updateUserById(
            data.userId,
            updates
        )

        if (authError) throw authError

        // Also update the public 'vendedores' table to stay in sync
        const dbUpdates: any = {
            id: data.userId,
            updated_at: new Date().toISOString(),
            deleted_at: null // Ensure record is not soft-deleted if we are actively updating it
        }

        // Only include fields if they were provided in data to avoid nulling existing values
        if (data.nombre) dbUpdates.full_name = data.nombre
        if (data.role) dbUpdates.role = data.role
        if (data.phone !== undefined) dbUpdates.phone = data.phone
        if (data.email) dbUpdates.email = data.email

        const { error: dbError } = await supabaseAdmin
            .from('perfiles')
            .upsert(dbUpdates, { onConflict: 'id' })

        if (dbError) {
            console.warn("DB update failed but Auth update succeeded:", dbError)
        }

        return { success: true }

    } catch (err: any) {
        console.error("Update user error:", err)
        return { error: err.message || "Error al actualizar usuario" }
    }
}

export async function deleteUserAction(userId: string) {
    if (!supabaseServiceKey) return { error: "Falta Service Role Key" }

    if (!(await verifyAdminRole())) {
        return { error: "No tiene permisos para realizar esta acción." }
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    })

    try {
        // 1. Get current user details to preserve original email in metadata if needed
        const { data: userProfile } = await supabaseAdmin
            .from('perfiles')
            .select('email')
            .eq('id', userId)
            .single()

        const originalEmail = userProfile?.email || "unknown"
        const timestamp = Date.now()
        // Create an archived email that definitely won't conflict
        const archivedEmail = `deleted_${timestamp}_${userId}@archived.local`

        // 2. "Release" the email by renaming the account in Auth and Perfiles
        // This ensures that even if Hard Delete fails (due to constraints), the email is free.

        // A. Update Auth User
        const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(userId, {
            email: archivedEmail,
            user_metadata: {
                original_email: originalEmail,
                deleted: true,
                deleted_at: new Date().toISOString()
            }
        })

        if (updateAuthError) {
            console.error("Failed to release email in Auth:", updateAuthError)
            return { error: "Error al liberar el correo: " + updateAuthError.message }
        }

        // B. Update Perfiles (Public) - Mark as inactive and rename email
        const { error: updateDbError } = await supabaseAdmin
            .from('perfiles')
            .update({
                email: archivedEmail,
                activo: false,
                deleted_at: new Date().toISOString()
            })
            .eq('id', userId)

        if (updateDbError) {
            console.warn("Failed to update perfiles during archive:", updateDbError)
            // Continue anyway, as Auth email is the most critical one to release
        }

        // 3. Attempt Hard Delete
        // If this succeeds, the user is gone forever (great).
        // If this fails (e.g. FK violation from 'cotizaciones'), the catch block would usually catch it
        // BUT 'deleteUser' from Auth might silently fail to cascade if FK is RESTRICT.

        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

        if (deleteError) {
            console.warn("Hard delete failed (likely constraints):", deleteError)
            // This is acceptable. We successfully "Archived" the user by renaming credentials.
            // We return SUCCESS so the UI updates, as the "User" effectively no longer exists as a valid login.
        }

        return { success: true }
    } catch (err: any) {
        console.error("Delete user error details:", JSON.stringify(err, null, 2))
        return { error: `Error durante el proceso de eliminación: ${err.message || 'Error desconocido'}` }
    }
}
export async function createSessionAction(userId: string) {
    if (!supabaseServiceKey) return { error: "Falta Service Role Key" }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    })

    try {
        const sessionId = randomUUID()
        const cookieStore = await cookies()

        // 0. Check if user is active
        const { data: userProfile } = await supabaseAdmin
            .from('perfiles')
            .select('activo')
            .eq('id', userId)
            .single()

        if (userProfile && userProfile.activo === false) {
            return { error: "Su cuenta ha sido desactivada. Contacte al administrador." }
        }

        // 1. Try to INSERT active session in DB (StrictMode: Fail if exists)
        const { error: dbError } = await supabaseAdmin
            .from('active_sessions')
            .insert({
                user_id: userId,
                session_id: sessionId,
                last_login_at: new Date().toISOString(),
                device_info: "browser"
            })

        if (dbError) {
            // Check for unique violation (Postgres code 23505)
            if (dbError.code === '23505') {
                // 1. Check if the "active" session is actually stale based on Heartbeat
                const { data: profile } = await supabaseAdmin
                    .from('perfiles')
                    .select('last_seen_at')
                    .eq('id', userId)
                    .single()

                const lastSeen = profile?.last_seen_at ? new Date(profile.last_seen_at).getTime() : 0
                const now = new Date().getTime()
                // Threshold: 2 minutes (120000 ms)
                const isStale = (now - lastSeen) > (2 * 60 * 1000)

                if (isStale) {
                    // Session is a ghost OR valid user with failed heartbeats. 
                    // To be safe and enforce single session:
                    // 1. Kill the DB session
                    await supabaseAdmin
                        .from('active_sessions')
                        .delete()
                        .eq('user_id', userId)

                    // 2. FORCE signal to other clients to log out (just in case they are online)
                    await supabaseAdmin
                        .from('perfiles')
                        .update({ last_force_logout_at: new Date().toISOString() })
                        .eq('id', userId)

                    // Retry creation
                    const { error: retryError } = await supabaseAdmin
                        .from('active_sessions')
                        .insert({
                            user_id: userId,
                            session_id: sessionId,
                            last_login_at: new Date().toISOString(),
                            device_info: "browser"
                        })

                    if (retryError) throw retryError // If it fails again, real error
                } else {
                    // Session is genuinely active. Block it.
                    const { data: existingSession } = await supabaseAdmin
                        .from('active_sessions')
                        .select('last_login_at, device_info')
                        .eq('user_id', userId)
                        .single()

                    return {
                        error: "Este usuario ya tiene una sesión activa",
                        code: 'SESSION_EXISTS',
                        details: existingSession
                    }
                }
            } else {
                throw dbError
            }
        }

        // Successfully created session. Now mark user as SEEN so it's not immediately stale
        await supabaseAdmin
            .from('perfiles')
            .update({ last_seen_at: new Date().toISOString() })
            .eq('id', userId)

        // 2. Set HTTP-only cookie
        cookieStore.set('crm_session', sessionId, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 60 * 60 * 24 * 7 // 1 week
        })

        return { success: true }
    } catch (err: any) {
        console.error("Create session error:", err)
        return { error: "Error al crear sesión segura" }
    }
}

export async function deleteSessionAction() {
    if (!supabaseServiceKey) return { error: "Falta Service Role Key" }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    })

    try {
        const cookieStore = await cookies()
        const sessionId = cookieStore.get('crm_session')?.value

        if (sessionId) {
            // Remove from DB
            await supabaseAdmin
                .from('active_sessions')
                .delete()
                .eq('session_id', sessionId)

            // Remove cookie
            cookieStore.delete('crm_session')
        }

        return { success: true }
    } catch (err: any) {
        console.error("Delete session error:", err)
        return { error: "Error al cerrar sesión segura" }
    }
}
