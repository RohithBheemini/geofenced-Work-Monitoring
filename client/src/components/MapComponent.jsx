/**
 * @file MapComponent.jsx
 * @description High-performance interactive Leaflet Map with custom worker photo pins,
 * geofence boundaries, and breadcrumb trails.
 */

import { useEffect, useRef } from 'react';
import L from 'leaflet';

const STATUS_STYLES = {
  EMERGENCY_SOS: { statusClass: 'status-sos', dotColor: 'bg-red-600 animate-ping', label: 'SOS DISTRESS' },
  OVERTIME_TIER_2: { statusClass: 'status-overtime-2', dotColor: 'bg-red-500', label: 'Tier 2 OT (2.0x)' },
  OVERTIME_TIER_1: { statusClass: 'status-overtime-1', dotColor: 'bg-amber-500', label: 'Tier 1 OT (1.5x)' },
  OUT_OF_BOUNDS_WARNING: { statusClass: 'status-out-bounds', dotColor: 'bg-orange-500', label: '' },
  APPROVED_REMOTE: { statusClass: 'status-remote', dotColor: 'bg-blue-500', label: 'Remote' },
  IN_TRANSIT: { statusClass: 'status-remote', dotColor: 'bg-cyan-500', label: 'In Transit' },
};

export function MapComponent({
  workers = [],
  geofences = [],
  selectedWorkerId = null,
  onSelectWorker = () => {},
  focusCoordinate = null,
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const geofenceLayersRef = useRef({});
  const breadcrumbLayerRef = useRef(null);

  // 1. Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [37.7749, -122.4194],
      zoom: 13,
      zoomControl: false,
    });

    L.control.zoom({ position: 'bottomright' }).addTo(map);

    // CartoDB Dark Matter tiles
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
      maxZoom: 19,
      subdomains: 'abcd',
    }).addTo(map);

    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Render Geofences
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    // Clear old geofence layers
    Object.values(geofenceLayersRef.current).forEach((layer) => layer.remove());
    geofenceLayersRef.current = {};

    geofences.forEach((zone) => {
      const color = zone.color || '#3b82f6';
      let layer;

      if (zone.type === 'CIRCULAR' && zone.center) {
        layer = L.circle([zone.center.latitude, zone.center.longitude], {
          radius: zone.radiusMeters,
          color: color,
          weight: 2,
          dashArray: '6, 6',
          fillColor: color,
          fillOpacity: 0.12,
        }).addTo(map);

        layer.bindTooltip(
          `<div class="text-xs font-semibold px-1 py-0.5">${zone.name}<br/><span class="opacity-75 font-normal text-[10px]">Radius: ${zone.radiusMeters}m</span></div>`,
          { permanent: false, direction: 'top', className: 'bg-slate-900 border border-slate-700 text-slate-100 rounded shadow' }
        );
      } else if (zone.type === 'POLYGON' && zone.vertices && zone.vertices.length >= 3) {
        const latLngs = zone.vertices.map((v) => [v.latitude, v.longitude]);
        layer = L.polygon(latLngs, {
          color: color,
          weight: 2,
          dashArray: '6, 6',
          fillColor: color,
          fillOpacity: 0.12,
        }).addTo(map);

        layer.bindTooltip(
          `<div class="text-xs font-semibold px-1 py-0.5">${zone.name}<br/><span class="opacity-75 font-normal text-[10px]">Polygonal Yard</span></div>`,
          { permanent: false, direction: 'top', className: 'bg-slate-900 border border-slate-700 text-slate-100 rounded shadow' }
        );
      }

      if (layer) {
        geofenceLayersRef.current[zone.id] = layer;
      }
    });
  }, [geofences]);

  // 3. Render Worker Location Pins with Photos
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    const currentWorkerIds = new Set();

    workers.forEach((worker) => {
      // If coordinates are null (e.g. Medical Leave Privacy Firewall), skip map pin
      if (!worker.currentLocation || worker.currentLocation.latitude == null || worker.currentLocation.longitude == null) {
        if (markersRef.current[worker.id]) {
          markersRef.current[worker.id].remove();
          delete markersRef.current[worker.id];
        }
        return;
      }

      currentWorkerIds.add(worker.id);
      const { latitude, longitude } = worker.currentLocation;

      const styleConfig = STATUS_STYLES[worker.status] || {
        statusClass: 'status-checked-in',
        dotColor: 'bg-emerald-500',
        label: 'On-Site',
      };
      const statusClass = styleConfig.statusClass;
      const dotColor = styleConfig.dotColor;
      const labelTag = worker.status === 'OUT_OF_BOUNDS_WARNING'
        ? `Grace: ${worker.shift?.egressGraceRemainingSeconds || 300}s`
        : styleConfig.label;

      const isSelected = selectedWorkerId === worker.id;

      // Custom HTML Pin Icon
      const customHtml = `
        <div class="worker-pin-container ${isSelected ? 'scale-110 z-50' : ''}">
          <div class="worker-avatar-wrapper ${isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-900' : ''}">
            <img src="${worker.photoUrl}" alt="${worker.name}" class="worker-avatar-img" />
            <div class="pin-status-ring ${statusClass}"></div>
            <div class="pin-badge-indicator ${dotColor}"></div>
          </div>
          <div class="pin-needle"></div>
          <div class="pin-label-pill flex items-center gap-1">
            <span class="w-1.5 h-1.5 rounded-full ${dotColor}"></span>
            <span>${worker.name.split(' ')[0]}</span>
            <span class="text-[9px] opacity-75 font-mono">(${labelTag})</span>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'worker-custom-div-icon',
        html: customHtml,
        iconSize: [60, 75],
        iconAnchor: [30, 75],
      });

      if (markersRef.current[worker.id]) {
        // Smoothly animate/move marker
        markersRef.current[worker.id].setLatLng([latitude, longitude]);
        markersRef.current[worker.id].setIcon(customIcon);
      } else {
        const marker = L.marker([latitude, longitude], { icon: customIcon }).addTo(map);
        marker.on('click', () => {
          onSelectWorker(worker.id);
        });
        markersRef.current[worker.id] = marker;
      }
    });

    // Remove markers for departed workers
    Object.keys(markersRef.current).forEach((id) => {
      if (!currentWorkerIds.has(id)) {
        markersRef.current[id].remove();
        delete markersRef.current[id];
      }
    });
  }, [workers, selectedWorkerId, onSelectWorker]);

  // 4. Render Breadcrumbs for Selected Worker
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (breadcrumbLayerRef.current) {
      breadcrumbLayerRef.current.remove();
      breadcrumbLayerRef.current = null;
    }

    if (!selectedWorkerId) return;

    const worker = workers.find((w) => w.id === selectedWorkerId);
    if (!worker || !worker.breadcrumbs || worker.breadcrumbs.length < 2) return;

    const latLngs = worker.breadcrumbs.map((b) => [b.latitude, b.longitude]);
    const polyline = L.polyline(latLngs, {
      color: '#38bdf8',
      weight: 3,
      dashArray: '4, 8',
      opacity: 0.75,
    }).addTo(map);

    breadcrumbLayerRef.current = polyline;
  }, [selectedWorkerId, workers]);

  // 5. Handle Programmatic Map Pan / Focus
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !focusCoordinate) return;

    map.flyTo([focusCoordinate.latitude, focusCoordinate.longitude], 15, {
      duration: 1.2,
      easeLinearity: 0.25,
    });
  }, [focusCoordinate]);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full z-0" />

      {/* Floating Map Legend */}
      <div className="absolute bottom-6 left-6 z-10 bg-slate-900/90 backdrop-blur-md border border-slate-800 rounded-xl p-3 shadow-2xl text-xs space-y-1.5 pointer-events-auto">
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
          Operational Pin Legend
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/50"></span>
          <span className="text-slate-300">On-Site Verified (Active)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm shadow-amber-500/50 animate-pulse"></span>
          <span className="text-slate-300">Overtime Tier 1 (1.5x)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm shadow-red-500/50 animate-pulse"></span>
          <span className="text-slate-300">Overtime Tier 2 (2.0x)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-sm shadow-orange-500/50"></span>
          <span className="text-slate-300">Out of Bounds (Grace Period)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 shadow-sm shadow-blue-500/50"></span>
          <span className="text-slate-300">Approved Remote Telecommute</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-slate-500"></span>
          <span className="text-slate-400">Medical Leave (Location Masked)</span>
        </div>
      </div>
    </div>
  );
}
