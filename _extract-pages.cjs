const fs = require('fs')
const src = fs.readFileSync('C:/Users/76741/Desktop/新建文件夹/原型/assets/js/templates/platform-pages.js', 'utf8')
function extract(key) {
  const startMarker = `"${key}":  "`
  const idx = src.indexOf(startMarker)
  if (idx < 0) throw new Error('not found ' + key)
  let pos = idx + startMarker.length
  let result = ''
  while (pos < src.length) {
    const ch = src[pos]
    if (ch === '\\') {
      result += src[pos] + src[pos + 1]
      pos += 2
      continue
    }
    if (ch === '"') break
    result += ch
    pos++
  }
  return JSON.parse('"' + result + '"')
}
for (const k of ['page-atomic', 'page-templates']) {
  const html = extract(k)
  fs.writeFileSync(`C:/Users/76741/Desktop/_${k}.html`, html, 'utf8')
  console.log(k, html.length)
}
