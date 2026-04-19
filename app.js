/* ═══════════════════════════════════════════════════
   CONTROL VISITAS  –  app.js
   Base URL: https://controlvisitas.fly.dev
═══════════════════════════════════════════════════ */

const API = 'https://controlvisitas.fly.dev';

// ─── State ───────────────────────────────────────
let allClientes = [];        // cached client list
let editingVisitaId = null;  // null = new, number = edit
let visitaClienteId = null;  // client id for visita endpoint

// ─── Utils ───────────────────────────────────────
function today() {
  return new Date().toISOString().slice(0, 10);
}
function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-ES');
}
function fmtTime(t) {
  if (!t) return '—';
  // Spring serializa LocalTime con @JsonFormat("HH:mm") -> string "HH:mm"
  // Sin anotacion puede llegar como array [H,M,S]
  if (Array.isArray(t)) return t.slice(0, 2).map(x => String(x).padStart(2,'0')).join(':');
  return String(t).slice(0, 5);
}

function toast(msg, type = 'ok') {
  const c = document.getElementById('toast-container');
  const d = document.createElement('div');
  d.className = `toast-msg ${type}`;
  d.innerHTML = `<i class="bi bi-${type === 'ok' ? 'check-circle' : 'exclamation-circle'}"></i> ${msg}`;
  c.appendChild(d);
  setTimeout(() => d.remove(), 3500);
}

async function apiFetch(path, opts = {}) {
  const res = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json' },
    ...opts
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  if (res.status === 204) return null;
  return res.json();
}

// ─── Navigation ──────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`screen-${name}`).classList.add('active');
  const nb = document.getElementById(`nav-${name}`);
  if (nb) nb.classList.add('active');

  if (name === 'visitas') loadVisitasHoy();
  if (name === 'clientes') loadClientes();
  if (name === 'productos') loadProductos();
  if (name === 'listado') {
    const el = document.getElementById('listado-fecha');
    if (!el.value) el.value = today();
  }
}

function closeModal(id) {
  document.getElementById(id).style.display = 'none';
}

// ─── VISITAS HOY ─────────────────────────────────
async function loadVisitasHoy() {
  const tb = document.getElementById('tbody-visitas');
  tb.innerHTML = `<tr class="loading-row"><td colspan="8"><span class="spinner"></span> Cargando…</td></tr>`;
  try {
    const visitas = await apiFetch(`/visita/${today()}`);
    renderVisitasTable(visitas, tb, 8);
  } catch (e) {
    tb.innerHTML = `<tr><td colspan="8" class="loading-row" style="color:var(--danger)">Error al cargar visitas</td></tr>`;
  }
}

function renderVisitasTable(visitas, tbody, cols) {
  if (!visitas || visitas.length === 0) {
    tbody.innerHTML = `<tr><td colspan="${cols}">
      <div class="empty-state"><i class="bi bi-calendar-x"></i>Sin visitas registradas</div>
    </td></tr>`;
    return;
  }
  tbody.innerHTML = visitas.map(v => {
    const empresa = v.cliente?.empresa || '—';
    const dir = [v.cliente?.direccion, v.cliente?.municipio].filter(Boolean).join(', ') || '—';
    const contacto = v.cliente?.contacto || '—';
    const tel = v.cliente?.telefono || '—';
    return `<tr>
      <td><strong>${empresa}</strong></td>
      <td>${dir}</td>
      <td>${contacto}</td>
      <td>${tel}</td>
      <td><span class="badge-pill badge-info">${fmtTime(v.hora_llegada)}</span></td>
      <td><span class="badge-pill badge-accent">${fmtTime(v.hora_salida)}</span></td>
      <td style="max-width:200px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${v.observaciones || '—'}</td>
      ${cols === 8 ? `<td>
        <button class="btn-danger" onclick="borrarVisita(${v.cliente?.id}, ${v.id})">
          <i class="bi bi-trash3"></i>
        </button>
      </td>` : ''}
    </tr>`;
  }).join('');
}

async function borrarVisita(clienteId, visitaId) {
  if (!confirm('¿Borrar esta visita?')) return;
  try {
    await apiFetch(`/cliente/${clienteId}/visita/${visitaId}`, { method: 'DELETE' });
    toast('Visita eliminada');
    loadVisitasHoy();
  } catch (e) {
    toast('Error al borrar visita', 'err');
  }
}

// ─── MODAL NUEVA VISITA ──────────────────────────
async function openModalNuevaVisita(id = null) {
  editingVisitaId = id;
  document.getElementById('modal-visita-title').textContent = id ? 'Editar Visita' : 'Nueva Visita';
  document.getElementById('v-fecha').value = today();
  document.getElementById('v-inicio').value = '';
  document.getElementById('v-fin').value = '';
  document.getElementById('v-obs').value = '';

  // populate clients
  const sel = document.getElementById('v-cliente');
  sel.innerHTML = '<option value="">Cargando clientes…</option>';
  document.getElementById('modal-visita').style.display = 'flex';
  try {
    if (allClientes.length === 0) allClientes = await apiFetch('/cliente');
    sel.innerHTML = allClientes.map(c =>
      `<option value="${c.id}">${c.empresa || 'Cliente ' + c.id}</option>`
    ).join('');
  } catch (e) {
    sel.innerHTML = '<option>Error cargando clientes</option>';
  }
}

async function guardarVisita() {
  const clienteId = document.getElementById('v-cliente').value;
  const fecha = document.getElementById('v-fecha').value;
  const hora_llegada = document.getElementById('v-inicio').value;
  const hora_salida = document.getElementById('v-fin').value;
  const observaciones = document.getElementById('v-obs').value;

  if (!clienteId || !fecha) { toast('Selecciona cliente y fecha', 'err'); return; }

  const body = { fecha, hora_llegada, hora_salida, observaciones };

  try {
    if (editingVisitaId) {
      await apiFetch(`/visita/${editingVisitaId}`, { method: 'PUT', body: JSON.stringify(body) });
      toast('Visita actualizada');
    } else {
      await apiFetch(`/cliente/${clienteId}/visita`, { method: 'POST', body: JSON.stringify(body) });
      toast('Visita registrada');
    }
    closeModal('modal-visita');
    loadVisitasHoy();
  } catch (e) {
    toast('Error al guardar visita', 'err');
  }
}

// ─── LISTADO VISITAS ─────────────────────────────
async function cargarListado() {
  const fecha = document.getElementById('listado-fecha').value;
  if (!fecha) { toast('Selecciona una fecha', 'err'); return; }
  const tb = document.getElementById('tbody-listado');
  tb.innerHTML = `<tr class="loading-row"><td colspan="7"><span class="spinner"></span> Cargando…</td></tr>`;
  try {
    const visitas = await apiFetch(`/visita/${fecha}`);
    renderListado(visitas);
  } catch (e) {
    tb.innerHTML = `<tr><td colspan="7" class="loading-row" style="color:var(--danger)">Error al cargar visitas</td></tr>`;
  }
}

function renderListado(visitas) {
  const tb = document.getElementById('tbody-listado');
  if (!visitas || visitas.length === 0) {
    tb.innerHTML = `<tr><td colspan="7"><div class="empty-state"><i class="bi bi-calendar-x"></i>Sin visitas en esta fecha</div></td></tr>`;
    return;
  }
  tb.innerHTML = visitas.map(v => {
    const empresa = v.cliente?.empresa || '—';
    const dir = [v.cliente?.direccion, v.cliente?.municipio].filter(Boolean).join(', ') || '—';
    return `<tr>
      <td><strong>${empresa}</strong></td>
      <td>${dir}</td>
      <td>${v.cliente?.contacto || '—'}</td>
      <td>${v.cliente?.telefono || '—'}</td>
      <td><span class="badge-pill badge-info">${fmtTime(v.hora_llegada)}</span></td>
      <td><span class="badge-pill badge-accent">${fmtTime(v.hora_salida)}</span></td>
      <td style="max-width:200px">${v.observaciones || '—'}</td>
    </tr>`;
  }).join('');
}

function imprimirPDF() {
  const fecha = document.getElementById('listado-fecha').value || today();
  const rows = [];
  document.querySelectorAll('#tbody-listado tr').forEach(tr => {
    const tds = tr.querySelectorAll('td');
    if (tds.length < 7) return;
    rows.push(Array.from(tds).map(td => td.innerText.trim()));
  });
  if (rows.length === 0) { toast('No hay datos para imprimir', 'err'); return; }

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation: 'landscape' });
  doc.setFontSize(14);
  doc.text(`Listado de Visitas — ${fmtDate(fecha)}`, 14, 16);
  doc.autoTable({
    head: [['Empresa','Dirección','Contacto','Teléfono','Inicio','Fin','Observaciones']],
    body: rows,
    startY: 22,
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [30, 35, 50], textColor: [232, 255, 71] },
    alternateRowStyles: { fillColor: [245, 245, 250] },
  });
  doc.save(`visitas_${fecha}.pdf`);
  toast('PDF generado');
}

// ─── CLIENTES ────────────────────────────────────
// Cache de visitas por cliente: { clienteId: [visita, ...] }
let visitasCache = {};

async function loadClientes(forceReload = false) {
  const tb = document.getElementById('tbody-clientes');
  // Si ya tenemos clientes en caché, mostrarlos al instante
  if (!forceReload && allClientes.length > 0) {
    renderClientesTable(allClientes, {});
    return;
  }
  tb.innerHTML = `<tr class="loading-row"><td colspan="6"><span class="spinner"></span> Cargando clientes…</td></tr>`;
  try {
    // 1 sola llamada para clientes
    allClientes = await apiFetch('/cliente');

    // Renderizar tabla inmediatamente — visitas solo bajo demanda (detalle)
    visitasCache = {};
    renderClientesTable(allClientes, {});
  } catch (e) {
    tb.innerHTML = `<tr><td colspan="6" class="loading-row" style="color:var(--danger)">Error al cargar clientes</td></tr>`;
  }
}

function actualizarCeldaVisitas(clienteId) {
  const cell = document.getElementById(`visitas-c-${clienteId}`);
  if (!cell) return;
  const visitas = visitasCache[clienteId] || [];
  const last5 = visitas.slice(0, 5);
  if (last5.length === 0) {
    cell.innerHTML = '<span style="color:var(--text-muted);font-size:.8rem">Sin visitas</span>';
    return;
  }
  cell.innerHTML = `<table class="mini-table">
    ${last5.map(v => `<tr>
      <td>${fmtDate(v.fecha)}</td>
      <td>${fmtTime(v.hora_llegada)} – ${fmtTime(v.hora_salida)}</td>
    </tr>`).join('')}
  </table>`;
}

function renderClientesTable(clientes, cache) {
  const tb = document.getElementById('tbody-clientes');
  if (!clientes || clientes.length === 0) {
    tb.innerHTML = `<tr><td colspan="6"><div class="empty-state"><i class="bi bi-people"></i>Sin clientes</div></td></tr>`;
    return;
  }
  tb.innerHTML = clientes.map(c => {
    const nombre = c.empresa || 'Sin nombre';
    const dir = [c.direccion, c.municipio].filter(Boolean).join(', ') || '—';
    return `<tr id="row-c-${c.id}">
      <td><strong>${nombre}</strong></td>
      <td>${dir}</td>
      <td>${c.contacto || '—'}</td>
      <td>${c.telefono || '—'}</td>
      <td><span class="badge-pill badge-accent">${c.municipio || '—'}</span></td>
      <td>
        <div style="display:flex;gap:.4rem;flex-wrap:nowrap">
          <button class="btn-info" onclick="verDetalle(${c.id},'${nombre.replace(/'/g,"\\'")}')">
            <i class="bi bi-eye"></i>
          </button>
          <button class="btn-ghost" onclick="openEditCliente(${c.id})">
            <i class="bi bi-pencil"></i>
          </button>
          <button class="btn-danger" onclick="borrarCliente(${c.id})">
            <i class="bi bi-trash3"></i>
          </button>
        </div>
      </td>
    </tr>`;
  }).join('');

}

function filtrarClientes() {
  const q = document.getElementById('search-clientes').value.toLowerCase();
  const filtered = allClientes.filter(c => {
    const nombre = (c.empresa || '').toLowerCase();
    const contacto = (c.contacto || '').toLowerCase();
    const dir = (c.direccion || '').toLowerCase();
    const mun = (c.municipio || '').toLowerCase();
    return nombre.includes(q) || contacto.includes(q) || dir.includes(q) || mun.includes(q);
  });
  renderClientesTable(filtered);
}

// ─── MODAL NUEVO / EDITAR CLIENTE ────────────────
function openModalCliente() {
  document.getElementById('modal-cliente-title').textContent = 'Nuevo Cliente';
  document.getElementById('c-id').value = '';
  ['c-empresa','c-contacto','c-telefono','c-email','c-direccion','c-municipio'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('modal-cliente').style.display = 'flex';
}

async function openEditCliente(id) {
  try {
    const c = await apiFetch(`/cliente/${id}`);
    document.getElementById('modal-cliente-title').textContent = 'Editar Cliente';
    document.getElementById('c-id').value = c.id;
    document.getElementById('c-empresa').value = c.empresa || '';
    document.getElementById('c-contacto').value = c.contacto || '';
    document.getElementById('c-telefono').value = c.telefono || '';
    document.getElementById('c-email').value = c.email || '';
    document.getElementById('c-direccion').value = c.direccion || '';
    document.getElementById('c-municipio').value = c.municipio || '';
    document.getElementById('modal-cliente').style.display = 'flex';
  } catch (e) {
    toast('Error al cargar cliente', 'err');
  }
}

async function guardarCliente() {
  const id = document.getElementById('c-id').value;
  const body = {
    empresa: document.getElementById('c-empresa').value,
    contacto: document.getElementById('c-contacto').value,
    telefono: document.getElementById('c-telefono').value,
    email: document.getElementById('c-email').value,
    direccion: document.getElementById('c-direccion').value,
    municipio: document.getElementById('c-municipio').value,
  };
  if (!body.empresa) { toast('La empresa es obligatoria', 'err'); return; }
  try {
    if (id) {
      await apiFetch(`/cliente/${id}`, { method: 'PUT', body: JSON.stringify(body) });
      toast('Cliente actualizado');
    } else {
      await apiFetch('/cliente', { method: 'POST', body: JSON.stringify(body) });
      toast('Cliente creado');
    }
    closeModal('modal-cliente');
    loadClientes();
  } catch (e) {
    toast('Error al guardar cliente', 'err');
  }
}

async function borrarCliente(id) {
  if (!confirm('¿Borrar este cliente? Se eliminarán también sus visitas.')) return;
  try {
    await apiFetch(`/cliente/${id}`, { method: 'DELETE' });
    toast('Cliente eliminado');
    loadClientes();
  } catch (e) {
    toast('Error al borrar cliente', 'err');
  }
}

// ─── DETALLE CLIENTE ─────────────────────────────
async function verDetalle(id, nombre) {
  document.getElementById('detalle-nombre').textContent = nombre;
  document.getElementById('detalle-series').innerHTML = '<span class="spinner"></span>';
  document.getElementById('detalle-productos').innerHTML = '<span class="spinner"></span>';
  document.getElementById('detalle-visitas').querySelector('tbody').innerHTML = '';
  document.getElementById('modal-detalle').style.display = 'flex';

  try {
    const [series, productos, visitas] = await Promise.all([
      apiFetch(`/cliente/${id}/serie`).catch(() => []),
      apiFetch(`/cliente/${id}/producto`).catch(() => []),
      apiFetch(`/visita/cliente/${id}/ultimas`).catch(() => []),
    ]);

    const seriesEl = document.getElementById('detalle-series');
    if (series && series.length) {
      seriesEl.innerHTML = series.map(s => {
        const equipo = (s.producto && s.producto.equipo) ? s.producto.equipo : 'Equipo';
        const nserie = s.num_serie ? ' <small style="opacity:.65">' + s.num_serie + '</small>' : '';
        const inst   = s.fecha_instalacion ? ' | Inst: ' + fmtDate(s.fecha_instalacion) : '';
        const venc   = s.fecha_vencimiento ? ' | Vence: ' + fmtDate(s.fecha_vencimiento) : '';
        const cont   = s.fin_contrato      ? ' | Contrato: ' + fmtDate(s.fin_contrato)   : '';
        return '<span class="detail-tag" title="' + inst + venc + cont + '"><i class="bi bi-cpu"></i> ' + equipo + nserie + '</span>';
      }).join('');
    } else {
      seriesEl.innerHTML = '<span style="color:var(--text-muted);font-size:.85rem">Sin máquinas registradas</span>';
    }

    const prodEl = document.getElementById('detalle-productos');
    if (productos && productos.length) {
      prodEl.innerHTML = productos.map(p => '<span class="detail-tag"><i class="bi bi-box-seam"></i> ' + (p.equipo || '—') + '</span>').join('');
    } else {
      prodEl.innerHTML = '<span style="color:var(--text-muted);font-size:.85rem">Sin productos registrados</span>';
    }

    const vTb = document.getElementById('detalle-visitas').querySelector('tbody');
    vTb.innerHTML = (visitas && visitas.length)
      ? visitas.map(v => `<tr>
          <td>${fmtDate(v.fecha)}</td>
          <td>${fmtTime(v.hora_llegada)} – ${fmtTime(v.hora_salida)}</td>
          <td style="color:var(--text)">${v.observaciones || '—'}</td>
        </tr>`).join('')
      : '<tr><td colspan="3" style="color:var(--text-muted)">Sin visitas</td></tr>';
  } catch (e) {
    toast('Error cargando detalle', 'err');
  }
}

// ─── PRODUCTOS ───────────────────────────────────
async function loadProductos() {
  const tb = document.getElementById('tbody-productos');
  tb.innerHTML = `<tr class="loading-row"><td colspan="3"><span class="spinner"></span> Cargando…</td></tr>`;
  try {
    const productos = await apiFetch('/producto');
    if (!productos || productos.length === 0) {
      tb.innerHTML = `<tr><td colspan="3"><div class="empty-state"><i class="bi bi-box-seam"></i>Sin productos</div></td></tr>`;
      return;
    }
    tb.innerHTML = productos.map((p, i) => {
      const series = (p.serie || []).map(s =>
        '<span class="badge-pill badge-info" style="margin:1px 2px;font-size:.75rem">' + (s.num_serie || '—') + '</span>'
      ).join('');
      return '<tr>' +
        '<td>' + (i+1) + '</td>' +
        '<td><strong>' + (p.equipo || '—') + '</strong></td>' +
        '<td>' + (series || '<span style="color:var(--text-muted)">Sin series</span>') + '</td>' +
      '</tr>';
    }).join('');
  } catch (e) {
    tb.innerHTML = `<tr><td colspan="3" class="loading-row" style="color:var(--danger)">Error al cargar productos</td></tr>`;
  }
}

// ─── CLOSE ON BACKDROP CLICK ─────────────────────
['modal-visita','modal-cliente','modal-detalle'].forEach(id => {
  document.getElementById(id).addEventListener('click', function(e) {
    if (e.target === this) closeModal(id);
  });
});

// ─── INIT ────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('listado-fecha').value = today();

  // 1. Despertar Fly.io en cuanto carga la página (petición ligera)
  apiFetch('/cliente/count').catch(() => {});

  // 2. Pre-cargar clientes en segundo plano para que la primera
  //    vez que el usuario pulse "Clientes" aparezca al instante
  setTimeout(() => {
    apiFetch('/cliente').then(d => { if (d) allClientes = d; }).catch(() => {});
  }, 800);
});
