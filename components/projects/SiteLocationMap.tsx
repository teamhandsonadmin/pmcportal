'use client';

import { useEffect } from 'react';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Circle, useMap, useMapEvents } from 'react-leaflet';

// react-leaflet's default marker icon resolves its image paths relative to
// the bundler's asset URL scheme, which breaks under both webpack and
// Turbopack in Next.js (the icon silently fails to render, or 404s). The
// reliable fix, independent of whichever bundler is active: serve the icon
// PNGs as plain static files from /public and point the default icon at
// those absolute paths, instead of letting Leaflet resolve them itself.
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: '/leaflet/marker-icon-2x.png',
  iconUrl: '/leaflet/marker-icon.png',
  shadowUrl: '/leaflet/marker-shadow.png',
});

function ClickToPlace({ onChange }: { onChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onChange(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// At the modal's default zoom, a radius of even a few hundred meters can be
// larger than the whole visible viewport — the circle then has no edge on
// screen at all, just a uniform faint tint that reads as "no circle".
// Re-fitting the view to the circle's bounds whenever center/radius change
// keeps the geofence boundary actually visible instead of silently invisible.
function FitToRadius({ lat, lng, radiusMeters }: { lat: number; lng: number; radiusMeters: number | null | undefined }) {
  const map = useMap();
  useEffect(() => {
    if (radiusMeters == null || radiusMeters <= 0) return;
    // L.circle(...).getBounds() needs the layer attached to a map (it
    // projects through the map's current pixel origin) — toBounds() computes
    // the box directly from geographic math instead, so it works standalone.
    const bounds = L.latLng(lat, lng).toBounds(radiusMeters * 2);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, lat, lng, radiusMeters]);
  return null;
}

interface SiteLocationMapProps {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
  zoom?: number;
  // Radius in meters for the live geofence preview circle — null/undefined
  // means no radius set yet, in which case no circle is drawn at all.
  radiusMeters?: number | null;
}

export default function SiteLocationMap({ lat, lng, onChange, zoom = 16, radiusMeters }: SiteLocationMapProps) {
  return (
    <MapContainer
      center={[lat, lng]}
      zoom={zoom}
      className="h-full w-full rounded-lg"
      style={{ minHeight: 320 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker
        position={[lat, lng]}
        draggable
        eventHandlers={{
          dragend: (e) => {
            const pos = e.target.getLatLng();
            onChange(pos.lat, pos.lng);
          },
        }}
      />
      {radiusMeters != null && radiusMeters > 0 && (
        <>
          <Circle
            center={[lat, lng]}
            radius={radiusMeters}
            pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.15, weight: 2 }}
          />
          <FitToRadius lat={lat} lng={lng} radiusMeters={radiusMeters} />
        </>
      )}
      <ClickToPlace onChange={onChange} />
    </MapContainer>
  );
}
