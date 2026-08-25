export function replaceProperty<T extends object, K extends keyof T>(
  target: T,
  key: K,
  replacement: T[K],
): () => void {
  const descriptor = Object.getOwnPropertyDescriptor(target, key)

  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: descriptor?.enumerable ?? true,
    writable: true,
    value: replacement,
  })

  return () => {
    if (descriptor) {
      Object.defineProperty(target, key, descriptor)
    } else {
      Reflect.deleteProperty(target, key)
    }
  }
}
