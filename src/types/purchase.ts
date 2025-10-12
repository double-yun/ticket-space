export interface TicketEventInfo {
  id: number
  name: string
  description: string
  price: string
  imageUrl?: string | null
}

export interface TicketPurchase {
  id: string
  transactionHash: string
  tokenId: string
  purchaseDate: string
  used: boolean
  usedAt?: string | null
  ticket: TicketEventInfo
}
