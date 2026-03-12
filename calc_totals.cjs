const fs = require('fs');
const data = fs.readFileSync('d:/asset-audit-pro/senarai aset.csv', 'utf8');
const lines = data.split('\n').slice(1).filter(l => l.trim());

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQ = !inQ; }
    else if (ch === ',' && !inQ) { result.push(current.trim()); current = ''; }
    else { current += ch; }
  }
  result.push(current.trim());
  return result;
}

const counts = {};
for (const line of lines) {
  const parts = parseCSVLine(line);
  const bahagian = (parts[3] || '').trim();
  if (bahagian) counts[bahagian] = (counts[bahagian] || 0) + 1;
}

const mapping = {
  'JABATAN KEJURUTERAAN AWAM': ['JABATAN KEJURUTERAAN AWAM'],
  'JABATAN KEJURUTERAAN MEKANIKAL': ['JABATAN KEJURUTERAAN MEKANIKAL'],
  'JABATAN KEJURUTERAAN PETROKIMIA': ['JABATAN KEJURUTERAAN PETROKIMIA'],
  'JABATAN KEJURUTERAAN ELEKTRIK': ['JABATAN KEJURUTERAAN ELEKTRIK'],
  'JABATAN TEKNOLOGI MAKLUMAT & KOMUNIKASI': ['JABATAN TEKNOLOGI MAKLUMAT & KOMUNIKASI'],
  'JABATAN PERDAGANGAN': ['JABATAN PERDAGANGAN'],
  'JABATAN MATEMATIK, SAINS & KOMPUTER': ['JABATAN MATEMATIK, SAINS & KOMPUTER'],
  'JABATAN PENGAJIAN AM': ['JABATAN PENGAJIAN AM'],
  'JABATAN HAL EHWAL PELAJAR': ['JABATAN HAL EHWAL PELAJAR'],
  'JABATAN SUKAN KO-KURIKULUM DAN KEBUDAYAAN': ['JABATAN SUKAN & KOKURIKULUM'],
  'UNIT KHIDMAT PENGURUSAN': ['PEJABAT PENGARAH','PEJABAT TIMBALAN PENGARAH AKADEMIK','PEJABAT TIMBALAN PENGARAH SOKONGAN AKADEMIK','UNIT PENTADBIRAN','UNIT PEROLEHAN DAN BEKALAN','UNIT PERAKAUNAN DAN BAYARAN'],
  'UNIT JAMINAN KUALITI': ['UNIT PENGURUSAN KUALITI'],
  'UNIT PENGURUSAN PSIKOLOGI': ['UNIT PSIKOLOGI & KERJAYA'],
  'UNIT LATIHAN DAN PENDIDIKAN LANJUTAN': ['UNIT LATIHAN & PENDIDIKAN LANJUTAN'],
  'CISEC': ['UNIT CISEC'],
  'UNIT PERHUBUNGAN DAN LATIHAN INDUSTRI': ['UNIT PERHUBUNGAN & LATIHAN INDUSTRI'],
  'UNIT PEMBANGUNAN INSTRUKSIONAL DAN MULTIMEDIA': ['UNIT PEMBANGUNAN INSTRUKSIONAL & MULTIMEDIA'],
  'UNIT PEPERIKSAAN': ['UNIT PEPERIKSAAN'],
  'UNIT PERPUSTAKAAN': ['UNIT PERPUSTAKAAN'],
  'UNIT PENGURUSAN KOLEJ KEDIAMAN': ['UNIT KAMSIS'],
  'UNIT PEMBANGUNAN DAN SENGGARAAN': ['UNIT PEMBANGUNAN & SENGGARAAN'],
  'UNIT TEKNOLOGI MAKLUMAT & KOMUNIKASI': ['UNIT TEKNOLOGI MAKLUMAT & KOMUNIKASI'],
  'UNIT PENGURUSAN ASET': ['UNIT PENGURUSAN ASET'],
};

let grand = 0;
const rows = [];
for (const [sppa, bahagians] of Object.entries(mapping)) {
  let total = 0;
  const parts = [];
  for (const b of bahagians) {
    const c = counts[b] || 0;
    total += c;
    if (bahagians.length > 1) parts.push(b + '(' + c + ')');
  }
  grand += total;
  rows.push({sppa, total, parts: parts.join(' + ')});
}
rows.sort((a,b) => b.total - a.total);
console.log('SPPA Department | Total Assets | Breakdown (if merged)');
console.log('---');
for (const r of rows) {
  console.log(String(r.total).padStart(6), '|', r.sppa, r.parts ? '= ' + r.parts : '');
}
console.log('\nGRAND TOTAL:', grand);
console.log('Missing from app total (17091):', grand - 17091);

// Generate SQL UPDATE statements
console.log('\n\n-- SQL to update department total_assets:');
for (const r of rows) {
  if (r.total > 0) {
    console.log(`UPDATE departments SET total_assets = ${r.total} WHERE name ILIKE '${r.sppa.trim()}';`);
  }
}
