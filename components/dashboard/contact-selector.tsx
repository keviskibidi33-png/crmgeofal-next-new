"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Plus, User, Loader2 } from "lucide-react"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"

interface Contact {
    id: string
    nombre: string
    email: string | null
    telefono: string | null
    cargo: string | null
    es_principal: boolean
}

interface ContactSelectorProps {
    clienteId: string | null
    value: string | null
    onValueChange: (contactId: string | null) => void
    disabled?: boolean
}

export function ContactSelector({ clienteId, value, onValueChange, disabled }: ContactSelectorProps) {
    const [contacts, setContacts] = useState<Contact[]>([])
    const [loading, setLoading] = useState(false)
    const [showAddForm, setShowAddForm] = useState(false)
    const [newContact, setNewContact] = useState({
        nombre: "",
        email: "",
        telefono: "",
        cargo: "",
    })
    const { toast } = useToast()

    // Cargar contactos cuando cambia el clienteId
    useEffect(() => {
        if (!clienteId) {
            setContacts([])
            return
        }

        const fetchContacts = async () => {
            setLoading(true)
            try {
                const { data, error } = await supabase
                    .from("contactos")
                    .select("*")
                    .eq("cliente_id", clienteId)
                    .order("es_principal", { ascending: false })
                    .order("nombre", { ascending: true })

                if (error) throw error
                setContacts(data || [])

                // Auto-seleccionar contacto principal si existe
                if (data && data.length > 0 && !value) {
                    const principal = data.find((c) => c.es_principal)
                    if (principal) {
                        onValueChange(principal.id)
                    }
                }
            } catch (err: any) {
                console.error("Error cargando contactos:", err)
            } finally {
                setLoading(false)
            }
        }

        fetchContacts()
    }, [clienteId])

    const handleCreateContact = async () => {
        if (!clienteId || !newContact.nombre.trim()) {
            toast({
                title: "Error",
                description: "El nombre del contacto es obligatorio",
                variant: "destructive",
            })
            return
        }

        setLoading(true)
        try {
            // Verificar si será el primer contacto (principal)
            const esPrincipal = contacts.length === 0

            const { data, error } = await supabase
                .from("contactos")
                .insert({
                    cliente_id: clienteId,
                    nombre: newContact.nombre.trim(),
                    email: newContact.email.trim() || null,
                    telefono: newContact.telefono.trim() || null,
                    cargo: newContact.cargo.trim() || null,
                    es_principal: esPrincipal,
                })
                .select()
                .single()

            if (error) throw error

            // Agregar a la lista y seleccionar automáticamente
            setContacts((prev) => [...prev, data])
            onValueChange(data.id)

            toast({
                title: "Contacto creado",
                description: `${newContact.nombre} ha sido agregado exitosamente`,
            })

            // Reset form
            setNewContact({ nombre: "", email: "", telefono: "", cargo: "" })
            setShowAddForm(false)
        } catch (err: any) {
            toast({
                title: "Error al crear contacto",
                description: err.message,
                variant: "destructive",
            })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold">Contacto del Proyecto *</Label>
                {clienteId && (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 text-[10px] font-bold text-primary hover:text-primary hover:bg-primary/5 uppercase tracking-wider"
                        onClick={() => setShowAddForm(true)}
                        disabled={disabled}
                    >
                        <Plus className="h-3 w-3 mr-1" />
                        Nuevo Contacto
                    </Button>
                )}
            </div>

            <Select
                value={value || undefined}
                onValueChange={onValueChange}
                disabled={disabled || !clienteId || loading}
            >
                <SelectTrigger className="h-9 text-sm">
                    <SelectValue
                        placeholder={
                            !clienteId
                                ? "Seleccione primero una empresa"
                                : loading
                                    ? "Cargando..."
                                    : "Seleccione el contacto..."
                        }
                    />
                </SelectTrigger>
                <SelectContent>
                    {contacts.length === 0 && clienteId && !loading ? (
                        <div className="p-2 text-sm text-muted-foreground text-center">
                            No hay contactos. Cree uno nuevo.
                        </div>
                    ) : (
                        contacts.map((contact) => (
                            <SelectItem key={contact.id} value={contact.id}>
                                <div className="flex items-center gap-2">
                                    <User className="h-4 w-4 text-muted-foreground/60" />
                                    <div className="flex flex-col">
                                        <span className="font-medium text-sm">
                                            {contact.nombre}
                                            {contact.es_principal && (
                                                <span className="ml-2 text-[10px] font-bold text-primary uppercase">(Principal)</span>
                                            )}
                                        </span>
                                        {contact.cargo && (
                                            <span className="text-[10px] text-muted-foreground">{contact.cargo}</span>
                                        )}
                                    </div>
                                </div>
                            </SelectItem>
                        ))
                    )}
                </SelectContent>
            </Select>

            <Dialog open={showAddForm} onOpenChange={setShowAddForm}>
                <DialogContent className="sm:max-w-[425px] bg-card border-border">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Plus className="h-4 w-4 text-primary" />
                            Nuevo Contacto
                        </DialogTitle>
                        <DialogDescription>
                            Agrega un contacto directo para la empresa seleccionada.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-4 py-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="new-nombre" className="text-xs font-semibold">Nombre Completo *</Label>
                            <Input
                                id="new-nombre"
                                value={newContact.nombre}
                                onChange={e => setNewContact({ ...newContact, nombre: e.target.value })}
                                placeholder="Ej: Ing. Juan Pérez"
                                className="h-9"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label htmlFor="new-cargo" className="text-xs font-semibold">Cargo</Label>
                                <Input
                                    id="new-cargo"
                                    value={newContact.cargo}
                                    onChange={e => setNewContact({ ...newContact, cargo: e.target.value })}
                                    placeholder="Ej: Gerente"
                                    className="h-9"
                                />
                            </div>
                            <div className="space-y-1.5">
                                <Label htmlFor="new-telefono" className="text-xs font-semibold">Teléfono</Label>
                                <Input
                                    id="new-telefono"
                                    value={newContact.telefono}
                                    onChange={e => setNewContact({ ...newContact, telefono: e.target.value })}
                                    placeholder="999..."
                                    className="h-9"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="new-email" className="text-xs font-semibold">Email</Label>
                            <Input
                                id="new-email"
                                value={newContact.email}
                                onChange={e => setNewContact({ ...newContact, email: e.target.value })}
                                placeholder="email@empresa.com"
                                className="h-9"
                            />
                        </div>
                    </div>

                    <DialogFooter className="pt-2">
                        <Button variant="ghost" onClick={() => setShowAddForm(false)}>
                            Cancelar
                        </Button>
                        <Button
                            className="font-bold px-6"
                            onClick={handleCreateContact}
                            disabled={loading || !newContact.nombre.trim()}
                        >
                            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Guardar Contacto
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}
