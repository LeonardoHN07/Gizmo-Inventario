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

function getStoredTheme() {
  if (typeof window === 'undefined') return 'light'

  const savedTheme = window.localStorage.getItem('gizmo-theme')
  return savedTheme === 'dark' ? 'dark' : 'light'
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

function getSaleStockDelta(previousStatus, nextStatus, quantity) {
  const wasCanceled = previousStatus === 'Cancelada'
  const willBeCanceled = nextStatus === 'Cancelada'

  if (wasCanceled === willBeCanceled) return 0
  return willBeCanceled ? quantity : -quantity
}

function normalizeSale(sale) {
  return {
    recipientName: '',
    shippingAddress: '',
    ...sale,
  }
}

export default function App() {
  const [products, setProducts] = useState(initialProducts)
  const [sales, setSales] = useState(initialSales.map(normalizeSale))
  const [categories, setCategories] = useState(initialCategories)
  const [productForm, setProductForm] = useState({ name: '', category: 'Tecnología', price: '', quantity: '' })
  const [saleForm, setSaleForm] = useState({
    productId: '',
    quantity: '',
    status: 'Completada',
    recipientName: '',
    shippingAddress: '',
  })
  const [categoryInput, setCategoryInput] = useState('')
  const [editingCategory, setEditingCategory] = useState(null)
  const [categoryDraft, setCategoryDraft] = useState('')
  const [editingProductIds, setEditingProductIds] = useState([])
  const [draftQuantities, setDraftQuantities] = useState({})
  const [isInventoryEditing, setIsInventoryEditing] = useState(false)
  const [activeScreen, setActiveScreen] = useState('dashboard')
  const [editingSaleId, setEditingSaleId] = useState(null)
  const [saleDraft, setSaleDraft] = useState({ status: 'Pendiente', recipientName: '', shippingAddress: '' })
  const [isSaleFormOpen, setIsSaleFormOpen] = useState(false)
  const [theme, setTheme] = useState(getStoredTheme)

  useEffect(() => {
    const stored = getStoredData()
    if (stored) {
      setProducts(stored.products || initialProducts)
      setSales((stored.sales || initialSales).map(normalizeSale))
      setCategories(stored.categories || initialCategories)
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('gizmo-inventory-data', JSON.stringify({ products, sales, categories }))
    }
  }, [products, sales, categories])

  useEffect(() => {
    if (typeof window === 'undefined') return

    window.localStorage.setItem('gizmo-theme', theme)
    document.documentElement.dataset.theme = theme
  }, [theme])

  const summary = useMemo(() => {
    const totalProducts = products.length
    const totalQuantity = products.reduce((sum, item) => sum + item.quantity, 0)
    const totalSales = sales.reduce((sum, item) => sum + item.total, 0)
    const pendingSales = sales.filter((item) => item.status === 'Pendiente').length

    return { totalProducts, totalQuantity, totalSales, pendingSales }
  }, [products, sales])

  const pendingSales = useMemo(() => sales.filter((sale) => sale.status === 'Pendiente'), [sales])

  const selectedSaleProduct = useMemo(
    () => products.find((product) => product.id === Number(saleForm.productId)) || null,
    [products, saleForm.productId],
  )

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

  const beginCategoryEdit = (category) => {
    setEditingCategory(category)
    setCategoryDraft(category)
  }

  const cancelCategoryEdit = () => {
    setEditingCategory(null)
    setCategoryDraft('')
  }

  const saveCategoryEdit = (event) => {
    event.preventDefault()

    if (!editingCategory) return

    const nextCategory = categoryDraft.trim()
    if (!nextCategory || nextCategory === editingCategory || categories.includes(nextCategory)) return

    setCategories((prev) => prev.map((category) => (category === editingCategory ? nextCategory : category)))
    setProducts((prev) =>
      prev.map((product) => (product.category === editingCategory ? { ...product, category: nextCategory } : product)),
    )
    setProductForm((prev) => (prev.category === editingCategory ? { ...prev, category: nextCategory } : prev))
    setEditingCategory(null)
    setCategoryDraft('')
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
      recipientName: saleForm.recipientName.trim(),
      shippingAddress: saleForm.shippingAddress.trim(),
      date: new Date().toISOString().slice(0, 10),
    }

    setSales((prev) => [newSale, ...prev])

    if (saleForm.status !== 'Cancelada') {
      setProducts((prev) =>
        prev.map((item) => (item.id === product.id ? { ...item, quantity: item.quantity - quantity } : item)),
      )
    }

    setSaleForm({ productId: '', quantity: '', status: 'Completada', recipientName: '', shippingAddress: '' })
    setIsSaleFormOpen(false)
  }

  const openSaleForm = () => {
    setActiveScreen('sales')
    setIsSaleFormOpen(true)
  }

  const closeSaleForm = () => {
    setIsSaleFormOpen(false)
  }

  const toggleTheme = () => {
    setTheme((current) => (current === 'dark' ? 'light' : 'dark'))
  }

  const beginSaleEdit = (sale) => {
    setActiveScreen('sales')
    setEditingSaleId(sale.id)
    setSaleDraft({
      status: sale.status,
      recipientName: sale.recipientName || '',
      shippingAddress: sale.shippingAddress || '',
    })
  }

  const cancelSaleEdit = () => {
    setEditingSaleId(null)
    setSaleDraft({ status: 'Pendiente', recipientName: '', shippingAddress: '' })
  }

  const saveSaleEdit = (event) => {
    event.preventDefault()

    if (!editingSaleId) return

    const currentSale = sales.find((sale) => sale.id === editingSaleId)
    if (!currentSale) return

    const stockDelta = getSaleStockDelta(currentSale.status, saleDraft.status, currentSale.quantity)
    if (stockDelta < 0) {
      const product = products.find((item) => item.name === currentSale.productName)
      if (!product || product.quantity < currentSale.quantity) {
        window.alert('No hay suficiente stock para reactivar esta venta.')
        return
      }
    }

    if (stockDelta !== 0) {
      setProducts((prev) =>
        prev.map((item) =>
          item.name === currentSale.productName ? { ...item, quantity: item.quantity + stockDelta } : item,
        ),
      )
    }

    setSales((prev) =>
      prev.map((sale) =>
        sale.id === editingSaleId
          ? {
              ...sale,
              status: saleDraft.status,
              recipientName: saleDraft.recipientName.trim(),
              shippingAddress: saleDraft.shippingAddress.trim(),
            }
          : sale,
      ),
    )
    cancelSaleEdit()
  }

  const markSaleCompleted = (saleId) => {
    const currentSale = sales.find((sale) => sale.id === saleId)
    if (!currentSale) return

    setSales((prev) =>
      prev.map((sale) => (sale.id === saleId ? { ...sale, status: 'Completada' } : sale)),
    )
    if (editingSaleId === saleId) {
      cancelSaleEdit()
    }
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
          <p className="eyebrow">{activeScreen === 'dashboard' ? 'Inventario simple y claro' : 'Ventas pendientes'}</p>
          <h1>Gizmo Inventario</h1>
          <p className="hero-copy">
            {activeScreen === 'dashboard'
              ? 'Lleva el control de categorías, productos, precios, stock y ventas desde una sola vista.'
              : 'Revisa pedidos pendientes, completa ventas cuando toque y corrige direcciones de envío.'}
          </p>
        </div>
        <div className="hero-actions">
          <div className="screen-switcher">
            <button
              type="button"
              className={activeScreen === 'dashboard' ? 'screen-switcher-btn screen-switcher-btn-active' : 'screen-switcher-btn'}
              onClick={() => setActiveScreen('dashboard')}
            >
              Dashboard
            </button>
            <button
              type="button"
              className={activeScreen === 'sales' ? 'screen-switcher-btn screen-switcher-btn-active' : 'screen-switcher-btn'}
              onClick={() => setActiveScreen('sales')}
            >
              Ventas pendientes
            </button>
          </div>
          <button type="button" className="theme-toggle" onClick={toggleTheme}>
            {theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          </button>
          {activeScreen === 'sales' && <div className="hero-badge">{`${pendingSales.length} pendientes`}</div>}
        </div>
      </header>
      {activeScreen === 'dashboard' && (
        <>
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

          <section className="card inventory-section">
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
                {categories.map((category) =>
                  editingCategory === category ? (
                    <form key={category} className="category-edit-pill" onSubmit={saveCategoryEdit}>
                      <input
                        className="category-edit-input"
                        value={categoryDraft}
                        onChange={(event) => setCategoryDraft(event.target.value)}
                        aria-label={`Editar categoría ${category}`}
                      />
                      <button type="submit" className="secondary-btn">
                        Guardar
                      </button>
                      <button type="button" className="ghost-btn" onClick={cancelCategoryEdit}>
                        Cancelar
                      </button>
                    </form>
                  ) : (
                    <span key={category} className="tag category-tag">
                      {category}
                      <button type="button" className="tag-action" onClick={() => beginCategoryEdit(category)}>
                        Editar
                      </button>
                    </span>
                  ),
                )}
              </div>
            </div>
          </section>
        </>
      )}

      {activeScreen === 'sales' && (
        <section className="card sales-screen">
          <div className="section-header">
            <div>
              <h2>Ventas pendientes</h2>
              <p>Registra una venta nueva, abre un pedido, corrige la dirección y márcalo como completado cuando salga.</p>
            </div>
          </div>

          <div className="sales-screen-grid">
            <div className="sales-screen-stack">
              <div className="panel-block panel-block-muted">
                <h3>Nueva venta</h3>
                <p>Abre el formulario para registrar una venta con producto, cantidad, estado y envío.</p>
                <button type="button" className="secondary-btn" onClick={openSaleForm}>
                  Registrar venta
                </button>
              </div>

              <div className="panel-block panel-block-muted">
                <h3>Pedidos pendientes</h3>
                <p>Hay {pendingSales.length} pedido(s) que todavía no están completados.</p>
                <div className="sales-list pending-sales-list">
                  {pendingSales.length > 0 ? (
                    pendingSales.map((sale) => (
                      <article key={sale.id} className="pending-sale-card">
                        <div>
                          <strong>{sale.productName}</strong>
                          <p>{sale.quantity} unidades • {formatCurrency(sale.total)}</p>
                          <small className="sale-shipping-info">
                            {sale.recipientName || 'Sin nombre'}
                            {sale.shippingAddress ? ` • ${sale.shippingAddress}` : ' • Sin dirección'}
                          </small>
                        </div>
                        <div className="pending-sale-actions">
                          <button type="button" className="ghost-btn" onClick={() => beginSaleEdit(sale)}>
                            Editar
                          </button>
                          <button type="button" className="secondary-btn" onClick={() => markSaleCompleted(sale.id)}>
                            Completar
                          </button>
                        </div>
                      </article>
                    ))
                  ) : (
                    <p className="analytics-empty">No hay ventas pendientes ahora mismo.</p>
                  )}
                </div>
              </div>
            </div>

            <div className="panel-block">
              <h3>{editingSaleId ? 'Editar pedido' : 'Selecciona un pedido'}</h3>
              {editingSaleId ? (
                <form className="form-stack panel-form" onSubmit={saveSaleEdit}>
                  <select value={saleDraft.status} onChange={(event) => setSaleDraft((prev) => ({ ...prev, status: event.target.value }))}>
                    <option value="Pendiente">Pendiente</option>
                    <option value="Completada">Completada</option>
                    <option value="Cancelada">Cancelada</option>
                  </select>
                  <input
                    value={saleDraft.recipientName}
                    onChange={(event) => setSaleDraft((prev) => ({ ...prev, recipientName: event.target.value }))}
                    placeholder="Nombre para envío"
                  />
                  <input
                    value={saleDraft.shippingAddress}
                    onChange={(event) => setSaleDraft((prev) => ({ ...prev, shippingAddress: event.target.value }))}
                    placeholder="Dirección de envío"
                  />
                  <button type="submit">Guardar cambios</button>
                  <button type="button" className="ghost-btn" onClick={cancelSaleEdit}>
                    Cancelar
                  </button>
                </form>
              ) : (
                <div className="empty-editor-state">
                  <p>Selecciona un pedido pendiente para editar su estado o su dirección.</p>
                </div>
              )}
            </div>
          </div>

          <div className="section-header sales-history-header">
            <div>
              <h3>Historial completo</h3>
              <p>Todos los pedidos se guardan aquí, incluidos los que ya fueron completados.</p>
            </div>
          </div>

          <div className="sales-list">
            {sales.map((sale) => (
              <div key={sale.id} className="sale-item">
                <div>
                  <strong>{sale.productName}</strong>
                  <p>{sale.quantity} unidades • {sale.status}</p>
                  {(sale.recipientName || sale.shippingAddress) && (
                    <small className="sale-shipping-info">
                      {sale.recipientName || 'Sin nombre'}
                      {sale.shippingAddress ? ` • ${sale.shippingAddress}` : ''}
                    </small>
                  )}
                </div>
                <div className="sale-meta">
                  <span>{formatCurrency(sale.total)}</span>
                  <small>{sale.date}</small>
                </div>
              </div>
            ))}
          </div>

          {isSaleFormOpen && (
            <div className="modal-backdrop" role="presentation" onClick={closeSaleForm}>
              <div
                className="modal-card"
                role="dialog"
                aria-modal="true"
                aria-labelledby="new-sale-title"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="modal-header">
                  <div>
                    <h3 id="new-sale-title">Registrar venta</h3>
                    <p>Completa los datos y guarda la venta en el historial.</p>
                  </div>
                  <button type="button" className="ghost-btn" onClick={closeSaleForm}>
                    Cerrar
                  </button>
                </div>

                <form onSubmit={handleRecordSale} className="form-stack panel-form">
                  <select
                    value={saleForm.productId}
                    onChange={(event) => setSaleForm((prev) => ({ ...prev, productId: event.target.value }))}
                    required
                  >
                    <option value="">Selecciona un producto</option>
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name}
                      </option>
                    ))}
                  </select>
                  <div className="sale-quantity-field">
                    <input
                      type="number"
                      min="1"
                      max={selectedSaleProduct?.quantity || undefined}
                      value={saleForm.quantity}
                      onChange={(event) => setSaleForm((prev) => ({ ...prev, quantity: event.target.value }))}
                      placeholder={
                        selectedSaleProduct
                          ? `Cantidad vendida · stock: ${selectedSaleProduct.quantity}`
                          : 'Cantidad vendida'
                      }
                      required
                    />
                    <small className="sale-quantity-hint">
                      {selectedSaleProduct
                        ? `Stock disponible: ${selectedSaleProduct.quantity} unidades`
                        : 'Selecciona un producto para ver el stock disponible'}
                    </small>
                  </div>
                  <select
                    value={saleForm.status}
                    onChange={(event) => setSaleForm((prev) => ({ ...prev, status: event.target.value }))}
                  >
                    <option value="Completada">Completada</option>
                    <option value="Pendiente">Pendiente</option>
                    <option value="Cancelada">Cancelada</option>
                  </select>
                  <input
                    value={saleForm.recipientName}
                    onChange={(event) => setSaleForm((prev) => ({ ...prev, recipientName: event.target.value }))}
                    placeholder="Nombre para envío (opcional)"
                  />
                  <input
                    value={saleForm.shippingAddress}
                    onChange={(event) => setSaleForm((prev) => ({ ...prev, shippingAddress: event.target.value }))}
                    placeholder="Dirección de envío (opcional)"
                  />
                  <button type="submit">Guardar venta</button>
                </form>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  )
}
