import { useEffect, useMemo, useState } from 'react'

const initialProducts = [
  {
    id: 1,
    name: 'Auriculares',
    category: 'Tecnología',
    price: 39.99,
    salePrice: 59.99,
    quantity: 12,
    minimum: 5,
    retired: false,
    imageUrl: '',
  },
  {
    id: 2,
    name: 'Camiseta',
    category: 'Ropa',
    price: 14.5,
    salePrice: 24.5,
    quantity: 4,
    minimum: 3,
    retired: false,
    imageUrl: '',
  },
  {
    id: 3,
    name: 'Lámpara LED',
    category: 'Hogar',
    price: 24.99,
    salePrice: 34.99,
    quantity: 0,
    minimum: 2,
    retired: false,
    imageUrl: '',
  },
]

const initialCategories = ['Tecnología', 'Ropa', 'Hogar']

const initialSales = [
  {
    id: 1,
    productName: 'Auriculares',
    quantity: 2,
    total: 119.98,
    unitPrice: 39.99,
    unitSalePrice: 59.99,
    status: 'Completada',
    date: '2026-07-28',
  },
  {
    id: 2,
    productName: 'Camiseta',
    quantity: 1,
    total: 24.5,
    unitPrice: 14.5,
    unitSalePrice: 24.5,
    status: 'Pendiente',
    date: '2026-08-01',
  },
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

function getStockStatus(quantity, minimum) {
  if (quantity <= 0) return 'Sin stock'
  if (quantity < minimum) return 'Stock bajo'
  return 'Disponible'
}

function getStockStatusClass(quantity, minimum) {
  if (quantity <= 0) return 'status-badge danger'
  if (quantity < minimum) return 'status-badge warning'
  return 'status-badge success'
}

function normalizeProduct(product) {
  const minimum = Number(product.minimum)
  const productPrice = Number(product.price)
  const salePrice = Number(product.salePrice ?? product.price)
  const retired = Boolean(product.retired)
  const imageUrl = typeof product.imageUrl === 'string' ? product.imageUrl : ''

  const normalizedSalePrice = Number.isFinite(salePrice) && salePrice >= 0 ? salePrice : 0
  const normalizedProductPrice = Number.isFinite(productPrice) && productPrice >= 0 ? productPrice : normalizedSalePrice

  return {
    ...product,
    price: normalizedProductPrice,
    salePrice: normalizedSalePrice,
    minimum: Number.isFinite(minimum) && minimum >= 0 ? minimum : 5,
    retired,
    imageUrl,
  }
}

function getSaleStockDelta(previousStatus, nextStatus, quantity) {
  const wasCanceled = previousStatus === 'Cancelada'
  const willBeCanceled = nextStatus === 'Cancelada'

  if (wasCanceled === willBeCanceled) return 0
  return willBeCanceled ? quantity : -quantity
}

function normalizeSale(sale) {
  const parsedUnitSalePrice = Number(sale.unitSalePrice)
  const unitSalePrice = Number.isFinite(parsedUnitSalePrice)
    ? parsedUnitSalePrice
    : sale.quantity > 0
      ? Number((sale.total / sale.quantity).toFixed(2))
      : 0

  const parsedUnitPrice = Number(sale.unitPrice)
  const unitPrice = Number.isFinite(parsedUnitPrice) ? parsedUnitPrice : unitSalePrice

  return {
    recipientName: '',
    shippingAddress: '',
    ...sale,
    unitPrice,
    unitSalePrice,
  }
}

function normalizeLogisticsCost(cost) {
  const amount = Number(cost.amount)
  return {
    id: cost.id ?? Date.now(),
    date: typeof cost.date === 'string' && cost.date ? cost.date : new Date().toISOString().slice(0, 10),
    amount: Number.isFinite(amount) && amount >= 0 ? amount : 0,
    note: typeof cost.note === 'string' ? cost.note : '',
  }
}

export default function App() {
  const [products, setProducts] = useState(initialProducts.map(normalizeProduct))
  const [sales, setSales] = useState(initialSales.map(normalizeSale))
  const [categories, setCategories] = useState(initialCategories)
  const [productForm, setProductForm] = useState({
    name: '',
    category: 'Tecnología',
    price: '',
    salePrice: '',
    quantity: '',
    minimum: '5',
    retired: 'en-venta',
    imageUrl: '',
  })
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
  const [draftPrices, setDraftPrices] = useState({})
  const [draftSalePrices, setDraftSalePrices] = useState({})
  const [draftQuantities, setDraftQuantities] = useState({})
  const [draftMinimums, setDraftMinimums] = useState({})
  const [draftRetired, setDraftRetired] = useState({})
  const [isInventoryEditing, setIsInventoryEditing] = useState(false)
  const [activeScreen, setActiveScreen] = useState('dashboard')
  const [editingSaleId, setEditingSaleId] = useState(null)
  const [saleDraft, setSaleDraft] = useState({ status: 'Pendiente', recipientName: '', shippingAddress: '' })
  const [isSaleFormOpen, setIsSaleFormOpen] = useState(false)
  const [selectedProductId, setSelectedProductId] = useState(null)
  const [productImageDraft, setProductImageDraft] = useState('')
  const [analyticsStartDate, setAnalyticsStartDate] = useState('')
  const [analyticsEndDate, setAnalyticsEndDate] = useState('')
  const [analyticsTab, setAnalyticsTab] = useState('ganancias')
  const [logisticsCosts, setLogisticsCosts] = useState([])
  const [logisticsCostForm, setLogisticsCostForm] = useState({ date: new Date().toISOString().slice(0, 10), amount: '', note: '' })
  const [theme, setTheme] = useState(getStoredTheme)

  useEffect(() => {
    const stored = getStoredData()
    if (stored) {
      setProducts((stored.products || initialProducts).map(normalizeProduct))
      setSales((stored.sales || initialSales).map(normalizeSale))
      setCategories(stored.categories || initialCategories)
      setLogisticsCosts((stored.logisticsCosts || []).map(normalizeLogisticsCost))
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('gizmo-inventory-data', JSON.stringify({ products, sales, categories, logisticsCosts }))
    }
  }, [products, sales, categories, logisticsCosts])

  useEffect(() => {
    if (typeof window === 'undefined') return

    window.localStorage.setItem('gizmo-theme', theme)
    document.documentElement.dataset.theme = theme
  }, [theme])

  const summary = useMemo(() => {
    const currentMonth = new Date().toISOString().slice(0, 7)
    const totalProducts = products.length
    const totalQuantity = products.reduce((sum, item) => sum + item.quantity, 0)
    const totalSales = sales
      .filter((item) => item.status !== 'Cancelada' && item.date.startsWith(currentMonth))
      .reduce((sum, item) => sum + item.total, 0)
    const pendingSales = sales.filter((item) => item.status === 'Pendiente').length

    return { totalProducts, totalQuantity, totalSales, pendingSales }
  }, [products, sales])

  const pendingSales = useMemo(() => sales.filter((sale) => sale.status === 'Pendiente'), [sales])

  const analyticsSales = useMemo(() => {
    const start = analyticsStartDate || null
    const end = analyticsEndDate || null

    return sales.filter((sale) => {
      if (sale.status === 'Cancelada') return false
      if (start && sale.date < start) return false
      if (end && sale.date > end) return false
      return true
    })
  }, [sales, analyticsStartDate, analyticsEndDate])

  const filteredLogisticsCosts = useMemo(() => {
    const start = analyticsStartDate || null
    const end = analyticsEndDate || null

    return logisticsCosts.filter((cost) => {
      if (start && cost.date < start) return false
      if (end && cost.date > end) return false
      return true
    })
  }, [logisticsCosts, analyticsStartDate, analyticsEndDate])

  const logisticsCostsTotal = useMemo(
    () => logisticsCosts.reduce((sum, item) => sum + item.amount, 0),
    [logisticsCosts],
  )

  const analyticsSummary = useMemo(() => {
    const productByName = new Map(products.map((product) => [product.name, product]))
    const grouped = new Map()

    let totalProfit = 0
    let totalUnits = 0

    analyticsSales.forEach((sale) => {
      const fallbackProduct = productByName.get(sale.productName)
      const unitSalePrice = Number.isFinite(sale.unitSalePrice)
        ? sale.unitSalePrice
        : sale.quantity > 0
          ? sale.total / sale.quantity
          : fallbackProduct?.salePrice ?? 0
      const unitPrice = Number.isFinite(sale.unitPrice) ? sale.unitPrice : fallbackProduct?.price ?? unitSalePrice
      const lineProfit = (unitSalePrice - unitPrice) * sale.quantity

      totalProfit += lineProfit
      totalUnits += sale.quantity

      const current = grouped.get(sale.productName) || {
        productName: sale.productName,
        quantity: 0,
        profit: 0,
      }
      current.quantity += sale.quantity
      current.profit += lineProfit
      grouped.set(sale.productName, current)
    })

    const rankedBySales = Array.from(grouped.values()).sort((a, b) => b.quantity - a.quantity)
    const rankedByWorst = [...rankedBySales].sort((a, b) => a.quantity - b.quantity)
    const rankedByProfit = [...rankedBySales].sort((a, b) => b.profit - a.profit)

    const logisticsCost = filteredLogisticsCosts.reduce((sum, item) => sum + item.amount, 0)

    return {
      grossProfit: totalProfit,
      logisticsCost,
      totalProfit: totalProfit - logisticsCost,
      totalUnits,
      totalRecords: analyticsSales.length,
      topProducts: rankedBySales.slice(0, 5),
      worstProducts: rankedByWorst.slice(0, 5),
      topProfitProducts: rankedByProfit.slice(0, 5),
    }
  }, [analyticsSales, filteredLogisticsCosts, products])

  const selectedSaleProduct = useMemo(
    () => products.find((product) => product.id === Number(saleForm.productId) && !product.retired) || null,
    [products, saleForm.productId],
  )

  const saleEligibleProducts = useMemo(() => products.filter((product) => !product.retired), [products])

  const selectedProductForImage = useMemo(
    () => products.find((product) => product.id === selectedProductId) || null,
    [products, selectedProductId],
  )

  const handleAddProduct = (event) => {
    event.preventDefault()

    if (
      !productForm.name.trim() ||
      !productForm.price ||
      !productForm.salePrice ||
      !productForm.quantity ||
      productForm.minimum === ''
    ) {
      return
    }

    const minimum = Number(productForm.minimum)
    const productPrice = Number(productForm.price)
    const salePrice = Number(productForm.salePrice)
    if (!Number.isFinite(minimum) || minimum < 0) return
    if (!Number.isFinite(productPrice) || productPrice < 0) return
    if (!Number.isFinite(salePrice) || salePrice < 0) return

    const newProduct = {
      id: Date.now(),
      name: productForm.name.trim(),
      category: productForm.category.trim(),
      price: productPrice,
      salePrice,
      quantity: Number(productForm.quantity),
      minimum,
      retired: productForm.retired === 'retirado',
      imageUrl: productForm.imageUrl.trim(),
    }

    setProducts((prev) => [newProduct, ...prev])
    setProductForm({
      name: '',
      category: productForm.category,
      price: '',
      salePrice: '',
      quantity: '',
      minimum: String(minimum),
      retired: productForm.retired,
      imageUrl: '',
    })

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
    if (product.retired) {
      window.alert('Este producto está retirado y no se puede vender.')
      return
    }
    if (product.quantity < quantity) return

    const newSale = {
      id: Date.now(),
      productName: product.name,
      quantity,
      total: Number((product.salePrice * quantity).toFixed(2)),
      unitPrice: product.price,
      unitSalePrice: product.salePrice,
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
      setDraftPrices({})
      setDraftSalePrices({})
      setDraftQuantities({})
      setDraftMinimums({})
      setDraftRetired({})
      return
    }

    setIsInventoryEditing(true)
    const nextPriceDrafts = Object.fromEntries(products.map((product) => [product.id, String(product.price)]))
    const nextSalePriceDrafts = Object.fromEntries(products.map((product) => [product.id, String(product.salePrice)]))
    const nextDrafts = Object.fromEntries(products.map((product) => [product.id, String(product.quantity)]))
    const nextMinimumDrafts = Object.fromEntries(products.map((product) => [product.id, String(product.minimum)]))
    const nextRetiredDrafts = Object.fromEntries(
      products.map((product) => [product.id, product.retired ? 'retirado' : 'en-venta']),
    )
    setDraftPrices(nextPriceDrafts)
    setDraftSalePrices(nextSalePriceDrafts)
    setDraftQuantities(nextDrafts)
    setDraftMinimums(nextMinimumDrafts)
    setDraftRetired(nextRetiredDrafts)
    setEditingProductIds(products.map((product) => product.id))
  }

  const updateDraftPrice = (productId, value) => {
    setDraftPrices((prev) => ({ ...prev, [productId]: value }))
  }

  const updateDraftSalePrice = (productId, value) => {
    setDraftSalePrices((prev) => ({ ...prev, [productId]: value }))
  }

  const updateDraftQuantity = (productId, value) => {
    setDraftQuantities((prev) => ({ ...prev, [productId]: value }))
  }

  const updateDraftMinimum = (productId, value) => {
    setDraftMinimums((prev) => ({ ...prev, [productId]: value }))
  }

  const updateDraftRetired = (productId, value) => {
    setDraftRetired((prev) => ({ ...prev, [productId]: value }))
  }

  const saveStockEdit = (productId) => {
    const normalizedPrice = Number(draftPrices[productId])
    const normalizedSalePrice = Number(draftSalePrices[productId])
    const normalizedValue = Number(draftQuantities[productId])
    const normalizedMinimum = Number(draftMinimums[productId])
    const isRetired = draftRetired[productId] === 'retirado'
    if (!Number.isFinite(normalizedPrice) || normalizedPrice < 0) return
    if (!Number.isFinite(normalizedSalePrice) || normalizedSalePrice < 0) return
    if (!Number.isFinite(normalizedValue) || normalizedValue < 0) return
    if (!Number.isFinite(normalizedMinimum) || normalizedMinimum < 0) return

    const confirmed = window.confirm('¿Deseas guardar este cambio de stock?')
    if (!confirmed) return

    setProducts((prev) =>
      prev.map((item) =>
        item.id === productId
          ? {
              ...item,
              price: normalizedPrice,
              salePrice: normalizedSalePrice,
              quantity: normalizedValue,
              minimum: normalizedMinimum,
              retired: isRetired,
            }
          : item,
      ),
    )
    setEditingProductIds((prev) => prev.filter((id) => id !== productId))
    setDraftPrices((prev) => ({ ...prev, [productId]: String(normalizedPrice) }))
    setDraftSalePrices((prev) => ({ ...prev, [productId]: String(normalizedSalePrice) }))
    setDraftQuantities((prev) => ({ ...prev, [productId]: String(normalizedValue) }))
    setDraftMinimums((prev) => ({ ...prev, [productId]: String(normalizedMinimum) }))
    setDraftRetired((prev) => ({ ...prev, [productId]: isRetired ? 'retirado' : 'en-venta' }))
  }

  const cancelStockEdit = () => {
    setEditingProductIds([])
    setDraftPrices({})
    setDraftSalePrices({})
    setDraftQuantities({})
    setDraftMinimums({})
    setDraftRetired({})
    setIsInventoryEditing(false)
  }

  const clearAnalyticsFilters = () => {
    setAnalyticsStartDate('')
    setAnalyticsEndDate('')
  }

  const handleAddLogisticsCost = (event) => {
    event.preventDefault()

    const amount = Number(logisticsCostForm.amount)
    if (!logisticsCostForm.date || !Number.isFinite(amount) || amount < 0) return

    const newCost = normalizeLogisticsCost({
      id: Date.now(),
      date: logisticsCostForm.date,
      amount,
      note: logisticsCostForm.note.trim(),
    })

    setLogisticsCosts((prev) => [newCost, ...prev])
    setLogisticsCostForm((prev) => ({ ...prev, amount: '', note: '' }))
  }

  const removeLogisticsCost = (costId) => {
    setLogisticsCosts((prev) => prev.filter((item) => item.id !== costId))
  }

  const openProductImage = (product) => {
    setSelectedProductId(product.id)
    setProductImageDraft(product.imageUrl || '')
  }

  const closeProductImage = () => {
    setSelectedProductId(null)
    setProductImageDraft('')
  }

  const saveProductImage = (event) => {
    event.preventDefault()
    if (!selectedProductForImage) return

    const nextImageUrl = productImageDraft.trim()
    setProducts((prev) =>
      prev.map((product) => (product.id === selectedProductForImage.id ? { ...product, imageUrl: nextImageUrl } : product)),
    )
  }

  const heroEyebrow =
    activeScreen === 'dashboard'
      ? 'Inventario simple y claro'
      : activeScreen === 'sales'
        ? 'Ventas pendientes'
        : 'Analitica del negocio'

  const heroCopy =
    activeScreen === 'dashboard'
      ? 'Lleva el control de categorías, productos, precios, stock y ventas desde una sola vista.'
      : activeScreen === 'sales'
        ? 'Revisa pedidos pendientes, completa ventas cuando toque y corrige direcciones de envío.'
        : 'Filtra por fecha y analiza ganancias, productos mas vendidos y productos con menos salida.'

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <p className="eyebrow">{heroEyebrow}</p>
          <h1>Gizmo Inventario</h1>
          <p className="hero-copy">{heroCopy}</p>
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
            <button
              type="button"
              className={activeScreen === 'analytics' ? 'screen-switcher-btn screen-switcher-btn-active' : 'screen-switcher-btn'}
              onClick={() => setActiveScreen('analytics')}
            >
              Ganancias
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
              <span>Ventas del mes</span>
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
                    <th>Precio de venta</th>
                    <th>Cantidad</th>
                    <th>Mínimo</th>
                    <th>Venta</th>
                    <th>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => (
                    <tr key={product.id}>
                      <td>{product.category}</td>
                      <td>
                        <button type="button" className="product-name-button" onClick={() => openProductImage(product)}>
                          {product.name}
                        </button>
                      </td>
                      <td>
                        {isInventoryEditing && editingProductIds.includes(product.id) ? (
                          <input
                            className="inline-quantity-input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={draftPrices[product.id] ?? ''}
                            onChange={(event) => updateDraftPrice(product.id, event.target.value)}
                          />
                        ) : (
                          formatCurrency(product.price)
                        )}
                      </td>
                      <td>
                        {isInventoryEditing && editingProductIds.includes(product.id) ? (
                          <input
                            className="inline-quantity-input"
                            type="number"
                            min="0"
                            step="0.01"
                            value={draftSalePrices[product.id] ?? ''}
                            onChange={(event) => updateDraftSalePrice(product.id, event.target.value)}
                          />
                        ) : (
                          formatCurrency(product.salePrice)
                        )}
                      </td>
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
                        {isInventoryEditing && editingProductIds.includes(product.id) ? (
                          <input
                            className="inline-quantity-input"
                            type="number"
                            min="0"
                            value={draftMinimums[product.id] ?? ''}
                            onChange={(event) => updateDraftMinimum(product.id, event.target.value)}
                          />
                        ) : (
                          <span>{product.minimum}</span>
                        )}
                      </td>
                      <td>
                        {isInventoryEditing && editingProductIds.includes(product.id) ? (
                          <select
                            value={draftRetired[product.id] ?? 'en-venta'}
                            onChange={(event) => updateDraftRetired(product.id, event.target.value)}
                          >
                            <option value="en-venta">En venta</option>
                            <option value="retirado">Retirado</option>
                          </select>
                        ) : (
                          <span>{product.retired ? 'Retirado' : 'En venta'}</span>
                        )}
                      </td>
                      <td>
                        <span className={getStockStatusClass(product.quantity, product.minimum)}>
                          {getStockStatus(product.quantity, product.minimum)}
                        </span>
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
                  step="0.01"
                  value={productForm.salePrice}
                  onChange={(event) => setProductForm((prev) => ({ ...prev, salePrice: event.target.value }))}
                  placeholder="Precio de venta"
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
                <input
                  type="number"
                  min="0"
                  value={productForm.minimum}
                  onChange={(event) => setProductForm((prev) => ({ ...prev, minimum: event.target.value }))}
                  placeholder="Mínimo"
                  required
                />
                <select
                  value={productForm.retired}
                  onChange={(event) => setProductForm((prev) => ({ ...prev, retired: event.target.value }))}
                >
                  <option value="en-venta">En venta</option>
                  <option value="retirado">Retirado</option>
                </select>
                <input
                  type="url"
                  value={productForm.imageUrl}
                  onChange={(event) => setProductForm((prev) => ({ ...prev, imageUrl: event.target.value }))}
                  placeholder="URL de imagen (opcional)"
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

      {activeScreen === 'analytics' && (
        <section className="card analytics-screen">
          <div className="section-header analytics-header">
            <div>
              <h2>Ganancias</h2>
              <p>Filtra el historial por fecha y revisa ganancias, top de productos y el rendimiento mas bajo.</p>
            </div>
          </div>

          <div className="analytics-tab-switcher">
            <button
              type="button"
              className={analyticsTab === 'ganancias' ? 'screen-switcher-btn screen-switcher-btn-active' : 'screen-switcher-btn'}
              onClick={() => setAnalyticsTab('ganancias')}
            >
              Ganancias
            </button>
            <button
              type="button"
              className={analyticsTab === 'costos' ? 'screen-switcher-btn screen-switcher-btn-active' : 'screen-switcher-btn'}
              onClick={() => setAnalyticsTab('costos')}
            >
              Costos
            </button>
          </div>

          {analyticsTab === 'ganancias' && (
            <div className="analytics-filters">
              <label>
                Desde
                <input
                  type="date"
                  value={analyticsStartDate}
                  onChange={(event) => setAnalyticsStartDate(event.target.value)}
                />
              </label>
              <label>
                Hasta
                <input
                  type="date"
                  value={analyticsEndDate}
                  onChange={(event) => setAnalyticsEndDate(event.target.value)}
                />
              </label>
              <button type="button" className="ghost-btn" onClick={clearAnalyticsFilters}>
                Limpiar
              </button>
            </div>
          )}

          {analyticsTab === 'ganancias' && (
            <>
              <section className="stats-grid analytics-stats-grid">
                <article className="card stat-card analytics-panel">
                  <span>Ganancias netas</span>
                  <strong>{formatCurrency(analyticsSummary.totalProfit)}</strong>
                </article>
                <article className="card stat-card analytics-panel">
                  <span>Ganancias brutas</span>
                  <strong>{formatCurrency(analyticsSummary.grossProfit)}</strong>
                </article>
                <article className="card stat-card analytics-panel">
                  <span>Costo logistico</span>
                  <strong>{formatCurrency(analyticsSummary.logisticsCost)}</strong>
                </article>
                <article className="card stat-card analytics-panel">
                  <span>Unidades vendidas</span>
                  <strong>{analyticsSummary.totalUnits}</strong>
                </article>
              </section>

              <div className="analytics-grid">
                <article className="analytics-panel">
                  <h3>Top productos mas vendidos</h3>
                  <div className="analytics-chart-list">
                    {analyticsSummary.topProducts.length > 0 ? (
                      analyticsSummary.topProducts.map((item, index) => {
                        const max = analyticsSummary.topProducts[0]?.quantity || 1
                        const width = Math.max(8, (item.quantity / max) * 100)
                        return (
                          <div key={`top-${item.productName}-${index}`} className="chart-row">
                            <div className="chart-row-label">
                              <span>{item.productName}</span>
                              <strong>{item.quantity}</strong>
                            </div>
                            <div className="chart-track">
                              <div className="chart-bar chart-bar-top" style={{ width: `${width}%` }} />
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <p className="analytics-empty">No hay ventas en el rango seleccionado.</p>
                    )}
                  </div>
                </article>

                <article className="analytics-panel">
                  <h3>Productos con menor salida</h3>
                  <div className="analytics-chart-list">
                    {analyticsSummary.worstProducts.length > 0 ? (
                      analyticsSummary.worstProducts.map((item, index) => {
                        const max = analyticsSummary.worstProducts[analyticsSummary.worstProducts.length - 1]?.quantity || 1
                        const width = Math.max(8, (item.quantity / max) * 100)
                        return (
                          <div key={`worst-${item.productName}-${index}`} className="chart-row">
                            <div className="chart-row-label">
                              <span>{item.productName}</span>
                              <strong>{item.quantity}</strong>
                            </div>
                            <div className="chart-track">
                              <div className="chart-bar chart-bar-worst" style={{ width: `${width}%` }} />
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <p className="analytics-empty">No hay ventas en el rango seleccionado.</p>
                    )}
                  </div>
                </article>

                <article className="analytics-panel analytics-panel-wide">
                  <h3>Ganancia por producto</h3>
                  <div className="analytics-chart-list">
                    {analyticsSummary.topProfitProducts.length > 0 ? (
                      analyticsSummary.topProfitProducts.map((item, index) => {
                        const maxProfit = analyticsSummary.topProfitProducts[0]?.profit || 1
                        const width = Math.max(8, (item.profit / maxProfit) * 100)
                        return (
                          <div key={`profit-${item.productName}-${index}`} className="chart-row">
                            <div className="chart-row-label">
                              <span>{item.productName}</span>
                              <strong>{formatCurrency(item.profit)}</strong>
                            </div>
                            <div className="chart-track">
                              <div className="chart-bar chart-bar-profit" style={{ width: `${width}%` }} />
                            </div>
                          </div>
                        )
                      })
                    ) : (
                      <p className="analytics-empty">No hay ganancias para mostrar en este rango.</p>
                    )}
                  </div>
                </article>
              </div>
            </>
          )}

          {analyticsTab === 'costos' && (
            <div className="costs-layout">
              <article className="analytics-panel">
                <h3>Agregar costo de logistica</h3>
                <form className="form-stack panel-form" onSubmit={handleAddLogisticsCost}>
                  <input
                    type="date"
                    value={logisticsCostForm.date}
                    onChange={(event) => setLogisticsCostForm((prev) => ({ ...prev, date: event.target.value }))}
                    required
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={logisticsCostForm.amount}
                    onChange={(event) => setLogisticsCostForm((prev) => ({ ...prev, amount: event.target.value }))}
                    placeholder="Costo de logistica"
                    required
                  />
                  <input
                    value={logisticsCostForm.note}
                    onChange={(event) => setLogisticsCostForm((prev) => ({ ...prev, note: event.target.value }))}
                    placeholder="Nota (opcional)"
                  />
                  <button type="submit">Guardar costo</button>
                </form>
              </article>

              <article className="analytics-panel">
                <h3>Costos en rango</h3>
                <p className="costs-total">Total: {formatCurrency(logisticsCostsTotal)}</p>
                <div className="sales-list costs-list">
                  {logisticsCosts.length > 0 ? (
                    logisticsCosts.map((cost) => (
                      <div key={cost.id} className="sale-item">
                        <div>
                          <strong>{formatCurrency(cost.amount)}</strong>
                          <p>{cost.note || 'Sin nota'}</p>
                        </div>
                        <div className="sale-meta">
                          <small>{cost.date}</small>
                          <button type="button" className="ghost-btn" onClick={() => removeLogisticsCost(cost.id)}>
                            Eliminar
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="analytics-empty">No hay costos de logistica registrados.</p>
                  )}
                </div>
              </article>
            </div>
          )}
        </section>
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
                      <article
                        key={sale.id}
                        className={editingSaleId === sale.id ? 'pending-sale-card pending-sale-card-active' : 'pending-sale-card'}
                      >
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
              <h3>{editingSaleId ? 'Editar pedido' : 'Selecciona una venta'}</h3>
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
                  <p>Selecciona una venta desde pendientes o desde el historial para editar su estado o su dirección.</p>
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
              <div key={sale.id} className={editingSaleId === sale.id ? 'sale-item sale-item-active' : 'sale-item'}>
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
                  <button type="button" className="ghost-btn" onClick={() => beginSaleEdit(sale)}>
                    Editar
                  </button>
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
                    {saleEligibleProducts.map((product) => (
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

      {selectedProductForImage && (
        <div className="modal-backdrop" role="presentation" onClick={closeProductImage}>
          <div
            className="modal-card product-image-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-image-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <h3 id="product-image-title">Imagen de {selectedProductForImage.name}</h3>
                <p>Haz clic en guardar para actualizar la imagen del producto.</p>
              </div>
              <button type="button" className="ghost-btn" onClick={closeProductImage}>
                Cerrar
              </button>
            </div>

            {selectedProductForImage.imageUrl ? (
              <img
                className="product-image-preview"
                src={selectedProductForImage.imageUrl}
                alt={`Imagen de ${selectedProductForImage.name}`}
              />
            ) : (
              <div className="product-image-empty">
                <p>Este producto no tiene imagen.</p>
                <p>Agrega una URL para mostrarla en esta sección.</p>
              </div>
            )}

            <form onSubmit={saveProductImage} className="form-stack panel-form product-image-form">
              <input
                type="url"
                value={productImageDraft}
                onChange={(event) => setProductImageDraft(event.target.value)}
                placeholder="https://..."
              />
              <button type="submit">Guardar imagen</button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
