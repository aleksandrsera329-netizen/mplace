export function formatMoney(cents: number, currency = "RUB") {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format((cents || 0) / 100)
}

export function formatDate(value?: string | Date | null) {
  if (!value) return "—"
  const d = typeof value === "string" ? new Date(value) : value
  if (Number.isNaN(d.getTime())) return "—"
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d)
}

export function statusLabel(status: string) {
  const map: Record<string, string> = {
    PENDING_PAYMENT: "Ожидает оплаты",
    PAID: "Оплачен",
    PROCESSING: "В обработке",
    SHIPPED: "Отправлен",
    DELIVERED: "Доставлен",
    CANCELLED: "Отменён",
    REFUNDED: "Возврат",
    OPEN: "Открыт",
    MATCHED: "Подобран",
    AWARDED: "Выбран",
    CLOSED: "Закрыт",
    EXPIRED: "Истёк",
    DRAFT: "Черновик",
  }
  return map[status] || status
}
