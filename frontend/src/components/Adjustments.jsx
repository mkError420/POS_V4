import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config';

export default function Adjustments() {
  const [adjustments, setAdjustments] = useState([]);
  const [products, setProducts] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [alert, setAlert] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editAdjustmentId, setEditAdjustmentId] = useState(null);
  const [editShopId, setEditShopId] = useState(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const userStr = localStorage.getItem('user');
  const userObj = userStr ? JSON.parse(userStr) : {};
  const isSuperAdmin = userObj.role === 'super_admin';

  // Filters
  const [filterProductId, setFilterProductId] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');
  const [filterShopId, setFilterShopId] = useState('');
  const [shops, setShops] = useState([]);

  const [filterProductSearch, setFilterProductSearch] = useState('');
  const [showFilterProductDropdown, setShowFilterProductDropdown] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    product_id: '',
    adjusted_quantity: '',
    reason: '',
    notes: ''
  });

  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);

  const fetchAdjustments = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${API_BASE_URL}/adjustments`;
      const params = new URLSearchParams();

      if (filterProductId) params.append('product_id', filterProductId);
      if (filterType) params.append('adjustment_type', filterType);
      if (filterStartDate) params.append('start_date', filterStartDate);
      if (filterEndDate) params.append('end_date', filterEndDate);
      if (filterShopId) params.append('shop_id', filterShopId);

      if (params.toString()) url += `?${params.toString()}`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to retrieve adjustments.');
      setAdjustments(await response.json());
      setCurrentPage(1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchProducts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/products`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setProducts(await response.json());
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/adjustments/stats`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setStats(await response.json());
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const fetchShops = async () => {
    if (!isSuperAdmin) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/shops`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setShops(await response.json());
      }
    } catch (err) {
      console.error('Error fetching shops:', err);
    }
  };

  useEffect(() => {
    fetchAdjustments();
    fetchProducts();
    fetchStats();
    fetchShops();
  }, [filterProductId, filterType, filterStartDate, filterEndDate, filterShopId]);

  const triggerAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.product_id || formData.adjusted_quantity === '') {
      triggerAlert('error', 'Please select a product and enter the quantity.');
      return;
    }
    if (!formData.reason) {
      triggerAlert('error', 'Please provide a reason for the adjustment.');
      return;
    }

    let finalQuantity = parseFloat(formData.adjusted_quantity);
    const selectedProduct = products.find(p => p.id === parseInt(formData.product_id));

    try {
      const token = localStorage.getItem('token');
      const method = editMode ? 'PUT' : 'POST';
      const endpoint = editMode ? `${API_BASE_URL}/adjustments/${editAdjustmentId}` : `${API_BASE_URL}/adjustments`;

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          shop_id: editMode ? editShopId : (selectedProduct ? selectedProduct.shop_id : null),
          product_id: parseInt(formData.product_id),
          adjusted_quantity: finalQuantity,
          reason: formData.reason,
          notes: formData.notes
        })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to save adjustment.');

      triggerAlert('success', editMode ? 'Inventory adjustment updated successfully!' : 'Inventory adjustment recorded successfully!');
      setShowAddModal(false);
      resetForm();
      fetchAdjustments();
      fetchStats();
      fetchProducts();
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const handleDelete = async (adj) => {
    if (!window.confirm('Are you sure you want to delete this adjustment? This will revert the stock quantity.')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/adjustments/${adj.id}?shop_id=${adj.shop_id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to delete adjustment.');

      triggerAlert('success', 'Adjustment deleted and stock reverted!');
      fetchAdjustments();
      fetchStats();
      fetchProducts();
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      product_id: '',
      adjusted_quantity: '',
      reason: '',
      notes: ''
    });
    setProductSearch('');
    setShowProductDropdown(false);
  };

  const openAddModal = (product = null) => {
    setEditMode(false);
    setEditAdjustmentId(null);
    setEditShopId(null);
    if (product) {
      setFormData({
        product_id: String(product.id),
        adjusted_quantity: String(product.stock_quantity),
        reason: '',
        notes: ''
      });
      setProductSearch(`${product.name} (${product.sku})`);
    } else {
      resetForm();
    }
    setShowAddModal(true);
  };

  const openEditModal = (adj) => {
    setEditMode(true);
    setEditAdjustmentId(adj.id);
    setEditShopId(adj.shop_id);
    setFormData({
      product_id: String(adj.product_id),
      adjusted_quantity: String(adj.adjusted_quantity),
      reason: adj.reason || '',
      notes: adj.notes || ''
    });
    setProductSearch(`${adj.product_name} (${adj.product_sku})`);
    setShowAddModal(true);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const getAdjustmentBadge = (type) => {
    return type === 'increase'
      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
      : 'bg-rose-100 text-rose-800 border-rose-200';
  };

  return (
    <div className="space-y-6">
      {/* Alerts Banner */}
      {alert && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg flex items-center transition-all ${alert.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
          }`}>
          <span className="text-sm font-semibold">{alert.message}</span>
        </div>
      )}

      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Inventory Adjustments</h2>
          <p className="text-sm text-slate-500">Adjust stock quantities to match physical inventory counts</p>
        </div>
        {!isSuperAdmin && (
          <button
            onClick={() => openAddModal()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-5 rounded-xl text-sm shadow transition-colors flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>New Adjustment</span>
          </button>
        )}
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Adjustments</div>
            <div className="text-2xl font-bold text-slate-800 mt-1">{stats.stats.total_adjustments || 0}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Increases</div>
            <div className="text-2xl font-bold text-emerald-600 mt-1">{stats.stats.increases || 0}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Decreases</div>
            <div className="text-2xl font-bold text-rose-600 mt-1">{stats.stats.decreases || 0}</div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Net Change</div>
            <div className={`text-2xl font-bold mt-1 ${stats.stats.net_change >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {stats.stats.net_change >= 0 ? '+' : ''}{stats.stats.net_change || 0}
            </div>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xs">
        <div className="flex flex-wrap items-center gap-4">
          {isSuperAdmin && (
            <select
              value={filterShopId}
              onChange={(e) => setFilterShopId(e.target.value)}
              className="border border-slate-200 rounded-lg p-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
            >
              <option value="">All Shops</option>
              {shops.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
          <div className="relative w-full md:w-64 min-w-[200px]">
            <input
              type="text"
              value={filterProductSearch}
              onChange={(e) => {
                setFilterProductSearch(e.target.value);
                setShowFilterProductDropdown(true);
                if (e.target.value === '') {
                  setFilterProductId('');
                }
              }}
              onFocus={() => setShowFilterProductDropdown(true)}
              onBlur={() => setTimeout(() => setShowFilterProductDropdown(false), 200)}
              placeholder="All Products (Search...)"
              className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
            />
            {showFilterProductDropdown && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                <div
                  className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm border-b border-slate-100"
                  onClick={() => {
                    setFilterProductId('');
                    setFilterProductSearch('');
                    setShowFilterProductDropdown(false);
                  }}
                >
                  <div className="font-semibold text-slate-800">All Products</div>
                </div>
                {products
                  .filter(p =>
                    p.name.toLowerCase().includes(filterProductSearch.toLowerCase()) ||
                    (p.sku && p.sku.toLowerCase().includes(filterProductSearch.toLowerCase()))
                  )
                  .map(p => (
                    <div
                      key={p.id}
                      className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm border-b border-slate-100 last:border-0"
                      onClick={() => {
                        setFilterProductId(String(p.id));
                        setFilterProductSearch(`${p.name} (${p.sku})`);
                        setShowFilterProductDropdown(false);
                      }}
                    >
                      <div className="font-semibold text-slate-800">{p.name}</div>
                      <div className="text-xs text-slate-500">SKU: {p.sku}</div>
                    </div>
                  ))}
              </div>
            )}
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="border border-slate-200 rounded-lg p-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
          >
            <option value="">All Types</option>
            <option value="increase">Increase Only</option>
            <option value="decrease">Decrease Only</option>
          </select>
          <input
            type="date"
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
            className="border border-slate-200 rounded-lg p-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
            placeholder="Start Date"
          />
          <input
            type="date"
            value={filterEndDate}
            onChange={(e) => setFilterEndDate(e.target.value)}
            className="border border-slate-200 rounded-lg p-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
            placeholder="End Date"
          />
          <button
            onClick={() => {
              setFilterProductId('');
              setFilterType('');
              setFilterStartDate('');
              setFilterEndDate('');
              setFilterShopId('');
              setFilterProductSearch('');
            }}
            className="text-sm text-indigo-600 hover:text-indigo-800 font-semibold"
          >
            Clear Filters
          </button>
        </div>
      </div>

      {/* Adjustments Table */}
      {(() => {
        const totalPages = Math.ceil(adjustments.length / itemsPerPage);
        const currentAdjustments = adjustments.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
        
        return (
          <>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                {isSuperAdmin && (
                  <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Shop</th>
                )}
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Product</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Previous Qty</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Adjusted Qty</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Difference</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Type</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Reason</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Adjusted By</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan="9" className="px-6 py-8 text-center text-slate-500">Loading adjustments...</td>
                </tr>
              ) : adjustments.length === 0 ? (
                <tr>
                  <td colSpan="9" className="px-6 py-8 text-center text-slate-500">No adjustments found</td>
                </tr>
              ) : (
                currentAdjustments.map(adj => (
                  <tr key={adj.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 text-sm text-slate-700">{formatDate(adj.created_at)}</td>
                    {isSuperAdmin && (
                      <td className="px-6 py-4 text-sm font-medium text-slate-900">
                        {adj.shop_name || 'N/A'}
                      </td>
                    )}
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-900">{adj.product_name}</div>
                      <div className="text-xs text-slate-500">{adj.product_sku}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">{+Number(adj.previous_quantity).toFixed(3)}</td>
                    <td className="px-6 py-4 text-sm font-medium text-slate-900">{+Number(adj.adjusted_quantity).toFixed(3)}</td>
                    <td className={`px-6 py-4 text-sm font-semibold ${adj.difference >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {adj.difference >= 0 ? '+' : ''}{+Number(adj.difference).toFixed(3)}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold border ${getAdjustmentBadge(adj.adjustment_type)}`}>
                        {adj.adjustment_type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">{adj.reason}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{adj.adjusted_by_name}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <button
                          onClick={() => openEditModal(adj)}
                          className="text-indigo-600 hover:text-indigo-800 transition-colors p-1 bg-indigo-50 hover:bg-indigo-100 rounded"
                          title="Edit"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDelete(adj)}
                          className="text-rose-600 hover:text-rose-800 transition-colors p-1 bg-rose-50 hover:bg-rose-100 rounded"
                          title="Delete"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between bg-white px-4 py-3 border border-slate-200 rounded-2xl shadow-xs">
          <div className="flex flex-1 items-center justify-between">
            <div className="hidden sm:block">
              <p className="text-sm text-slate-700">
                Showing <span className="font-semibold">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-semibold">{Math.min(currentPage * itemsPerPage, adjustments.length)}</span> of <span className="font-semibold">{adjustments.length}</span> results
              </p>
            </div>
            <div>
              <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                >
                  <span className="sr-only">Previous</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                  </svg>
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => {
                    if (totalPages <= 15) return true;
                    const start = Math.max(1, Math.min(currentPage - 7, totalPages - 14));
                    return p >= start && p < start + 15;
                  })
                  .map(p => (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`relative inline-flex items-center px-4 py-2 text-sm font-semibold focus:z-20 ${
                      currentPage === p 
                        ? 'bg-indigo-600 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 z-10' 
                        : 'text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
                >
                  <span className="sr-only">Next</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
          </>
        );
      })()}

      {/* Add Adjustment Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-800">{editMode ? 'Edit Adjustment' : 'Inventory Adjustment'}</h3>
              <p className="text-sm text-slate-500 mt-1">Adjust stock quantity to match physical count</p>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Product *</label>
                <div className="relative">
                  <input
                    type="text"
                    value={productSearch}
                    onChange={(e) => {
                      if (editMode) return;
                      setProductSearch(e.target.value);
                      setShowProductDropdown(true);
                      setFormData({ ...formData, product_id: '' });
                    }}
                    onFocus={() => { if (!editMode) setShowProductDropdown(true); }}
                    onBlur={() => { if (!editMode) setTimeout(() => setShowProductDropdown(false), 200); }}
                    placeholder="Search product by name or SKU"
                    className={`w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none ${editMode ? 'bg-slate-100 cursor-not-allowed text-slate-500' : 'focus:ring-1 focus:ring-indigo-500'}`}
                    required={!formData.product_id}
                    disabled={editMode}
                  />
                  {!editMode && showProductDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {products
                        .filter(p =>
                          p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                          (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase()))
                        )
                        .map(p => (
                          <div
                            key={p.id}
                            className="px-4 py-2 hover:bg-slate-50 cursor-pointer text-sm border-b border-slate-100 last:border-0"
                            onClick={() => {
                              setFormData({ ...formData, product_id: String(p.id), adjusted_quantity: String(p.stock_quantity) });
                              setProductSearch(`${p.name} (${p.sku})`);
                              setShowProductDropdown(false);
                            }}
                          >
                            <div className="font-semibold text-slate-800">{p.name}</div>
                            <div className="text-xs text-slate-500">SKU: {p.sku} • Current Stock: {p.stock_quantity}</div>
                          </div>
                        ))}
                      {products.filter(p =>
                        p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
                        (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase()))
                      ).length === 0 && (
                          <div className="px-4 py-3 text-sm text-slate-500 text-center">No products found</div>
                        )}
                    </div>
                  )}
                </div>
                {formData.product_id && (() => {
                  const selectedProduct = products.find(p => p.id === parseInt(formData.product_id));
                  return selectedProduct ? (
                    <p className="text-xs font-semibold text-slate-500 mt-2 flex items-center gap-1.5">
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Base Unit: <span className="text-indigo-600 uppercase tracking-wider">{selectedProduct.unit}</span>
                    </p>
                  ) : null;
                })()}
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                  Adjusted Quantity *
                </label>
                <input
                  type="number"
                  name="adjusted_quantity"
                  value={formData.adjusted_quantity}
                  onChange={handleInputChange}
                  required
                  min="0"
                  step="any"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                  placeholder="Enter the physical count"
                />
                {formData.product_id && (() => {
                  const selectedProduct = products.find(p => p.id === parseInt(formData.product_id));
                  const currentStock = selectedProduct?.stock_quantity || 0;
                  const unit = selectedProduct?.unit || '';
                  const newQty = parseFloat(formData.adjusted_quantity);
                  const diff = newQty - currentStock;
                  return (
                    <p className="text-xs text-slate-500 mt-1.5 flex items-center flex-wrap">
                      <span>Current stock: <span className="font-semibold text-slate-700">{currentStock}</span> {unit}</span>
                      {!isNaN(newQty) && diff > 0 && (
                        <span className="text-emerald-600 ml-2 font-medium">→ Increase by {+diff.toFixed(3)} {unit}</span>
                      )}
                      {!isNaN(newQty) && diff < 0 && (
                        <span className="text-rose-600 ml-2 font-medium">→ Decrease by {+(-diff).toFixed(3)} {unit}</span>
                      )}
                      {!isNaN(newQty) && diff === 0 && (
                        <span className="text-slate-500 ml-2 font-medium">→ No change</span>
                      )}
                    </p>
                  );
                })()}
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Reason *</label>
                <select
                  name="reason"
                  value={formData.reason}
                  onChange={handleInputChange}
                  required
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                >
                  <option value="">Select a reason</option>
                  <option value="Physical count">Physical count discrepancy</option>
                  <option value="Damaged goods">Damaged goods</option>
                  <option value="Theft/Loss">Theft/Loss</option>
                  <option value="Return">Return</option>
                  <option value="Data entry error">Data entry error</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1.5">Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  rows="3"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
                  placeholder="Additional details (optional)"
                />
              </div>
              <div className="pt-4 border-t border-slate-100 flex space-x-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors shadow"
                >
                  {editMode ? 'Update Adjustment' : 'Record Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
