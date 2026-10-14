// The /v1 never sends REQUESTED (a requested item is already in preparation),
// but the status helpers still accept it, like the React app.
export type OrderItemStatus = 'REQUESTED' | 'IN_PREPARATION' | 'READY' | 'DELIVERED'
