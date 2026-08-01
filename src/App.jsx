import { useEffect, useMemo, useState } from 'react'

const initialProducts = [
  { id: 1, name: 'Auriculares', category: 'Tecnología', price: 59.99, quantity: 12 },
  { id: 2, name: 'Camiseta', category: 'Ropa', price: 24.5, quantity: 4 },
  { id: 3, name: 'Lámpara LED', category: 'Hogar', price: 34.99, quantity: 0 },
]

const initialCategories = ['Tecnología', 'Ropa', 'Hogar']

const initialSales = [
  { id: 1, productName: 'Auriculares', quantity: 2, total: 119.98, status: 'Completada', date: '2026-07-28' },
  { id: 2, productName: 'Camiseta', quantity: 1, total: 24.5, status: 'Pendiente', date: '2026-08-01' },
]

function getStoredData() {
  if (typeof window === 'undefined') return null

  const raw = window.localStorage.getItem('gizmo-inventory-data')
  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function formatCurrency(value) {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

function getStockStatus(quantity) {
  if (quantity <= 0) return 'Sin stock'
  if (quantity <= 5) return 'Stock bajo'
  return 'Disponible'
}

function getStockStatusClass(quantity) {
  if (quantity <= 0) return 'status-badge danger'
  if (quantity <= 5) return 'status-badge warning'
  return 'status-badge success'
}

export default function App() {
  const [products, setProducts] = useState(initialProducts)
  const [sales, setSales] = useState(initialSales)
  const [categories, setCategories] = useState(initialCategories)
  const [productForm, setProductForm] = useState({ name: '', category: 'Tecnología', price: '', quantity: '' })
  const [saleForm, setSaleForm] = useState({ productId: '', quantity: '', status: 'Completada' })
  const [categoryInput, setCategoryInput] = useState('')
  const [editingProductIds, setEditingProductIds] = useState([])
  const [draftQuantities, setDraftQuantities] = useState({})
  const [isInventoryEditing, setIsInventoryEditing] = useState(false)

  useEffect(() => {
    const stored = getStoredData()
    if (stored) {
      setProducts(stored.products || initialProducts)
      setSales(stored.sales || initialSales)
      setCategories(stored.categories || initialCategories)
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('gizmo-inventory-data', JSON.stringify({ products, sales, categories }))
    }
  }, [products, sales, categories])

  const summary = useMemo(() => {
    const totalProducts = products.length
    const totalQuantity = products.reduce((sum, item) => sum + item.quantity, 0)
    const totalSales = sales.reduce((sum, item) => sum + item.total, 0)
    const pendingSales = sales.filter((item) => item.status === 'Pendiente').length

    return { totalProducts, totalQuantity, totalSales, pendingSales }
  }, [products, sales])

  const handleAddProduct = (event) => {
    event.preventDefault()

    if (!productForm.name.trim() || !productForm.price || !productForm.quantity) return

    const newProduct = {
      id: Date.now(),
      name: productForm.name.trim(),
      category: productForm.category.trim(),
      price: Number(productForm.price),
      quantity: Number(productForm.quantity),
    }

    setProducts((prev) => [newProduct, ...prev])
    setProductForm({ name: '', category: productForm.category, price: '', quantity: '' })

    if (!categories.includes(productForm.category.trim())) {
      setCategories((prev) => [...prev, productForm.category.trim()])
    }
  }

  const handleAddCategory = (event) => {
    event.preventDefault()

    const cleaned = categoryInput.trim()
    if (!cleaned || categories.includes(cleaned)) return

    setCategories((prev) => [...prev, cleaned])
    setCategoryInput('')
  }

  const handleRecordSale = (event) => {
    event.preventDefault()

    const product = products.find((item) => item.id === Number(saleForm.productId))
    const quantity = Number(saleForm.quantity)

    if (!product || !quantity || quantity <= 0) return
    if (product.quantity < quantity) return

    const newSale = {
      id: Date.now(),
      productName: product.name,
      quantity,
      total: Number((product.price * quantity).toFixed(2)),
      status: saleForm.status,
      date: new Date().toISOString().slice(0, 10),
    }

    setSales((prev) => [newSale, ...prev])
    setProducts((prev) =>
      prev.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity - quantity } : item)),
    )
    setSaleForm({ productId: '', quantity: '', status: 'Completada' })
  }

  const toggleInventoryEditing = () => {
    if (isInventoryEditing) {
      setIsInventoryEditing(false)
      setEditingProductIds([])
      setDraftQuantities({})
      return
    }

    setIsInventoryEditing(true)
    const nextDrafts = Object.fromEntries(products.map((product) => [product.id, String(product.quantity)]))
    setDraftQuantities(nextDrafts)
    setEditingProductIds(products.map((product) => product.id))
  }

  const updateDraftQuantity = (productId, value) => {
    setDraftQuantities((prev) => ({ ...prev, [productId]: value }))
  }

  const saveStockEdit = (productId) => {
    const normalizedValue = Number(draftQuantities[productId])
    if (!Number.isFinite(normalizedValue) || normalizedValue < 0) return

    const confirmed = window.confirm('¿Deseas guardar este cambio de stock?')
    if (!confirmed) return

    setProducts((prev) =>
      prev.map((item) => (item.id === productId ? { ...item, quantity: normalizedValue } : item)),
    )
    setEditingProductIds((prev) => prev.filter((id) => id !== productId))
    setDraftQuantities((prev) => ({ ...prev, [productId]: String(normalizedValue) }))
  }

  const cancelStockEdit = () => {
    setEditingProductIds([])
    setDraftQuantities({})
    setIsInventoryEditing(false)
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">Inventario simple y claro</p>
          <h1>Gizmo Inventario</h1>
          <p className="hero-copy">
            Lleva el control de categorías, productos, precios, stock y ventas desde una sola vista.
          </p>
        </div>
        <div className="hero-badge">Listo para crecer</div>
      </header>

      <section className="stats-grid">
        <article className="card stat-card">
          <span>Productos</span>
          <strong>{summary.totalProducts}</strong>
        </article>
        <article className="card stat-card">
          <span>Unidades en stock</span>
          <strong>{summary.totalQuantity}</strong>
        </article>
        <article className="card stat-card">
          <span>Ventas registradas</span>
          <strong>{formatCurrency(summary.totalSales)}</strong>
        </article>
        <article className="card stat-card">
          <span>Ventas pendientes</span>
          <strong>{summary.pendingSales}</strong>
        </article>
      </section>

      <section className="grid-layout">
        <div className="card">
          <h2>Agregar producto</h2>
          <form onSubmit={handleAddProduct} className="form-stack">
            <input
              value={productForm.name}
              onChange={(event) => setProductForm((prev) => ({ ...prev, name: event.target.value }))}
              placeholder="Nombre del producto"
              required
            />
            <select
              value={productForm.category}
              onChange={(event) => setProductForm((prev) => ({ ...prev, category: event.target.value }))}
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              step="0.01"
              value={productForm.price}
              onChange={(event) => setProductForm((prev) => ({ ...prev, price: event.target.value }))}
              placeholder="Precio"
              required
            />
            <input
              type="number"
              min="0"
              value={productForm.quantity}
              onChange={(event) => setProductForm((prev) => ({ ...prev, quantity: event.target.value }))}
              placeholder="Cantidad"
              required
            />
            <button type="submit">Guardar producto</button>
          </form>
        </div>

        <div className="card">
          <h2>Agregar categoría</h2>
          <form onSubmit={handleAddCategory} className="form-stack">
            <input
              value={categoryInput}
              onChange={(event) => setCategoryInput(event.target.value)}
              placeholder="Nueva categoría"
            />
            <button type="submit">Añadir</button>
          </form>

          <div className="tag-list">
            {categories.map((category) => (
              <span key={category} className="tag">
                {category}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="section-header">
          <div>
            <h2>Inventario</h2>
            <p>Vista tipo hoja de cálculo para revisar stock y estado.</p>
          </div>
          <button type="button" className="secondary-btn" onClick={toggleInventoryEditing}>
            {isInventoryEditing ? 'Salir de edición' : 'Editar stock'}
          </button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Categoría</th>
                <th>Producto</th>
                <th>Precio</th>
                <th>Cantidad</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr key={product.id}>
                  <td>{product.category}</td>
                  <td>{product.name}</td>
                  <td>{formatCurrency(product.price)}</td>
                  <td>
                    {isInventoryEditing && editingProductIds.includes(product.id) ? (
                      <div className="edit-stock-actions">
                        <input
                          className="inline-quantity-input"
                          type="number"
                          min="0"
                          value={draftQuantities[product.id] ?? ''}
                          onChange={(event) => updateDraftQuantity(product.id, event.target.value)}
                        />
                        <button type="button" className="secondary-btn" onClick={() => saveStockEdit(product.id)}>
                          Guardar
                        </button>
                      </div>
                    ) : (
                      <div className="edit-stock-actions">
                        <span>{product.quantity}</span>
                      </div>
                    )}
                  </td>
                  <td>
                    <span className={getStockStatusClass(product.quantity)}>{getStockStatus(product.quantity)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid-layout">
        <div className="card">
          <h2>Registrar venta</h2>
          <form onSubmit={handleRecordSale} className="form-stack">
            <select value={saleForm.productId} onChange={(event) => setSaleForm((prev) => ({ ...prev, productId: event.target.value }))} required>
              <option value="">Selecciona un producto</option>
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="1"
              value={saleForm.quantity}
              onChange={(event) => setSaleForm((prev) => ({ ...prev, quantity: event.target.value }))}
              placeholder="Cantidad vendida"
              required
            />
            <select value={saleForm.status} onChange={(event) => setSaleForm((prev) => ({ ...prev, status: event.target.value }))}>
              <option value="Completada">Completada</option>
              <option value="Pendiente">Pendiente</option>
              <option value="Cancelada">Cancelada</option>
            </select>
            <button type="submit">Registrar venta</button>
          </form>
        </div>

        <div className="card">
          <h2>Historial de ventas</h2>
          <div className="sales-list">
            {sales.map((sale) => (
              <div key={sale.id} className="sale-item">
                <div>
                  <strong>{sale.productName}</strong>
                  <p>{sale.quantity} unidades • {sale.status}</p>
                </div>
                <div className="sale-meta">
                  <span>{formatCurrency(sale.total)}</span>
                  <small>{sale.date}</small>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}
