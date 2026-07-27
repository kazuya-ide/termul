/** LIT App Hub: 台帳のMarkdown本文(`## 概要`等の見出し)から表示用テキストを取り出す。 */

/** 指定した見出し(例: "概要")の本文だけを取り出す。無ければnull。 */
export function extractSection(body: string, heading: string): string | null {
  const match = body.match(
    new RegExp(`^##\\s+${heading}\\s*$([\\s\\S]*?)(?=^##\\s+|$(?![\\s\\S]))`, 'm')
  )
  if (!match) return null
  const text = match[1].trim()
  return text.length > 0 ? text : null
}

/** カード表示用の短い概要。「## 概要」が無ければ本文の先頭の段落を使う。 */
export function extractOverviewExcerpt(body: string, maxLength = 80): string {
  const overview = extractSection(body, '概要') ?? body.split(/\n\s*\n/)[0]?.trim() ?? ''
  const singleLine = overview.replace(/\s+/g, ' ').trim()
  return singleLine.length > maxLength ? `${singleLine.slice(0, maxLength)}…` : singleLine
}
