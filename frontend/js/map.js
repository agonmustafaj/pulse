// OpenFreeMap tiles — free, no API key. https://openfreemap.org/
// Stock "dark" style is near-black land + water (looks empty). Orbit uses a
// custom readable dark style: Natural Earth land texture + navy oceans.
const STYLE_LIGHT = "https://tiles.openfreemap.org/styles/positron";

const STYLE_ORBIT_DARK = {
  version: 8,
  name: "pulse-orbit-dark",
  sources: {
    ne2_shaded: {
      type: "raster",
      tiles: ["https://tiles.openfreemap.org/natural_earth/ne2sr/{z}/{x}/{y}.png"],
      maxzoom: 6,
      tileSize: 256,
      attribution:
        '<a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>',
    },
    openmaptiles: {
      type: "vector",
      url: "https://tiles.openfreemap.org/planet",
    },
  },
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  layers: [
    {
      id: "background",
      type: "background",
      paint: { "background-color": "#0a1522" },
    },
    {
      id: "natural_earth",
      type: "raster",
      source: "ne2_shaded",
      maxzoom: 8,
      paint: {
        "raster-opacity": ["interpolate", ["linear"], ["zoom"], 0, 0.72, 6, 0.35, 8, 0.12],
        "raster-saturation": -0.55,
        "raster-contrast": 0.2,
        "raster-brightness-min": 0.02,
        "raster-brightness-max": 0.62,
      },
    },
    {
      id: "water",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "water",
      filter: ["match", ["geometry-type"], ["Polygon", "MultiPolygon"], true, false],
      paint: {
        "fill-color": "#071525",
        "fill-opacity": 0.94,
      },
    },
    {
      id: "landcover-ice",
      type: "fill",
      source: "openmaptiles",
      "source-layer": "landcover",
      filter: ["==", ["get", "class"], "ice"],
      paint: { "fill-color": "#3d5366", "fill-opacity": 0.55 },
    },
    {
      id: "boundary-country",
      type: "line",
      source: "openmaptiles",
      "source-layer": "boundary",
      filter: [
        "all",
        ["==", ["get", "admin_level"], 2],
        ["!", ["has", "claimed_by"]],
      ],
      paint: {
        "line-color": "#6b8aa6",
        "line-width": ["interpolate", ["linear"], ["zoom"], 0, 0.5, 4, 1.1, 8, 1.6],
        "line-opacity": 0.9,
      },
    },
    {
      id: "place-country",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "place",
      filter: [
        "all",
        ["==", ["get", "class"], "country"],
        ["<=", ["get", "rank"], 2],
      ],
      layout: {
        "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 1, 11, 4, 15],
        "text-transform": "uppercase",
        "text-letter-spacing": 0.06,
        "text-max-width": 8,
        "text-allow-overlap": false,
      },
      paint: {
        "text-color": "#d7e4f0",
        "text-halo-color": "rgba(7, 21, 37, 0.9)",
        "text-halo-width": 1.4,
      },
    },
    {
      id: "place-city",
      type: "symbol",
      source: "openmaptiles",
      "source-layer": "place",
      minzoom: 3,
      filter: ["==", ["get", "class"], "city"],
      layout: {
        "text-field": ["coalesce", ["get", "name:en"], ["get", "name"]],
        "text-font": ["Noto Sans Regular"],
        "text-size": ["interpolate", ["linear"], ["zoom"], 3, 10, 8, 14],
        "text-optional": true,
      },
      paint: {
        "text-color": "#a8bfd4",
        "text-halo-color": "rgba(7, 21, 37, 0.85)",
        "text-halo-width": 1.1,
      },
    },
  ],
};

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · <a href="https://openfreemap.org/" target="_blank" rel="noopener">OpenFreeMap</a>';

/** Default Orbit ISS view — Earth context around the station. */
export const ISS_MAP_ZOOM = 2;

export function createMap(container, { center = [0, 20], zoom = 1.6 } = {}) {
  const map = new maplibregl.Map({
    container,
    style: STYLE_ORBIT_DARK,
    center,
    zoom,
    attributionControl: { compact: true, customAttribution: OSM_ATTRIBUTION },
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-left");
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 100 }), "bottom-left");
  return map;
}

export function setDarkStyle(map, dark = true) {
  map.setStyle(dark ? STYLE_ORBIT_DARK : STYLE_LIGHT);
}

export function eventsToGeoJSON(events) {
  return {
    type: "FeatureCollection",
    features: (events || [])
      .filter((e) => e.latitude != null && e.longitude != null)
      .map((e) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [e.longitude, e.latitude] },
        properties: {
          id: e.id,
          title: e.title,
          category: e.category,
          source: e.source,
          severity: e.severity || "",
          type: (e.metadata && e.metadata.type) || e.category,
        },
      })),
  };
}

export function upsertEventLayers(map, geojson, { onClick } = {}) {
  const sourceId = "pulse-events";
  if (map.getSource(sourceId)) {
    map.getSource(sourceId).setData(geojson);
  } else {
    map.addSource(sourceId, {
      type: "geojson",
      data: geojson,
      cluster: true,
      clusterMaxZoom: 6,
      clusterRadius: 42,
    });

    map.addLayer({
      id: "clusters",
      type: "circle",
      source: sourceId,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#8b5cf6",
        "circle-radius": ["step", ["get", "point_count"], 16, 10, 20, 30, 26],
        "circle-opacity": 0.85,
        "circle-stroke-width": 1,
        "circle-stroke-color": "#c4b5fd",
      },
    });

    map.addLayer({
      id: "cluster-count",
      type: "symbol",
      source: sourceId,
      filter: ["has", "point_count"],
      layout: {
        "text-field": "{point_count_abbreviated}",
        "text-size": 11,
      },
      paint: { "text-color": "#f1f4f8" },
    });

    map.addLayer({
      id: "unclustered",
      type: "circle",
      source: sourceId,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": [
          "match",
          ["get", "type"],
          "earthquake",
          "#ef4444",
          "natural_event",
          "#f59e0b",
          "space",
          "#38bdf8",
          "#8b5cf6",
        ],
        "circle-radius": 6,
        "circle-stroke-width": 1.5,
        "circle-stroke-color": "#0b1220",
        "circle-opacity": 0.95,
      },
    });

    map.on("click", "clusters", async (e) => {
      const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
      const clusterId = features[0].properties.cluster_id;
      const zoom = await map.getSource(sourceId).getClusterExpansionZoom(clusterId);
      map.easeTo({ center: features[0].geometry.coordinates, zoom });
    });

    map.on("click", "unclustered", (e) => {
      const f = e.features[0];
      if (onClick) onClick(f.properties, f.geometry.coordinates);
    });

    map.on("mouseenter", "clusters", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "clusters", () => (map.getCanvas().style.cursor = ""));
    map.on("mouseenter", "unclustered", () => (map.getCanvas().style.cursor = "pointer"));
    map.on("mouseleave", "unclustered", () => (map.getCanvas().style.cursor = ""));
  }
}

export function upsertIssMarker(map, iss, markerRef) {
  if (!map || !iss || iss.latitude == null || iss.longitude == null) return markerRef;

  if (markerRef) {
    markerRef.setLngLat([iss.longitude, iss.latitude]);
    return markerRef;
  }

  const el = document.createElement("div");
  el.className = "iss-marker";
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", "ISS position");
  el.innerHTML = `<span class="iss-marker-core"></span><span class="iss-marker-label">ISS</span>`;

  return new maplibregl.Marker({ element: el, anchor: "center" })
    .setLngLat([iss.longitude, iss.latitude])
    .addTo(map);
}

export function flyTo(map, lon, lat, zoom = ISS_MAP_ZOOM) {
  if (!map || lon == null || lat == null) return;
  map.easeTo({ center: [lon, lat], zoom, duration: 900 });
}
