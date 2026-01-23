import { useEffect, useMemo, useState, useCallback } from 'react';
import { Plus, Trash2, Download, Building2, FolderOpen } from 'lucide-react';

import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';

type QuoteItem = {
  codigo: string;
  descripcion: string;
  norma?: string;
  acreditado?: string;
  costo_unitario: number;
  cantidad: number;
};

type QuotePayload = {
  cotizacion_numero?: string;
  fecha_emision?: string;
  fecha_solicitud?: string;
  cliente?: string;
  ruc?: string;
  contacto?: string;
  telefono_contacto?: string;
  correo?: string;
  proyecto?: string;
  ubicacion?: string;
  personal_comercial?: string;
  telefono_comercial?: string;
  include_igv: boolean;
  igv_rate: number;
  items: QuoteItem[];
  template_id?: string;
  cliente_id?: string;
  proyecto_id?: string;
  user_id?: string;
};

type Cliente = {
  id: string;
  nombre: string;
  empresa?: string;
  ruc?: string;
  contacto?: string;
  telefono?: string;
  email?: string;
  direccion?: string;
};

type Proyecto = {
  id: string;
  nombre: string;
  ubicacion?: string;
  direccion?: string;
  cliente_id: string;
  cliente_nombre?: string;
  vendedor_nombre?: string;
  vendedor_telefono?: string;
  created_at?: string;
};

type UserProfile = {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string;
};

const TEMPLATE_VARIANTS = [
  { id: 'V1', name: 'V1 - Muestra de Suelo y Agregado' },
  { id: 'V2', name: 'V2 - Probetas' },
  { id: 'V3', name: 'V3 - Densidad de Campo y Muestreo' },
  { id: 'V4', name: 'V4 - Extracción de Diamantina' },
  { id: 'V5', name: 'V5 - Diamantina para Pases' },
  { id: 'V6', name: 'V6 - Albañilería' },
  { id: 'V7', name: 'V7 - Viga Beckelman' },
  { id: 'V8', name: 'V8 - Control de Calidad de Concreto' },
];

function getApiBaseUrl() {
  return import.meta.env.VITE_QUOTES_API_URL || 'http://localhost:8000';
}

function getUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  return {
    user_id: urlParams.get('user_id') || '',
    email: urlParams.get('email') || '',
    name: urlParams.get('name') || '',
    access_token: urlParams.get('access_token') || '',
    phone: urlParams.get('phone') || '',
  };
}

export function QuoteBuilderPage() {
  const apiBaseUrl = useMemo(() => getApiBaseUrl(), []);
  const urlParams = useMemo(() => getUrlParams(), []);

  const [includeIgv, setIncludeIgv] = useState(true);
  const [header, setHeader] = useState<Omit<QuotePayload, 'include_igv' | 'igv_rate' | 'items'>>({
    fecha_emision: new Date().toISOString().slice(0, 10),
    fecha_solicitud: new Date().toISOString().slice(0, 10),
    cliente: '',
    ruc: '',
    contacto: '',
    telefono_contacto: '',
    correo: '',
    proyecto: '',
    ubicacion: '',
    personal_comercial: urlParams.name || '',
    telefono_comercial: urlParams.phone || '',
  });

  const [items, setItems] = useState<QuoteItem[]>([
    {
      codigo: '',
      descripcion: '',
      norma: '',
      acreditado: 'NO',
      costo_unitario: 0,
      cantidad: 1,
    },
  ]);

  const [exporting, setExporting] = useState(false);
  const [quoteNumber, setQuoteNumber] = useState<string>('001');
  const [quoteYear, setQuoteYear] = useState<number>(new Date().getFullYear());
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('V1');

  // Client/Project state
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [proyectos, setProyectos] = useState<Proyecto[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [selectedProyecto, setSelectedProyecto] = useState<Proyecto | null>(null);
  const [clienteSearch, setClienteSearch] = useState('');
  const [proyectoSearch, setProyectoSearch] = useState('');
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const [showProyectoDropdown, setShowProyectoDropdown] = useState(false);
  const [showNewClienteModal, setShowNewClienteModal] = useState(false);
  const [showNewProyectoModal, setShowNewProyectoModal] = useState(false);
  const [newCliente, setNewCliente] = useState({ nombre: '', ruc: '', contacto: '', telefono: '', email: '' });
  const [newProyecto, setNewProyecto] = useState({ nombre: '', ubicacion: '' });
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);

  // Auto-fill personal comercial from URL params (passed by Directus)
  useEffect(() => {
    if (urlParams.name) {
      setHeader(prev => ({
        ...prev,
        personal_comercial: urlParams.name || prev.personal_comercial,
        telefono_comercial: urlParams.phone || prev.telefono_comercial,
      }));
      setCurrentUser({
        id: urlParams.user_id,
        first_name: urlParams.name.split(' ')[0],
        last_name: urlParams.name.split(' ').slice(1).join(' '),
        email: urlParams.email,
        phone: urlParams.phone,
      });
    }
  }, [urlParams.name, urlParams.phone]);

  // Handle phone updates from URL specifically if name matches but phone was empty
  useEffect(() => {
    if (urlParams.phone && !header.telefono_comercial) {
      setHeader(h => ({ ...h, telefono_comercial: urlParams.phone }));
    }
  }, [urlParams.phone]);

  useEffect(() => {
    async function loadNext() {
      try {
        setError(null);
        const resp = await fetch(`${apiBaseUrl}/quote/next-number`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fecha_emision: header.fecha_emision }),
        });
        if (!resp.ok) return;
        const json = (await resp.json()) as { number: string; year: number; token: string };
        setQuoteNumber(json.number);
        setQuoteYear(json.year);
      } catch {
        // opcional
      }
    }

    loadNext();
  }, [apiBaseUrl, header.fecha_emision]);

  const quoteToken = useMemo(() => {
    const yearSuffix = String(quoteYear).slice(-2);
    return `${quoteNumber}-${yearSuffix}`;
  }, [quoteNumber, quoteYear]);

  const subtotal = useMemo(() => {
    return items.reduce((acc, it) => acc + (Number(it.costo_unitario) || 0) * (Number(it.cantidad) || 0), 0);
  }, [items]);
  const igv = useMemo(() => (includeIgv ? subtotal * 0.18 : 0), [includeIgv, subtotal]);
  const total = useMemo(() => subtotal + igv, [subtotal, igv]);

  function updateItem(idx: number, patch: Partial<QuoteItem>) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      {
        codigo: '',
        descripcion: '',
        norma: '',
        acreditado: 'NO',
        costo_unitario: 0,
        cantidad: 1,
      },
    ]);
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  }

  // Search clients
  const searchClientes = useCallback(async (search: string) => {
    try {
      const resp = await fetch(`${apiBaseUrl}/clientes?search=${encodeURIComponent(search)}`);
      const data = await resp.json();
      setClientes(data.data || []);
    } catch { setClientes([]); }
  }, [apiBaseUrl]);

  // Search projects
  const searchProyectos = useCallback(async (clienteId?: string, searchStr?: string) => {
    try {
      let url = `${apiBaseUrl}/proyectos?`;
      const params = new URLSearchParams();

      const actualClienteId = clienteId || selectedCliente?.id;
      const actualSearch = searchStr !== undefined ? searchStr : proyectoSearch;

      if (actualClienteId) params.append('cliente_id', String(actualClienteId));
      if (actualSearch) params.append('search', actualSearch);

      url += params.toString();
      const resp = await fetch(url);
      const data = await resp.json();
      setProyectos(data.data || []);
    } catch { setProyectos([]); }
  }, [apiBaseUrl, proyectoSearch, selectedCliente?.id]);

  // Select client
  async function selectCliente(c: Cliente) {
    setSelectedCliente(c);
    setClienteSearch(c.nombre); // Keep search text updated
    setShowClienteDropdown(false);
    setHeader((prev) => ({
      ...prev,
      cliente: c.nombre, // The backend already maps empresa to nombre if available
      ruc: c.ruc || '',
      contacto: c.contacto || '',
      telefono_contacto: c.telefono || '',
      correo: c.email || '',
    }));
    setSelectedProyecto(null); // Clear selected project when client changes
    setProyectoSearch(''); // Clear project search when client changes
    searchProyectos(c.id);
  }

  // Select project
  async function selectProyecto(p: Proyecto) {
    setSelectedProyecto(p);
    setProyectoSearch(p.nombre); // Keep search text updated
    setShowProyectoDropdown(false);
    setHeader((prev) => ({
      ...prev,
      proyecto: p.nombre,
      ubicacion: p.ubicacion || p.direccion || '',
      personal_comercial: p.vendedor_nombre || prev.personal_comercial,
      telefono_comercial: p.vendedor_telefono || prev.telefono_comercial,
    }));
  }

  // Create new client
  async function createNewCliente() {
    if (!newCliente.nombre.trim()) return;
    try {
      const resp = await fetch(`${apiBaseUrl}/clientes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCliente),
      });
      const data = await resp.json();
      if (data.data) {
        selectCliente(data.data); // Use the correct handler
        setShowNewClienteModal(false);
        setNewCliente({ nombre: '', ruc: '', contacto: '', telefono: '', email: '' });
      }
    } catch (e) { console.error(e); }
  }

  // Create new project
  async function createNewProyecto() {
    if (!newProyecto.nombre.trim() || !selectedCliente) return;
    try {
      const resp = await fetch(`${apiBaseUrl}/proyectos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newProyecto,
          cliente_id: selectedCliente.id,
          ubicacion: newProyecto.ubicacion,
          vendedor_id: urlParams.user_id || currentUser?.id,
        }),
      });
      const data = await resp.json();
      if (data.data) {
        selectProyecto(data.data); // Use the correct handler
        setShowNewProyectoModal(false);
        setNewProyecto({ nombre: '', ubicacion: '' });
      }
    } catch (e) { console.error(e); }
  }

  // Load clients on search
  useEffect(() => {
    if (clienteSearch.length >= 2) {
      searchClientes(clienteSearch);
    }
  }, [clienteSearch, searchClientes]);

  // Load projects on search
  useEffect(() => {
    if (proyectoSearch.length >= 2 && !selectedProyecto) {
      searchProyectos(selectedCliente?.id, proyectoSearch);
    } else if (proyectoSearch.length === 0 && selectedCliente) {
      // Refresh list if search cleared but client selected
      searchProyectos(selectedCliente.id, '');
    }
  }, [proyectoSearch, searchProyectos, selectedProyecto, selectedCliente]);

  async function onExport() {
    setExporting(true);
    setError(null);
    try {
      const payload: QuotePayload = {
        ...header,
        cotizacion_numero: quoteNumber || undefined,
        include_igv: includeIgv,
        igv_rate: 0.18,
        items,
        template_id: selectedTemplate,
        user_id: urlParams.user_id || undefined,
        proyecto_id: selectedProyecto?.id,
        cliente_id: selectedCliente?.id,
      };

      const resp = await fetch(`${apiBaseUrl}/export/xlsx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(txt || `HTTP ${resp.status}`);
      }

      const blob = await resp.blob();
      console.log('Blob created:', blob.size, blob.type);

      const contentDisposition = resp.headers.get('Content-Disposition');
      console.log('Content-Disposition header:', contentDisposition);

      let filename = 'cotizacion_v1_1.xlsx';

      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^";]+)"?/);
        if (match) {
          filename = match[1];
          console.log('Extracted filename:', filename);
        }
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      a.setAttribute('download', filename);

      console.log('Triggering download for (v1.2):', filename);
      document.body.appendChild(a);
      a.click();

      // Signal CRM that quote was created
      if (window.parent !== window) {
        window.parent.postMessage({ type: 'QUOTE_CREATED' }, '*');
      }

      // Dejamos el objeto URL vivo por 1 minuto
      setTimeout(() => {
        if (document.body.contains(a)) {
          document.body.removeChild(a);
        }
        window.URL.revokeObjectURL(url);
        console.log('Download cleanup done (v1.2)');
      }, 60000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error exportando');
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Cotizaciones <span className="text-xs font-normal text-slate-400">v1.3</span></h1>
            <p className="text-sm text-slate-500">Selecciona la plantilla y genera el XLSX.</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-blue-500 focus:outline-none"
            >
              {TEMPLATE_VARIANTS.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <div className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-2 text-sm text-slate-700">
              <span>N° Cotización:</span>
              <input
                type="text"
                value={quoteNumber}
                onChange={(e) => setQuoteNumber(e.target.value.replace(/\D/g, '').slice(0, 5) || '001')}
                className="w-20 rounded border border-slate-300 px-2 py-1 text-center font-semibold focus:border-blue-500 focus:outline-none"
                maxLength={5}
              />
              <span className="font-semibold">-{String(quoteYear).slice(-2)}</span>
            </div>
            <Button onClick={onExport} disabled={exporting}>
              <Download className="mr-2 h-4 w-4" />
              {exporting ? 'Exportando…' : 'Exportar Excel'}
            </Button>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="rounded-lg border border-border bg-white p-6">
          <h2 className="mb-4 text-lg font-semibold text-slate-900">Datos de la cotización</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Cliente Autocomplete */}
            <div className="space-y-2 relative">
              <Label className="flex items-center gap-2"><Building2 className="h-4 w-4" /> Cliente / Empresa</Label>
              <Input
                value={clienteSearch}
                onChange={(e) => { setClienteSearch(e.target.value); setShowClienteDropdown(true); }}
                onFocus={() => { if (clientes.length > 0) setShowClienteDropdown(true); }}
                placeholder="Buscar cliente..."
              />
              {showClienteDropdown && clientes.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-auto">
                  {clientes.map(c => (
                    <div key={c.id} onClick={() => selectCliente(c)} className="px-3 py-2 hover:bg-slate-100 cursor-pointer text-sm">
                      <div className="font-medium">{c.nombre}</div>
                      {c.ruc && <div className="text-xs text-slate-500">RUC: {c.ruc}</div>}
                    </div>
                  ))}
                  <div onClick={() => { setShowNewClienteModal(true); setShowClienteDropdown(false); }} className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm text-blue-600 border-t">
                    <Plus className="inline h-3 w-3 mr-1" /> Crear nuevo cliente
                  </div>
                </div>
              )}
              {clienteSearch.length >= 2 && clientes.length === 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg p-3">
                  <div onClick={() => { setNewCliente(p => ({ ...p, nombre: clienteSearch })); setShowNewClienteModal(true); }} className="text-sm text-blue-600 cursor-pointer">
                    <Plus className="inline h-3 w-3 mr-1" /> Crear "{clienteSearch}"
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>RUC</Label>
              <Input value={header.ruc || ''} onChange={(e) => setHeader((p) => ({ ...p, ruc: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Contacto</Label>
              <Input value={header.contacto || ''} onChange={(e) => setHeader((p) => ({ ...p, contacto: e.target.value }))} />
            </div>

            <div className="space-y-2">
              <Label>Teléfono de contacto</Label>
              <Input value={header.telefono_contacto || ''} onChange={(e) => setHeader((p) => ({ ...p, telefono_contacto: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Correo</Label>
              <Input value={header.correo || ''} onChange={(e) => setHeader((p) => ({ ...p, correo: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Fecha de solicitud</Label>
              <Input
                type="date"
                value={header.fecha_solicitud || ''}
                onChange={(e) => setHeader((p) => ({ ...p, fecha_solicitud: e.target.value }))}
              />
            </div>

            {/* Proyecto Autocomplete */}
            <div className="space-y-2 relative">
              <Label className="flex items-center gap-2"><FolderOpen className="h-4 w-4" /> Proyecto</Label>
              <Input
                value={proyectoSearch}
                onChange={(e) => { setProyectoSearch(e.target.value); setShowProyectoDropdown(true); }}
                onFocus={() => { if (proyectos.length > 0) setShowProyectoDropdown(true); }}
                placeholder={selectedCliente ? "Buscar proyecto..." : "Selecciona cliente primero"}
                disabled={!selectedCliente}
              />
              {showProyectoDropdown && proyectos.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg max-h-48 overflow-auto">
                  {proyectos.map(p => (
                    <div key={p.id} onClick={() => selectProyecto(p)} className="px-3 py-2 hover:bg-slate-100 cursor-pointer text-sm">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{p.nombre}</span>
                        {p.created_at && (
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                            {new Date(p.created_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                      {p.ubicacion && <div className="text-xs text-slate-500">{p.ubicacion}</div>}
                    </div>
                  ))}
                  <div onClick={() => { setShowNewProyectoModal(true); setShowProyectoDropdown(false); }} className="px-3 py-2 hover:bg-blue-50 cursor-pointer text-sm text-blue-600 border-t">
                    <Plus className="inline h-3 w-3 mr-1" /> Crear nuevo proyecto
                  </div>
                </div>
              )}
              {selectedCliente && proyectoSearch.length >= 2 && proyectos.length === 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white border border-slate-200 rounded-md shadow-lg p-3">
                  <div onClick={() => { setNewProyecto(p => ({ ...p, nombre: proyectoSearch })); setShowNewProyectoModal(true); }} className="text-sm text-blue-600 cursor-pointer">
                    <Plus className="inline h-3 w-3 mr-1" /> Crear "{proyectoSearch}"
                  </div>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Ubicación</Label>
              <Input value={header.ubicacion || ''} onChange={(e) => setHeader((p) => ({ ...p, ubicacion: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Fecha de emisión</Label>
              <Input
                type="date"
                value={header.fecha_emision || ''}
                onChange={(e) => setHeader((p) => ({ ...p, fecha_emision: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>Personal comercial</Label>
              <Input
                value={header.personal_comercial || ''}
                onChange={(e) => setHeader((p) => ({ ...p, personal_comercial: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Teléfono comercial</Label>
              <Input
                value={header.telefono_comercial || ''}
                onChange={(e) => setHeader((p) => ({ ...p, telefono_comercial: e.target.value }))}
              />
            </div>

            <div className="flex items-center justify-between rounded-md border border-border px-3 py-2">
              <div>
                <div className="text-sm font-medium text-slate-900">IGV</div>
                <div className="text-xs text-slate-500">Activar / desactivar</div>
              </div>
              <Switch checked={includeIgv} onCheckedChange={setIncludeIgv} />
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-border bg-white p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Ítems</h2>
            <Button variant="outline" onClick={addItem}>
              <Plus className="mr-2 h-4 w-4" />
              Agregar ítem
            </Button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-slate-600">
                  <th className="py-2 pr-3">Código</th>
                  <th className="py-2 pr-3">Descripción</th>
                  <th className="py-2 pr-3">Norma</th>
                  <th className="py-2 pr-3">Acreditado</th>
                  <th className="py-2 pr-3">Costo unitario</th>
                  <th className="py-2 pr-3">Cantidad</th>
                  <th className="py-2 pr-3">Parcial</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => {
                  const parcial = (Number(it.costo_unitario) || 0) * (Number(it.cantidad) || 0);
                  return (
                    <tr key={idx} className="border-b border-border last:border-b-0">
                      <td className="py-2 pr-3">
                        <Input value={it.codigo} onChange={(e) => updateItem(idx, { codigo: e.target.value })} />
                      </td>
                      <td className="py-2 pr-3">
                        <Input value={it.descripcion} onChange={(e) => updateItem(idx, { descripcion: e.target.value })} />
                      </td>
                      <td className="py-2 pr-3">
                        <Input value={it.norma || ''} onChange={(e) => updateItem(idx, { norma: e.target.value })} />
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          value={it.acreditado || ''}
                          onChange={(e) => updateItem(idx, { acreditado: e.target.value })}
                          placeholder="SI/NO"
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          type="number"
                          value={String(it.costo_unitario)}
                          onChange={(e) => updateItem(idx, { costo_unitario: Number(e.target.value) })}
                        />
                      </td>
                      <td className="py-2 pr-3">
                        <Input
                          type="number"
                          value={String(it.cantidad)}
                          onChange={(e) => updateItem(idx, { cantidad: Number(e.target.value) })}
                        />
                      </td>
                      <td className="py-2 pr-3 text-right font-medium text-slate-900">
                        {parcial.toFixed(2)}
                      </td>
                      <td className="py-2 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeItem(idx)}
                          disabled={items.length <= 1}
                          aria-label="Eliminar"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex justify-end">
            <div className="w-full max-w-sm rounded-md border border-border p-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-medium text-slate-900">S/. {subtotal.toFixed(2)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between text-sm">
                <span className="text-slate-600">IGV (18%)</span>
                <span className="font-medium text-slate-900">S/. {igv.toFixed(2)}</span>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-sm">
                <span className="text-slate-600 font-semibold">Total</span>
                <span className="font-bold text-blue-600 text-lg">S/. {total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 text-xs text-slate-500">
          API: <span className="font-mono">{apiBaseUrl}</span>
        </div>
      </div>

      {/* Modal: New Cliente */}
      {showNewClienteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border-2 border-slate-100 rounded-xl p-8 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-900 mb-1">Nuevo Cliente</h3>
            <p className="text-sm text-slate-500 mb-6">Añade los datos de la empresa y contacto.</p>
            <div className="space-y-3">
              <div>
                <Label>Nombre / Empresa *</Label>
                <Input value={newCliente.nombre} onChange={e => setNewCliente(p => ({ ...p, nombre: e.target.value }))} />
              </div>
              <div>
                <Label>RUC</Label>
                <Input value={newCliente.ruc} onChange={e => setNewCliente(p => ({ ...p, ruc: e.target.value }))} />
              </div>
              <div>
                <Label>Contacto</Label>
                <Input value={newCliente.contacto} onChange={e => setNewCliente(p => ({ ...p, contacto: e.target.value }))} />
              </div>
              <div>
                <Label>Teléfono</Label>
                <Input value={newCliente.telefono} onChange={e => setNewCliente(p => ({ ...p, telefono: e.target.value }))} />
              </div>
              <div>
                <Label>Email</Label>
                <Input value={newCliente.email} onChange={e => setNewCliente(p => ({ ...p, email: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowNewClienteModal(false)}>Cancelar</Button>
              <Button onClick={createNewCliente}>Crear Cliente</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: New Proyecto */}
      {showNewProyectoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white border-2 border-slate-100 rounded-xl p-8 w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <h3 className="text-xl font-bold text-slate-900 mb-1">Nuevo Proyecto</h3>
            <p className="text-sm text-slate-500 mb-2">Cliente: <span className="font-semibold text-blue-600">{selectedCliente?.nombre}</span></p>
            <p className="text-xs text-slate-400 mb-6">El proyecto se vinculará automáticamente a este cliente.</p>
            <div className="space-y-3">
              <div>
                <Label>Nombre del Proyecto *</Label>
                <Input value={newProyecto.nombre} onChange={e => setNewProyecto(p => ({ ...p, nombre: e.target.value }))} />
              </div>
              <div>
                <Label>Ubicación</Label>
                <Input value={newProyecto.ubicacion} onChange={e => setNewProyecto(p => ({ ...p, ubicacion: e.target.value }))} placeholder="Ubicación de la obra" />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowNewProyectoModal(false)}>Cancelar</Button>
              <Button onClick={createNewProyecto}>Crear Proyecto</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
