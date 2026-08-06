// Mesmo padrao ja usado em ProductsPage (handlePriceChange):
// usuario digita so os digitos, os 2 ultimos viram centavos automaticamente.
export function maskCentsInput(rawValue: string): string {
  const digitsOnly = rawValue.replace(/\D/g, "")
  return (parseInt(digitsOnly || "0", 10) / 100).toFixed(2)
}
