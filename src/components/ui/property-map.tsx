'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Create custom building icon
const createBuildingIcon = () => {
  // SVG icon for building
  const buildingSvg = `
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 21H21" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M5 21V7L13 2V21" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M19 21V11H5" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M9 9V9.01" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M9 12V12.01" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M9 15V15.01" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M9 18V18.01" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  `;

  // Create a div element for the icon
  const iconHtml = `
    <div style="
      background-color: #2563eb;
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    ">
      ${buildingSvg}
    </div>
  `;

  return L.divIcon({
    className: 'custom-building-marker',
    html: iconHtml,
    iconSize: [48, 48],
    iconAnchor: [24, 48],
    popupAnchor: [0, -48],
  });
};

interface PropertyMapProps {
  latitude: number;
  longitude: number;
  propertyName: string;
  address?: string;
  city?: string;
  zoom?: number;
  height?: string;
}

// Component to update map view when coordinates change
function MapUpdater({ latitude, longitude, zoom }: { latitude: number; longitude: number; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView([latitude, longitude], zoom);
  }, [map, latitude, longitude, zoom]);

  return null;
}

export function PropertyMap({
  latitude,
  longitude,
  propertyName,
  address,
  city,
  zoom = 15, // Zoom adapté pour voir le bien et ses environs
  height = '400px',
}: PropertyMapProps) {
  return (
    <div style={{ height, width: '100%' }} className="rounded-lg overflow-hidden border">
      <MapContainer
        center={[latitude, longitude]}
        zoom={zoom}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
        key={`${latitude}-${longitude}`} // Force re-render when coordinates change
      >
        <MapUpdater latitude={latitude} longitude={longitude} zoom={zoom} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[latitude, longitude]} icon={createBuildingIcon()}>
          <Popup>
            <div className="p-2">
              <p className="font-semibold text-sm">{propertyName}</p>
              {address && <p className="text-xs text-muted-foreground">{address}</p>}
              {city && <p className="text-xs text-muted-foreground">{city}</p>}
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
}

