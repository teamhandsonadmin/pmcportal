'use client';

import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';

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

interface SiteLocationMapProps {
  lat: number;
  lng: number;
  onChange: (lat: number, lng: number) => void;
  zoom?: number;
}

export default function SiteLocationMap({ lat, lng, onChange, zoom = 16 }: SiteLocationMapProps) {
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
      <ClickToPlace onChange={onChange} />
    </MapContainer>
  );
}
