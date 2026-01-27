"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Bell, Search, LogOut, User as UserIcon, Settings, Sun, Moon, Building2, FolderKanban, FileText, Loader2 } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useTheme } from "@/components/theme-provider"
import { useAuth, type User, type ModuleType } from "@/hooks/use-auth"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { supabase } from "@/lib/supabaseClient"

interface HeaderProps {
  user: User
  setActiveModule: (module: ModuleType) => void
}

interface SearchResult {
  id: string
  type: "cliente" | "proyecto" | "cotizacion"
  title: string
  subtitle: string
}

export function DashboardHeader({ user, setActiveModule }: HeaderProps) {
  const { theme, setTheme } = useTheme()
  const { signOut } = useAuth()
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [showResults, setShowResults] = useState(false)
  const searchRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const handleLogout = async () => {
    await signOut()
  }

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark")
  }

  // Load top 3 most recent items when focusing empty search
  const loadTopSuggestions = useCallback(async () => {
    if (searchQuery.length > 0 || searchResults.length > 0) return

    setIsSearching(true)
    const suggestions: SearchResult[] = []

    try {
      // Get 3 most recent clients
      const { data: recentClients } = await supabase
        .from("clientes")
        .select("id, empresa, nombre, ruc")
        .order("created_at", { ascending: false })
        .limit(3)

      if (recentClients) {
        recentClients.forEach((c) => {
          suggestions.push({
            id: c.id,
            type: "cliente",
            title: c.empresa || c.nombre || "Sin nombre",
            subtitle: c.ruc ? `RUC: ${c.ruc}` : "Cliente reciente",
          })
        })
      }

      // Get 2 most recent projects
      const { data: recentProjects } = await supabase
        .from("proyectos")
        .select("id, nombre, estado")
        .order("created_at", { ascending: false })
        .limit(2)

      if (recentProjects) {
        recentProjects.forEach((p) => {
          suggestions.push({
            id: p.id,
            type: "proyecto",
            title: p.nombre || "Sin nombre",
            subtitle: `Estado: ${p.estado || "N/A"}`,
          })
        })
      }

      if (suggestions.length > 0) {
        setSearchResults(suggestions)
        setShowResults(true)
      }
    } catch (error) {
      console.error("Error loading suggestions:", error)
    } finally {
      setIsSearching(false)
    }
  }, [searchQuery, searchResults.length])

  // Debounced search function
  const performSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([])
      setShowResults(false)
      return
    }

    setIsSearching(true)
    const results: SearchResult[] = []
    // Use % for SQL LIKE wildcards (PostgREST standard)
    const searchPattern = `%${query}%`

    try {
      // Search clients by empresa (business name)
      const { data: clientsByEmpresa, error: clientsError } = await supabase
        .from("clientes")
        .select("id, empresa, nombre, ruc, email")
        .ilike("empresa", searchPattern)
        .limit(5)

      if (!clientsError && clientsByEmpresa) {
        clientsByEmpresa.forEach((c) => {
          results.push({
            id: c.id,
            type: "cliente",
            title: c.empresa || c.nombre || "Sin nombre",
            subtitle: c.ruc ? `RUC: ${c.ruc}` : c.email || "Sin contacto",
          })
        })
      }

      // Also search clients by nombre (contact name)
      const { data: clientsByNombre } = await supabase
        .from("clientes")
        .select("id, empresa, nombre, ruc, email")
        .ilike("nombre", searchPattern)
        .limit(5)

      if (clientsByNombre) {
        clientsByNombre.forEach((c) => {
          if (!results.find(r => r.type === "cliente" && r.id === c.id)) {
            results.push({
              id: c.id,
              type: "cliente",
              title: c.nombre || c.empresa || "Sin nombre",
              subtitle: c.ruc ? `RUC: ${c.ruc}` : c.email || "Sin contacto",
            })
          }
        })
      }

      // Also search by RUC if query looks like a number
      if (/^\d+$/.test(query)) {
        const { data: clientsByRuc } = await supabase
          .from("clientes")
          .select("id, empresa, nombre, ruc, email")
          .ilike("ruc", searchPattern)
          .limit(3)

        if (clientsByRuc) {
          clientsByRuc.forEach((c) => {
            if (!results.find(r => r.type === "cliente" && r.id === c.id)) {
              results.push({
                id: c.id,
                type: "cliente",
                title: c.empresa || c.nombre || "Sin nombre",
                subtitle: c.ruc ? `RUC: ${c.ruc}` : "Sin RUC",
              })
            }
          })
        }
      }

      // Search projects
      const { data: projects, error: projectsError } = await supabase
        .from("proyectos")
        .select("id, nombre, estado")
        .ilike("nombre", searchPattern)
        .limit(5)

      if (!projectsError && projects) {
        projects.forEach((p) => {
          results.push({
            id: p.id,
            type: "proyecto",
            title: p.nombre || "Sin nombre",
            subtitle: `Estado: ${p.estado || "N/A"}`,
          })
        })
      }

      // Search quotes only if query matches quote format (COT or numbers)
      if (query.toUpperCase().includes("COT") || /^\d+$/.test(query)) {
        const { data: quotes, error: quotesError } = await supabase
          .from("cotizaciones")
          .select("id, numero, total")
          .ilike("numero", searchPattern)
          .limit(5)

        if (!quotesError && quotes) {
          quotes.forEach((q) => {
            results.push({
              id: q.id,
              type: "cotizacion",
              title: q.numero || "Sin número",
              subtitle: q.total ? `S/ ${Number(q.total).toLocaleString()}` : "Sin monto",
            })
          })
        }
      }

      setSearchResults(results)
      setShowResults(results.length > 0)
    } catch (error) {
      console.error("Search error:", error)
    } finally {
      setIsSearching(false)
    }
  }, [])

  // Handle search input with debounce
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value
    setSearchQuery(query)

    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      performSearch(query)
    }, 300)
  }

  // Handle result click
  const handleResultClick = (result: SearchResult) => {
    setSearchQuery("")
    setShowResults(false)
    setSearchResults([])

    switch (result.type) {
      case "cliente":
        setActiveModule("clientes")
        break
      case "proyecto":
        setActiveModule("proyectos")
        break
      case "cotizacion":
        setActiveModule("cotizadora")
        break
    }
  }

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const getResultIcon = (type: SearchResult["type"]) => {
    switch (type) {
      case "cliente":
        return <Building2 className="h-4 w-4 text-blue-500" />
      case "proyecto":
        return <FolderKanban className="h-4 w-4 text-green-500" />
      case "cotizacion":
        return <FileText className="h-4 w-4 text-orange-500" />
    }
  }

  const getTypeLabel = (type: SearchResult["type"]) => {
    switch (type) {
      case "cliente":
        return "Cliente"
      case "proyecto":
        return "Proyecto"
      case "cotizacion":
        return "Cotización"
    }
  }

  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm flex items-center justify-between px-6">
      {/* Search with Autocomplete */}
      <div className="relative w-96" ref={searchRef}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        {isSearching && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground animate-spin" />
        )}
        <Input
          placeholder="Buscar clientes, proyectos, cotizaciones..."
          value={searchQuery}
          onChange={handleSearchChange}
          onFocus={() => {
            if (searchResults.length > 0) {
              setShowResults(true)
            } else if (searchQuery.length === 0) {
              loadTopSuggestions()
            }
          }}
          className="pl-10 pr-10 bg-secondary/50 border-border focus:bg-secondary"
        />

        {/* Search Results Dropdown */}
        {showResults && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
            {searchResults.map((result) => (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => handleResultClick(result)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent text-left transition-colors border-b border-border last:border-b-0"
              >
                {getResultIcon(result.type)}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{result.title}</div>
                  <div className="text-xs text-muted-foreground truncate">{result.subtitle}</div>
                </div>
                <span className="text-xs text-muted-foreground bg-secondary px-2 py-1 rounded">
                  {getTypeLabel(result.type)}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* No results message */}
        {showResults && searchResults.length === 0 && searchQuery.length >= 2 && !isSearching && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg z-50 p-4">
            <p className="text-sm text-muted-foreground text-center">No se encontraron resultados</p>
          </div>
        )}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="text-muted-foreground hover:text-foreground"
        >
          {theme === "dark" ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          <span className="sr-only">Cambiar tema</span>
        </Button>

        {/* Notifications */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-5 w-5 text-muted-foreground" />
              <span className="sr-only">Notificaciones</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm">Notificaciones</h4>
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Bell className="h-12 w-12 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">No tienes notificaciones</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Te avisaremos cuando haya algo nuevo</p>
              </div>
            </div>
          </PopoverContent>
        </Popover>

        {/* User Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-3 px-3">
              <Avatar className="h-8 w-8">
                <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <UserIcon className="h-4 w-4 text-primary" />
                </div>
                <AvatarFallback className="bg-primary/20 text-primary text-sm">
                  {user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium hidden md:block">{user.name}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>
              <div className="flex flex-col">
                <span>{user.name}</span>
                <span className="text-xs text-muted-foreground font-normal">{user.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setActiveModule("configuracion")}>
              <Settings className="mr-2 h-4 w-4" />
              Mi Perfil y Preferencias
            </DropdownMenuItem>
            <DropdownMenuItem onClick={toggleTheme}>
              {theme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
              {theme === "dark" ? "Modo Claro" : "Modo Oscuro"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout} className="text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Cerrar Sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
