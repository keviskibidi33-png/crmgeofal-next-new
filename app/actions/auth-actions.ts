"use server"

import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

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
            .from('vendedores')
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
            .from('vendedores')
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

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
    })

    try {
        // Delete from Auth (encadenado should cascade delete from public if constrained correctly)
        // Even if no cascade, we want to try to delete from public manually just in case

        // 1. Try deleting from public 'vendedores' first to avoid FK issues if cascade isn't set
        const { error: dbError } = await supabaseAdmin
            .from('vendedores')
            .delete()
            .eq('id', userId)

        if (dbError) {
            console.warn("Could not delete from public table (might depend on Auth):", dbError)
        }

        // 2. Delete from Auth
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)
        if (authError) throw authError

        return { success: true }
    } catch (err: any) {
        console.error("Delete user error details:", JSON.stringify(err, null, 2))
        return { error: `Error al eliminar: ${err.message || 'Error desconocido'} (Revise si el usuario tiene datos asociados como cotizaciones o clientes)` }
    }
}
