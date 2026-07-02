import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, AlignmentType, WidthType, BorderStyle, VerticalAlignTable
} from 'docx'
import type {
  Visit, Store, Profile, CashCheck, DepositValidation, ChecklistItem,
  StockCheck, Supervision, Briefing, Feedback, ChatMarketplace, StockSeparation,
  VisitAttendance, CashDenomination
} from '@/types'
import { DENOMINATIONS } from '@/types'

interface ReportData {
  visit: Visit & { store: Store; supervisor: Profile }
  attendance: VisitAttendance | null
  cashCheck: CashCheck | null
  denominations: CashDenomination[]
  deposit: DepositValidation | null
  checklists: ChecklistItem[]
  stockChecks: StockCheck[]
  supervisions: Supervision[]
  briefing: Briefing | null
  feedback: Feedback | null
  chats: ChatMarketplace[]
  stockSep: StockSeparation | null
  manager: Profile | null
}

const LOGO_URL = 'https://iili.io/CzsxwUx.png'

const tableBorders = {
  top: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
  bottom: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
  left: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
  right: { style: BorderStyle.SINGLE, size: 1, color: '999999' },
}

async function imgBuffer(url: string, supabase?: any): Promise<Uint8Array> {
  try {
    const m = url.match(/\/storage\/v1\/object\/public\/([^\/]+)\/(.+)/)
    if (m && supabase) {
      const r = await supabase.storage.from(m[1]).download(m[2])
      if (r.error) throw r.error
      return new Uint8Array(await r.data.arrayBuffer())
    }
  } catch {}
  const r = await fetch(url)
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return new Uint8Array(await r.arrayBuffer())
}

function getImageType(url: string): 'png' | 'jpg' | 'gif' | 'bmp' {
  const ext = url.split('.').pop()?.toLowerCase().split('?')[0]
  if (ext === 'jpg' || ext === 'jpeg') return 'jpg'
  if (ext === 'gif') return 'gif'
  if (ext === 'bmp') return 'bmp'
  return 'png'
}

function borderCell(text: string, options?: { bold?: boolean; align?: AlignmentType; shading?: string; size?: number }) {
  return new TableCell({
    borders: tableBorders,
    shading: options?.shading ? { fill: options.shading } : undefined,
    children: [
      new Paragraph({
        alignment: options?.align || AlignmentType.LEFT,
        children: [new TextRun({ text, bold: options?.bold, size: options?.size || 20, font: 'Calibri' })],
      }),
    ],
  })
}

function headerRow(cells: string[]) {
  return new TableRow({ tableHeader: true, cantSplit: true, children: cells.map(c => borderCell(c, { bold: true, shading: 'D1D5DB', size: 20 })) })
}

function dataRow(cells: (string | number)[]) {
  return new TableRow({ cantSplit: true, children: cells.map(c => borderCell(String(c), { size: 20 })) })
}

function sectionTitle(text: string) {
  return new Paragraph({
    spacing: { before: 400, after: 200 },
    keepNext: true,
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '0F766E' } },
    children: [new TextRun({ text, bold: true, size: 26, font: 'Calibri', color: '0F766E' })],
  })
}

function bodyText(text: string, options?: { bold?: boolean; size?: number }) {
  return new Paragraph({
    spacing: { after: 80 },
    keepLines: true,
    children: [new TextRun({ text, size: options?.size || 22, font: 'Calibri', bold: options?.bold })],
  })
}

async function addPhoto(label: string, url: string | null | undefined, maxWidth = 400, maxHeight = 300, supabase?: any): Promise<Paragraph[]> {
  if (!url) return []
  try {
    const img = await imgBuffer(url, supabase)
    return [
      new Paragraph({ spacing: { before: 150 }, children: [new TextRun({ text: label, size: 20, font: 'Calibri', bold: true, color: '4B5563' })] }),
      new Paragraph({ children: [new ImageRun({ type: getImageType(url), data: img, transformation: { width: maxWidth, height: maxHeight } })] }),
    ]
  } catch (err) {
    console.error(`[Report] Gagal memuat foto: ${url}`, err)
    return [bodyText(`[Foto tidak dapat dimuat: ${url.substring(0, 60)}...]`)]
  }
}

export async function generateReport(data: ReportData, supabase?: any): Promise<Buffer> {
  const { visit, attendance, cashCheck, denominations, deposit, checklists, stockChecks, supervisions, briefing, chats, stockSep, manager } = data
  const sections: (Paragraph | Table)[] = []

  // ── KOP SURAT ──
  // Logo center + Judul center dalam tabel
  try {
    const logoBuf = await imgBuffer(LOGO_URL, supabase)
    const logoCell = new TableCell({
      width: { size: 30, type: WidthType.PERCENTAGE },
      verticalAlign: VerticalAlignTable.CENTER,
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new ImageRun({ type: 'png', data: logoBuf, transformation: { width: 100, height: 100 } })],
        }),
      ],
    })
    const titleCell = new TableCell({
      width: { size: 70, type: WidthType.PERCENTAGE },
      verticalAlign: VerticalAlignTable.CENTER,
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [new TextRun({ text: 'LAPORAN KUNJUNGAN TOKO', bold: true, size: 32, font: 'Calibri', color: '1F2937' })],
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { after: 60 },
          children: [new TextRun({ text: 'StorePulse — Aplikasi Supervisor Retail', size: 20, font: 'Calibri', color: '6B7280', italics: true })],
        }),
      ],
    })
    sections.push(new Table({
      rows: [new TableRow({ cantSplit: true, children: [logoCell, titleCell] })],
      width: { size: 100, type: WidthType.PERCENTAGE },
    }))
  } catch (err) {
    console.error(`[Report] Gagal memuat logo: ${LOGO_URL}`, err)
    // Logo gagal dimuat, tetap tampilkan judul
    sections.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 60 },
        children: [new TextRun({ text: 'LAPORAN KUNJUNGAN TOKO', bold: true, size: 32, font: 'Calibri', color: '1F2937' })],
      }),
    )
  }

  // ── GARIS PEMISAH ──
  sections.push(new Paragraph({
    spacing: { after: 200 },
    border: { bottom: { style: BorderStyle.DOUBLE, size: 6, color: '0F766E' } },
    children: [],
  }))

  // ── INFORMASI KUNJUNGAN ──
  sections.push(sectionTitle('A. Informasi Kunjungan'))
  sections.push(
    new Table({
      rows: [
        dataRow(['Nama Toko', visit.store?.name || '-']),
        dataRow(['Kode Toko', visit.store?.code || '-']),
        dataRow(['Alamat', visit.store?.address || '-']),
        dataRow(['Supervisor', visit.supervisor?.name || '-']),
        dataRow(['Tanggal Kunjungan', visit.visit_date]),
        dataRow(['Skor Total', `${visit.total_score ?? '-'} / 100`]),
        dataRow(['Status', visit.status === 'approved' ? 'Disetujui' : visit.status === 'submitted' ? 'Terkirim' : visit.status === 'revision' ? 'Revisi' : 'Draft']),
      ],
      width: { size: 100, type: WidthType.PERCENTAGE },
    })
  )
  if (visit.total_score !== null) {
    const total = visit.total_score
    let grade = 'E'; let gradeColor = 'EF4444'; let gradeLabel = 'Sangat Kurang'
    if (total >= 90) { grade = 'A'; gradeColor = '22C55E'; gradeLabel = 'Sangat Baik' }
    else if (total >= 75) { grade = 'B'; gradeColor = '0F766E'; gradeLabel = 'Baik' }
    else if (total >= 60) { grade = 'C'; gradeColor = 'F59E0B'; gradeLabel = 'Cukup' }
    else if (total >= 45) { grade = 'D'; gradeColor = 'F97316'; gradeLabel = 'Kurang' }
    sections.push(
      new Paragraph({ spacing: { before: 200 }, alignment: AlignmentType.CENTER, children: [new TextRun({ text: `Grade: ${grade} — ${gradeLabel}`, bold: true, size: 36, font: 'Calibri', color: gradeColor })] }),
    )
  }
  if (visit.manager_note) sections.push(bodyText(`Catatan Manager: ${visit.manager_note}`))
  if (visit.review_notes) sections.push(bodyText(`Catatan Review Supervisor: ${visit.review_notes}`))

  // ── ABSEN ──
  sections.push(sectionTitle('B. Absen Selfie & Verifikasi Lokasi'))
  if (attendance) {
    sections.push(bodyText(`Perangkat: ${attendance.device_type === 'mobile' ? 'HP/Tablet' : 'Laptop'}`))
    sections.push(bodyText(`📍 Lokasi SPV: ${attendance.latitude.toFixed(6)}, ${attendance.longitude.toFixed(6)}`))
    if (visit.store.latitude && visit.store.longitude) {
      const dist = Math.round(haversine(attendance.latitude, attendance.longitude, visit.store.latitude, visit.store.longitude))
      sections.push(bodyText(`📍 Lokasi Toko: ${visit.store.latitude.toFixed(6)}, ${visit.store.longitude.toFixed(6)}`))
      sections.push(bodyText(`📏 Jarak: ${dist} meter`))
      sections.push(bodyText(`🔗 Buka di Google Maps: https://maps.google.com/maps?q=${attendance.latitude},${attendance.longitude}`))
    }
    sections.push(bodyText(`Status Lokasi: ${attendance.is_location_match ? 'Sesuai dengan toko (≤80m)' : 'Tidak sesuai'}`))
    sections.push(...await addPhoto('Foto Selfie:', attendance.selfie_photo_url, 300, 250, supabase))
  } else {
    sections.push(bodyText('Data absensi tidak tersedia'))
  }

  // ── UANG MODAL & PETTY CASH ──
  sections.push(sectionTitle('C. Uang Modal & Petty Cash'))
  if (cashCheck) {
    sections.push(bodyText(`Modal Awal: Rp ${(cashCheck.initial_capital || 0).toLocaleString('id-ID')}`))
    sections.push(bodyText(`Saldo Petty Cash: Rp ${(cashCheck.petty_cash_balance || 0).toLocaleString('id-ID')}`))
    const totalModal = (cashCheck.initial_capital || 0) + (cashCheck.petty_cash_balance || 0)
    sections.push(bodyText(`Total Modal + Petty Cash: Rp ${totalModal.toLocaleString('id-ID')}`, { bold: true }))
    sections.push(bodyText(`Bon Klaim Belum Cair: ${cashCheck.has_pending_claim ? `Ya, Rp ${(cashCheck.pending_claim_amount || 0).toLocaleString('id-ID')}` : 'Tidak Ada'}`))

    if (denominations.length > 0) {
      sections.push(bodyText('Detail Pecahan Uang:', { bold: true }))
      sections.push(
        new Table({
          rows: [
            headerRow(['No', 'Pecahan', 'Jumlah', 'Total']),
            ...denominations.map((d, i) => dataRow([i + 1, `Rp ${d.denomination.toLocaleString('id-ID')}`, `${d.quantity} ${d.type === 'coin' ? 'koin' : 'lembar'}`, `Rp ${(d.denomination * d.quantity).toLocaleString('id-ID')}`])),
            dataRow(['', 'TOTAL', '', `Rp ${denominations.reduce((s, d) => s + d.denomination * d.quantity, 0).toLocaleString('id-ID')}`]),
          ],
          width: { size: 100, type: WidthType.PERCENTAGE },
        })
      )
      const denomTotal = denominations.reduce((s, d) => s + d.denomination * d.quantity, 0)
      const claimAmt = cashCheck.has_pending_claim ? (cashCheck.pending_claim_amount || 0) : 0
      const isMatch = (denomTotal + claimAmt) === totalModal
      if (totalModal > 0) {
        sections.push(bodyText(`Status: ${isMatch ? '✅ Sesuai — total pecahan + bon klaim sama dengan modal + petty cash' : '❌ Tidak sesuai — total pecahan + bon klaim berbeda dengan modal + petty cash'}`, { bold: true }))
      }
    }
    if (cashCheck.note) sections.push(bodyText(`Catatan: ${cashCheck.note}`))
  } else {
    sections.push(bodyText('Data tidak tersedia'))
  }

  // ── SETORAN ──
  sections.push(sectionTitle('D. Validasi Setoran'))
  if (deposit) {
    sections.push(bodyText(`Status: ${deposit.has_pending ? 'Ada Pending' : 'Clear / Tidak Ada Pending'}`))
    if (deposit.note) sections.push(bodyText(`Catatan: ${deposit.note}`))
    sections.push(...await addPhoto('Foto Form Setoran:', deposit.photo_url, 350, 250, supabase))
  } else {
    sections.push(bodyText('Data tidak tersedia'))
  }

  // ── CEKLIST KONDISI TOKO ──
  sections.push(sectionTitle('E. Ceklist Kondisi Toko'))
  if (checklists.length > 0) {
    const areaGroups: Record<string, typeof checklists> = { exterior: [], interior: [], butcher: [], storage: [] }
    for (const c of checklists) {
      const a = c.area || 'exterior'
      if (areaGroups[a]) areaGroups[a].push(c)
    }
    const areaLabels: Record<string, string> = { exterior: 'Area Luar', interior: 'Area Dalam Toko', butcher: 'Area Butcher', storage: 'Area Gudang, Office & Cold Storage' }

    for (const [area, items] of Object.entries(areaGroups)) {
      if (items.length === 0) continue
      sections.push(bodyText(`\n${areaLabels[area]}:`, { bold: true, size: 22 }))
      for (let i = 0; i < items.length; i++) {
        const c = items[i]
        sections.push(bodyText(`${i + 1}. ${c.item_name} — ${c.status === 'baik' ? 'Baik' : c.status === 'kurang' ? 'Kurang' : 'Buruk'}`, { size: 20 }))
        if (c.note) sections.push(bodyText(`   Catatan: ${c.note}`, { size: 20 }))
        if (c.photo_url) {
          sections.push(...await addPhoto(`   Foto:`, c.photo_url, 300, 200, supabase))
        }
      }
    }
    const baik = checklists.filter(c => c.status === 'baik').length
    sections.push(bodyText(`\nRingkasan: ${baik}/${checklists.length} item dalam kondisi baik`))
  } else {
    sections.push(bodyText('Data tidak tersedia'))
  }

  // ── CHAT MARKETPLACE ──
  sections.push(sectionTitle('F. Chat Response Marketplace'))
  if (chats.length > 0) {
    sections.push(
      new Table({
        rows: [
          headerRow(['No', 'Marketplace', 'Persentase', 'Skor']),
          ...chats.map((c, i) => {
            const pct = c.percentage ?? 0
            const skor = pct >= 80 ? '5/5' : pct >= 50 ? '2.5/5' : '0/5'
            return dataRow([i + 1, c.marketplace === 'tiktok' ? 'TikTok' : 'Shopee', `${pct}%`, skor])
          }),
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
      })
    )
    for (const c of chats) {
      sections.push(...await addPhoto(`Foto ${c.marketplace === 'tiktok' ? 'TikTok' : 'Shopee'}:`, c.photo_url, 350, 250, supabase))
    }
  } else {
    sections.push(bodyText('Data tidak tersedia'))
  }

  // ── PEMISAHAN STOK ──
  sections.push(sectionTitle('G. Pemisahan Stok Online & Offline'))
  if (stockSep) {
    const statusText = stockSep.status === 'sehat' ? 'Sehat' : stockSep.status === 'perhatian' ? 'Perhatian' : 'Kritis'
    sections.push(bodyText(`Status Stock Keeper: ${statusText}`))
    if (stockSep.imbalance_percentage !== null) {
      const ok = stockSep.imbalance_percentage < 10
      sections.push(bodyText(`Imbalance Stok: ${stockSep.imbalance_percentage}% — ${ok ? '✅ Poin 3 (≤10%)' : '❌ Poin 0 (>10%)'}`))
    }
    if (stockSep.oversold_items !== null) {
      const ok = stockSep.oversold_items < 5
      sections.push(bodyText(`Potensi Oversold: ${stockSep.oversold_items} item — ${ok ? '✅ Poin 3 (<5 item)' : '❌ Poin 0 (≥5 item)'}`))
    }
    if (stockSep.note) sections.push(bodyText(`Catatan: ${stockSep.note}`))
    sections.push(...await addPhoto('Foto Item Bermasalah:', stockSep.photo_items_url, 350, 250, supabase))
    sections.push(...await addPhoto('Foto Dashboard Stock Keeper:', stockSep.photo_dashboard_url, 350, 250, supabase))
  } else {
    sections.push(bodyText('Data tidak tersedia'))
  }

  // ── CEK STOK ──
  sections.push(sectionTitle('H. Random Cek 5 Item Fast Moving'))
  if (stockChecks.length > 0) {
    sections.push(
      new Table({
        rows: [
          headerRow(['No', 'Nama Item', 'Stok Sistem', 'Stok Fisik', 'Terjual Blm Faktur', 'Selisih', 'Status']),
          ...stockChecks.map((s, i) => {
            const diff = (s.physical_stock + s.sold_stock) - s.system_stock
            const sign = diff > 0 ? '+' : ''
            return dataRow([i + 1, s.item_name || '-', s.system_stock || 0, s.physical_stock || 0, s.sold_stock || 0, `${sign}${diff}`, s.is_match ? 'Cocok' : 'Tidak Cocok'])
          }),
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
      })
    )
    const match = stockChecks.filter(s => s.is_match).length
    sections.push(bodyText(`Akurasi: ${match}/${stockChecks.length} item cocok (${Math.round((match / stockChecks.length) * 100)}%)`))
  } else {
    sections.push(bodyText('Data tidak tersedia'))
  }

  // ── SUPERVISI ──
  sections.push(sectionTitle('I. Supervisi & Tindak Lanjut'))
  if (supervisions.length > 0) {
    sections.push(
      new Table({
        rows: [
          headerRow(['No', 'Item Checklist', 'Area', 'Deadline', 'Status']),
          ...supervisions.map((s, i) => {
            const areaLabel = s.area === 'exterior' ? 'Luar' : s.area === 'interior' ? 'Dalam' : s.area === 'butcher' ? 'Butcher' : 'Gudang'
            return dataRow([i + 1, s.checklist_item_name, areaLabel, s.deadline_date || '-', s.status === 'completed' ? 'Selesai' : 'Open'])
          }),
        ],
        width: { size: 100, type: WidthType.PERCENTAGE },
      })
    )
    for (const s of supervisions) {
      const cl = checklists.find(c => c.item_name === s.checklist_item_name && c.area === s.area)
      if (cl?.note) sections.push(bodyText(`Catatan SPV untuk "${s.checklist_item_name}": ${cl.note}`))
      if (cl?.photo_url) sections.push(...await addPhoto(`Foto ${s.checklist_item_name}:`, cl.photo_url, 300, 200, supabase))
    }
  } else {
    sections.push(bodyText('Tidak ada item supervisi'))
  }

  // ── BRIEFING ──
  sections.push(sectionTitle('J. Briefing Flow Kerja'))
  if (briefing) {
    if (briefing.note) sections.push(bodyText(`Catatan: ${briefing.note}`))
    sections.push(...await addPhoto('Foto Briefing:', briefing.photo_url, 350, 250, supabase))
  } else {
    sections.push(bodyText('Data tidak tersedia'))
  }

  // ── REKAPITULASI SKOR ──
  sections.push(sectionTitle('K. Rekapitulasi Skor'))
  const modal = (cashCheck?.initial_capital || 0) + (cashCheck?.petty_cash_balance || 0)
  const denomTotal = denominations.reduce((s, d) => s + d.denomination * d.quantity, 0)
  const claimAmt = cashCheck?.has_pending_claim ? (cashCheck.pending_claim_amount || 0) : 0
  const cashScore = modal > 0 && (denomTotal + claimAmt) === modal ? 10 : 0

  const burukItems = checklists.filter(c => c.status === 'buruk')
  const allDeadlinesSet = burukItems.every(item =>
    supervisions.some(s => s.checklist_item_name === item.item_name && s.area === item.area && s.deadline_date)
  )
  const supervisiScore = burukItems.length === 0 ? 15 : allDeadlinesSet ? 10 : 0

  const scoreItems = [
    { label: 'Uang Kasir & Petty Cash', skor: cashScore, max: 10 },
    { label: 'Setoran (No Pending)', skor: deposit?.has_pending === false ? 10 : 0, max: 10 },
    { label: 'Kondisi Toko', skor: Math.round((checklists.filter(c => c.status === 'baik').length / Math.max(checklists.length, 1)) * 20 * 10) / 10, max: 20 },
    { label: 'Akurasi Stok', skor: Math.round((stockChecks.filter(s => s.is_match).length / Math.max(stockChecks.length, 1)) * 20 * 10) / 10, max: 20 },
    { label: 'Supervisi', skor: supervisiScore, max: 15 },
    { label: 'Chat TikTok', skor: (chats.find(c => c.marketplace === 'tiktok')?.percentage ?? 0) >= 80 ? 5 : (chats.find(c => c.marketplace === 'tiktok')?.percentage ?? 0) >= 50 ? 2.5 : 0, max: 5 },
    { label: 'Chat Shopee', skor: (chats.find(c => c.marketplace === 'shopee')?.percentage ?? 0) >= 80 ? 5 : (chats.find(c => c.marketplace === 'shopee')?.percentage ?? 0) >= 50 ? 2.5 : 0, max: 5 },
    { label: 'Pemisahan Stok Online/Offline', skor: calcStockSepScore(stockSep), max: 15 },
  ]

  sections.push(
    new Table({
      rows: [
        headerRow(['No', 'Parameter', 'Skor', 'Maksimal']),
        ...scoreItems.map((s, i) => dataRow([i + 1, s.label, s.skor, s.max])),
        dataRow(['', 'TOTAL', visit.total_score ?? '-', '100']),
      ],
      width: { size: 100, type: WidthType.PERCENTAGE },
    })
  )

  // ── TANDA TANGAN ──
  sections.push(new Paragraph({ spacing: { before: 500 }, children: [] }))
  sections.push(new Paragraph({
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '0F766E' } },
    children: [],
  }))
  sections.push(sectionTitle('Tanda Tangan'))

  // Tanda tangan dalam tabel 2 kolom (Supervisor kiri, Manager kanan)
  let supSigParagraphs: Paragraph[] = [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80 }, children: [new TextRun({ text: visit.supervisor?.name || '-', bold: true, size: 22, font: 'Calibri' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'Supervisor', size: 20, font: 'Calibri', color: '6B7280', italics: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80 }, children: [new TextRun({ text: '(Tanda tangan tidak tersedia)', size: 20, font: 'Calibri', color: '9CA3AF', italics: true })] }),
  ]
  let mgrSigParagraphs: Paragraph[] = visit.status === 'approved' ? [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80 }, children: [new TextRun({ text: manager?.name || '-', bold: true, size: 22, font: 'Calibri' })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'Manager', size: 20, font: 'Calibri', color: '6B7280', italics: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80 }, children: [new TextRun({ text: '(Tanda tangan tidak tersedia)', size: 20, font: 'Calibri', color: '9CA3AF', italics: true })] }),
  ] : [
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80 }, children: [new TextRun({ text: '—', size: 22, font: 'Calibri', color: '9CA3AF', italics: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'Manager', size: 20, font: 'Calibri', color: '6B7280', italics: true })] }),
    new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80 }, children: [new TextRun({ text: '(Menunggu persetujuan)', size: 20, font: 'Calibri', color: '9CA3AF', italics: true })] }),
  ]

  if (visit.supervisor?.signature) {
    const supImg = await imgBuffer(visit.supervisor.signature, supabase)
    supSigParagraphs = [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80 }, children: [new TextRun({ text: visit.supervisor.name, bold: true, size: 22, font: 'Calibri' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'Supervisor', size: 20, font: 'Calibri', color: '6B7280', italics: true })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: getImageType(visit.supervisor.signature), data: supImg, transformation: { width: 200, height: 80 } })] }),
    ]
  }
  if (visit.status === 'approved' && manager?.signature) {
    const mgrImg = await imgBuffer(manager.signature, supabase)
    mgrSigParagraphs = [
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80 }, children: [new TextRun({ text: manager.name, bold: true, size: 22, font: 'Calibri' })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: 'Manager', size: 20, font: 'Calibri', color: '6B7280', italics: true })] }),
      new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: getImageType(manager.signature), data: mgrImg, transformation: { width: 200, height: 80 } })] }),
    ]
  }

  sections.push(
    new Table({
      rows: [
        new TableRow({ cantSplit: true,
          children: [
            new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlignTable.CENTER, children: supSigParagraphs }),
            new TableCell({ width: { size: 50, type: WidthType.PERCENTAGE }, verticalAlign: VerticalAlignTable.CENTER, children: mgrSigParagraphs }),
          ],
        }),
      ],
      width: { size: 100, type: WidthType.PERCENTAGE },
    })
  )

  // ── FOOTER ──
  sections.push(new Paragraph({ spacing: { before: 400 }, children: [] }))
  sections.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: 'CCCCCC' } },
    spacing: { before: 200 },
    children: [new TextRun({ text: `Dicetak pada: ${new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`, size: 18, font: 'Calibri', color: '9CA3AF' })],
  }))
  sections.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'StorePulse — Aplikasi Supervisor Retail — PT Hijrah Food Indonesia', size: 18, font: 'Calibri', color: '9CA3AF' })],
  }))

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{ children: sections }],
  })

  return Buffer.from(await Packer.toBuffer(doc))
}

function calcStockSepScore(s: StockSeparation | null): number {
  if (!s) return 0
  const statusScore = s.status === 'sehat' ? 6 : s.status === 'perhatian' ? 3 : 0
  const imbalanceScore = (s.imbalance_percentage !== null && s.imbalance_percentage < 10) ? 5 : 0
  const oversoldScore = (s.oversold_items !== null && s.oversold_items < 5) ? 4 : 0
  return statusScore + imbalanceScore + oversoldScore
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}
