# 🌋 ORION
### Observatorio Colombiano de Riesgos y Amenazas Naturales

> *"Comprendiendo los riesgos del territorio colombiano"*

ORION es una plataforma web geográfica educativa e informativa para la visualización y consulta de amenazas naturales en Colombia, desarrollada con tecnologías SIG Web de código abierto.

---

##  Vista general

![ORION](https://raw.githubusercontent.com/juliancruz27/orion/main/preview.png)

ORION integra en un solo visor interactivo información sobre las principales amenazas naturales del territorio colombiano, permitiendo a estudiantes, investigadores y ciudadanos comprender de manera integrada los riesgos presentes en el país.

##  Módulos temáticos

| Módulo | Descripción | Fuente |
|--------|-------------|--------|
|  **Volcánico** | 12 volcanes activos con nivel de alerta, radio de influencia, historia eruptiva y observatorio de monitoreo | SGC |
|  **Sísmico** | Sismos históricos, zonas de amenaza sísmica y fallas geológicas principales | SGC |
|  **Movimientos en masa** | Eventos históricos de deslizamientos y avenidas torrenciales | UNGRD |
|  **Inundaciones** | Cuencas principales y áreas susceptibles a inundación | IDEAM |


##  Tecnologías utilizadas

- **HTML5 / CSS3 / JavaScript** — sin frameworks ni dependencias pesadas
- **[Leaflet.js](https://leafletjs.com/)** — librería de mapas interactivos
- **GeoJSON** — formato estándar para datos geoespaciales
- **OpenStreetMap / CartoDB** — capas base del mapa

---

##  Estructura del proyecto

```
orion/
├── index.html          # Página principal
├── css/
│   └── style.css       # Estilos de la plataforma
├── js/
│   └── app.js          # Lógica del visor cartográfico
└── data/
    ├── volcanes.geojson
    ├── sismos.geojson
    ├── zonas_sismicas.geojson
    ├── fallas.geojson
    ├── movimientos_masa.geojson
    └── inundaciones.geojson
```

##  Cómo usar

1. Clona el repositorio:
```bash
git clone https://github.com/juliancruz27/orion.git
```

2. Abre `index.html` en tu navegador — no requiere servidor ni instalación adicional.

> También puedes usar la extensión **Live Server** de VS Code para desarrollo local.


 ##  Fuentes de datos

- **[Servicio Geológico Colombiano (SGC)](https://www.sgc.gov.co)** — Volcanes, sismos y fallas geológicas
- **[UNGRD](https://portal.gestiondelriesgo.gov.co)** — Movimientos en masa y gestión del riesgo
- **[IDEAM](https://www.ideam.gov.co)** — Hidrología e inundaciones

---

##  Contexto académico

Proyecto desarrollado como parte de la formación en **Geografía** en la **Universidad del Cauca**. ORION está concebido como un módulo del sistema **ORBIS** — Plataforma Nacional de Inteligencia Territorial, actualmente en desarrollo.

---

 ##  Autor

**Julian Cruz** — Estudiante de Geografía, Universidad del Cauca  
GitHub: [@juliancruz27](https://github.com/juliancruz27)

---

*Plataforma educativa e informativa. No constituye un sistema de monitoreo en tiempo real ni una fuente oficial de alertas.*
