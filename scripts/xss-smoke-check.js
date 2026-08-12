/**
 * Stage 21 smoke check — escapeHtml / escapeAttr
 * Run: node scripts/xss-smoke-check.js
 */
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/`/g, '&#96;');
}

const payload = '<img src=x onerror="alert(1)">';
const out = escapeHtml(payload);
const expected = '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;';

if (out !== expected) {
  console.error('FAIL escapeHtml', { out, expected });
  process.exit(1);
}
if (escapeHtml(null) !== '') {
  console.error('FAIL null');
  process.exit(1);
}
if (escapeAttr('a`b"c').includes('`')) {
  console.error('FAIL escapeAttr backticks');
  process.exit(1);
}

console.log('xss-smoke-check: ok');
