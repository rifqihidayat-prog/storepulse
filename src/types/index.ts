export interface Profile {
  id: string
  name: string
  role: 'supervisor' | 'manager' | 'staff'
  signature?: string | null
  created_at: string
}

export interface StoreStaff {
  id: string
  store_id: string
  profile_id: string
  created_at: string
}

export interface Store {
  id: string
  name: string
  code: string
  address: string | null
  latitude: number | null
  longitude: number | null
  created_at: string
}

export type VisitStatus = 'draft' | 'submitted' | 'approved' | 'revision'

export interface Visit {
  id: string
  store_id: string
  store?: Store
  supervisor_id: string
  supervisor?: Profile
  visit_date: string
  status: VisitStatus
  manager_id: string | null
  manager_note: string | null
  total_score: number | null
  review_notes: string | null
  created_at: string
  updated_at: string
}

export interface VisitAttendance {
  id: string
  visit_id: string
  selfie_photo_url: string
  latitude: number
  longitude: number
  device_type: 'mobile' | 'desktop'
  is_location_match: boolean | null
  created_at: string
}

export interface CashCheck {
  id: string
  visit_id: string
  cashier_amount: number | null
  petty_cash_amount: number | null
  cashier_is_match: boolean | null
  petty_cash_is_match: boolean | null
  initial_capital: number | null
  petty_cash_balance: number | null
  note: string | null
  has_pending_claim: boolean | null
  pending_claim_amount: number | null
}

export interface CashDenomination {
  id: string
  visit_id: string
  denomination: number
  quantity: number
  type: 'coin' | 'bill'
}

export interface DepositValidation {
  id: string
  visit_id: string
  has_pending: boolean | null
  photo_url: string | null
  note: string | null
}

export interface ChecklistItem {
  id: string
  visit_id: string
  item_name: string
  status: 'baik' | 'kurang' | 'buruk'
  note: string | null
  photo_url: string | null
  area: string | null
}

export interface StockCheck {
  id: string
  visit_id: string
  item_name: string
  system_stock: number
  physical_stock: number
  sold_stock: number
  is_match: boolean
}

export interface Supervision {
  id: string
  visit_id: string
  checklist_item_name: string
  area: string
  deadline_date: string | null
  status: 'open' | 'completed'
  completed_at: string | null
  note: string | null
  evidence_photo_url: string | null
  evidence_photos: string | null
  completed_note: string | null
}

export interface Briefing {
  id: string
  visit_id: string
  photo_url: string | null
  note: string | null
}

export interface Feedback {
  id: string
  visit_id: string
  photo_url: string | null
  feedback_text: string | null
}

export interface ChatMarketplace {
  id: string
  visit_id: string
  marketplace: 'tiktok' | 'shopee'
  percentage: number | null
  photo_url: string | null
}

export interface StockSeparation {
  id: string
  visit_id: string
  status: 'sehat' | 'perhatian' | 'kritis' | null
  imbalance_percentage: number | null
  oversold_items: number | null
  photo_url: string | null
  photo_items_url: string | null
  photo_dashboard_url: string | null
  note: string | null
}

export interface ScoreBreakdown {
  cash_check: number
  deposit: number
  store_condition: number
  stock_accuracy: number
  supervision: number
  chat_tiktok: number
  chat_shopee: number
  stock_separation: number
  total: number
}

export const DENOMINATIONS = [
  { value: 100, label: 'Rp 100', type: 'coin' },
  { value: 200, label: 'Rp 200', type: 'coin' },
  { value: 500, label: 'Rp 500', type: 'coin' },
  { value: 1000, label: 'Rp 1.000', type: 'coin' },
  { value: 2000, label: 'Rp 2.000', type: 'bill' },
  { value: 5000, label: 'Rp 5.000', type: 'bill' },
  { value: 10000, label: 'Rp 10.000', type: 'bill' },
  { value: 20000, label: 'Rp 20.000', type: 'bill' },
  { value: 50000, label: 'Rp 50.000', type: 'bill' },
  { value: 100000, label: 'Rp 100.000', type: 'bill' },
]

export interface ChecklistItemDef {
  name: string
  area: 'exterior' | 'interior' | 'butcher' | 'storage'
}

export const CHECKLIST_ITEMS: ChecklistItemDef[] = [
  // ── Area Luar ──
  { name: 'Area parkir bersih, bebas puntung rokok dan kotoran, serta dalam kondisi baik', area: 'exterior' },
  { name: 'Teras toko bersih, bebas sampah, dan dalam kondisi baik', area: 'exterior' },
  { name: 'Pintu kaca dan area kaca bersih, bebas bercak dan noda', area: 'exterior' },
  { name: 'Bebas sarang laba-laba', area: 'exterior' },
  { name: 'Tempat sampah bersih dan tidak penuh', area: 'exterior' },
  { name: 'Lampu area luar dalam kondisi menyala', area: 'exterior' },
  { name: 'Keset teras toko bersih dan tidak rusak', area: 'exterior' },

  // ── Area Dalam Toko ──
  { name: 'Tata letak produk dan display penuh/tersusun rapi', area: 'interior' },
  { name: 'Lantai area toko bersih, bebas sampah, dan dalam kondisi baik', area: 'interior' },
  { name: 'Area kasir rapi dan bersih', area: 'interior' },
  { name: 'Bebas sarang laba-laba', area: 'interior' },
  { name: 'Price tag tercetak lengkap dan mutakhir (update)', area: 'interior' },
  { name: 'Keranjang belanja bersih dan tidak rusak', area: 'interior' },
  { name: 'POP/promo terpasang dan dalam kondisi baik', area: 'interior' },
  { name: 'Tempat sampah bersih dan tidak penuh', area: 'interior' },
  { name: 'Form monitoring suhu tersedia dan terisi', area: 'interior' },
  { name: 'Seragam karyawan sesuai SOP dan dilengkapi ID card', area: 'interior' },
  { name: 'Rak promo ter-update', area: 'interior' },
  { name: 'Suhu ruangan dalam kondisi dingin sesuai standar', area: 'interior' },
  { name: 'Lampu area sales dalam kondisi menyala', area: 'interior' },
  { name: 'Speaker toko berfungsi dan tidak rusak', area: 'interior' },
  { name: 'Televisi promo terupdate dan berfungsi', area: 'interior' },
  { name: 'AC berfungsi dan tidak rusak', area: 'interior' },
  { name: 'Freezer dan chiller bersih dan tidak rusak', area: 'interior' },
  { name: 'Form ceklis kebersihan harian terisi', area: 'interior' },

  // ── Area Butcher ──
  { name: 'Grease trap bersih, bebas lemak', area: 'butcher' },
  { name: 'Lantai area butcher bersih', area: 'butcher' },
  { name: 'Form administrasi fresh terisi lengkap dan mutakhir', area: 'butcher' },
  { name: 'Area display bersih', area: 'butcher' },
  { name: 'Mesin giling bersih dan berfungsi', area: 'butcher' },
  { name: 'Peralatan dalam kondisi bersih dan tidak rusak', area: 'butcher' },

  // ── Area Gudang, Office & Cold Storage ──
  { name: 'Meja persiapan online rapi dan bersih', area: 'storage' },
  { name: 'Meja office rapi dan bersih', area: 'storage' },
  { name: 'Peralatan karyawan tersimpan di tempatnya', area: 'storage' },
  { name: 'Lantai area office rapi dan bersih', area: 'storage' },
  { name: 'Display stok dry rapi sesuai kategori', area: 'storage' },
  { name: 'Chest freezer bebas bunga es', area: 'storage' },
  { name: 'Cold storage memiliki layout yang jelas', area: 'storage' },
  { name: 'Cold storage bebas bunga es', area: 'storage' },
  { name: 'Cold storage penataan rapi dan bersih', area: 'storage' },
  { name: 'Peralatan kebersihan tersimpan di tempatnya', area: 'storage' },
  { name: 'Seluruh area toilet bersih dan lengkap dengan handsoap dan tempat sampah', area: 'storage' },
]

export const SCORE_WEIGHTS = {
  CASH_CHECK: 10,
  DEPOSIT: 10,
  STORE_CONDITION: 20,
  STOCK_ACCURACY: 20,
  SUPERVISION: 15,
  CHAT_TIKTOK: 5,
  CHAT_SHOPEE: 5,
  STOCK_SEPARATION: 15,
} as const
