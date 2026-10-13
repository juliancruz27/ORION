// ================================
// MAPA BASE
// ================================
const mapa = L.map('mapa').setView([4.6, -74.1], 6);

L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(mapa);

const controlLeyenda = L.control({ position: 'bottomright' });
controlLeyenda.onAdd = () => {
  const contenedor = L.DomUtil.create('div', 'leyenda-mapa leaflet-control');
  contenedor.innerHTML = `
    <details>
      <summary>Leyenda del mapa</summary>
      <div class="leyenda-contenido">
        <strong>Volcánico</strong>
        <span><i class="leyenda-icono" style="color:#ff6600">▲</i> Alerta naranja</span>
        <span><i class="leyenda-icono" style="color:#ffcc00">▲</i> Alerta amarilla</span>
        <span><i class="leyenda-icono" style="color:#00cc44">▲</i> Alerta verde</span>
        <strong>Sismos</strong>
        <span><i class="leyenda-circulo"></i> Sismo histórico; tamaño según magnitud</span>
        <strong>Movimientos en masa</strong>
        <span><i class="leyenda-icono" style="color:#ff6600">◆</i> Avenida torrencial</span>
        <span><i class="leyenda-icono" style="color:#cc4400">◆</i> Deslizamiento rotacional</span>
        <span><i class="leyenda-icono" style="color:#aa3300">◆</i> Flujo de detritos</span>
        <span><i class="leyenda-icono" style="color:#ff8833">◆</i> Deslizamiento superficial</span>
        <strong>Inundaciones</strong>
        <span><i class="leyenda-icono leyenda-azul">~</i> Área o evento de inundación</span>
        <strong>Zonas sísmicas</strong>
        <span><i class="leyenda-area" style="background:#ff4444"></i> Amenaza alta</span>
        <span><i class="leyenda-area" style="background:#ffaa00"></i> Amenaza media</span>
        <span><i class="leyenda-area" style="background:#44aa44"></i> Amenaza baja</span>
        <strong>Fallas geológicas</strong>
        <span><i class="leyenda-linea"></i> Falla geológica</span>
      </div>
    </details>
  `;
  L.DomEvent.disableClickPropagation(contenedor);
  L.DomEvent.disableScrollPropagation(contenedor);
  return contenedor;
};
controlLeyenda.addTo(mapa);

// ================================
// BÚSQUEDA DE EVENTOS
// ================================
const resultadosBusqueda = [];
const entradaBusqueda = document.getElementById('busqueda-eventos');
const listaResultadosBusqueda = document.getElementById('resultados-busqueda');
const botonLimpiarBusqueda = document.getElementById('limpiar-busqueda');
const filtroTipo = document.getElementById('filtro-tipo');
const filtroAlerta = document.getElementById('filtro-alerta');
const filtroUbicacion = document.getElementById('filtro-ubicacion');

function normalizarBusqueda(texto) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

function coincideConFiltros(resultado) {
  const ubicacion = normalizarBusqueda(filtroUbicacion.value.trim());
  return (!filtroTipo.value || resultado.categoria === filtroTipo.value)
    && (!filtroAlerta.value || resultado.alerta === filtroAlerta.value)
    && (!ubicacion || normalizarBusqueda(resultado.ubicacion).includes(ubicacion));
}

function categoriaHabilitada(resultado) {
  if (resultado.categoria === 'Volcánico') {
    return document.getElementById('capa-volcanes').checked;
  }
  if (resultado.categoria === 'Sísmico') {
    return document.getElementById('capa-sismos').checked
      && document.getElementById('check-sismos').checked;
  }
  if (resultado.categoria === 'Movimientos en masa') {
    return document.getElementById('capa-masas').checked;
  }
  return document.getElementById('capa-inundaciones').checked;
}

function registrarResultadoBusqueda(nombre, ubicacion, categoria, elemento, capa, alerta = '') {
  resultadosBusqueda.push({ nombre, ubicacion, categoria, elemento, capa, alerta });
  aplicarFiltrosEventos();
}

function actualizarResultadosBusqueda() {
  const consulta = normalizarBusqueda(entradaBusqueda.value.trim());
  botonLimpiarBusqueda.disabled = !consulta;
  listaResultadosBusqueda.replaceChildren();

  if (!consulta) {
    listaResultadosBusqueda.hidden = true;
    return;
  }

  listaResultadosBusqueda.hidden = false;
  const coincidencias = resultadosBusqueda
    .filter(resultado => coincideConFiltros(resultado)
      && normalizarBusqueda(`${resultado.nombre} ${resultado.ubicacion}`).includes(consulta))
    .slice(0, 8);

  if (!coincidencias.length) {
    const vacio = document.createElement('li');
    vacio.className = 'resultado-vacio';
    vacio.textContent = 'No se encontraron eventos.';
    listaResultadosBusqueda.appendChild(vacio);
    return;
  }

  coincidencias.forEach(resultado => {
    const item = document.createElement('li');
    const boton = document.createElement('button');
    const nombre = document.createElement('span');
    const detalle = document.createElement('span');

    boton.type = 'button';
    boton.className = 'resultado-busqueda';
    nombre.className = 'resultado-nombre';
    nombre.textContent = resultado.nombre;
    detalle.className = 'resultado-detalle';
    detalle.textContent = resultado.ubicacion
      ? `${resultado.categoria} · ${resultado.ubicacion}`
      : resultado.categoria;

    boton.append(nombre, detalle);
    boton.addEventListener('click', () => seleccionarResultadoBusqueda(resultado));
    item.appendChild(boton);
    listaResultadosBusqueda.appendChild(item);
  });
}

function aplicarFiltrosEventos() {
  let cantidad = 0;

  resultadosBusqueda.forEach(resultado => {
    const coincide = coincideConFiltros(resultado);
    resultado.elemento.style.display = coincide ? 'flex' : 'none';

    if (coincide) {
      cantidad += 1;
    }

    if (coincide && categoriaHabilitada(resultado)) resultado.capa.addTo(mapa);
    else mapa.removeLayer(resultado.capa);
  });

  const permitirCapasSismicas = (!filtroTipo.value || filtroTipo.value === 'Sísmico')
    && !filtroAlerta.value
    && document.getElementById('capa-sismos').checked;
  if (capaZonas) {
    if (permitirCapasSismicas && document.getElementById('check-zonas').checked) capaZonas.addTo(mapa);
    else mapa.removeLayer(capaZonas);
  }
  if (capaFallas) {
    if (permitirCapasSismicas && document.getElementById('check-fallas').checked) capaFallas.addTo(mapa);
    else mapa.removeLayer(capaFallas);
  }

  document.getElementById('conteo-eventos').textContent = `${cantidad} eventos coinciden`;
  document.querySelectorAll('.filtro-btn').forEach(boton => {
    const nivel = filtroAlerta.value || 'todos';
    boton.classList.toggle('activo-filtro', boton.dataset.filtro === nivel);
  });

  if (entradaBusqueda.value.trim()) actualizarResultadosBusqueda();
}

function activarCapaDeBusqueda(categoria) {
  if (categoria === 'Volcánico') {
    document.getElementById('capa-volcanes').checked = true;
    Object.values(capasVolcanes).forEach(layer => layer.addTo(mapa));
    aplicarFiltrosEventos();
    return;
  }

  if (categoria === 'Sísmico') {
    document.getElementById('capa-sismos').checked = true;
    document.getElementById('check-sismos').checked = true;
    if (capaSismos) capaSismos.addTo(mapa);
    aplicarFiltrosEventos();
    return;
  }

  if (categoria === 'Movimientos en masa') {
    document.getElementById('capa-masas').checked = true;
    if (capaMovimientos) capaMovimientos.addTo(mapa);
    aplicarFiltrosEventos();
    return;
  }

  document.getElementById('capa-inundaciones').checked = true;
  if (capaInundaciones) capaInundaciones.addTo(mapa);
  aplicarFiltrosEventos();
}

function seleccionarResultadoBusqueda(resultado) {
  resultado.elemento.closest('.modulo').classList.add('abierto');
  activarCapaDeBusqueda(resultado.categoria);
  entradaBusqueda.value = '';
  actualizarResultadosBusqueda();
  resultado.elemento.click();
}

entradaBusqueda.addEventListener('input', actualizarResultadosBusqueda);
botonLimpiarBusqueda.addEventListener('click', () => {
  entradaBusqueda.value = '';
  actualizarResultadosBusqueda();
  entradaBusqueda.focus();
});
filtroTipo.addEventListener('change', aplicarFiltrosEventos);
filtroAlerta.addEventListener('change', aplicarFiltrosEventos);
filtroUbicacion.addEventListener('input', aplicarFiltrosEventos);
document.getElementById('limpiar-filtros').addEventListener('click', () => {
  filtroTipo.value = '';
  filtroAlerta.value = '';
  filtroUbicacion.value = '';
  aplicarFiltrosEventos();
});

// ================================
// FUENTES Y ACTUALIZACIÓN DE DATOS
// ================================
function formatearFechaActualizacion(fecha) {
  if (!fecha) return 'No informada';

  const valor = new Date(`${fecha}T00:00:00`);
  if (Number.isNaN(valor.getTime())) return 'Fecha no válida';

  return new Intl.DateTimeFormat('es-CO', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(valor);
}

function mostrarFuentes(metadatos) {
  const lista = document.getElementById('lista-fuentes');
  lista.replaceChildren();

  metadatos.forEach(capa => {
    const elemento = document.createElement('li');
    const nombre = document.createElement('strong');
    const enlace = document.createElement('a');
    const actualizacion = document.createElement('span');

    nombre.className = 'fuente-nombre';
    nombre.textContent = capa.nombre;
    enlace.className = 'fuente-enlace';
    enlace.href = capa.url;
    enlace.target = '_blank';
    enlace.rel = 'noopener noreferrer';
    enlace.textContent = capa.fuente;
    actualizacion.className = 'fuente-actualizacion';
    actualizacion.textContent = `Actualización: ${formatearFechaActualizacion(capa.actualizacion)}`;

    elemento.append(nombre, enlace, actualizacion);
    lista.appendChild(elemento);
  });
}

fetch('data/metadatos.json')
  .then(respuesta => {
    if (!respuesta.ok) throw new Error('No se pudieron cargar los metadatos');
    return respuesta.json();
  })
  .then(mostrarFuentes)
  .catch(() => {
    const lista = document.getElementById('lista-fuentes');
    lista.replaceChildren();
    const error = document.createElement('li');
    error.textContent = 'No fue posible cargar las fuentes.';
    lista.appendChild(error);
  });


// ================================
// COLORES SEGÚN NIVEL DE ALERTA
// ================================
function colorAlerta(nivel) {
  switch (nivel) {
    case 'Rojo':     return '#ff0000';
    case 'Naranja':  return '#ff6600';
    case 'Amarillo': return '#ffcc00';
    case 'Verde':    return '#00cc44';
    default:         return '#ffffff';
  }
}

function colorBadge(nivel) {
  switch (nivel) {
    case 'Rojo':     return '#ff0000';
    case 'Naranja':  return '#ff6600';
    case 'Amarillo': return '#ffcc00';
    case 'Verde':    return '#00cc44';
    default:         return '#8899aa';
  }
}

function colorSismico(nivel) {
  switch (nivel) {
    case 'alto':  return '#ff4444';
    case 'medio': return '#ffaa00';
    case 'bajo':  return '#44aa44';
    default:      return '#ffffff';
  }
}

function colorMovimiento(tipo) {
  switch (tipo) {
    case 'Avenida torrencial':        return '#ff6600';
    case 'Deslizamiento rotacional':  return '#cc4400';
    case 'Flujo de detritos':         return '#aa3300';
    case 'Deslizamiento superficial': return '#ff8833';
    default:                          return '#ff5500';
  }
}


// ================================
// PANEL DE DETALLE
// ================================
const panelDetalle = document.getElementById('panel-detalle');
let capaActiva = null;
let circuloActivo = null;

function mostrarBloqueDetalle(idBloque, badgeLabel) {
  document.getElementById('detalle-bloque-volcan').classList.add('oculto');
  document.getElementById('detalle-bloque-sismico').classList.add('oculto');
  document.getElementById('detalle-bloque-masas').classList.add('oculto');
  document.getElementById('detalle-bloque-inundaciones').classList.add('oculto');
  document.getElementById(idBloque).classList.remove('oculto');
  document.getElementById('detalle-badge-label').textContent = badgeLabel;
}

function aplicarFoto(url, alt) {
  const foto = document.getElementById('detalle-foto');
  const contenedor = document.querySelector('.detalle-foto-contenedor');
  if (url) {
    contenedor.style.display = '';
    foto.src = url;
    foto.alt = alt || '';
    foto.onerror = () => {
      foto.style.display = 'none';
      contenedor.style.display = 'none';
    };
    foto.onload = () => { foto.style.display = 'block'; };
  } else {
    foto.removeAttribute('src');
    foto.alt = '';
    foto.style.display = 'none';
    contenedor.style.display = 'none';
  }
}

function cerrarDetalle() {
  if (circuloActivo) {
    mapa.removeLayer(circuloActivo);
    circuloActivo = null;
  }
  panelDetalle.classList.add('oculto');
  const capa = capaActiva;
  capaActiva = null;
  if (capa) capa.closePopup();

  mostrarBloqueDetalle('detalle-bloque-volcan', 'Nivel de alerta:');
}

document.getElementById('detalle-cerrar').onclick = () => cerrarDetalle();


// ================================
// PANEL DETALLE — VOLCÁNICO
// ================================
function abrirDetalle(p, layer) {
  capaActiva = layer;

  mostrarBloqueDetalle('detalle-bloque-volcan', 'Nivel de alerta:');

  document.getElementById('detalle-nombre').textContent = p.nombre;
  document.getElementById('detalle-alerta-valor').textContent = p.alerta;
  document.getElementById('detalle-ubicacion').textContent = p.ubicacion;
  document.getElementById('detalle-altura').textContent = p.altura;
  document.getElementById('detalle-tipo').textContent = p.tipo || '—';
  document.getElementById('detalle-actividad').textContent = p.ultima_actividad || '—';
  document.getElementById('detalle-entidad').textContent = p.entidad || '—';
  document.getElementById('detalle-observatorio').textContent = p.entidad || '—';
  document.getElementById('detalle-descripcion').textContent = p.descripcion;
  document.getElementById('detalle-historia').textContent = p.historia;
  document.getElementById('detalle-amenazas').textContent = p.amenazas || '—';
  document.getElementById('detalle-municipios').textContent = p.municipios_riesgo || '—';

  // Teléfono
  const telefono = p.telefono || '601 220 0200';
  document.getElementById('detalle-telefono-texto').textContent = telefono;
  document.getElementById('detalle-telefono').href = 'tel:' + telefono.replace(/\s/g, '');

  // Badge de color
  const badge = document.getElementById('detalle-alerta');
  badge.style.borderColor = colorBadge(p.alerta);
  badge.style.color = colorBadge(p.alerta);

  aplicarFoto(p.foto, `Fotografía de ${p.nombre}`);

  // Enlace SGC
  document.getElementById('detalle-url').href = 'https://www.sgc.gov.co/volcanes';

  // Círculo de influencia
  if (circuloActivo) mapa.removeLayer(circuloActivo);
  const latlng = layer.getLatLng();
  circuloActivo = L.circle([latlng.lat, latlng.lng], {
    radius: p.radio_km * 1000,
    color: colorAlerta(p.alerta),
    fillColor: colorAlerta(p.alerta),
    fillOpacity: 0.08,
    weight: 1.5,
    dashArray: '6, 6'
  }).addTo(mapa);

  panelDetalle.classList.remove('oculto');
}


// ================================
// PANEL DETALLE — SÍSMICO
// ================================
function abrirDetalleSismico(p, layer) {
  capaActiva = layer;

  mostrarBloqueDetalle('detalle-bloque-sismico', 'Magnitud:');

  document.getElementById('detalle-nombre').textContent = p.nombre;
  document.getElementById('detalle-alerta-valor').textContent = `M ${p.magnitud} Mw`;

  // Badge color según magnitud
  const badge = document.getElementById('detalle-alerta');
  let colorMag;
  if (p.magnitud >= 7)      colorMag = '#ff4444';
  else if (p.magnitud >= 6) colorMag = '#ff8800';
  else                       colorMag = '#ffcc00';
  badge.style.borderColor = colorMag;
  badge.style.color = colorMag;

  aplicarFoto(p.foto, `Fotografía de ${p.nombre}`);

  // Información general
  document.getElementById('detalle-fecha').textContent = p.fecha || '—';
  document.getElementById('detalle-ubicacion-s').textContent = p.ubicacion || '—';
  document.getElementById('detalle-profundidad').textContent = p.profundidad || '—';
  document.getElementById('detalle-falla').textContent = p.tipo_falla || '—';
  document.getElementById('detalle-victimas').textContent = p.victimas || '—';

  // Descripción e impacto
  document.getElementById('detalle-descripcion-s').textContent = p.descripcion || '—';
  document.getElementById('detalle-impacto').textContent = p.impacto || '—';

  panelDetalle.classList.remove('oculto');
}


// ================================
// PANEL DETALLE — MOVIMIENTOS EN MASA
// ================================
function abrirDetalleMasas(p, layer) {
  capaActiva = layer;

  mostrarBloqueDetalle('detalle-bloque-masas', 'Tipo:');

  document.getElementById('detalle-nombre').textContent = p.nombre;
  document.getElementById('detalle-alerta-valor').textContent = p.tipo || '—';

  const color = colorMovimiento(p.tipo);
  const badge = document.getElementById('detalle-alerta');
  badge.style.borderColor = color;
  badge.style.color = color;

  aplicarFoto(p.foto, `Fotografía de ${p.nombre}`);

  document.getElementById('detalle-fecha-m').textContent = p.fecha || '—';
  document.getElementById('detalle-ubicacion-m').textContent = p.ubicacion || '—';
  document.getElementById('detalle-tipo-m').textContent = p.tipo || '—';
  document.getElementById('detalle-victimas-m').textContent = p.victimas || '—';
  document.getElementById('detalle-rios-m').textContent = p.rios_afectados || '—';
  document.getElementById('detalle-descripcion-m').textContent = p.descripcion || '—';
  document.getElementById('detalle-causa-m').textContent = p.causa || '—';
  document.getElementById('detalle-fuente-m').textContent = p.fuente || '—';

  panelDetalle.classList.remove('oculto');
}


// ================================
// PANEL DETALLE — INUNDACIONES
// ================================
function abrirDetalleInundaciones(p, layer) {
  capaActiva = layer;

  mostrarBloqueDetalle('detalle-bloque-inundaciones', 'Tipo:');

  document.getElementById('detalle-nombre').textContent = p.nombre;
  document.getElementById('detalle-alerta-valor').textContent = p.tipo || '—';

  const badge = document.getElementById('detalle-alerta');
  badge.style.borderColor = '#3d9ec4';
  badge.style.color = '#3d9ec4';

  aplicarFoto(p.foto, `Fotografía de ${p.nombre}`);

  document.getElementById('detalle-tipo-i').textContent = p.tipo || '—';
  document.getElementById('detalle-ubicacion-i').textContent = p.ubicacion || '—';
  document.getElementById('detalle-periodo-i').textContent = p.periodo || '—';
  document.getElementById('detalle-area-i').textContent = p.area_afectada || '—';
  document.getElementById('detalle-municipios-i').textContent = p.municipios || '—';
  document.getElementById('detalle-descripcion-i').textContent = p.descripcion || '—';
  document.getElementById('detalle-causa-i').textContent = p.causa || '—';
  document.getElementById('detalle-fuente-i').textContent = p.fuente || '—';

  panelDetalle.classList.remove('oculto');
}


// ================================
// CARGA DE VOLCANES
// ================================
const capasVolcanes = {};

fetch('data/volcanes.geojson')
  .then(r => r.json())
  .then(datos => {

    L.geoJSON(datos, {

      pointToLayer: (feature, latlng) => {
        const color = colorAlerta(feature.properties.alerta);
        const icono = L.divIcon({
          className: '',
          html: `<div class="icono-volcan" style="color:${color}; text-shadow: 0 0 6px ${color}">▲</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });
        return L.marker(latlng, { icon: icono });
      },

      onEachFeature: (feature, layer) => {
        const p = feature.properties;
        capasVolcanes[p.nombre] = layer;

        layer.bindPopup(`
          <div class="popup-contenido">
            <h3>${p.nombre}</h3>
            <p><strong>Ubicación:</strong> ${p.ubicacion}</p>
            <p><strong>Altura:</strong> ${p.altura}</p>
            <p><strong>Nivel de alerta:</strong> ${p.alerta}</p>
          </div>
        `);

        layer.on('popupclose', () => cerrarDetalle());
        layer.on('click', () => abrirDetalle(p, layer));
      }

    }).addTo(mapa);

    // Contadores
    document.getElementById('count-naranja').textContent  = datos.features.filter(f => f.properties.alerta === 'Naranja').length;
    document.getElementById('count-amarillo').textContent = datos.features.filter(f => f.properties.alerta === 'Amarillo').length;
    document.getElementById('count-verde').textContent    = datos.features.filter(f => f.properties.alerta === 'Verde').length;

    // Lista del panel
    const lista = document.getElementById('lista-volcanes');
    datos.features.forEach(feature => {
      const p = feature.properties;
      const color = colorAlerta(p.alerta);
      const [lng, lat] = feature.geometry.coordinates;

      const li = document.createElement('li');
      li.dataset.alerta = p.alerta;
      li.innerHTML = `
        <span class="elemento-punto" style="background:${color}"></span>
        <span class="elemento-nombre">${p.nombre}</span>
        <span class="badge-alerta badge-${p.alerta.toLowerCase()}">${p.alerta}</span>
      `;

      li.addEventListener('click', () => {
        document.querySelectorAll('#lista-volcanes li').forEach(el => el.classList.remove('activo'));
        li.classList.add('activo');
        mapa.flyTo([lat, lng], 10, { animate: true, duration: 1.5 });
        capasVolcanes[p.nombre].openPopup();
        abrirDetalle(p, capasVolcanes[p.nombre]);
      });

      registrarResultadoBusqueda(p.nombre, p.ubicacion || '', 'Volcánico', li, capasVolcanes[p.nombre], p.alerta);
      lista.appendChild(li);
    });

    // Checkbox activar/desactivar
    document.getElementById('capa-volcanes').addEventListener('change', e => {
      datos.features.forEach(feature => {
        const layer = capasVolcanes[feature.properties.nombre];
        if (e.target.checked) layer.addTo(mapa);
        else mapa.removeLayer(layer);
      });
      aplicarFiltrosEventos();
    });

    // Filtro por alerta
    document.querySelectorAll('.filtro-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        filtroAlerta.value = btn.dataset.filtro === 'todos' ? '' : btn.dataset.filtro;
        aplicarFiltrosEventos();
      });
    });

  });


// ================================
// PANEL LATERAL: EXPANDIR / CONTRAER
// ================================
document.querySelectorAll('.modulo').forEach(modulo => {
  const cabecera = modulo.querySelector('.modulo-cabecera');
  cabecera.addEventListener('click', () => modulo.classList.toggle('abierto'));
});
// ================================
// CARGA DE SISMOS HISTÓRICOS
// ================================
let capaSismos = null;

fetch('data/sismos.geojson')
  .then(r => r.json())
  .then(datos => {

    capaSismos = L.geoJSON(datos, {

      pointToLayer: (feature, latlng) => {
        const mag = feature.properties.magnitud;
        return L.circleMarker(latlng, {
          radius: mag * 4,
          color: '#ff4444',
          fillColor: '#ff4444',
          fillOpacity: 0.3,
          weight: 1.5
        });
      },

      onEachFeature: (feature, layer) => {
        const p = feature.properties;
        layer.bindPopup(`
          <div class="popup-contenido">
            <h3>${p.nombre}</h3>
            <p><strong>Fecha:</strong> ${p.fecha}</p>
            <p><strong>Magnitud:</strong> ${p.magnitud} Mw</p>
            <p><strong>Ubicación:</strong> ${p.ubicacion}</p>
            <p><strong>Profundidad:</strong> ${p.profundidad}</p>
            <p><strong>Víctimas:</strong> ${p.victimas}</p>
          </div>
        `);
        layer.on('popupclose', () => cerrarDetalle());
        layer.on('click', () => abrirDetalleSismico(p, layer));
      }

    }).addTo(mapa);

    // Guardamos referencia a cada capa por coordenadas
    const capasSismos = {};
    capaSismos.eachLayer(layer => {
      const latlng = layer.getLatLng();
      const key = `${latlng.lat.toFixed(3)},${latlng.lng.toFixed(3)}`;
      capasSismos[key] = layer;
    });

    // Lista del panel
    const lista = document.getElementById('lista-sismos');
    datos.features.forEach(feature => {
      const p = feature.properties;
      const [lng, lat] = feature.geometry.coordinates;
      const key = `${lat.toFixed(3)},${lng.toFixed(3)}`;

      const li = document.createElement('li');
      li.innerHTML = `
        <span class="elemento-punto" style="background:#ff4444"></span>
        <span class="elemento-nombre">${p.nombre}</span>
        <span class="badge-alerta" style="background:rgba(255,68,68,0.15);color:#ff4444;border:1px solid rgba(255,68,68,0.3)">M${p.magnitud}</span>
      `;

      li.addEventListener('click', () => {
        document.querySelectorAll('#lista-sismos li').forEach(el => el.classList.remove('activo'));
        li.classList.add('activo');
        mapa.flyTo([lat, lng], 9, { animate: true, duration: 1.5 });
        const layer = capasSismos[key];
        if (layer) {
          layer.openPopup();
          abrirDetalleSismico(p, layer);
        }
      });

      registrarResultadoBusqueda(p.nombre, p.ubicacion || '', 'Sísmico', li, capasSismos[key], p.alerta || '');
      lista.appendChild(li);
    });

    // Checkbox subcapa
    document.getElementById('check-sismos').addEventListener('change', e => {
      if (e.target.checked) capaSismos.addTo(mapa);
      else mapa.removeLayer(capaSismos);
      aplicarFiltrosEventos();
    });

  });
// ================================
// CARGA DE ZONAS SÍSMICAS
// ================================
let capaZonas = null;

fetch('data/zonas_sismicas.geojson')
  .then(r => r.json())
  .then(datos => {

    capaZonas = L.geoJSON(datos, {
      style: feature => ({
        color: colorSismico(feature.properties.nivel),
        weight: 1, opacity: 0.6,
        fillColor: colorSismico(feature.properties.nivel),
        fillOpacity: 0.08
      }),
      onEachFeature: (feature, layer) => {
        const p = feature.properties;
        layer.bindPopup(`
          <div class="popup-contenido">
            <h3>${p.nombre}</h3>
            <p><strong>Descripción:</strong> ${p.descripcion}</p>
            <p><strong>Departamentos:</strong> ${p.departamentos}</p>
            <p><strong>Fuente:</strong> ${p.fuente}</p>
          </div>
        `);
      }
    }).addTo(mapa);

    document.getElementById('check-zonas').addEventListener('change', e => {
      if (e.target.checked) capaZonas.addTo(mapa);
      else mapa.removeLayer(capaZonas);
    });

  });


// ================================
// CARGA DE FALLAS GEOLÓGICAS
// ================================
let capaFallas = null;

fetch('data/fallas.geojson')
  .then(r => r.json())
  .then(datos => {

    capaFallas = L.geoJSON(datos, {
      style: {
        color: '#ff8800', weight: 2,
        opacity: 0.8, dashArray: '6, 4'
      },
      onEachFeature: (feature, layer) => {
        const p = feature.properties;
        layer.bindPopup(`
          <div class="popup-contenido">
            <h3>${p.nombre}</h3>
            <p><strong>Tipo:</strong> ${p.tipo}</p>
            <p><strong>Longitud:</strong> ${p.longitud}</p>
            <p><strong>Descripción:</strong> ${p.descripcion}</p>
            <p><strong>Departamentos:</strong> ${p.departamentos}</p>
            <p><strong>Fuente:</strong> ${p.fuente}</p>
          </div>
        `);
      }
    }).addTo(mapa);

    document.getElementById('check-fallas').addEventListener('change', e => {
      if (e.target.checked) capaFallas.addTo(mapa);
      else mapa.removeLayer(capaFallas);
    });

    // Checkbox principal módulo sísmico
    document.getElementById('capa-sismos').addEventListener('change', e => {
      const checked = e.target.checked;
      document.getElementById('check-sismos').checked = checked;
      document.getElementById('check-zonas').checked = checked;
      document.getElementById('check-fallas').checked = checked;
      if (checked) {
        if (capaSismos) capaSismos.addTo(mapa);
        if (capaZonas) capaZonas.addTo(mapa);
        if (capaFallas) capaFallas.addTo(mapa);
      } else {
        if (capaSismos) mapa.removeLayer(capaSismos);
        if (capaZonas) mapa.removeLayer(capaZonas);
        if (capaFallas) mapa.removeLayer(capaFallas);
      }
      aplicarFiltrosEventos();
    });

  });


// ================================
// CARGA DE MOVIMIENTOS EN MASA
// ================================
let capaMovimientos = null;

fetch('data/movimientos_masa.geojson')
  .then(r => r.json())
  .then(datos => {

    capaMovimientos = L.geoJSON(datos, {

      pointToLayer: (feature, latlng) => {
        const color = colorMovimiento(feature.properties.tipo);
        const icono = L.divIcon({
          className: '',
          html: `<div class="icono-masa" style="background:${color}">◆</div>`,
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });
        return L.marker(latlng, { icon: icono });
      },

      onEachFeature: (feature, layer) => {
        const p = feature.properties;
        layer.bindPopup(`
          <div class="popup-contenido">
            <h3>${p.nombre}</h3>
            <p><strong>Fecha:</strong> ${p.fecha}</p>
            <p><strong>Tipo:</strong> ${p.tipo}</p>
            <p><strong>Ubicación:</strong> ${p.ubicacion}</p>
            <p><strong>Víctimas:</strong> ${p.victimas}</p>
            <p><strong>Causa:</strong> ${p.causa}</p>
          </div>
        `);
        layer.on('popupclose', () => cerrarDetalle());
        layer.on('click', () => abrirDetalleMasas(p, layer));
      }

    }).addTo(mapa);

    const capasMasas = {};
    capaMovimientos.eachLayer(layer => {
      capasMasas[layer.feature.properties.nombre] = layer;
    });

    const lista = document.getElementById('lista-masas');
    datos.features.forEach(feature => {
      const p = feature.properties;
      const color = colorMovimiento(p.tipo);
      const [lng, lat] = feature.geometry.coordinates;

      const li = document.createElement('li');
      li.innerHTML = `
        <span class="elemento-punto" style="background:${color}"></span>
        <span class="elemento-nombre">${p.nombre}</span>
      `;

      li.addEventListener('click', () => {
        document.querySelectorAll('#lista-masas li').forEach(el => el.classList.remove('activo'));
        li.classList.add('activo');
        mapa.flyTo([lat, lng], 10, { animate: true, duration: 1.5 });
        const layer = capasMasas[p.nombre];
        if (layer) {
          layer.openPopup();
          abrirDetalleMasas(p, layer);
        }
      });

      registrarResultadoBusqueda(p.nombre, p.ubicacion || '', 'Movimientos en masa', li, capasMasas[p.nombre], p.alerta || '');
      lista.appendChild(li);
    });

    document.getElementById('capa-masas').addEventListener('change', e => {
      if (e.target.checked) capaMovimientos.addTo(mapa);
      else mapa.removeLayer(capaMovimientos);
      aplicarFiltrosEventos();
    });

  });


// ================================
// CARGA DE INUNDACIONES
// ================================
let capaInundaciones = null;

fetch('data/inundaciones.geojson')
  .then(r => r.json())
  .then(datos => {

    capaInundaciones = L.geoJSON(datos, {

      pointToLayer: (feature, latlng) => {
        const icono = L.divIcon({
          className: '',
          html: `<div class="icono-inundacion">~</div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12]
        });
        return L.marker(latlng, { icon: icono });
      },

      onEachFeature: (feature, layer) => {
        const p = feature.properties;
        layer.bindPopup(`
          <div class="popup-contenido">
            <h3>${p.nombre}</h3>
            <p><strong>Tipo:</strong> ${p.tipo}</p>
            <p><strong>Ubicación:</strong> ${p.ubicacion}</p>
            <p><strong>Período:</strong> ${p.periodo}</p>
            <p><strong>Área afectada:</strong> ${p.area_afectada}</p>
            <p><strong>Causa:</strong> ${p.causa}</p>
          </div>
        `);
        layer.on('popupclose', () => cerrarDetalle());
        layer.on('click', () => abrirDetalleInundaciones(p, layer));
      }

    }).addTo(mapa);

    const capasInundaciones = {};
    capaInundaciones.eachLayer(layer => {
      capasInundaciones[layer.feature.properties.nombre] = layer;
    });

    const lista = document.getElementById('lista-inundaciones');
    datos.features.forEach(feature => {
      const p = feature.properties;
      const [lng, lat] = feature.geometry.coordinates;

      const li = document.createElement('li');
      li.innerHTML = `
        <span class="elemento-punto" style="background:#2f6f8f"></span>
        <span class="elemento-nombre">${p.nombre}</span>
      `;

      li.addEventListener('click', () => {
        document.querySelectorAll('#lista-inundaciones li').forEach(el => el.classList.remove('activo'));
        li.classList.add('activo');
        mapa.flyTo([lat, lng], 9, { animate: true, duration: 1.5 });
        const layer = capasInundaciones[p.nombre];
        if (layer) {
          layer.openPopup();
          abrirDetalleInundaciones(p, layer);
        }
      });

      registrarResultadoBusqueda(p.nombre, p.ubicacion || '', 'Inundaciones', li, capasInundaciones[p.nombre], p.alerta || '');
      lista.appendChild(li);
    });

    document.getElementById('capa-inundaciones').addEventListener('change', e => {
      if (e.target.checked) capaInundaciones.addTo(mapa);
      else mapa.removeLayer(capaInundaciones);
      aplicarFiltrosEventos();
    });

  });