'use client'

import { useState } from 'react'
import { MapPin, ExternalLink, Link as LinkIcon } from 'lucide-react'

interface LocationPickerProps {
  initialLat?: number | null
  initialLng?: number | null
  onLocationChange: (lat: number, lng: number) => void
}

export default function LocationPicker({ initialLat, initialLng, onLocationChange }: LocationPickerProps) {
  const [lat, setLat] = useState(initialLat?.toString() || '')
  const [lng, setLng] = useState(initialLng?.toString() || '')
  const [linkInput, setLinkInput] = useState('')
  const [extractStatus, setExtractStatus] = useState<'idle' | 'success' | 'error'>('idle')

  function extractFromLink(url: string) {
    const trimmed = url.trim()

    // Support: google.com/maps/.../@lat,lng,...
    let match = trimmed.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/)
    if (match) {
      setLat(match[1])
      setLng(match[2])
      onLocationChange(parseFloat(match[1]), parseFloat(match[2]))
      setExtractStatus('success')
      return
    }

    // Support: maps.app.goo.gl or share.google (open in new tab)
    if (trimmed.includes('goo.gl') || trimmed.includes('share.google')) {
      window.open(trimmed, '_blank')
      setExtractStatus('error')
      return
    }

    setExtractStatus('error')
  }

  function handleLatChange(value: string) {
    setLat(value)
    if (value && lng) onLocationChange(parseFloat(value), parseFloat(lng))
  }

  function handleLngChange(value: string) {
    setLng(value)
    if (lat && value) onLocationChange(parseFloat(lat), parseFloat(value))
  }

  function openGmaps() {
    if (lat && lng) {
      window.open(`https://www.google.com/maps?q=${lat},${lng}`, '_blank')
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-medium text-gray-500 mb-1 flex items-center gap-1">
          <LinkIcon className="h-3 w-3" /> Paste Link Google Maps
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="https://www.google.com/maps/place/..."
            value={linkInput}
            onChange={e => { setLinkInput(e.target.value); setExtractStatus('idle') }}
            className="flex-1 h-9 rounded-lg border border-gray-200 bg-white px-3 py-1 text-sm placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400"
          />
          <button type="button" onClick={() => extractFromLink(linkInput)}
            className="h-9 px-3 rounded-lg border border-gray-200 bg-white text-sm hover:bg-gray-50 flex items-center gap-1 shrink-0">
            <LinkIcon className="h-4 w-4" /> Ambil
          </button>
        </div>
        {extractStatus === 'success' && <p className="text-xs text-emerald-600 mt-1">✅ Koordinat berhasil diekstrak</p>}
        {extractStatus === 'error' && (
          <p className="text-xs text-red-500 mt-1">
            ❌ Format link tidak dikenal. Pastikan link mengandung koordinat (@lat,lng).
            {linkInput.includes('goo.gl') || linkInput.includes('share.google')
              ? ' Link ini dibuka di tab baru — copy URL hasil redirect-nya.'
              : ''}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Latitude</label>
          <input type="number" step="any" placeholder="-6.320658"
            value={lat}
            onChange={e => handleLatChange(e.target.value)}
            className="w-full h-9 rounded-lg border border-gray-200 bg-white px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-gray-500">Longitude</label>
          <input type="number" step="any" placeholder="107.0192606"
            value={lng}
            onChange={e => handleLngChange(e.target.value)}
            className="w-full h-9 rounded-lg border border-gray-200 bg-white px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-400" />
        </div>
      </div>

      <div className="flex gap-2">
        <button type="button" onClick={() => window.open('https://www.google.com/maps', '_blank')}
          className="text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1.5 rounded-lg hover:bg-emerald-100 flex items-center gap-1">
          <MapPin className="h-3 w-3" /> Buka Google Maps
        </button>
        {lat && lng && (
          <button type="button" onClick={openGmaps}
            className="text-xs text-blue-600 bg-blue-50 px-2.5 py-1.5 rounded-lg hover:bg-blue-100 flex items-center gap-1">
            <ExternalLink className="h-3 w-3" /> Lihat di Maps
          </button>
        )}
      </div>

      {lat && lng && (
        <p className="text-xs text-gray-400">
          Koordinat: {parseFloat(lat).toFixed(6)}, {parseFloat(lng).toFixed(6)}
        </p>
      )}
    </div>
  )
}
