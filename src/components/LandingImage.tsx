import { createSignal, onCleanup, onMount } from 'solid-js'

// A local transparent pixel preserves the img element while the original
// photo stays off the network. Unlike native lazy loading, nearby offscreen
// photos cannot compete with the high-priority hero on a mobile connection.
const PLACEHOLDER = 'data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs='

export function LandingImage(props: { src: string; alt: string; class: string }) {
  let image!: HTMLImageElement
  let observer: IntersectionObserver | undefined
  const [visible, setVisible] = createSignal(false)
  onMount(() => {
    if (!('IntersectionObserver' in window)) { setVisible(true); return }
    observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return
      setVisible(true)
      observer?.disconnect()
    })
    observer.observe(image)
  })
  onCleanup(() => observer?.disconnect())
  return <img ref={image} src={visible() ? props.src : PLACEHOLDER} data-landing-src={props.src} alt={props.alt} class={props.class} decoding="async" />
}
