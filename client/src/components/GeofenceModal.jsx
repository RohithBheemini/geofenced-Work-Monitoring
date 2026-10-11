/**
 * @file GeofenceModal.jsx
 * @description Modal for provisioning new circular geofences.
 */

import React, { useState } from 'react';
import { X, Plus, MapPin, Building, Shield } from 'lucide-react';

export function GeofenceModal({
  isOpen = false,
  onClose = () => {},
  onCreateZone = () => {},
}) {
  const [name, setName] = useState('');
  const [lat, setLat] = useState('37.7790');
  const [lng, setLng] = useState('-122.4100');
  const [radius, setRadius] = useState('250');
  const [color, setColor] = useState('#10B981');

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    onCreateZone({
      name: name.trim(),
      type: 'CIRCULAR',
      center: {
        latitude: parseFloat(lat),
        longitude: parseFloat(lng),
      },
      radiusMeters: parseInt(radius, 10),
      bufferMeters: Math.max(20, Math.round(parseInt(radius, 10) * 0.15)),
      color,
    });

    setName('');
    onClose();
  };

  const colors = [
    { label: 'Emerald', hex: '#10B981' },
    { label: 'Amber', hex: '#F59E0B' },
    { label: 'Purple', hex: '#8B5CF6' },
    { label: 'Cyan', hex: '#06B6D4' },
    { label: 'Blue', hex: '#3B82F6' },
    { label: 'Rose', hex: '#F43F5E' },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl p-5 text-slate-100 animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-emerald-400" />
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Provision New Geofence Zone
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5 text-xs">
          <div>
            <label className="block text-slate-400 font-semibold mb-1">
              Geofence Zone Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. South Bay Distribution Center"
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                Center Latitude
              </label>
              <input
                type="number"
                step="0.0001"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-slate-400 font-semibold mb-1">
                Center Longitude
              </label>
              <input
                type="number"
                step="0.0001"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1">
              Radius (Meters)
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="50"
                max="1000"
                step="25"
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                className="flex-1 accent-emerald-500"
              />
              <span className="font-mono font-bold text-emerald-400 text-sm w-16 text-right">
                {radius}m
              </span>
            </div>
            <span className="text-[10px] text-slate-500 block mt-1">
              Hysteresis buffer will be automatically configured at max(20m, 15%).
            </span>
          </div>

          <div>
            <label className="block text-slate-400 font-semibold mb-1.5">
              Perimeter Color
            </label>
            <div className="flex items-center gap-2">
              {colors.map((c) => (
                <button
                  type="button"
                  key={c.hex}
                  onClick={() => setColor(c.hex)}
                  className={`w-7 h-7 rounded-full border-2 transition ${
                    color === c.hex ? 'border-white scale-110 shadow-lg' : 'border-transparent opacity-70 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: c.hex }}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-3 rounded-xl bg-slate-800 text-slate-300 hover:bg-slate-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1.5 transition shadow-lg shadow-emerald-950/40"
            >
              <Plus className="w-4 h-4" />
              <span>Create Geofence</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
