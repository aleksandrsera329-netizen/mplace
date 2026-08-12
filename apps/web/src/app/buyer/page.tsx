import { redirect } from "next/navigation"

/** /buyer → overview */
export default function BuyerIndexPage() {
  redirect("/buyer/dashboard")
}
