"use server"

import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Simple client with service role to bypass RLS for administrative logging
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
})

export interface AuditLog {
    user_id?: string
    user_name?: string
    action: string
    module?: string
    details?: any
    ip_address?: string
    severity?: 'info' | 'warning' | 'error'
}

export async function logAction(data: AuditLog) {
    if (!supabaseServiceKey) return { error: "Service Role Key missing" }

    try {
        const { error } = await supabaseAdmin
            .from('auditoria')
            .insert({
                user_id: data.user_id,
                user_name: data.user_name,
                action: data.action,
                module: data.module,
                details: data.details,
                ip_address: data.ip_address,
                severity: data.severity || 'info'
            })

        if (error) {
            console.error("Error inserting audit log:", error)
            return { error: error.message }
        }

        return { success: true }
    } catch (err: any) {
        console.error("Audit log error:", err)
        return { error: err.message }
    }
}

export async function getAuditLogs(filters: {
    startDate?: string
    endDate?: string
    userId?: string
    page?: number
    pageSize?: number
}) {
    if (!supabaseServiceKey) return { error: "Service Role Key missing" }

    const page = filters.page || 1
    const pageSize = filters.pageSize || 50
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    try {
        let query = supabaseAdmin
            .from('auditoria')
            .select('*', { count: 'exact' })
            .order('created_at', { ascending: false })
            .range(from, to)

        if (filters.startDate) {
            query = query.gte('created_at', filters.startDate)
        }
        if (filters.endDate) {
            query = query.lte('created_at', filters.endDate)
        }
        if (filters.userId && filters.userId !== 'all') {
            query = query.eq('user_id', filters.userId)
        }

        const { data, error, count } = await query

        if (error) throw error

        return { data, count, success: true }
    } catch (err: any) {
        console.error("Get audit logs error:", err)
        return { error: err.message }
    }
}

export async function purgeLogsAction(days: number) {
    if (!supabaseServiceKey) return { error: "Service Role Key missing" }

    const dateLimit = new Date()
    dateLimit.setDate(dateLimit.getDate() - days)
    const limitISO = dateLimit.toISOString()

    try {
        // 1. Get data to generate TXT before deleting
        const { data: logsToDelete, error: fetchError } = await supabaseAdmin
            .from('auditoria')
            .select('*')
            .lt('created_at', limitISO)
            .order('created_at', { ascending: true })

        if (fetchError) throw fetchError

        if (!logsToDelete || logsToDelete.length === 0) {
            return { success: true, message: "No hay logs para eliminar", data: "" }
        }

        // 2. Format logs into TXT string
        const txtContent = logsToDelete.map(log =>
            `[${log.created_at}] USER: ${log.user_name || 'System'} | ACTION: ${log.action} | MODULE: ${log.module || 'N/A'} | DETAILS: ${JSON.stringify(log.details)}`
        ).join('\n')

        // 3. Delete from database
        const { error: deleteError } = await supabaseAdmin
            .from('auditoria')
            .delete()
            .lt('created_at', limitISO)

        if (deleteError) throw deleteError

        return {
            success: true,
            data: txtContent,
            count: logsToDelete.length,
            filename: `audit_purge_${new Date().toISOString().split('T')[0]}.txt`
        }
    } catch (err: any) {
        console.error("Purge logs error:", err)
        return { error: err.message }
    }
}

export async function manualRangePurge(startDate: string, endDate: string) {
    if (!supabaseServiceKey) return { error: "Service Role Key missing" }

    try {
        // Just like purge but with specific range
        const { data: logsToDelete, error: fetchError } = await supabaseAdmin
            .from('auditoria')
            .select('*')
            .gte('created_at', startDate)
            .lte('created_at', endDate)

        if (fetchError) throw fetchError

        const txtContent = logsToDelete?.map(log =>
            `[${log.created_at}] USER: ${log.user_name || 'System'} | ACTION: ${log.action} | DETAILS: ${JSON.stringify(log.details)}`
        ).join('\n') || ""

        const { error: deleteError } = await supabaseAdmin
            .from('auditoria')
            .delete()
            .gte('created_at', startDate)
            .lte('created_at', endDate)

        if (deleteError) throw deleteError

        return {
            success: true,
            data: txtContent,
            count: logsToDelete?.length || 0,
            filename: `manual_purge_${startDate}_to_${endDate}.txt`
        }
    } catch (err: any) {
        return { error: err.message }
    }
}
