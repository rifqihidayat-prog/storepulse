'use client'

import { useEffect, useState, useRef, Suspense, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { NavBar } from '@/components/nav-bar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { CHECKLIST_ITEMS, SCORE_WEIGHTS, DENOMINATIONS } from '@/types'
import {
  ArrowLeft, ArrowRight, Check, Camera, DollarSign, FileText, ClipboardList,
  Package, Search, MessageCircle, MessageSquare, Truck, Star, Send, Save,
  MapPin, Smartphone, Monitor, AlertTriangle, X, ShoppingBag
} from 'lucide-react'
import type { Store, ScoreBreakdown, CashDenomination } from '@/types'

const STEPS = [
  { id: 1, label: 'Absen & Toko', icon: Camera },
  { id: 2, label: 'Uang Kasir', icon: DollarSign },
  { id: 3, label: 'Setoran', icon: FileText },
  { id: 4, label: 'Ceklist Toko', icon: ClipboardList },
  { id: 5, label: 'Chat Market', icon: MessageCircle },
  { id: 6, label: 'Stok Online', icon: Truck },
  { id: 7, label: 'Cek Stok', icon: Package },
  { id: 8, label: 'Supervisi', icon: Search },
  { id: 9, label: 'Briefing', icon: MessageSquare },
  { id: 10, label: 'Review', icon: Star },
] as const

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function getDeviceType() {
  if (typeof navigator === 'undefined') return 'desktop'
  const ua = navigator.userAgent
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)
  const isTouchDevice = navigator.maxTouchPoints > 0 && window.innerWidth <= 768
  return isMobile || isTouchDevice ? 'mobile' : 'desktop'
}

function calculateScore(data: FormData): ScoreBreakdown {
  const cashScore = (() => {
    const modal = parseInt(data.initialCapital) || 0
    const petty = parseInt(data.pettyCashBalance) || 0
    const expected = modal + petty
    const actual = data.denominations.reduce((sum, d) => sum + d.value * d.quantity, 0)
    const pendingAmt = data.hasPendingClaim ? (parseInt(data.pendingClaimAmount) || 0) : 0
    return expected > 0 && (actual + pendingAmt) === expected ? 10 : 0
  })()

  const depositScore = data.hasPending === false ? 10 : 0

  const baikCount = data.checklist.filter(c => c.status === 'baik').length
  const storeScore = (baikCount / Math.max(data.checklist.length, 1)) * SCORE_WEIGHTS.STORE_CONDITION

  const matchCount = data.stockChecks.filter(s => s.isMatch).length
  const stockScore = (matchCount / Math.max(data.stockChecks.length, 1)) * SCORE_WEIGHTS.STOCK_ACCURACY

  const burukItems = data.checklist.filter(c => c.status === 'buruk')
  const allDeadlinesSet = burukItems.every(item =>
    data.supervisions.some(s => s.item_name === item.item_name && s.area === item.area && s.deadline_date)
  )
  const supervisiScore = burukItems.length === 0 ? 15 : allDeadlinesSet ? 10 : 0

  const tiktokScore = data.tiktokPercentage !== null
    ? data.tiktokPercentage >= 80 ? 5 : data.tiktokPercentage >= 50 ? 2.5 : 0
    : 0

  const shopeeScore = data.shopeePercentage !== null
    ? data.shopeePercentage >= 80 ? 5 : data.shopeePercentage >= 50 ? 2.5 : 0
    : 0

  const sepStatusScore = data.stockSeparation === 'sehat' ? 6 : data.stockSeparation === 'perhatian' ? 3 : 0
  const sepImbalanceScore = (data.stockSepImbalance !== null && data.stockSepImbalance < 10) ? 5 : 0
  const sepOversoldScore = (data.stockSepOversold !== null && data.stockSepOversold < 5) ? 4 : 0
  const sepScore = sepStatusScore + sepImbalanceScore + sepOversoldScore

  const total = Math.round((cashScore + depositScore + storeScore + stockScore + supervisiScore + tiktokScore + shopeeScore + sepScore) * 10) / 10

  return {
    cash_check: cashScore, deposit: depositScore,
    store_condition: Math.round(storeScore * 10) / 10,
    stock_accuracy: Math.round(stockScore * 10) / 10,
    supervision: supervisiScore,
    chat_tiktok: tiktokScore, chat_shopee: shopeeScore,
    stock_separation: sepScore, total,
  }
}

interface ChecklistItem { item_name: string; status: 'baik' | 'kurang' | 'buruk'; note: string; photo: File | string | null; area: string }
interface StockItem { item_name: string; system_stock: number; physical_stock: number; sold_stock: number; isMatch: boolean }
interface SupervisionItem { item_name: string; area: string; deadline_date: string }
interface DenomInput { value: number; quantity: number; type: 'coin' | 'bill' }

interface FormData {
  storeId: string; visitDate: string
  selfiePhoto: File | string | null; gpsLatitude: number | null; gpsLongitude: number | null; gpsAccuracy: number | null
  locationVerified: boolean; locationDistance: number | null; deviceType: string
  initialCapital: string; pettyCashBalance: string
  denominations: DenomInput[]
  hasPendingClaim: boolean | null
  pendingClaimAmount: string
  cashNote: string
  hasPending: boolean | null; depositPhoto: File | string | null; depositNote: string
  checklist: ChecklistItem[]
  stockChecks: StockItem[]
  supervisions: SupervisionItem[]
  briefingPhoto: File | string | null; briefingNote: string
  tiktokPercentage: number | null; tiktokPhoto: File | string | null
  shopeePercentage: number | null; shopeePhoto: File | string | null
  chatNote: string
  stockSeparation: 'sehat' | 'perhatian' | 'kritis' | null
  stockSepImbalance: number | null
  stockSepOversold: number | null
  stockSepPhotoItems: File | string | null
  stockSepPhotoDashboard: File | string | null
  stockSepNote: string
  reviewNotes: string
}

function emptyForm(): FormData {
  return {
    storeId: '', visitDate: new Date().toISOString().split('T')[0],
    selfiePhoto: null, gpsLatitude: null, gpsLongitude: null, gpsAccuracy: null,
    locationVerified: false, locationDistance: null, deviceType: 'desktop',
    initialCapital: '', pettyCashBalance: '',
    denominations: DENOMINATIONS.map(d => ({ value: d.value, quantity: 0, type: d.type as 'coin' | 'bill' })),
    hasPendingClaim: null,
    pendingClaimAmount: '',
    cashNote: '',
    hasPending: null, depositPhoto: null, depositNote: '',
    checklist: CHECKLIST_ITEMS.map(item => ({ item_name: item.name, status: 'baik' as const, note: '', photo: null, area: item.area })),
    stockChecks: Array.from({ length: 5 }, () => ({ item_name: '', system_stock: 0, physical_stock: 0, sold_stock: 0, isMatch: false })),
    supervisions: [],
    briefingPhoto: null, briefingNote: '',
    tiktokPercentage: null, tiktokPhoto: null,
    shopeePercentage: null, shopeePhoto: null,
    stockSeparation: null, stockSepImbalance: null, stockSepOversold: null,
    stockSepPhotoItems: null, stockSepPhotoDashboard: null, stockSepNote: '',
    chatNote: '',
    reviewNotes: '',
  }
}

export default function NewVisitPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50"><main className="p-6 text-center text-gray-400">Memuat...</main></div>}>
      <VisitForm />
    </Suspense>
  )
}

function VisitForm() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [stores, setStores] = useState<Store[]>([])
  const [userId, setUserId] = useState('')
  const [userRole, setUserRole] = useState('')
  const [data, setData] = useState<FormData>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [gpsLoading, setGpsLoading] = useState(false)
  const [gpsError, setGpsError] = useState('')
  const selfieRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (!profile) { router.push('/login'); return }

      setUserId(user.id)
      setUserRole(profile.role)

      const device = getDeviceType()
      setData(prev => ({ ...prev, deviceType: device }))

      const { data: stores } = await supabase.from('stores').select('*').order('name')
      setStores(stores || [])
    }
    init()
  }, [router])

  function update<T>(key: string, value: T) {
    setData(prev => ({ ...prev, [key]: value }))
  }

  function handleChecklistChange(idx: number, status: 'baik' | 'kurang' | 'buruk') {
    setData(prev => {
      const list = [...prev.checklist]; list[idx] = { ...list[idx], status }
      return { ...prev, checklist: list }
    })
  }

  function handleChecklistNoteChange(idx: number, note: string) {
    setData(prev => {
      const list = [...prev.checklist]; list[idx] = { ...list[idx], note }
      return { ...prev, checklist: list }
    })
  }

  function handleChecklistPhotoChange(idx: number, photo: File | null) {
    setData(prev => {
      const list = [...prev.checklist]; list[idx] = { ...list[idx], photo }
      return { ...prev, checklist: list }
    })
  }

  function handleStockChange(idx: number, field: 'item_name' | 'system_stock' | 'physical_stock' | 'sold_stock', value: string | number) {
    setData(prev => {
      const list = [...prev.stockChecks]
      const item = { ...list[idx], [field]: value }
      if (field === 'system_stock' || field === 'physical_stock' || field === 'sold_stock') {
        item.isMatch = item.physical_stock + item.sold_stock === item.system_stock
      }
      list[idx] = item
      return { ...prev, stockChecks: list }
    })
  }

  function handleDenominationChange(idx: number, quantity: number) {
    setData(prev => {
      const list = [...prev.denominations]; list[idx] = { ...list[idx], quantity }
      return { ...prev, denominations: list }
    })
  }

  function handleSupervisionChange(item_name: string, area: string, deadline_date: string) {
    setData(prev => {
      const list = prev.supervisions.filter(s => s.item_name !== item_name || s.area !== area)
      return { ...prev, supervisions: [...list, { item_name, area, deadline_date }] }
    })
  }

  function getDenominationTotal(): number {
    return data.denominations.reduce((sum, d) => sum + d.value * d.quantity, 0)
  }

  function getLocation() {
    if (!navigator.geolocation) {
      setGpsError('GPS tidak tersedia di perangkat ini')
      return
    }
    setGpsLoading(true)
    setGpsError('')

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const store = stores.find(s => s.id === data.storeId)
        if (store?.latitude && store?.longitude) {
          const dist = haversineDistance(pos.coords.latitude, pos.coords.longitude, store.latitude, store.longitude)
          const verified = dist <= 80
          setData(prev => ({
            ...prev,
            gpsLatitude: pos.coords.latitude,
            gpsLongitude: pos.coords.longitude,
            gpsAccuracy: pos.coords.accuracy,
            locationVerified: verified,
            locationDistance: Math.round(dist),
          }))
          if (!verified) {
            setGpsError(`Lokasi Anda ${Math.round(dist)}m dari toko. Maksimal 80m.`)
          }
        } else {
          setGpsError('Toko belum memiliki koordinat. Hubungi Manager untuk setting.')
        }
        setGpsLoading(false)
      },
      (err) => {
        setGpsError('Gagal mendapatkan lokasi: ' + err.message)
        setGpsLoading(false)
      },
      { enableHighAccuracy: true, timeout: 15000 }
    )
  }

  const progress = (step / STEPS.length) * 100

  const canProceed = () => {
    if (step === 1) return data.storeId && data.selfiePhoto && (data.locationVerified || userRole === 'manager')
    if (step === 2) {
      const modal = parseInt(data.initialCapital) || 0
      const petty = parseInt(data.pettyCashBalance) || 0
      const denomTotal = data.denominations.reduce((sum, d) => sum + d.value * d.quantity, 0)
      const claimValid = data.hasPendingClaim === null ? false : data.hasPendingClaim ? (parseInt(data.pendingClaimAmount) || 0) > 0 : true
      return modal > 0 && petty > 0 && denomTotal > 0 && claimValid && data.cashNote.trim().length > 0
    }
    if (step === 3) return data.hasPending !== null && data.depositPhoto !== null && data.depositNote.trim().length > 0
    if (step === 4) return data.checklist.every(c => c.status && c.note.trim().length > 0 && c.photo !== null)
    if (step === 5) return data.tiktokPercentage !== null && data.tiktokPhoto !== null && data.shopeePercentage !== null && data.shopeePhoto !== null && data.chatNote.trim().length > 0
    if (step === 6) return data.stockSeparation !== null && data.stockSepImbalance !== null && data.stockSepOversold !== null && data.stockSepPhotoItems !== null && data.stockSepPhotoDashboard !== null && data.stockSepNote.trim().length > 0
    if (step === 7) return data.stockChecks.every(s => s.item_name && s.system_stock > 0 && s.physical_stock > 0)
    if (step === 8) {
      const burukItems = data.checklist.filter(c => c.status === 'buruk')
      if (burukItems.length === 0) return true
      return burukItems.every(item =>
        data.supervisions.some(s => s.item_name === item.item_name && s.area === item.area && s.deadline_date)
      )
    }
    if (step === 9) return data.briefingPhoto !== null && data.briefingNote.trim().length > 0
    return true
  }

  async function uploadFile(file: File, path: string): Promise<string | null> {
    const base64 = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        resolve(result.split(',')[1])
      }
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
    const ext = file.name.split('.').pop() || 'png'
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ base64, contentType: file.type || 'image/png', path: `${path}.${ext}` }),
    })
    const data = await res.json()
    if (!res.ok) return null
    return data.url
  }

  async function uploadPhoto(photo: File | string | null, path: string): Promise<string | null> {
    if (!photo) return null
    if (typeof photo === 'string') return photo
    return uploadFile(photo, path)
  }

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)
    const supabase = createClient()

    try {
      let vid: string
      if (isEditMode && editVisitId) {
        vid = editVisitId
        // Upload all photos first, then send everything to API (bypass RLS)
        const selfieUrl = await uploadPhoto(data.selfiePhoto, `${vid}/selfie`)
        const dpUrl = await uploadPhoto(data.depositPhoto, `${vid}/deposit`)
        const bUrl = await uploadPhoto(data.briefingPhoto, `${vid}/briefing`)
        const ttUrl = await uploadPhoto(data.tiktokPhoto, `${vid}/tiktok`)
        const spUrl = await uploadPhoto(data.shopeePhoto, `${vid}/shopee`)
        const ssItemsUrl = await uploadPhoto(data.stockSepPhotoItems, `${vid}/stock-sep-items`)
        const ssDashUrl = await uploadPhoto(data.stockSepPhotoDashboard, `${vid}/stock-sep-dash`)

        const clUrls = await Promise.all(data.checklist.map((c, i) => uploadPhoto(c.photo, `${vid}/checklist-${i}`)))

        const modal = parseInt(data.initialCapital) || 0
        const petty = parseInt(data.pettyCashBalance) || 0
        const denomTotal = data.denominations.reduce((sum, d) => sum + d.value * d.quantity, 0)
        const scores = calculateScore(data)

        const payload = {
          visit_id: vid, storeId: data.storeId, visitDate: data.visitDate,
          reviewNotes: data.reviewNotes || null, totalScore: scores.total,
          attendance: selfieUrl ? {
            selfie_photo_url: selfieUrl, latitude: data.gpsLatitude,
            longitude: data.gpsLongitude, device_type: data.deviceType,
            is_location_match: data.locationVerified,
          } : null,
          denominations: data.denominations.filter(d => d.quantity > 0).map(d => ({
            denomination: d.value, quantity: d.quantity, type: d.type,
          })),
          cashCheck: {
            initial_capital: modal || null, petty_cash_balance: petty || null,
            cashier_is_match: modal + petty > 0 && (denomTotal + (data.hasPendingClaim ? (parseInt(data.pendingClaimAmount) || 0) : 0)) === modal + petty,
            petty_cash_is_match: modal + petty > 0 && (denomTotal + (data.hasPendingClaim ? (parseInt(data.pendingClaimAmount) || 0) : 0)) === modal + petty,
            has_pending_claim: data.hasPendingClaim,
            pending_claim_amount: parseInt(data.pendingClaimAmount) || 0,
            note: data.cashNote || null,
          },
          deposit: {
            has_pending: data.hasPending, photo_url: dpUrl, note: data.depositNote || null,
          },
          checklists: data.checklist.map((c, i) => ({ item_name: c.item_name, status: c.status, note: c.note || null, photo_url: clUrls[i], area: c.area })),
          stockChecks: data.stockChecks.map(s => ({
            item_name: s.item_name, system_stock: s.system_stock,
            physical_stock: s.physical_stock, sold_stock: s.sold_stock, is_match: s.isMatch,
          })),
          supervisions: data.supervisions.map(s => ({
            item_name: s.item_name, area: s.area, deadline_date: s.deadline_date,
          })),
          briefing: { photo_url: bUrl, note: data.briefingNote || null },
          chats: [
            data.tiktokPercentage !== null ? { marketplace: 'tiktok', percentage: data.tiktokPercentage, photo_url: ttUrl } : null,
            data.shopeePercentage !== null ? { marketplace: 'shopee', percentage: data.shopeePercentage, photo_url: spUrl } : null,
          ].filter(Boolean),
          stockSep: data.stockSeparation ? {
            status: data.stockSeparation, imbalance_percentage: data.stockSepImbalance,
            oversold_items: data.stockSepOversold, photo_url: null,
            photo_items_url: ssItemsUrl, photo_dashboard_url: ssDashUrl,
            note: data.stockSepNote || null,
          } : null,
        }

        const res = await fetch('/api/visit-update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const result = await res.json()
        if (!res.ok) throw new Error(result?.error || 'Gagal update kunjungan')

        router.push(`/visit/${vid}`)
        setSubmitting(false)
        return
      }
      const { data: visit, error: visitErr } = await supabase.from('visits').insert({
        store_id: data.storeId,
        supervisor_id: userId,
        visit_date: data.visitDate,
        status: 'submitted',
        review_notes: data.reviewNotes || null,
      }).select().single()
      if (visitErr || !visit) throw visitErr || new Error('Gagal membuat kunjungan')
      vid = visit.id

      // 1. Attendance
      if (data.selfiePhoto) {
        const url = await uploadPhoto(data.selfiePhoto, `${vid}/selfie`)
        if (url) {
          await supabase.from('visit_attendance').insert({
            visit_id: vid, selfie_photo_url: url,
            latitude: data.gpsLatitude, longitude: data.gpsLongitude,
            device_type: data.deviceType, is_location_match: data.locationVerified,
          })
        }
      }

      // 2. Cash Denominations
      const nonZeroDenoms = data.denominations.filter(d => d.quantity > 0)
      if (nonZeroDenoms.length > 0) {
        await supabase.from('visit_cash_denominations').insert(
          nonZeroDenoms.map(d => ({ visit_id: vid, denomination: d.value, quantity: d.quantity, type: d.type }))
        )
      }

      // 3. Cash Check
      const modal = parseInt(data.initialCapital) || 0
      const petty = parseInt(data.pettyCashBalance) || 0
      const denomTotal = data.denominations.reduce((sum, d) => sum + d.value * d.quantity, 0)
      const claimAmt = data.hasPendingClaim ? (parseInt(data.pendingClaimAmount) || 0) : 0
      const cashMatch = modal + petty > 0 && (denomTotal + claimAmt) === modal + petty
      await supabase.from('visit_cash_checks').insert({
        visit_id: vid,
        initial_capital: modal || null,
        petty_cash_balance: petty || null,
        cashier_is_match: cashMatch,
        petty_cash_is_match: cashMatch,
        has_pending_claim: data.hasPendingClaim,
        pending_claim_amount: parseInt(data.pendingClaimAmount) || 0,
        note: data.cashNote || null,
      })

      // 4. Deposit
      const dpUrl = await uploadPhoto(data.depositPhoto, `${vid}/deposit`)
      await supabase.from('visit_deposits').insert({
        visit_id: vid, has_pending: data.hasPending, photo_url: dpUrl, note: data.depositNote || null,
      })

      // 5. Checklist
      const clPhotoUrls = await Promise.all(data.checklist.map((c, i) => uploadPhoto(c.photo, `${vid}/checklist-${i}`)))
      await supabase.from('visit_checklists').insert(
        data.checklist.map((c, i) => ({ visit_id: vid, item_name: c.item_name, status: c.status, note: c.note || null, photo_url: clPhotoUrls[i], area: c.area }))
      )

      // 6. Stock Checks
      await supabase.from('visit_stock_checks').insert(
        data.stockChecks.map(s => ({
          visit_id: vid, item_name: s.item_name, system_stock: s.system_stock,
          physical_stock: s.physical_stock, sold_stock: s.sold_stock, is_match: s.isMatch,
        }))
      )

      // 7. Supervisions
      if (data.supervisions.length > 0) {
        await supabase.from('visit_supervisions').insert(
          data.supervisions.map(s => ({
            visit_id: vid,
            checklist_item_name: s.item_name,
            area: s.area,
            deadline_date: s.deadline_date,
          }))
        )
      }

      // 8. Briefing
      const bUrl = await uploadPhoto(data.briefingPhoto, `${vid}/briefing`)
      await supabase.from('visit_briefings').insert({
        visit_id: vid, photo_url: bUrl, note: data.briefingNote || null,
      })

      // 10. Chat Marketplace
      if (data.tiktokPercentage !== null) {
        const ttUrl = await uploadPhoto(data.tiktokPhoto, `${vid}/tiktok`)
        await supabase.from('visit_chat_marketplace').insert({
          visit_id: vid, marketplace: 'tiktok', percentage: data.tiktokPercentage, photo_url: ttUrl,
        })
      }
      if (data.shopeePercentage !== null) {
        const spUrl = await uploadPhoto(data.shopeePhoto, `${vid}/shopee`)
        await supabase.from('visit_chat_marketplace').insert({
          visit_id: vid, marketplace: 'shopee', percentage: data.shopeePercentage, photo_url: spUrl,
        })
      }

      // 11. Stock Separation
      if (data.stockSeparation) {
        const ssItemsUrl = await uploadPhoto(data.stockSepPhotoItems, `${vid}/stock-sep-items`)
        const ssDashUrl = await uploadPhoto(data.stockSepPhotoDashboard, `${vid}/stock-sep-dash`)
        const sepRes = await fetch('/api/stock-separation', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            visit_id: vid, status: data.stockSeparation,
            imbalance_percentage: data.stockSepImbalance,
            oversold_items: data.stockSepOversold,
            photo_items_url: ssItemsUrl, photo_dashboard_url: ssDashUrl,
            note: data.stockSepNote || null,
          }),
        })
        const sepData = await sepRes.json()
        if (!sepRes.ok) throw new Error('Gagal simpan stok online: ' + (sepData?.error || JSON.stringify(sepData)))
      }

      // 12. Update score & status
      const scores = calculateScore(data)
      if (isEditMode && editVisitId) {
        await supabase.from('visits').update({
          store_id: data.storeId,
          visit_date: data.visitDate,
          status: 'submitted',
          review_notes: data.reviewNotes || null,
          total_score: scores.total,
        }).eq('id', vid)
      } else {
        await supabase.from('visits').update({
          status: 'submitted',
          review_notes: data.reviewNotes || null,
          total_score: scores.total,
        }).eq('id', vid)
      }

      router.push(`/visit/${vid}`)
    } catch (err: any) {
      alert('Error: ' + err.message)
    } finally {
      setSubmitting(false)
    }
  }

  // ── EDIT MODE ──
  const searchParams = useSearchParams()
  const editVisitId = searchParams.get('edit')
  const [isEditMode] = useState(!!editVisitId)
  const [loadedEdit, setLoadedEdit] = useState(false)

  // Load existing data for edit mode
  useEffect(() => {
    if (!editVisitId || loadedEdit) return
    ;(async () => {
      const supabase = createClient()
      const { data: visit } = await supabase
        .from('visits')
        .select('*, store:stores(*), supervisor:profiles!visits_supervisor_id_fkey(*)')
        .eq('id', editVisitId)
        .single()
      if (!visit) return

      const [attendRes, cashRes, denomRes, depRes, clRes, stkRes,
        supRes, briefRes, chatRes, sepRes] = await Promise.all([
        supabase.from('visit_attendance').select('*').eq('visit_id', editVisitId).maybeSingle(),
        supabase.from('visit_cash_checks').select('*').eq('visit_id', editVisitId).maybeSingle(),
        supabase.from('visit_cash_denominations').select('*').eq('visit_id', editVisitId),
        supabase.from('visit_deposits').select('*').eq('visit_id', editVisitId).maybeSingle(),
        supabase.from('visit_checklists').select('*').eq('visit_id', editVisitId),
        supabase.from('visit_stock_checks').select('*').eq('visit_id', editVisitId),
        supabase.from('visit_supervisions').select('*').eq('visit_id', editVisitId),
        supabase.from('visit_briefings').select('*').eq('visit_id', editVisitId).maybeSingle(),
        supabase.from('visit_chat_marketplace').select('*').eq('visit_id', editVisitId),
        supabase.from('visit_stock_separation').select('*').eq('visit_id', editVisitId).maybeSingle(),
      ])

      const att = attendRes.data as any
      const cash = cashRes.data as any
      const denoms = (denomRes.data || []) as any[]
      const dep = depRes.data as any
      const cls = (clRes.data || []) as any[]
      const stks = (stkRes.data || []) as any[]
      const sups = (supRes.data || []) as any[]
      const brief = briefRes.data as any
      const sep = sepRes.data as any
      const chatData = (chatRes.data || []) as any[]

      setData({
        storeId: visit.store_id, visitDate: visit.visit_date,
        selfiePhoto: att?.selfie_photo_url || null,
        gpsLatitude: att?.latitude || null, gpsLongitude: att?.longitude || null,
        gpsAccuracy: null, locationVerified: att?.is_location_match || false,
        locationDistance: null, deviceType: att?.device_type || 'desktop',
        initialCapital: cash?.initial_capital?.toString() || '',
        pettyCashBalance: cash?.petty_cash_balance?.toString() || '',
        denominations: denoms.length > 0 ? denoms.map((d: any) => ({ value: d.denomination, quantity: d.quantity, type: d.type as 'coin' | 'bill' }))
          : DENOMINATIONS.map(d => ({ value: d.value, quantity: 0, type: d.type as 'coin' | 'bill' })),
        hasPendingClaim: cash?.has_pending_claim ?? null,
        pendingClaimAmount: cash?.pending_claim_amount?.toString() || '',
        cashNote: cash?.note || '',
        hasPending: dep?.has_pending ?? null,
        depositPhoto: dep?.photo_url || null,
        depositNote: dep?.note || '',
        checklist: cls.length > 0 ? cls.map((c: any) => ({ item_name: c.item_name, status: c.status as 'baik' | 'kurang' | 'buruk', note: c.note || '', photo: c.photo_url || null, area: c.area || 'exterior' }))
          : CHECKLIST_ITEMS.map(i => ({ item_name: i.name, status: 'baik' as const, note: '', photo: null, area: i.area })),
        stockChecks: stks.length > 0 ? stks.map((s: any) => ({ item_name: s.item_name || '', system_stock: s.system_stock || 0, physical_stock: s.physical_stock || 0, sold_stock: s.sold_stock || 0, isMatch: s.is_match }))
          : Array.from({ length: 5 }, () => ({ item_name: '', system_stock: 0, physical_stock: 0, sold_stock: 0, isMatch: true })),
        supervisions: sups.length > 0 ? sups.map((s: any) => ({ item_name: s.checklist_item_name, area: s.area, deadline_date: s.deadline_date || '' })) : [],
        briefingPhoto: brief?.photo_url || null,
        briefingNote: brief?.note || '',
        tiktokPercentage: chatData.find((c: any) => c.marketplace === 'tiktok')?.percentage ?? null,
        tiktokPhoto: chatData.find((c: any) => c.marketplace === 'tiktok')?.photo_url || null,
        shopeePercentage: chatData.find((c: any) => c.marketplace === 'shopee')?.percentage ?? null,
        shopeePhoto: chatData.find((c: any) => c.marketplace === 'shopee')?.photo_url || null,
        stockSeparation: sep?.status || null,
        stockSepImbalance: sep?.imbalance_percentage ?? null,
        stockSepOversold: sep?.oversold_items ?? null,
        stockSepPhotoItems: sep?.photo_items_url || null,
        stockSepPhotoDashboard: sep?.photo_dashboard_url || null,
        stockSepNote: sep?.note || '',
        reviewNotes: visit.review_notes || '',
      })
      setLoadedEdit(true)
    })()
  }, [editVisitId, loadedEdit])

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-white">
      <NavBar />
      <main className="max-w-3xl mx-auto p-4 md:p-6">
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-gradient-to-br from-emerald-50 to-white pb-3 space-y-3">
          <div className="flex items-center gap-3 pt-2">
            <h1 className="text-xl font-bold text-emerald-900">{isEditMode ? 'Edit Laporan' : 'Kunjungan Baru'}</h1>
            <Badge variant="outline">{STEPS.find(s => s.id === step)?.label} ({step}/{STEPS.length})</Badge>
          </div>

          {/* Stepper */}
          <div className="flex gap-1 overflow-x-auto">
            {STEPS.map(s => {
              const active = step === s.id
              const done = s.id < step
              const Icon = s.icon
              const Tag = isEditMode ? 'button' : 'div'
              return (
                <Tag key={s.id} onClick={isEditMode ? () => setStep(s.id) : undefined}
                  className={`flex items-center gap-1.5 shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    active ? 'bg-emerald-700 text-white shadow-sm' :
                    done ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-50 text-gray-400'
                  } ${isEditMode ? 'cursor-pointer hover:opacity-80' : ''}`}>
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{s.label}</span>
                </Tag>
              )
            })}
          </div>

          {/* Progress bar */}
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-600 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {/* Scrollable content */}
        <div className="space-y-4 mt-1">

        {/* STEP 1: Attendance + GPS Verification */}
        {step === 1 && (
          <Card className="border-emerald-100 shadow-sm">
            <CardHeader className="border-b border-gray-50 pb-3">
              <CardTitle className="flex items-center gap-2 text-emerald-800">
                <Camera className="h-5 w-5" /> Absen Selfie & Verifikasi Lokasi
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-emerald-800">Toko</Label>
                  <Select value={data.storeId} onChange={e => {
                    update('storeId', e.target.value)
                    setGpsError('')
                    setData(prev => ({ ...prev, locationVerified: false, locationDistance: null }))
                  }}>
                    <option value="">Pilih toko...</option>
                    {stores.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} {s.latitude && s.longitude ? '📍' : '⚠️'}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-emerald-800">Tanggal Kunjungan</Label>
                  <Input type="date" value={data.visitDate} onChange={e => update('visitDate', e.target.value)} min={new Date().toISOString().split('T')[0]} />
                </div>
              </div>

              <Separator />

              <div>
                <Label className="text-emerald-800 flex items-center gap-1.5 mb-2">
                  <MapPin className="h-4 w-4 text-emerald-600" /> Verifikasi GPS (maks 80m dari toko)
                </Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={getLocation}
                    disabled={gpsLoading || !data.storeId}
                    className="border-emerald-200"
                  >
                    {gpsLoading ? 'Mendeteksi...' : '📍 Ambil Lokasi Saya'}
                  </Button>
                  {data.locationVerified && (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                      <Check className="h-3 w-3" /> {data.locationDistance}m — Sesuai
                    </span>
                  )}
                  {data.locationDistance !== null && !data.locationVerified && (
                    <span className="inline-flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2.5 py-1 rounded-full">
                      <AlertTriangle className="h-3 w-3" /> {data.locationDistance}m — Terlalu jauh
                    </span>
                  )}
                </div>
                {gpsError && <p className="text-xs text-red-500 mt-1">{gpsError}</p>}
                {data.gpsLatitude && (
                  <p className="text-xs text-gray-400 mt-1">
                    Lat: {data.gpsLatitude.toFixed(6)}, Lng: {data.gpsLongitude?.toFixed(6)}
                    {data.gpsAccuracy ? ` (±${Math.round(data.gpsAccuracy)}m)` : ''}
                  </p>
                )}
              </div>

              {/* Store vs GPS info */}
              {data.storeId && (() => {
                const store = stores.find(s => s.id === data.storeId)
                if (!store?.latitude || !store?.longitude) return null
                return (
                  <div className="p-3 rounded-lg bg-gray-50 border border-gray-100 text-xs space-y-1">
                    <p className="text-gray-500 font-medium">📍 Verifikasi Lokasi</p>
                    <p className="text-gray-500">Toko: {store.name} ({store.latitude.toFixed(6)}, {store.longitude.toFixed(6)})</p>
                    {data.gpsLatitude && (
                      <p className="text-gray-500">GPS Anda: {data.gpsLatitude.toFixed(6)}, {data.gpsLongitude?.toFixed(6)}</p>
                    )}
                    {data.locationDistance !== null && (
                      <p className={data.locationVerified ? 'text-emerald-600 font-medium' : 'text-red-600 font-medium'}>
                        {data.locationVerified ? '✅' : '❌'} Jarak: {data.locationDistance}m dari toko
                        {data.locationVerified ? ' (sesuai ≤80m)' : ' (terlalu jauh)'}
                      </p>
                    )}
                    <a href={`https://www.google.com/maps?q=${store.latitude},${store.longitude}`}
                      target="_blank" rel="noopener noreferrer"
                      className="inline-block text-blue-600 hover:underline mt-1">
                      🔗 Buka di Google Maps
                    </a>
                  </div>
                )
              })()}

              <Separator />

              <div>
                <Label className="text-emerald-800 flex items-center gap-1.5 mb-2">
                  <Camera className="h-4 w-4 text-emerald-600" /> Selfie di Toko
                </Label>
                {typeof data.selfiePhoto === 'string' && (
                  <img src={data.selfiePhoto} alt="Selfie" className="w-full h-48 object-cover rounded-lg border border-gray-200 mb-2" />
                )}
                {data.deviceType === 'mobile' ? (
                  <div>
                    <input
                      ref={selfieRef}
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={e => update('selfiePhoto', e.target.files?.[0] || null)}
                      className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                    />
                    <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                      <Smartphone className="h-3 w-3" /> Mode HP — kamera akan terbuka otomatis
                    </p>
                  </div>
                ) : (
                  <div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={e => update('selfiePhoto', e.target.files?.[0] || null)}
                      className="block w-full text-sm text-gray-500 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100"
                    />
                    <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                      <Monitor className="h-3 w-3" /> Akses via Laptop — pilih file foto
                    </p>
                  </div>
                )}
                {data.selfiePhoto && typeof data.selfiePhoto !== 'string' && (
                  <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                    <Check className="h-3 w-3" /> {(data.selfiePhoto as File).name || 'Foto terpilih'}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 2: Cash Denominations + Initial Capital */}
        {step === 2 && (
          <Card className="border-emerald-100 shadow-sm">
            <CardHeader className="border-b border-gray-50 pb-3">
              <CardTitle className="flex items-center gap-2 text-emerald-800">
                <DollarSign className="h-5 w-5" /> Uang Modal & Petty Cash
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-emerald-800">Modal Awal (Rp)</Label>
                    <Input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="0" value={data.initialCapital} onChange={e => update('initialCapital', e.target.value.replace(/\D/g, ''))} />
                </div>
                <div className="space-y-1">
                  <Label className="text-emerald-800">Saldo Petty Cash (Rp)</Label>
                    <Input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="0" value={data.pettyCashBalance} onChange={e => update('pettyCashBalance', e.target.value.replace(/\D/g, ''))} />
                </div>
              </div>

              <Separator />

              <Label className="text-emerald-800">Detail Per Pecahan</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {data.denominations.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-100 bg-white">
                    <span className="text-sm font-medium w-24 text-gray-700">
                      {d.type === 'coin' ? '🪙' : '💵'} {d.value.toLocaleString('id-ID')}
                    </span>
                    <div className="flex items-center gap-1 ml-auto">
                      <button type="button" onClick={() => handleDenominationChange(i, Math.max(0, d.quantity - 1))}
                        className="h-7 w-7 rounded bg-gray-100 text-gray-500 text-sm hover:bg-gray-200">−</button>
                      <input type="number" min="0" value={d.quantity || ''}
                        onChange={e => handleDenominationChange(i, Math.max(0, parseInt(e.target.value) || 0))}
                        className="h-7 w-14 text-center text-sm rounded border border-gray-200" />
                      <button type="button" onClick={() => handleDenominationChange(i, d.quantity + 1)}
                        className="h-7 w-7 rounded bg-gray-100 text-gray-500 text-sm hover:bg-gray-200">+</button>
                    </div>
                  </div>
                ))}
              </div>

              <Separator />

              <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-100 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-800 font-medium">Total Modal + Petty Cash:</span>
                  <span className="font-bold text-emerald-800">Rp {((parseInt(data.initialCapital) || 0) + (parseInt(data.pettyCashBalance) || 0)).toLocaleString('id-ID')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-800 font-medium">Total Uang Fisik:</span>
                  <span className="font-bold text-emerald-800">Rp {(getDenominationTotal()).toLocaleString('id-ID')}</span>
                </div>
                {data.hasPendingClaim && (
                  <div className="flex justify-between text-sm">
                    <span className="text-emerald-800 font-medium">+ Bon Klaim:</span>
                    <span className="font-bold text-emerald-800">Rp {(parseInt(data.pendingClaimAmount) || 0).toLocaleString('id-ID')}</span>
                  </div>
                )}
                <Separator className="bg-emerald-200" />
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-800 font-medium">Status:</span>
                  {(() => {
                    const expected = (parseInt(data.initialCapital) || 0) + (parseInt(data.pettyCashBalance) || 0)
                    const actual = getDenominationTotal()
                    const claimAmt = data.hasPendingClaim ? (parseInt(data.pendingClaimAmount) || 0) : 0
                    return expected > 0 && (actual + claimAmt) === expected
                      ? <span className="font-bold text-emerald-700">✅ Sesuai</span>
                      : <span className="font-bold text-red-500">❌ Tidak sesuai</span>
                  })()}
                </div>
              </div>

              <Separator />

              <div>
                <Label className="text-emerald-800">Ada bon klaim yang belum cair?</Label>
                <div className="flex gap-4 mt-1">
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input type="radio" name="pendingClaim" checked={data.hasPendingClaim === true} onChange={() => update('hasPendingClaim', true)}
                      className="text-emerald-600 focus:ring-emerald-500" /> Ya, ada
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-600">
                    <input type="radio" name="pendingClaim" checked={data.hasPendingClaim === false} onChange={() => update('hasPendingClaim', false)}
                      className="text-emerald-600 focus:ring-emerald-500" /> Tidak ada
                  </label>
                </div>
                {data.hasPendingClaim && (
                  <div className="mt-2">
                    <Label className="text-xs text-gray-400">Jumlah Bon Klaim (Rp)</Label>
                    <Input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="200000" value={data.pendingClaimAmount}
                      onChange={e => update('pendingClaimAmount', e.target.value.replace(/\D/g, ''))} className="text-sm" />
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <Label className="text-emerald-800">Catatan <span className="text-red-400">*</span></Label>
                <Input placeholder="Catatan wajib diisi" value={data.cashNote} onChange={e => update('cashNote', e.target.value)} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 3: Deposit */}
        {step === 3 && (
          <Card className="border-emerald-100 shadow-sm">
            <CardHeader className="border-b border-gray-50 pb-3">
              <CardTitle className="flex items-center gap-2 text-emerald-800"><FileText className="h-5 w-5" /> Validasi Setoran</CardTitle></CardHeader>
            <CardContent className="pt-4 space-y-4">
              <Label className="text-emerald-800">Apakah ada setoran pending?</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input type="radio" name="pending" checked={data.hasPending === false} onChange={() => update('hasPending', false)}
                    className="text-emerald-600 focus:ring-emerald-500" /> Tidak ada pending
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  <input type="radio" name="pending" checked={data.hasPending === true} onChange={() => update('hasPending', true)}
                    className="text-emerald-600 focus:ring-emerald-500" /> Ada pending
                </label>
              </div>
              <div className="space-y-1">
                <Label className="text-emerald-800">Foto Form Setoran</Label>
                {typeof data.depositPhoto === 'string' && (
                  <img src={data.depositPhoto} alt="Setoran" className="w-full h-32 object-cover rounded-lg border border-gray-200 mb-2" />
                )}
                <input type="file" accept="image/*" capture="environment" onChange={e => update('depositPhoto', e.target.files?.[0] || null)}
                  className="block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100" />
              </div>
              <div className="space-y-1">
                <Label className="text-emerald-800">Catatan <span className="text-red-400">*</span></Label>
                <Input placeholder="Catatan wajib diisi" value={data.depositNote} onChange={e => update('depositNote', e.target.value)} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 4: Checklist Toko */}
        {step === 4 && (
          <Card className="border-emerald-100 shadow-sm">
            <CardHeader className="border-b border-gray-50 pb-3">
              <CardTitle className="flex items-center gap-2 text-emerald-800">
                <ClipboardList className="h-5 w-5" /> Ceklist Kondisi Toko
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-6">
              {(() => {
                const total = data.checklist.length
                const valid = data.checklist.filter(c => c.status && c.note.trim().length > 0 && c.photo !== null).length
                const pct = Math.round(valid / total * 100)
                return (
                  <div className="bg-emerald-50 rounded-lg p-3 border border-emerald-100">
                    <div className="flex justify-between text-sm text-emerald-800 mb-1.5">
                      <span className="font-medium">Progres Checklist</span>
                      <span className={valid === total ? 'text-emerald-700 font-bold' : 'text-amber-700 font-medium'}>
                        {valid} / {total} item ({pct}%)
                      </span>
                    </div>
                    <div className="w-full bg-emerald-200 rounded-full h-2.5">
                      <div className={`h-2.5 rounded-full transition-all duration-300 ${
                        valid === total ? 'bg-emerald-600' : 'bg-amber-500'
                      }`} style={{ width: `${pct}%` }} />
                    </div>
                    {valid < total && (
                      <p className="text-xs text-red-500 mt-1.5 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> Item dengan border merah belum lengkap (catatan dan/atau foto)
                      </p>
                    )}
                  </div>
                )
              })()}
              {(['exterior', 'interior', 'butcher', 'storage'] as const).map(area => {
                const areaLabel = area === 'exterior' ? 'Area Luar'
                  : area === 'interior' ? 'Area Dalam Toko'
                  : area === 'butcher' ? 'Area Butcher'
                  : 'Area Gudang, Office & Cold Storage'
                const items = CHECKLIST_ITEMS.filter(item => item.area === area)
                const areaTotal = items.length
                const areaValid = items.filter(item => {
                  const ci = data.checklist.find(c => c.item_name === item.name && c.area === item.area)
                  return ci && ci.status && ci.note.trim().length > 0 && ci.photo !== null
                }).length
                return (
                  <div key={area}>
                    <h3 className="text-sm font-semibold text-emerald-800 mb-3 bg-emerald-50 px-3 py-2 rounded-lg flex items-center justify-between">
                      <span>{areaLabel}</span>
                      <span className={`text-xs font-normal ${areaValid === areaTotal ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {areaValid}/{areaTotal}
                      </span>
                    </h3>
                    <div className="space-y-4">
                      {items.map((item) => {
                        const globalIdx = data.checklist.findIndex(c => c.item_name === item.name && c.area === item.area)
                        const ci = data.checklist[globalIdx]
                        const noteFilled = ci && ci.note.trim().length > 0
                        const photoFilled = ci && ci.photo !== null
                        const itemValid = ci && ci.status && noteFilled && photoFilled
                        return (
                          <div key={globalIdx} className={`p-3.5 rounded-xl border space-y-3 ${
                            itemValid ? 'border-gray-100' : 'border-red-300 bg-red-50/20'
                          }`}>
                            <div className="flex items-start justify-between gap-2">
                              <span className="text-sm text-gray-700 flex-1">{item.name}</span>
                              <div className="flex gap-1 shrink-0">
                                {(['baik', 'kurang', 'buruk'] as const).map(status => (
                                  <button key={status} type="button" onClick={() => handleChecklistChange(globalIdx, status)}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                                      ci?.status === status
                                        ? status === 'baik' ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                                          : status === 'kurang' ? 'bg-amber-100 border-amber-300 text-amber-800'
                                            : 'bg-red-100 border-red-300 text-red-800'
                                        : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
                                    }`}>
                                    {status === 'baik' ? '✅ Baik' : status === 'kurang' ? '⚠️ Kurang' : '❌ Buruk'}
                                  </button>
                                ))}
                              </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1">
                                <Label className="text-xs text-gray-400">Catatan <span className="text-red-400">*</span></Label>
                                <Input placeholder="Catatan wajib" value={ci?.note || ''}
                                  onChange={e => handleChecklistNoteChange(globalIdx, e.target.value)}
                                  className={`text-sm ${!noteFilled ? 'border-red-400 focus:ring-red-300' : ''}`} />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-xs text-gray-400">Foto <span className="text-red-400">*</span></Label>
                                {typeof ci?.photo === 'string' && (
                                  <img src={ci.photo as string} alt="Checklist" className="w-full h-20 object-cover rounded-lg border border-gray-200 mb-1" />
                                )}
                                <div className={`${!photoFilled ? 'p-1.5 rounded border border-dashed border-red-300 bg-red-50/50' : ''}`}>
                                  <input type="file" accept="image/*" capture="environment" onChange={e => handleChecklistPhotoChange(globalIdx, e.target.files?.[0] || null)}
                                    className="block w-full text-sm file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-emerald-50 file:text-emerald-700" />
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}

        {/* STEP 5: Chat Marketplace */}
        {step === 5 && (
          <Card className="border-emerald-100 shadow-sm">
            <CardHeader className="border-b border-gray-50 pb-3">
              <CardTitle className="flex items-center gap-2 text-emerald-800"><MessageCircle className="h-5 w-5" /> Chat Response Marketplace</CardTitle></CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="p-4 rounded-xl border border-emerald-100 bg-emerald-50/50 space-y-3">
                <Label className="font-semibold text-emerald-800 flex items-center gap-2">TikTok Shop</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Persentase Chat Response (%)</Label>
                    <Input type="number" min="0" max="100" placeholder="80" value={data.tiktokPercentage ?? ''}
                      onChange={e => update('tiktokPercentage', e.target.value ? parseFloat(e.target.value) : null)} />
                    <div className="text-xs font-medium min-h-[18px]">
                      {data.tiktokPercentage !== null && data.tiktokPercentage >= 100
                        ? <span className="text-emerald-600">Excellent</span>
                        : data.tiktokPercentage !== null && data.tiktokPercentage >= 80
                        ? <span className="text-emerald-600">Good</span>
                        : data.tiktokPercentage !== null
                        ? <span className="text-red-500">Poor</span>
                        : null}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">≥100 Excellent · ≥80 Good · &lt;80 Poor</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Foto dari App</Label>
                    {typeof data.tiktokPhoto === 'string' && (
                      <img src={data.tiktokPhoto} alt="TikTok" className="w-full h-24 object-cover rounded-lg border border-gray-200 mb-2" />
                    )}
                    <input type="file" accept="image/*" capture="environment" onChange={e => update('tiktokPhoto', e.target.files?.[0] || null)}
                      className="block w-full text-sm file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-emerald-50 file:text-emerald-700" />
                  </div>
                </div>
              </div>
              <div className="p-4 rounded-xl border border-orange-100 bg-orange-50/50 space-y-3">
                <Label className="font-semibold text-orange-800 flex items-center gap-2">Shopee</Label>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Persentase Chat Response (%)</Label>
                    <Input type="number" min="0" max="100" placeholder="80" value={data.shopeePercentage ?? ''}
                      onChange={e => update('shopeePercentage', e.target.value ? parseFloat(e.target.value) : null)} />
                    <div className="text-xs font-medium min-h-[18px]">
                      {data.shopeePercentage !== null && data.shopeePercentage >= 100
                        ? <span className="text-emerald-600">Excellent</span>
                        : data.shopeePercentage !== null && data.shopeePercentage >= 80
                        ? <span className="text-emerald-600">Good</span>
                        : data.shopeePercentage !== null
                        ? <span className="text-red-500">Poor</span>
                        : null}
                    </div>
                    <p className="text-[10px] text-gray-400 mt-0.5">≥100 Excellent · ≥80 Good · &lt;80 Poor</p>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-gray-500">Foto dari App</Label>
                    {typeof data.shopeePhoto === 'string' && (
                      <img src={data.shopeePhoto} alt="Shopee" className="w-full h-24 object-cover rounded-lg border border-gray-200 mb-2" />
                    )}
                    <input type="file" accept="image/*" capture="environment" onChange={e => update('shopeePhoto', e.target.files?.[0] || null)}
                      className="block w-full text-sm file:mr-2 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-orange-50 file:text-orange-700" />
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-emerald-800">Catatan <span className="text-red-400">*</span></Label>
                <Input placeholder="Catatan wajib diisi" value={data.chatNote} onChange={e => update('chatNote', e.target.value)} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 6: Stock Separation */}
        {step === 6 && (
          <Card className="border-emerald-100 shadow-sm">
            <CardHeader className="border-b border-gray-50 pb-3">
              <CardTitle className="flex items-center gap-2 text-emerald-800"><Truck className="h-5 w-5" /> Pemisahan Stok Online &amp; Offline</CardTitle></CardHeader>
            <CardContent className="pt-4 space-y-4">
              <Label className="text-emerald-800">Status Stock Keeper</Label>
              <div className="flex gap-3">
                {(['sehat', 'perhatian', 'kritis'] as const).map(s => (
                  <button key={s} type="button" onClick={() => update('stockSeparation', s)}
                    className={`flex-1 py-3 rounded-xl text-sm font-medium border transition-all ${
                      data.stockSeparation === s
                        ? s === 'sehat' ? 'bg-emerald-100 border-emerald-300 text-emerald-800 shadow-sm'
                          : s === 'perhatian' ? 'bg-amber-100 border-amber-300 text-amber-800 shadow-sm'
                            : 'bg-red-100 border-red-300 text-red-800 shadow-sm'
                        : 'bg-white border-gray-200 text-gray-400 hover:bg-gray-50'
                    }`}>
                    {s === 'sehat' ? '✅ Sehat' : s === 'perhatian' ? '⚠️ Perhatian' : '❌ Kritis'}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-emerald-800">Imbalance Stok (%)</Label>
                  <Input type="number" min={0} max={100} step={0.1} placeholder="0.0"
                    value={data.stockSepImbalance ?? ''}
                    onChange={e => update('stockSepImbalance', e.target.value ? parseFloat(e.target.value) : null)} />
                  <p className="text-xs text-gray-400">Jika &lt;10% = 3 poin, jika ≥10% = 0 poin</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-emerald-800">Potensi Oversold (item)</Label>
                  <Input type="number" min={0} step={1} placeholder="0"
                    value={data.stockSepOversold ?? ''}
                    onChange={e => update('stockSepOversold', e.target.value ? parseInt(e.target.value) : null)} />
                  <p className="text-xs text-gray-400">Jika &lt;5 item = 3 poin, jika ≥5 = 0 poin</p>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-emerald-800">Foto Item Bermasalah</Label>
                {typeof data.stockSepPhotoItems === 'string' && (
                  <img src={data.stockSepPhotoItems} alt="Item bermasalah" className="w-full h-32 object-cover rounded-lg border border-gray-200 mb-2" />
                )}
                <input type="file" accept="image/*" capture="environment" onChange={e => update('stockSepPhotoItems', e.target.files?.[0] || null)}
                  className="block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700" />
              </div>
              <div className="space-y-1">
                <Label className="text-emerald-800">Foto Dashboard Stock Keeper</Label>
                {typeof data.stockSepPhotoDashboard === 'string' && (
                  <img src={data.stockSepPhotoDashboard} alt="Dashboard" className="w-full h-32 object-cover rounded-lg border border-gray-200 mb-2" />
                )}
                <input type="file" accept="image/*" capture="environment" onChange={e => update('stockSepPhotoDashboard', e.target.files?.[0] || null)}
                  className="block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700" />
              </div>
              <div className="space-y-1">
                <Label className="text-emerald-800">Catatan <span className="text-red-400">*</span></Label>
                <Input placeholder="Catatan wajib diisi" value={data.stockSepNote} onChange={e => update('stockSepNote', e.target.value)} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* STEP 7: Stock Check (with sold_stock) */}
        {step === 7 && (
          <Card className="border-emerald-100 shadow-sm">
            <CardHeader className="border-b border-gray-50 pb-3">
              <CardTitle className="flex items-center gap-2 text-emerald-800"><Package className="h-5 w-5" /> Random Cek 5 Item Fast Moving</CardTitle></CardHeader>
            <CardContent className="pt-4 space-y-3">
              {data.stockChecks.map((item, i) => (
                <div key={i} className="p-3.5 rounded-xl border border-gray-100 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-gray-400">Item {i + 1}</span>
                    {item.item_name && (
                      item.isMatch
                        ? <span className="text-xs text-emerald-600 font-medium bg-emerald-50 px-2 py-0.5 rounded-full">✓ Cocok</span>
                        : <span className="text-xs text-red-600 font-medium bg-red-50 px-2 py-0.5 rounded-full">✗ Tidak cocok</span>
                    )}
                  </div>
                  <div className="grid grid-cols-5 gap-2 items-start">
                    <div className="col-span-5 sm:col-span-1">
                      <Label className="text-xs text-gray-400">Nama Item</Label>
                      <Input placeholder="Nama item" value={item.item_name} onChange={e => handleStockChange(i, 'item_name', e.target.value)} className="text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-400">Stok Sistem</Label>
                      <Input type="number" min="0" placeholder="0" value={item.system_stock || ''} onChange={e => handleStockChange(i, 'system_stock', parseInt(e.target.value) || 0)} className="text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-400">Stok Fisik</Label>
                      <Input type="number" min="0" placeholder="0" value={item.physical_stock || ''} onChange={e => handleStockChange(i, 'physical_stock', parseInt(e.target.value) || 0)} className="text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-400">Stok Terjual Blm Faktur</Label>
                      <Input type="number" min="0" placeholder="0" value={item.sold_stock || ''} onChange={e => handleStockChange(i, 'sold_stock', parseInt(e.target.value) || 0)} className="text-sm" />
                    </div>
                    <div>
                      <Label className="text-xs text-gray-400">Selisih</Label>
                      {(() => {
                        const diff = (item.physical_stock + item.sold_stock) - item.system_stock
                        const sign = diff > 0 ? '+' : ''
                        return (
                          <div className={`h-9 rounded-lg border text-sm flex items-center justify-center font-bold ${
                            diff === 0 ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                              : 'bg-red-50 border-red-200 text-red-600'
                          }`}>
                            {item.item_name ? `${sign}${diff}` : '-'}
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* STEP 8: Supervisi — auto dari checklist buruk */}
        {step === 8 && (
          <Card className="border-emerald-100 shadow-sm">
            <CardHeader className="border-b border-gray-50 pb-3">
              <CardTitle className="flex items-center gap-2 text-emerald-800"><Search className="h-5 w-5" /> Supervisi — Tindak Lanjut Temuan</CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {(() => {
                const burukItems = data.checklist.filter(c => c.status === 'buruk')
                if (burukItems.length === 0) {
                  return (
                    <div className="text-center py-6 text-gray-400">
                      <Check className="h-8 w-8 mx-auto mb-2 text-emerald-500" />
                      <p className="text-sm">Tidak ada item yang perlu supervisi.</p>
                      <p className="text-xs text-gray-400 mt-1">Semua item checklist dalam kondisi baik.</p>
                    </div>
                  )
                }
                return (
                  <>
                    <p className="text-sm text-gray-500">Item dengan status <span className="text-red-500 font-medium">Buruk</span> dari Ceklist Toko yang perlu ditindaklanjuti:</p>
                    {burukItems.map((item, i) => {
                      const sup = data.supervisions.find(s => s.item_name === item.item_name && s.area === item.area)
                      return (
                        <div key={i} className="p-3.5 rounded-xl border border-red-100 bg-red-50/20 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-700">{item.item_name}</p>
                              <span className="text-xs text-gray-400">{item.area === 'exterior' ? 'Area Luar' : item.area === 'interior' ? 'Area Dalam Toko' : item.area === 'butcher' ? 'Area Butcher' : 'Area Gudang, Office & Cold Storage'}</span>
                            </div>
                          </div>
                          {item.note && (
                            <div className="bg-white rounded-lg p-2.5 border border-gray-200">
                              <p className="text-xs text-gray-400 mb-0.5">Catatan SPV:</p>
                              <p className="text-sm text-gray-700">{item.note}</p>
                            </div>
                          )}
                          {item.photo && (
                            typeof item.photo === 'string'
                              ? <img src={item.photo} alt="Temuan" className="w-full h-24 object-cover rounded-lg border border-gray-200" />
                              : <p className="text-xs text-gray-400 flex items-center gap-1"><Check className="h-3 w-3 text-emerald-500" /> Foto sudah diambil</p>
                          )}
                          <div className="space-y-1">
                            <Label className="text-xs text-gray-400">Deadline Tindak Lanjut <span className="text-red-400">*</span></Label>
                            <Input type="date" min={new Date().toISOString().split('T')[0]}
                              value={sup?.deadline_date || ''}
                              onChange={e => handleSupervisionChange(item.item_name, item.area, e.target.value)}
                              className={`text-sm ${sup?.deadline_date ? 'border-emerald-300' : 'border-red-300'}`} />
                          </div>
                        </div>
                      )
                    })}
                  </>
                )
              })()}
            </CardContent>
          </Card>
        )}

        {/* STEP 9: Briefing */}
        {step === 9 && (
          <Card className="border-emerald-100 shadow-sm">
            <CardHeader className="border-b border-gray-50 pb-3">
              <CardTitle className="flex items-center gap-2 text-emerald-800"><MessageSquare className="h-5 w-5" /> Briefing Flow Kerja</CardTitle></CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="space-y-1">
                <Label className="text-emerald-800">Foto Briefing</Label>
                {typeof data.briefingPhoto === 'string' && (
                  <img src={data.briefingPhoto} alt="Briefing" className="w-full h-32 object-cover rounded-lg border border-gray-200 mb-2" />
                )}
                <input type="file" accept="image/*" capture="environment" onChange={e => update('briefingPhoto', e.target.files?.[0] || null)}
                  className="block w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-emerald-50 file:text-emerald-700" />
              </div>
              <div className="space-y-1">
                <Label className="text-emerald-800">Catatan Briefing <span className="text-red-400">*</span></Label>
                <Input placeholder="Catatan wajib diisi" value={data.briefingNote} onChange={e => update('briefingNote', e.target.value)} />
              </div>
            </CardContent>
          </Card>
        )}



        {/* STEP 10: Review & Score */}
        {step === 10 && (
          <Card className="border-emerald-100 shadow-sm">
            <CardHeader className="border-b border-gray-50 pb-3">
              <CardTitle className="flex items-center gap-2 text-amber-600"><Star className="h-5 w-5" /> Review &amp; Skor</CardTitle></CardHeader>
            <CardContent className="pt-4 space-y-4">
              {(() => {
                const s = calculateScore(data)
                return (
                  <>
                    <div className="text-center p-6 bg-emerald-50 rounded-xl border border-emerald-100">
                      <p className="text-5xl font-bold text-emerald-700">{s.total}</p>
                      <p className="text-sm text-gray-400 mt-1">dari 100</p>
                      {(() => {
                        const total = s.total
                        let grade = 'E'; let gradeColor = 'text-red-600'; let gradeBg = 'bg-red-50'; let gradeLabel = 'Sangat Kurang'
                        if (total >= 90) { grade = 'A'; gradeColor = 'text-emerald-600'; gradeBg = 'bg-emerald-50'; gradeLabel = 'Sangat Baik' }
                        else if (total >= 75) { grade = 'B'; gradeColor = 'text-teal-600'; gradeBg = 'bg-teal-50'; gradeLabel = 'Baik' }
                        else if (total >= 60) { grade = 'C'; gradeColor = 'text-amber-600'; gradeBg = 'bg-amber-50'; gradeLabel = 'Cukup' }
                        else if (total >= 45) { grade = 'D'; gradeColor = 'text-orange-600'; gradeBg = 'bg-orange-50'; gradeLabel = 'Kurang' }
                        return (
                          <div className={`mt-3 inline-block px-4 py-1 rounded-full text-sm font-bold ${gradeColor} ${gradeBg}`}>
                            Grade {grade} — {gradeLabel}
                          </div>
                        )
                      })()}
                    </div>
                    <div className="space-y-1.5">
                      {[
                        { label: 'Uang Kasir & Petty Cash', score: s.cash_check, max: 10 },
                        { label: 'Setoran (no pending)', score: s.deposit, max: 10 },
                        { label: 'Kondisi Toko', score: s.store_condition, max: 20 },
                        { label: 'Akurasi Stok 5 Item', score: s.stock_accuracy, max: 20 },
                        { label: 'Supervisi', score: s.supervision, max: 15 },
                        { label: 'Chat Response TikTok', score: s.chat_tiktok, max: 5 },
                        { label: 'Chat Response Shopee', score: s.chat_shopee, max: 5 },
                        { label: 'Pemisahan Stok Online/Offline', score: s.stock_separation, max: 15 },
                      ].map(item => (
                        <div key={item.label} className="flex items-center justify-between p-2.5 rounded-lg bg-gray-50 text-sm">
                          <span className="text-gray-600">{item.label}</span>
                          <span className="font-semibold text-gray-800">{item.score} / {item.max}</span>
                        </div>
                      ))}
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <Label className="text-emerald-800">Catatan Review</Label>
                      <Textarea placeholder="Catatan akhir supervisor sebelum submit..." value={data.reviewNotes}
                        onChange={e => update('reviewNotes', e.target.value)} />
                    </div>
                  </>
                )
              })()}
            </CardContent>
          </Card>
        )}

        {/* Navigation */}
        <div className="flex justify-between pt-4 pb-8">
          <Button variant="outline" onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}>
            <ArrowLeft className="h-4 w-4" /> Sebelumnya
          </Button>
          {isEditMode ? (
            <Button onClick={handleSubmit} disabled={submitting}
              className="bg-amber-600 hover:bg-amber-700 text-white">
              <Save className="h-4 w-4" /> {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
            </Button>
          ) : step < STEPS.length ? (
            <Button onClick={() => setStep(s => s + 1)} disabled={!canProceed()}
              className="bg-emerald-700 hover:bg-emerald-800">
              Selanjutnya <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting}
              className="bg-emerald-700 hover:bg-emerald-800">
              {submitting ? 'Menyimpan...' : <><Save className="h-4 w-4" /> Simpan &amp; Selesai</>}
            </Button>
          )}
        </div>
        </div>
      </main>
    </div>
  )
}
