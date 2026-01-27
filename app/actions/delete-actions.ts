"use server"

import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export async function deleteClientAction(clientId: string) {
  if (!supabaseServiceKey) {
    return { error: "Service Role Key not configured" }
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  try {
    const { error } = await supabaseAdmin
      .from("clientes")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", clientId)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('💥 [SERVER DELETE CLIENT ERROR]', error)
    return { error: error.message || "Failed to delete client" }
  }
}

export async function deleteProjectAction(projectId: string) {
  if (!supabaseServiceKey) {
    return { error: "Service Role Key not configured" }
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })

  try {
    const { error } = await supabaseAdmin
      .from("proyectos")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", projectId)

    if (error) throw error

    return { success: true }
  } catch (error: any) {
    console.error('💥 [SERVER DELETE PROJECT ERROR]', error)
    return { error: error.message || "Failed to delete project" }
  }
}
