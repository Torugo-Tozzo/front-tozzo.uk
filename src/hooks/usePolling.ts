import { useEffect, useRef } from 'react'

/**
 * Executa `fn` em um intervalo enquanto a aba está visível.
 * Pausa quando a aba fica oculta e retoma (com poll imediato) ao voltar.
 * Usa `fnRef` para sempre chamar a versão mais recente de `fn` sem reiniciar o intervalo.
 */
export function usePolling(fn: () => Promise<void> | void, interval: number, enabled = true) {
  const fnRef = useRef(fn)
  fnRef.current = fn

  useEffect(() => {
    if (!enabled) return

    let intervalId: ReturnType<typeof setInterval> | null = null
    let isRunning = false

    const run = async () => {
      if (isRunning || document.hidden) return
      isRunning = true
      try {
        await fnRef.current()
      } finally {
        isRunning = false
      }
    }

    const start = () => {
      if (intervalId) return
      run()
      intervalId = setInterval(run, interval)
    }

    const stop = () => {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
      }
    }

    const handleVisibility = () => {
      if (document.hidden) stop()
      else start()
    }

    if (!document.hidden) start()

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleVisibility)
    window.addEventListener('blur', handleVisibility)

    return () => {
      stop()
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleVisibility)
      window.removeEventListener('blur', handleVisibility)
    }
  }, [interval, enabled])
}
