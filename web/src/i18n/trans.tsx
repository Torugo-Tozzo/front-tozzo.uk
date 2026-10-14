import { For, type JSX } from "solid-js"

export interface TransPart {
  text: string
  tag?: string
}

/** Splits "a <link>b</link> c" into text and tagged parts (no nesting). */
export function splitTags(text: string): TransPart[] {
  const parts: TransPart[] = []
  const pattern = /<(\w+)>(.*?)<\/\1>/g
  let last = 0
  for (const match of text.matchAll(pattern)) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index) })
    parts.push({ tag: match[1], text: match[2] })
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last) })
  return parts
}

/**
 * The react-i18next <Trans> for a translated string with tags: each tag becomes
 * the element its component returns, and the text stays text (no innerHTML).
 */
export function Trans(props: { text: string; components: Record<string, (children: string) => JSX.Element> }) {
  return (
    <For each={splitTags(props.text)}>
      {(part) => {
        const render = part.tag ? props.components[part.tag] : undefined
        return render ? render(part.text) : part.text
      }}
    </For>
  )
}
