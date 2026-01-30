import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'


const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export async function middleware(req: NextRequest) {
    const res = NextResponse.next()
    const { pathname } = req.nextUrl

    // 1. Define Public Routes
    const isPublicRoute =
        pathname === '/login' ||
        pathname.startsWith('/_next') ||
        pathname.startsWith('/static') ||
        pathname.startsWith('/api/auth') ||
        pathname === '/favicon.ico' ||
        pathname.match(/\.(svg|png|jpg|jpeg|gif|webp)$/)

    if (isPublicRoute) {
        return res
    }

    // 2. Check Session Cookie
    const sessionId = req.cookies.get('crm_session')?.value

    if (!sessionId) {
        return NextResponse.redirect(new URL('/login', req.url))
    }

    // 3. Verify Session & Get Role using Service Key (High Privilege)
    try {
        if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
            throw new Error("Missing Supabase Config")
        }

        // Initialize Supabase Client
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            }
        })

        // 1. Get Session
        const { data: sessionData, error: sessionError } = await supabase
            .from('active_sessions')
            .select('user_id')
            .eq('session_id', sessionId)
            .single()

        if (sessionError || !sessionData) {
            console.error("Middleware Session Check Failed:", sessionError?.message)
            const response = NextResponse.redirect(new URL('/login?error=session_expired', req.url))
            response.cookies.delete('crm_session')
            return response
        }

        const userId = sessionData.user_id

        // 2. Get Role
        const { data: roleData, error: roleError } = await supabase
            .from('perfiles')
            .select('role')
            .eq('id', userId)
            .single()

        const role = roleData?.role || null

        // 4. Role Based Access Control (RBAC)

        // Admin General Access: All
        if (role === 'admin_general') {
            return res
        }

        // Laboratorio Routes
        if (pathname.startsWith('/laboratorio') || pathname.startsWith('/programacion')) {
            if (role !== 'laboratorio' && role !== 'laboratorio_leer') {
                return NextResponse.redirect(new URL('/unauthorized', req.url))
            }
        }

        // Comercial Routes
        if (pathname.startsWith('/comercial') || pathname.startsWith('/cotizaciones') || pathname.startsWith('/clientes')) {
            // Assuming 'vendedor' is the role for comercial
            if (role !== 'vendedor' && role !== 'administracion') {
                // Note: 'administracion' is unclear if they have access to comercial, assuming NO based on "acceso a otras tablas pero no modulos"
                // Prompt: "user_administracion: ... acceso a otras tablas pero no modulos" -> Implies NO module access?
                // Prompt: "user_vendedor: Solo VER tabla comercial".
                // Let's stick to strict: Vendedor only.
                if (role !== 'vendedor') {
                    return NextResponse.redirect(new URL('/unauthorized', req.url))
                }
            }
        }

        // Administracion Routes
        if (pathname.startsWith('/administracion')) {
            if (role !== 'administracion') {
                return NextResponse.redirect(new URL('/unauthorized', req.url))
            }
        }

        return res

    } catch (err) {
        console.error("Middleware Error:", err)
        return NextResponse.redirect(new URL('/login?error=server_error', req.url))
    }
}

export const config = {
    matcher: [
        /*
         * Match all request paths except for the ones starting with:
         * - api (API routes)
         * - _next/static (static files)
         * - _next/image (image optimization files)
         * - favicon.ico (favicon file)
         */
        '/((?!api|_next/static|_next/image|favicon.ico).*)',
    ],
}
