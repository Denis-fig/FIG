// font-scan.js — нативный поиск и чтение системных шрифтов (main-процесс Electron)
// Работает на macOS и Windows. Возвращает список семейств и байты файла для встраивания.
const fs = require('fs');
const path = require('path');
const os = require('os');
let fontkit = null;
try { fontkit = require('fontkit'); } catch (e) { /* подхватится из node_modules */ }

function fontDirs() {
  const home = os.homedir();
  if (process.platform === 'darwin') {
    return ['/System/Library/Fonts', '/System/Library/Fonts/Supplemental', '/Library/Fonts', path.join(home, 'Library/Fonts')];
  }
  if (process.platform === 'win32') {
    const dirs = ['C:\\Windows\\Fonts'];
    if (process.env.LOCALAPPDATA) dirs.push(path.join(process.env.LOCALAPPDATA, 'Microsoft\\Windows\\Fonts'));
    return dirs;
  }
  // linux (для тестов)
  return ['/usr/share/fonts', path.join(home, '.fonts'), path.join(home, '.local/share/fonts')];
}

const EXT = new Set(['.ttf', '.otf', '.ttc', '.otc']);

function walk(dir, out, depth) {
  if (depth > 6) return;
  let items = [];
  try { items = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return; }
  for (const it of items) {
    const full = path.join(dir, it.name);
    try {
      if (it.isDirectory()) walk(full, out, depth + 1);
      else if (EXT.has(path.extname(it.name).toLowerCase())) out.push(full);
    } catch (e) {}
  }
}

// family -> { regular: {file, index}, any: {file, index} }
let INDEX = null;
let CACHE_DIR = os.tmpdir();
function setCacheDir(d) { if (d) CACHE_DIR = d; }
function cacheFile() { return path.join(CACHE_DIR, 'mf-fonts-cache.json'); }
function dirsSignature() {
  // подпись = список (путь:mtime) по каталогам шрифтов, чтобы ловить изменения
  const sig = [];
  fontDirs().forEach(d => { try { const st = fs.statSync(d); sig.push(d + ':' + Math.floor(st.mtimeMs)); } catch (e) { sig.push(d + ':0'); } });
  return sig.join('|');
}
function loadCache() {
  try {
    const raw = JSON.parse(fs.readFileSync(cacheFile(), 'utf8'));
    if (raw && raw.sig === dirsSignature() && raw.map) { INDEX = raw.map; return true; }
  } catch (e) {}
  return false;
}
function saveCache() {
  try { fs.writeFileSync(cacheFile(), JSON.stringify({ sig: dirsSignature(), builtAt: Date.now(), map: INDEX })); } catch (e) {}
}

function pickName(font) {
  // предпочитаем "preferred/typographic family" (name ID 16), иначе family (ID 1)
  try {
    const n = font.name && font.name.records;
    if (n) {
      const pref = n.preferredFamily || n.typographicFamily;
      if (pref) return firstStr(pref);
    }
  } catch (e) {}
  return font.familyName || null;
}
function firstStr(rec) {
  if (typeof rec === 'string') return rec;
  if (rec && typeof rec === 'object') { return rec.en || rec['en-US'] || Object.values(rec)[0] || null; }
  return null;
}
function isRegular(font) {
  const sub = (font.subfamilyName || '').toLowerCase();
  const bold = !!(font['OS/2'] && (font['OS/2'].fsSelection & 0x20));
  const italic = !!(font['OS/2'] && (font['OS/2'].fsSelection & 0x01));
  return (!bold && !italic) || sub === 'regular' || sub === 'book' || sub === '';
}

function addFont(file, idx, font, map) {
  const fam = pickName(font);
  if (!fam) return;
  const key = fam.trim();
  if (!map[key]) map[key] = { family: key, regular: null, any: { file, index: idx } };
  if (!map[key].regular && isRegular(font)) map[key].regular = { file, index: idx };
}

function buildIndex() {
  if (!fontkit) { try { fontkit = require('fontkit'); } catch (e) { return {}; } }
  const files = [];
  fontDirs().forEach(d => walk(d, files, 0));
  const map = {};
  for (const file of files) {
    try {
      const f = fontkit.openSync(file);
      if (f && f.fonts && Array.isArray(f.fonts)) {
        // коллекция (.ttc/.otc)
        f.fonts.forEach((sub, i) => { try { addFont(file, i, sub, map); } catch (e) {} });
      } else if (f) {
        addFont(file, -1, f, map);
      }
    } catch (e) {}
  }
  INDEX = map;
  saveCache();
  return map;
}
function ensureIndex() { if (INDEX) return; if (!loadCache()) buildIndex(); }

function listFamilies() {
  ensureIndex();
  return Object.keys(INDEX).sort((a, b) => a.localeCompare(b));
}

// Вернуть base64 data: URL файла шрифта для семейства (regular, иначе любой)
function getFontData(family) {
  if (!INDEX) buildIndex();
  ensureIndex();const e = INDEX[family];
  if (!e) return null;
  const pick = e.regular || e.any;
  if (!pick) return null;
  try {
    const buf = fs.readFileSync(pick.file);
    const ext = path.extname(pick.file).toLowerCase();
    const mime = (ext === '.otf' || ext === '.otc') ? 'font/otf' : 'font/ttf';
    // .ttc/.otc: встраиваем весь файл; FontFace в Chromium (Electron) грузит коллекции
    return 'data:' + mime + ';base64,' + buf.toString('base64');
  } catch (e) { return null; }
}

module.exports = { listFamilies, getFontData, buildIndex, fontDirs, setCacheDir, ensureIndex };

// Самотест: node font-scan.js
if (require.main === module) {
  const t0 = Date.now();
  const fams = listFamilies();
  console.log('dirs:', fontDirs());
  console.log('families:', fams.length, 'in', (Date.now() - t0) + 'ms');
  console.log('sample:', fams.slice(0, 12));
  if (fams.length) {
    const d = getFontData(fams[0]);
    console.log('getFontData(' + fams[0] + ') len:', d ? d.length : null);
  }
}
