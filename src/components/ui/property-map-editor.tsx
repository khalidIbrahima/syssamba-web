'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Create custom building icon
const createBuildingIcon = () => {
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
      cursor: pointer;
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

interface PropertyMapEditorProps {
  latitude?: number | null;
  longitude?: number | null;
  onLocationChange: (lat: number, lng: number) => void;
  height?: string;
}

// Component to handle map clicks
function MapClickHandler({ onLocationChange }: { onLocationChange: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      onLocationChange(lat, lng);
    },
  });
  return null;
}

// Component to update map view when coordinates change
function MapUpdater({ latitude, longitude, zoom }: { latitude: number; longitude: number; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.setView([latitude, longitude], zoom);
  }, [map, latitude, longitude, zoom]);

  return null;
}

export function PropertyMapEditor({
  latitude,
  longitude,
  onLocationChange,
  height = '400px',
}: PropertyMapEditorProps) {
  // Default center (Dakar, Senegal)
  const defaultCenter: [number, number] = [14.7167, -17.4677];
  const defaultZoom = 13;

  // Use provided coordinates or default
  const center: [number, number] = latitude && longitude 
    ? [latitude, longitude] 
    : defaultCenter;
  const zoom = latitude && longitude ? 15 : defaultZoom;

  const [markerPosition, setMarkerPosition] = useState<[number, number] | null>(
    latitude && longitude ? [latitude, longitude] : null
  );

  // Update marker when coordinates change from outside
  useEffect(() => {
    if (latitude && longitude) {
      setMarkerPosition([latitude, longitude]);
    }
  }, [latitude, longitude]);

  const handleMapClick = (lat: number, lng: number) => {
    setMarkerPosition([lat, lng]);
    onLocationChange(lat, lng);
  };

  return (
    <div style={{ height, width: '100%' }} className="rounded-lg overflow-hidden border">
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
        key={`${latitude}-${longitude}`}
      >
        <MapClickHandler onLocationChange={handleMapClick} />
        {markerPosition && <MapUpdater latitude={markerPosition[0]} longitude={markerPosition[1]} zoom={15} />}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {markerPosition && (
          <Marker position={markerPosition} icon={createBuildingIcon()}>
          </Marker>
        )}
      </MapContainer>
      <div className="mt-2 text-sm text-muted-foreground text-center">
        {markerPosition ? (
          <p>
            Position: {markerPosition[0].toFixed(6)}, {markerPosition[1].toFixed(6)}
          </p>
        ) : (
          <p className="text-muted-foreground">
            Cliquez sur la carte pour définir l'emplacement du bien
          </p>
        )}
      </div>
    </div>
  );
}

