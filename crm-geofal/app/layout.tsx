import type React from "react"
import type { Metadata } from "next"
import { Inter, Geist_Mono } from "next/font/google"

import "./globals.css"

import { ThemeProvider } from "@/components/theme-provider"
import { Providers } from "@/components/providers"

const inter = Inter({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Geofal CRM - Sistema de Gestión",
  description: "Geofal CRM para administración de clientes y cotizaciones",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/geofal.svg" />
      </head>
      <body className={`font-sans antialiased h-screen overflow-hidden`} suppressHydrationWarning>
        <Providers>
          <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
            {children}

          </ThemeProvider>
        </Providers>
      </body>
    </html>
  )
}
