import { Suspense, type JSX } from "solid-js"

import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import { LoadingOverlay } from "@/components/LoadingOverlay"

export default function MainLayout(props: { children?: JSX.Element }) {
  return (
    <div class="min-h-screen flex flex-col">
      <Navbar />
      <Suspense fallback={<LoadingOverlay />}>
        <main class="flex-1">
          {props.children}
        </main>
        <Footer />
      </Suspense>
    </div>
  )
}
