"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabaseClient"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { Loader2, Plus, Trash2, User, Star, Phone, Mail, Briefcase, CheckCircle2, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ModernConfirmDialog } from "./modern-confirm-dialog"

interface Contact {
    id: string
    nombre: string
    email: string | null
    telefono: string | null
    cargo: string | null
    es_principal: boolean
}

interface ContactAgendaDialogProps {
    clienteId: string | null
    clienteNombre: string | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onPrincipalUpdated?: () => void
}

export function ContactAgendaDialog({
    clienteId,
    clienteNombre,
    open,
    onOpenChange,
    onPrincipalUpdated
}: ContactAgendaDialogProps) {
    const [contacts, setContacts] = useState<Contact[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isSaving, setIsSaving] = useState(false)
    const [showAddForm, setShowAddForm] = useState(false)
    const [newContact, setNewContact] = useState({
        nombre: "",
        email: "",
        telefono: "",
        cargo: ""
    })
    const [contactToDelete, setContactToDelete] = useState<Contact | null>(null)
    const [isConfirmDeleteOpen, setIsConfirmDeleteOpen] = useState(false)
    const { toast } = useToast()

    const fetchContacts = async () => {
        if (!clienteId) return
        setIsLoading(true)
        try {
            const { data, error } = await supabase
                .from("contactos")
                .select("*")
                .eq("cliente_id", clienteId)
                .order("es_principal", { ascending: false })
                .order("nombre", { ascending: true })

            if (error) throw error
            setContacts(data || [])
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" })
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (open && clienteId) {
            fetchContacts()
            setShowAddForm(false)
        }
    }, [open, clienteId])

    const handleAddContact = async () => {
        if (!clienteId || !newContact.nombre) return
        setIsSaving(true)
        try {
            const { error } = await supabase.from("contactos").insert({
                cliente_id: clienteId,
                nombre: newContact.nombre,
                email: newContact.email || null,
                telefono: newContact.telefono || null,
                cargo: newContact.cargo || null,
                es_principal: contacts.length === 0 // First contact is principal by default
            })

            if (error) throw error
            toast({ title: "Contacto agregado" })
            setNewContact({ nombre: "", email: "", telefono: "", cargo: "" })
            setShowAddForm(false)
            fetchContacts()
            if (contacts.length === 0) onPrincipalUpdated?.()
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" })
        } finally {
            setIsSaving(false)
        }
    }

    const initiateDelete = (contact: Contact) => {
        if (contact.es_principal) {
            toast({ title: "Aviso", description: "No puedes eliminar al contacto principal directamente. Marca otro como principal primero.", variant: "destructive" })
            return
        }
        setContactToDelete(contact)
        setIsConfirmDeleteOpen(true)
    }

    const handleDeleteContact = async () => {
        if (!contactToDelete) return
        setIsSaving(true)
        try {
            const { error } = await supabase.from("contactos").delete().eq("id", contactToDelete.id)
            if (error) throw error
            toast({ title: "Contacto eliminado", description: `Se ha eliminado a ${contactToDelete.nombre}` })
            fetchContacts()
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" })
        } finally {
            setIsSaving(false)
            setIsConfirmDeleteOpen(false)
            setContactToDelete(null)
        }
    }

    const setAsPrincipal = async (contact: Contact) => {
        if (contact.es_principal) return
        setIsSaving(true)
        try {
            // 1. Quitar principal a todos
            await supabase.from("contactos").update({ es_principal: false }).eq("cliente_id", clienteId)

            // 2. Setear nuevo principal
            await supabase.from("contactos").update({ es_principal: true }).eq("id", contact.id)

            // 3. Mirror en tabla clientes para acceso rápido (nombre, email, tel)
            await supabase.from("clientes").update({
                nombre: contact.nombre,
                email: contact.email,
                telefono: contact.telefono
            }).eq("id", clienteId)

            toast({ title: "Principal actualizado", description: `${contact.nombre} es ahora el contacto principal.` })
            fetchContacts()
            onPrincipalUpdated?.()
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" })
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] w-[95vw] p-0 overflow-hidden bg-card border-border shadow-2xl h-[85vh] flex flex-col rounded-3xl">
                <DialogHeader className="p-6 bg-slate-50/10 border-b border-border/50 shrink-0">
                    <DialogTitle className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2 leading-tight">
                        <Users className="h-5 w-5 text-primary" />
                        Agenda de Contactos
                    </DialogTitle>
                    <DialogDescription className="text-[10px] text-slate-400 mt-0.5 leading-tight">
                        Empresa: <span className="font-bold text-slate-600">{clienteNombre}</span>
                    </DialogDescription>
                </DialogHeader>

                <ScrollArea className="flex-1 overflow-y-auto">
                    <div className="p-6 space-y-6">
                        {/* Formulario de Agregar */}
                        {showAddForm ? (
                            <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3 animate-in fade-in slide-in-from-top-2">
                                <h4 className="text-[9px] font-black uppercase tracking-[0.15em] text-primary flex items-center gap-2">
                                    <Plus className="h-2.5 w-2.5" /> Nuevo Contacto
                                </h4>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1 col-span-2">
                                        <Label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Nombre Completo</Label>
                                        <Input
                                            value={newContact.nombre}
                                            onChange={e => setNewContact({ ...newContact, nombre: e.target.value })}
                                            placeholder="Ing. Pedro Aras"
                                            className="h-9 text-xs font-bold rounded-lg border-primary/10"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Cargo</Label>
                                        <Input
                                            value={newContact.cargo}
                                            onChange={e => setNewContact({ ...newContact, cargo: e.target.value })}
                                            placeholder="Cargo"
                                            className="h-9 text-xs rounded-lg border-primary/10 shadow-none"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <Label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Teléfono</Label>
                                        <Input
                                            value={newContact.telefono}
                                            onChange={e => setNewContact({ ...newContact, telefono: e.target.value })}
                                            placeholder="Teléfono"
                                            className="h-9 text-xs rounded-lg border-primary/10 shadow-none"
                                        />
                                    </div>
                                    <div className="space-y-1 col-span-2">
                                        <Label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Email</Label>
                                        <Input
                                            value={newContact.email}
                                            onChange={e => setNewContact({ ...newContact, email: e.target.value })}
                                            placeholder="email@empresa.com"
                                            className="h-9 text-xs rounded-lg border-primary/10 shadow-none"
                                        />
                                    </div>
                                </div>
                                <div className="flex gap-2 pt-1">
                                    <Button variant="ghost" className="flex-1 h-9 text-xs font-semibold rounded-lg text-slate-400 hover:text-slate-600" onClick={() => setShowAddForm(false)}>
                                        Cancelar
                                    </Button>
                                    <Button className="flex-1 h-9 text-xs font-bold bg-[#0089b3] hover:bg-[#007499] text-white rounded-lg shadow-sm transition-all" onClick={handleAddContact} disabled={isSaving || !newContact.nombre}>
                                        {isSaving && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                                        Guardar
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <Button variant="outline" className="w-full border-dashed border-primary/30 hover:bg-primary/5 hover:border-primary/50 h-10 text-[10px] font-bold rounded-xl transition-all shadow-none" onClick={() => setShowAddForm(true)}>
                                <Plus className="h-3.5 w-3.5 mr-2" /> Agregar Nuevo Contacto
                            </Button>
                        )}

                        {/* Lista de Contactos */}
                        <div className="space-y-3">
                            <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Contactos Registrados ({contacts.length})</h4>
                            {isLoading ? (
                                <div className="flex flex-col items-center py-10 text-muted-foreground">
                                    <Loader2 className="h-8 w-8 animate-spin mb-2 opacity-20" />
                                    <p className="text-xs">Cargando agenda...</p>
                                </div>
                            ) : contacts.length === 0 ? (
                                <div className="text-center py-10 bg-secondary/10 rounded-xl border border-dashed border-border">
                                    <p className="text-xs text-muted-foreground">No hay contactos registrados.</p>
                                </div>
                            ) : (
                                contacts.map(contact => (
                                    <div key={contact.id} className={`p-4 rounded-xl border transition-all ${contact.es_principal ? 'bg-blue-500/5 border-blue-500/30' : 'bg-card border-border hover:border-border/80'}`}>
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="font-bold text-sm truncate">{contact.nombre}</span>
                                                    {contact.es_principal && <Badge variant="secondary" className="bg-blue-500/10 text-blue-500 hover:bg-blue-500/10 text-[9px] uppercase font-black py-0 h-4">Principal</Badge>}
                                                </div>

                                                <div className="grid grid-cols-1 gap-1">
                                                    {contact.cargo && <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Briefcase className="h-3 w-3" /> {contact.cargo}</div>}
                                                    {contact.telefono && <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Phone className="h-3 w-3" /> {contact.telefono}</div>}
                                                    {contact.email && <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><Mail className="h-3 w-3" /> {contact.email}</div>}
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-1 shrink-0">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className={`h-8 w-8 rounded-full ${contact.es_principal ? 'text-blue-500' : 'text-muted-foreground hover:text-blue-500'}`}
                                                    onClick={() => setAsPrincipal(contact)}
                                                    disabled={isSaving || contact.es_principal}
                                                    title={contact.es_principal ? "Contacto principal" : "Marcar como principal"}
                                                >
                                                    {contact.es_principal ? <Star className="h-4 w-4 fill-current" /> : <Star className="h-4 w-4" />}
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="h-8 w-8 rounded-full text-muted-foreground hover:text-red-500"
                                                    onClick={() => initiateDelete(contact)}
                                                    disabled={isSaving || contact.es_principal}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </ScrollArea>

                <DialogFooter className="px-8 pt-4 pb-8 bg-white border-t border-slate-100 gap-4 shrink-0">
                    <Button variant="ghost" className="h-10 px-6 text-xs font-semibold text-slate-400 hover:text-slate-800 rounded-xl" onClick={() => onOpenChange(false)}>
                        Cerrar
                    </Button>
                    <div className="flex-1" />
                    <Button className="h-10 px-9 font-bold bg-[#0089b3] hover:bg-[#007499] text-white rounded-xl shadow-[0_4px_12px_rgba(0,137,179,0.2)] transition-all active:scale-[0.98] text-xs" onClick={() => onOpenChange(false)}>
                        <CheckCircle2 className="h-3.5 w-3.5 mr-2" />
                        Finalizar
                    </Button>
                </DialogFooter>

                <ModernConfirmDialog
                    open={isConfirmDeleteOpen}
                    onOpenChange={setIsConfirmDeleteOpen}
                    onConfirm={handleDeleteContact}
                    title="¿Eliminar contacto?"
                    description={`¿Estás seguro de que deseas eliminar a ${contactToDelete?.nombre}? Esta acción no se puede deshacer.`}
                    confirmText="Sí, eliminar"
                    cancelText="No, cancelar"
                />
            </DialogContent>
        </Dialog>
    )
}
