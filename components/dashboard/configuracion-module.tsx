"use client"

import { User, Mail, Image as ImageIcon, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/hooks/use-auth"
import { useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { updateUserAction } from "@/app/actions/auth-actions"
import { Loader2, AlertTriangle, Phone } from "lucide-react"
import { logAction } from "@/app/actions/audit-actions"

export function ConfiguracionModule() {
  const { user: currentUser, refreshUser } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const [formData, setFormData] = useState({
    name: currentUser?.name || "",
    email: currentUser?.email || "",
    phone: currentUser?.phone || "",
  })

  const handleSave = async () => {
    if (!currentUser) return
    setIsLoading(true)
    try {
      const result = await updateUserAction({
        userId: currentUser.id,
        nombre: formData.name,
        email: formData.email,
        phone: formData.phone,
      })

      if (result.error) throw new Error(result.error)

      await refreshUser()

      toast({
        title: "Perfil actualizado",
        description: "Tus datos han sido guardados correctamente.",
      })

      // Log action
      logAction({
        user_id: currentUser.id,
        user_name: formData.name, // Use new name for the log record if changed
        action: "Actualizó su perfil",
        module: "CONFIGURACION",
        details: { fields_updated: Object.keys(formData) }
      })

      setIsEditing(false)
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-2xl space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mi Configuración</h1>
          <p className="text-muted-foreground">Gestiona tu perfil y preferencias personales dentro del CRM</p>
        </div>
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)}>Editar Perfil</Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => setIsEditing(false)} disabled={isLoading}>Cancelar</Button>
            <Button onClick={handleSave} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar Cambios
            </Button>
          </div>
        )}
      </div>

      {isEditing && (
        <div className="p-4 rounded-lg bg-warning/10 border border-warning/30 flex items-start gap-3 text-warning">
          <AlertTriangle className="h-5 w-5 shrink-0" />
          <div className="text-sm">
            <p className="font-bold">⚠️ Advertencia de Seguridad</p>
            <p className="opacity-90">Modificar tu correo electrónico afectará tus credenciales de acceso. Ten cuidado al realizar estos cambios.</p>
          </div>
        </div>
      )}

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            Información de Perfil
          </CardTitle>
          <CardDescription>Datos básicos de tu cuenta vinculada</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Nombre completo</Label>
            <Input
              value={isEditing ? formData.name : (currentUser?.name || "")}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              readOnly={!isEditing}
              className={!isEditing ? "bg-secondary/30" : "bg-background"}
            />
          </div>
          <div className="space-y-2">
            <Label>Correo electrónico</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={isEditing ? formData.email : (currentUser?.email || "")}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                readOnly={!isEditing}
                className={!isEditing ? "pl-10 bg-secondary/30" : "pl-10 bg-background"}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Teléfono</Label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={isEditing ? formData.phone : (currentUser?.phone || "")}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                readOnly={!isEditing}
                className={!isEditing ? "pl-10 bg-secondary/30" : "pl-10 bg-background"}
                placeholder="Ej. 987654321"
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Rol asignado</Label>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              <Badge variant="outline" className="capitalize px-3 py-1 font-medium bg-primary/5 border-primary/20">
                {currentUser?.role === "admin" ? "Administrador" : (currentUser?.role || "Usuario")}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-card border-border">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            Imagen de Perfil
          </CardTitle>
          <CardDescription>Esta imagen se muestra en el dashboard y cotizaciones</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-6 p-4 rounded-lg bg-secondary/10">
            <div className="relative h-20 w-20">
              <div className="h-20 w-20 rounded-full border-2 border-primary/20 bg-primary/10 flex items-center justify-center text-3xl font-bold text-primary">
                {currentUser?.name ? currentUser.name[0] : "?"}
              </div>
            </div>
            <div className="space-y-2">
              <Button variant="outline" size="sm" disabled>Cambiar avatar</Button>
              <p className="text-xs text-muted-foreground italic">La personalización de avatar estará disponible pronto.</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
