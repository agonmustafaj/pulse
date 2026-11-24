// OpenFreeMap — free vector styles, no API key required.
// https://openfreemap.org/
const STYLE_DARK = "https://tiles.openfreemap.org/styles/dark";
const STYLE_LIGHT = "https://tiles.openfreemap.org/styles/positron";

const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export function createMap(container, { center = [10, 20], zoom = 1.4 } = {}) {
  const map = new maplibregl.Map({
    container,
    style: STYLE_DARK,
    center,
    zoom,
    attributionControl: { compact: true, customAttribution: OSM_ATTRIBUTION },
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-left");
  map.addControl(new maplibregl.ScaleControl({ maxWidth: 100 }), "bottom-left");
  return map;
}

export function setDarkStyle(map, dark = true) {
  map.setStyle(dark ? STYLE_DARK : STYLE_LIGHT);
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
  if (!iss || iss.latitude == null) return markerRef;
  const el = document.createElement("div");
  el.className = "iss-marker";
  el.style.cssText =
    "width:14px;height:14px;border-radius:50%;background:#38bdf8;box-shadow:0 0 12px #38bdf8;border:2px solid #0b1220;";
  if (markerRef) markerRef.remove();
  const marker = new maplibregl.Marker({ element: el }).setLngLat([iss.longitude, iss.latitude]).addTo(map);
  return marker;
}

export function flyTo(map, lon, lat, zoom = 4) {
  if (lon == null || lat == null) return;
  map.easeTo({ center: [lon, lat], zoom, duration: 900 });
}
