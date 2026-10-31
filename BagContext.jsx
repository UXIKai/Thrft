import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import {
  addToCart,
  cartCount,
  cartTotal,
  clearCart,
  formatMoney,
  readCart,
  removeFromCart,
  writeCart,
} from './cart.js'

const BagContext = createContext(null)

/**
 * Global marketplace bag — persisted in localStorage, shared across Home / detail / Bag UI.
 */
export function BagProvider({ children }) {
  const [items, setItems] = useState(() => readCart())

  const addItem = useCallback((product) => {
    setItems(addToCart(product))
  }, [])

  const removeItem = useCallback((productId) => {
    setItems(removeFromCart(productId))
  }, [])

  const replaceItems = useCallback((next) => {
    setItems(writeCart(Array.isArray(next) ? next : []))
  }, [])

  const empty = useCallback(() => {
    setItems(clearCart())
  }, [])

  const value = useMemo(
    () => ({
      items,
      count: cartCount(items),
      total: cartTotal(items),
      totalLabel: formatMoney(cartTotal(items)),
      addItem,
      removeItem,
      replaceItems,
      empty,
      formatMoney,
    }),
    [items, addItem, removeItem, replaceItems, empty],
  )

  return <BagContext.Provider value={value}>{children}</BagContext.Provider>
}

export function useBag() {
  const ctx = useContext(BagContext)
  if (!ctx) {
    throw new Error('useBag must be used within BagProvider')
  }
  return ctx
}
