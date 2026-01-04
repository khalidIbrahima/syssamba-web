'use client';

import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
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
      width: 40px;
      height: 40px;
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
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
  });
};

interface UnitLocation {
  id: string;
  unitNumber: string;
  propertyName: string;
  address: string;
  city?: string;
  latitude: number;
  longitude: number;
}

interface UnitsMapViewerProps {
  units: UnitLocation[];
  height?: string;
}

// Component to fit map bounds to show all markers
function MapBounds({ units }: { units: UnitLocation[] }) {
  const map = useMap();

  useEffect(() => {
    if (units.length === 0) return;

    if (units.length === 1) {
      // If only one unit, center on it with zoom 15
      map.setView([units[0].latitude, units[0].longitude], 15);
      return;
    }

    // Calculate bounds for multiple units
    const bounds = L.latLngBounds(
      units.map(unit => [unit.latitude, unit.longitude] as [number, number])
    );
    
    // Fit map to bounds with padding
    map.fitBounds(bounds, { padding: [50, 50] });
  }, [map, units]);

  return null;
}

export function UnitsMapViewer({ units, height = '500px' }: UnitsMapViewerProps) {
  // Filter units with valid coordinates
  const unitsWithCoords = useMemo(() => {
    return units.filter(
      unit => unit.latitude != null && unit.longitude != null &&
              !isNaN(unit.latitude) && !isNaN(unit.longitude)
    );
  }, [units]);

  // Default center (Dakar, Senegal) if no units
  const defaultCenter: [number, number] = [14.7167, -17.4677];
  const defaultZoom = 12;

  // Calculate center from units if available
  const center: [number, number] = useMemo(() => {
    if (unitsWithCoords.length === 0) return defaultCenter;
    
    if (unitsWithCoords.length === 1) {
      return [unitsWithCoords[0].latitude, unitsWithCoords[0].longitude];
    }

    // Calculate center point
    const avgLat = unitsWithCoords.reduce((sum, u) => sum + u.latitude, 0) / unitsWithCoords.length;
    const avgLng = unitsWithCoords.reduce((sum, u) => sum + u.longitude, 0) / unitsWithCoords.length;
    return [avgLat, avgLng];
  }, [unitsWithCoords]);

  if (unitsWithCoords.length === 0) {
    return (
      <div style={{ height }} className="rounded-lg border bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground mb-2">Aucun lot sélectionné avec coordonnées</p>
          <p className="text-sm text-muted-foreground">
            Sélectionnez des lots qui ont des coordonnées géographiques
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ height, width: '100%' }} className="rounded-lg overflow-hidden border">
      <MapContainer
        center={center}
        zoom={defaultZoom}
        scrollWheelZoom={true}
        style={{ height: '100%', width: '100%' }}
        key={unitsWithCoords.map(u => u.id).join(',')} // Force re-render when units change
      >
        <MapBounds units={unitsWithCoords} />
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {unitsWithCoords.map((unit) => (
          <Marker
            key={unit.id}
            position={[unit.latitude, unit.longitude]}
            icon={createBuildingIcon()}
          >
            <Popup>
              <div className="p-2">
                <p className="font-semibold text-sm">Lot {unit.unitNumber}</p>
                <p className="text-xs text-muted-foreground mt-1">{unit.propertyName}</p>
                <p className="text-xs text-muted-foreground mt-1">{unit.address}</p>
                {unit.city && <p className="text-xs text-muted-foreground">{unit.city}</p>}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}

