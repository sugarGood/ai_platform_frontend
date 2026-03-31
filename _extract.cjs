const fs = require('fs');
const src = fs.readFileSync('C:/Users/76741/Desktop/新建文件夹/原型/assets/js/templates/platform-pages.js', 'utf8');
const startMarker = '"page-skills":  "';
const idx = src.indexOf(startMarker);
if (idx < 0) { console.log('NOT FOUND'); process.exit(1); }
let pos = idx + startMarker.length;
let depth = 0;
let result = '';
while (pos < src.length) {
  const ch = src[pos];
  if (ch === '\\') {
    result += src[pos] + src[pos + 1];
    pos += 2;
    continue;
  }
  if (ch === '"') break;
  result += ch;
  pos++;
}
const html = JSON.parse('"' + result + '"');
fs.writeFileSync('C:/Users/76741/Desktop/_skills_page.html', html, 'utf8');
console.log('wrote', html.length, 'chars');
