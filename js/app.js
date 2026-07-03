// ================================
// MAPA BASE
// ================================
const mapa = L.map('mapa').setView([4.6, -74.1], 6);

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution: '&copy; OpenStreetMap &copy; CARTO'
}).addTo(mapa);


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


// ================================
// PANEL DE DETALLE
// ================================
const panelDetalle = document.getElementById('panel-detalle');
let capaActiva = null;
let circuloActivo = null;

function abrirDetalle(p, layer) {
  capaActiva = layer;

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

  // Teléfono del observatorio
  const telefono = p.telefono || '601 220 0200';
  document.getElementById('detalle-telefono-texto').textContent = '📞 ' + telefono;
  document.getElementById('detalle-telefono').href = 'tel:' + telefono.replace(/\s/g, '');
  // Badge de color según alerta
  const badge = document.getElementById('detalle-alerta');
  badge.style.borderColor = colorBadge(p.alerta);
  badge.style.color = colorBadge(p.alerta);

  // Fotografía
  const foto = document.getElementById('detalle-foto');
  foto.src = p.foto || '';
  foto.alt = `Fotografía de ${p.nombre}`;
  foto.onerror = () => { foto.style.display = 'none'; };
  foto.onload = () => { foto.style.display = 'block'; };

  // Enlace SGC
  document.getElementById('detalle-url').href = 'https://www.sgc.gov.co/volcanes';
// Dibujar círculo de influencia
  if (circuloActivo) {
    mapa.removeLayer(circuloActivo);
  }

  const [lng, lat] = layer.getLatLng
    ? [layer.getLatLng().lng, layer.getLatLng().lat]
    : [0, 0];

  circuloActivo = L.circle([lat, lng], {
    radius: p.radio_km * 1000,
    color: colorAlerta(p.alerta),
    fillColor: colorAlerta(p.alerta),
    fillOpacity: 0.08,
    weight: 1.5,
    dashArray: '6, 6'
  }).addTo(mapa);
  panelDetalle.classList.remove('oculto');
}

function cerrarDetalle() {
  if (circuloActivo) {
    mapa.removeLayer(circuloActivo);
    circuloActivo = null;
  }
  panelDetalle.classList.add('oculto');
  const capa = capaActiva;
  capaActiva = null;
  if (capa) {
    capa.closePopup();
  }
}

document.getElementById('detalle-cerrar').onclick = () => cerrarDetalle();


// ================================
// CARGA DE VOLCANES DESDE GEOJSON
// ================================
const capasVolcanes = {};
let datosVolcanes = null;

fetch('data/volcanes.geojson')
  .then(respuesta => respuesta.json())
  .then(datos => {
    datosVolcanes = datos;

    // Capa de Leaflet con todos los volcanes
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

        // Al cerrar el popup también cerramos el panel
        layer.on('popupclose', () => cerrarDetalle());

        // Clic en marcador abre panel de detalle
        layer.on('click', () => abrirDetalle(p, layer));
      }

    }).addTo(mapa);

    // Lista de volcanes en el panel lateral
    const lista = document.getElementById('lista-volcanes');

    datos.features.forEach(feature => {
      const p = feature.properties;
      const color = colorAlerta(p.alerta);
      const [lng, lat] = feature.geometry.coordinates;
// Contadores por nivel de alerta
    const contNaranja  = datos.features.filter(f => f.properties.alerta === 'Naranja').length;
    const contAmarillo = datos.features.filter(f => f.properties.alerta === 'Amarillo').length;
    const contVerde    = datos.features.filter(f => f.properties.alerta === 'Verde').length;

    document.getElementById('count-naranja').textContent  = contNaranja;
    document.getElementById('count-amarillo').textContent = contAmarillo;
    document.getElementById('count-verde').textContent    = contVerde;
      const li = document.createElement('li');
      li.dataset.alerta = p.alerta;
      li.innerHTML = `
        <span class="elemento-punto" style="background:${color}"></span>
        <span class="elemento-nombre">${p.nombre}</span>
        <span class="badge-alerta badge-${p.alerta.toLowerCase()}">${p.alerta}</span>
      `;

      li.addEventListener('click', () => {
        document.querySelectorAll('#lista-volcanes li').forEach(el => {
          el.classList.remove('activo');
        });
        li.classList.add('activo');

        mapa.flyTo([lat, lng], 10, {
          animate: true,
          duration: 1.5
        });
        capasVolcanes[p.nombre].openPopup();
        abrirDetalle(p, capasVolcanes[p.nombre]);
      });

      lista.appendChild(li);
    });

    // Filtro por nivel de alerta
    document.querySelectorAll('.filtro-btn').forEach(btn => {
      btn.addEventListener('click', () => {

        document.querySelectorAll('.filtro-btn').forEach(b => {
          b.classList.remove('activo-filtro');
        });
        btn.classList.add('activo-filtro');

        const filtro = btn.dataset.filtro;

        // Filtrar lista del panel
        document.querySelectorAll('#lista-volcanes li').forEach(li => {
          if (filtro === 'todos' || li.dataset.alerta === filtro) {
            li.style.display = 'flex';
          } else {
            li.style.display = 'none';
          }
        });

        // Filtrar marcadores del mapa
        datos.features.forEach(feature => {
          const p = feature.properties;
          const layer = capasVolcanes[p.nombre];
          if (filtro === 'todos' || p.alerta === filtro) {
            layer.addTo(mapa);
          } else {
            mapa.removeLayer(layer);
          }
        });

      });
    });

  });


// ================================
// PANEL LATERAL: EXPANDIR / CONTRAER
// ================================
const modulos = document.querySelectorAll('.modulo');

modulos.forEach(modulo => {
  const cabecera = modulo.querySelector('.modulo-cabecera');
  cabecera.addEventListener('click', () => {
    modulo.classList.toggle('abierto');
  });
});