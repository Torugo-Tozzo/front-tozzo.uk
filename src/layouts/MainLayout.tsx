import { Suspense, type JSX } from "solid-js"

import { Navbar } from "@/components/Navbar"
import { Footer } from "@/components/Footer"
import { LoadingOverlay } from "@/components/LoadingOverlay"

export default function MainLayout(props: { children?: JSX.Element }) {
  return (
    <div class="min-h-screen flex flex-col">
      <Navbar />
      <main class="flex-1">
        <Suspense fallback={<LoadingOverlay />}>
          {props.children}
        </Suspense>
      </main>
      <Footer />
    </div>
  )
}
