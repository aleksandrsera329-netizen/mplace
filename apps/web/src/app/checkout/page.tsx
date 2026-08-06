import Link from "next/link"
import { Header } from "@/components/header"
import { Button } from "@/components/ui/button"

export default function CheckoutPage() {
  return (
    <div className="min-h-screen">
      <Header />
      <div className="mx-auto max-w-2xl px-4 py-20 text-center">
        <h1 className="mb-4 text-3xl font-bold">Оформление заказа</h1>
        <p className="mb-8 text-muted-foreground">
          Страница checkout / RFQ будет реализована в следующем шаге.
        </p>
        <Button asChild>
          <Link href="/cart">Вернуться в корзину</Link>
        </Button>
      </div>
    </div>
  )
}
