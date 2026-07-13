import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import API_BASE_URL from '../config';

export default function Suppliers() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'shop_admin';
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [alert, setAlert] = useState(null);

  // Sub-navigation tabs: 'directory', 'pos', 'logs'
  const [activeTab, setActiveTab] = useState('pos');

  // Supplier Profile view state (null = show tabs, non-null = supplier ID)
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [profileData, setProfileData] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileTab, setProfileTab] = useState('pos_history'); // 'pos_history', 'cost_history', 'supplied_products'

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [currentSupplier, setCurrentSupplier] = useState(null);

  const [showAddPoModal, setShowAddPoModal] = useState(false);
  const [isEditPoMode, setIsEditPoMode] = useState(false);
  const [showPoDetailsModal, setShowPoDetailsModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState(false);

  // Shared entity states
  const [productsList, setProductsList] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [costLogs, setCostLogs] = useState([]);
  const [selectedPo, setSelectedPo] = useState(null);

  // Return & Replace states
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const [selectedExpiredProduct, setSelectedExpiredProduct] = useState(null);
  const [returnFormData, setReturnFormData] = useState({ quantity: '', notes: '' });

  // Product Edit states (inside supplied products profile tab)
  const [showEditProductModal, setShowEditProductModal] = useState(false);
  const [editingProductId, setEditingProductId] = useState(null);
  const [productEditForm, setProductEditForm] = useState({ name: '', sku: '', cost_price: '', price: '', stock_quantity: '', category: '' });
  const [updatingProduct, setUpdatingProduct] = useState(false);
  const [replaceFormData, setReplaceFormData] = useState({ quantity: '', new_expiry_date: '', notes: '' });

  // Log Edit CRUD states
  const [showEditLogModal, setShowEditLogModal] = useState(false);
  const [selectedLog, setSelectedLog] = useState(null);
  const [editLogFormData, setEditLogFormData] = useState({ quantity: '', notes: '', new_expiry_date: '' });

  // Supplier CSV upload states
  const [showSupplierCsvModal, setShowSupplierCsvModal] = useState(false);
  const [supplierCsvFile, setSupplierCsvFile] = useState(null);
  const [supplierCsvUploading, setSupplierCsvUploading] = useState(false);
  const [selectedSupplierIds, setSelectedSupplierIds] = useState([]);

  // Supplier basic form state
  const [formData, setFormData] = useState({
    name: '',
    contact_name: '',
    email: '',
    phone: ''
  });

  // PO form state
  const [poFormData, setPoFormData] = useState({
    supplier_id: '',
    order_date: '',
    notes: '',
    product_id: '',
    is_new: false,
    name: '',
    sku: '',
    category: '',
    cost_price: '',
    selling_price: '',
    quantity_ordered: 1,
    unit: 'piece',
    low_stock_threshold: '10',
    payment_basis: 'cash',
    paid_amount: '',
    received_date: ''
  });

  // PO cart for multiple products
  const [poCart, setPoCart] = useState([]);
  
  // Track which cart item is being edited
  const [editingCartItemIndex, setEditingCartItemIndex] = useState(null);

  // Add product to PO cart
  const addToPoCart = () => {
    if (!poFormData.supplier_id) {
      triggerAlert('error', 'Please select a supplier first.');
      return;
    }

    if (parseFloat(poFormData.quantity_ordered) < 0) {
      triggerAlert('error', 'Quantity cannot be negative.');
      return;
    }

    if (poFormData.is_new && (!poFormData.name || !poFormData.sku)) {
      triggerAlert('error', 'Product name and SKU are required.');
      return;
    }

    if (!poFormData.is_new && !poFormData.product_id) {
      triggerAlert('error', 'Please select a product.');
      return;
    }

    const cartItem = poFormData.is_new ? {
      is_new: true,
      name: poFormData.name,
      sku: poFormData.sku,
      category: poFormData.category || '',
      quantity_ordered: parseFloat(poFormData.quantity_ordered) || 0,
      cost_price: parseFloat(poFormData.cost_price || 0),
      selling_price: parseFloat(poFormData.selling_price || 0),
      unit: poFormData.unit
    } : {
      product_id: parseInt(poFormData.product_id),
      name: poFormData.name || productSearch.split(' (')[0],
      sku: poFormData.sku || productSearch.match(/\(([^)]+)\)/)?.[1] || '',
      category: poFormData.category || '',
      quantity_ordered: parseFloat(poFormData.quantity_ordered) || 0,
      cost_price: parseFloat(poFormData.cost_price || 0),
      selling_price: parseFloat(poFormData.selling_price || 0),
      unit: poFormData.unit
    };

    // If editing an existing cart item, update it instead of adding new
    if (editingCartItemIndex !== null) {
      const updatedCart = [...poCart];
      updatedCart[editingCartItemIndex] = cartItem;
      setPoCart(updatedCart);
      setEditingCartItemIndex(null);
      triggerAlert('success', 'Product updated in cart!');
    } else {
      setPoCart([...poCart, cartItem]);
      triggerAlert('success', 'Product added to cart!');
    }

    // Reset product form fields
    setProductSearch('');
    setPoFormData(prev => ({
      ...prev,
      product_id: '',
      is_new: false,
      name: '',
      sku: '',
      category: '',
      cost_price: '',
      selling_price: '',
      quantity_ordered: 1,
      unit: 'piece'
    }));
  };

  // Remove product from PO cart
  const removeFromPoCart = (index) => {
    setPoCart(poCart.filter((_, i) => i !== index));
    // If removing the item being edited, cancel edit mode
    if (editingCartItemIndex === index) {
      setEditingCartItemIndex(null);
      // Reset form
      setProductSearch('');
      setPoFormData(prev => ({
        ...prev,
        product_id: '',
        is_new: false,
        name: '',
        sku: '',
        category: '',
        cost_price: '',
        selling_price: '',
        quantity_ordered: 1,
        unit: 'piece'
      }));
    }
  };

  // Edit product in PO cart
  const editCartItem = (index) => {
    const item = poCart[index];
    setEditingCartItemIndex(index);
    
    // Populate form with cart item data
    setPoFormData(prev => ({
      ...prev,
      product_id: item.product_id ? String(item.product_id) : '',
      is_new: item.is_new || false,
      name: item.name || '',
      sku: item.sku || '',
      category: item.category || '',
      cost_price: String(item.cost_price || ''),
      selling_price: String(item.selling_price || ''),
      quantity_ordered: item.quantity_ordered || 1,
      unit: item.unit || 'piece'
    }));

    // Set product search if it's an existing product
    if (item.product_id) {
      const product = productsList.find(p => p.id === item.product_id);
      if (product) {
        setProductSearch(`${product.name} (${product.sku})`);
      }
    }
  };

  // Cancel editing cart item
  const cancelEditCartItem = () => {
    setEditingCartItemIndex(null);
    setProductSearch('');
    setPoFormData(prev => ({
      ...prev,
      product_id: '',
      is_new: false,
      name: '',
      sku: '',
      category: '',
      cost_price: '',
      selling_price: '',
      quantity_ordered: 1,
      unit: 'piece'
    }));
  };

  // Calculate PO total from cart
  const calculatePOTotal = () => {
    return poCart.reduce((total, item) => {
      return total + (item.cost_price * item.quantity_ordered);
    }, 0);
  };

  // Receive verification form state
  const [receiveItems, setReceiveItems] = useState([]); // Array of { product_id, quantity_received, cost_price, product_name, sku }
  const [receiveNotes, setReceiveNotes] = useState('');

  // PO Filter (global PO list tab)
  const [poFilterStatus, setPoFilterStatus] = useState('all');
  const [poSearchTerm, setPoSearchTerm] = useState('');
  const [poPaymentAmount, setPoPaymentAmount] = useState('');

  // Supplier Profile - PO history filters
  const [profilePoFilter, setProfilePoFilter] = useState('all');   // 'all' | 'paid' | 'due'
  const [profilePoDateFrom, setProfilePoDateFrom] = useState('');
  const [profilePoDateTo, setProfilePoDateTo] = useState('');
  const [profilePoMonth, setProfilePoMonth] = useState('');         // 'YYYY-MM' format

  // Supplier Profile - Supplied Products search
  const [suppliedProductSearch, setSuppliedProductSearch] = useState('');

  // Pagination states
  const [supplierPage, setSupplierPage] = useState(1);
  const [poPage, setPoPage] = useState(1);
  const [logsPage, setLogsPage] = useState(1);
  const itemsPerPage = 10;

  // Load baseline directory data
  const fetchSuppliers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to retrieve suppliers.');
      const data = await response.json();
      setSuppliers(data);
    } catch (err) {
      setError(err.message);
    }
  };

  // Load products list for PO creations
  const fetchProducts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/products`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setProductsList(await response.json());
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  // Load purchase orders global list
  const fetchPurchaseOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/purchase-orders`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setPurchaseOrders(await response.json());
      }
    } catch (err) {
      console.error('Error fetching POs:', err);
    }
  };

  const handleSelectSupplier = (id) => {
    setSelectedSupplierIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleSelectAllSuppliers = (e, currentSuppliers) => {
    if (e.target.checked) {
      const ids = currentSuppliers.map(s => s.id);
      setSelectedSupplierIds(prev => Array.from(new Set([...prev, ...ids])));
    } else {
      const ids = currentSuppliers.map(s => s.id);
      setSelectedSupplierIds(prev => prev.filter(id => !ids.includes(id)));
    }
  };

  const handleBulkDeleteSuppliers = async () => {
    if (selectedSupplierIds.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedSupplierIds.length} suppliers?`)) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/bulk-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ids: selectedSupplierIds })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to bulk delete suppliers');

      triggerAlert('success', data.message || 'Suppliers deleted successfully');
      setSelectedSupplierIds([]);
      fetchSuppliers();
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  // Load cost price logs global list
  const fetchCostLogs = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/cost-price-logs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setCostLogs(await response.json());
      }
    } catch (err) {
      console.error('Error fetching cost logs:', err);
    }
  };

  // Initialize data on mount
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      await Promise.all([
        fetchSuppliers(),
        fetchProducts(),
        fetchPurchaseOrders(),
        fetchCostLogs()
      ]);
      setLoading(false);
    };
    initData();
  }, []);

  // Sync profile when selected supplier ID changes
  useEffect(() => {
    if (selectedSupplierId) {
      loadProfileData(selectedSupplierId);
      // Reset profile-level filters on supplier switch
      setProfilePoFilter('all');
      setProfilePoDateFrom('');
      setProfilePoDateTo('');
      setProfilePoMonth('');
    } else {
      setProfileData(null);
    }
  }, [selectedSupplierId]);

  // Load profile data and stats
  const loadProfileData = async (supplierId) => {
    setProfileLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/${supplierId}/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to retrieve supplier profile details.');
      const data = await response.json();
      setProfileData(data);
    } catch (err) {
      triggerAlert('error', err.message);
      setSelectedSupplierId(null);
    } finally {
      setProfileLoading(false);
    }
  };

  const triggerAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // CREATE SUPPLIER
  const handleAddSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name) {
      triggerAlert('error', 'Supplier name is required.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to create supplier.');

      triggerAlert('success', 'Supplier created successfully!');
      setShowAddModal(false);
      resetForm();
      fetchSuppliers();
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  // EDIT SUPPLIER OPEN
  const openEdit = (supplier) => {
    setCurrentSupplier(supplier);
    setFormData({
      name: supplier.name,
      contact_name: supplier.contact_name || '',
      email: supplier.email || '',
      phone: supplier.phone || ''
    });
    setShowEditModal(true);
  };

  // UPDATE SUPPLIER
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/${currentSupplier.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to update supplier.');

      triggerAlert('success', 'Supplier updated successfully!');
      setShowEditModal(false);
      resetForm();
      fetchSuppliers();
      if (selectedSupplierId === currentSupplier.id) {
        loadProfileData(currentSupplier.id);
      }
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  // DELETE SUPPLIER
  const handleDelete = async (supplierId) => {
    if (!window.confirm('Are you sure you want to delete this supplier? This will also remove associated POs and logs.')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/${supplierId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to delete supplier.');

      triggerAlert('success', 'Supplier deleted successfully!');
      setSelectedSupplierId(null);
      fetchSuppliers();
      fetchPurchaseOrders();
      fetchCostLogs();
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      contact_name: '',
      email: '',
      phone: ''
    });
    setCurrentSupplier(null);
  };

  // OPEN PO CREATION MODAL
  const [supplierSearch, setSupplierSearch] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [showSupplierSuggestions, setShowSupplierSuggestions] = useState(false);
  const [showProductSuggestions, setShowProductSuggestions] = useState(false);

  const openAddPo = (supplierId = '') => {
    const existingSupplier = suppliers.find(s => String(s.id) === String(supplierId));
    setSupplierSearch(existingSupplier ? existingSupplier.name : '');
    setProductSearch('');
    setShowSupplierSuggestions(false);
    setShowProductSuggestions(false);
    setIsEditPoMode(false);
    setPoCart([]);
    setEditingCartItemIndex(null);
    const today = new Date().toISOString().split('T')[0];
    setPoFormData({
      supplier_id: supplierId,
      order_date: today,
      notes: '',
      product_id: '',
      is_new: false,
      name: '',
      sku: '',
      category: '',
      cost_price: '',
      selling_price: '',
      quantity_ordered: 1,
      unit: 'piece',
      low_stock_threshold: '10',
      payment_basis: 'cash',
      paid_amount: '',
      received_date: ''
    });
    setShowAddPoModal(true);
  };

  const handlePoProductChange = (productId) => {
    if (productId === 'new_product') {
      setPoFormData(prev => ({
        ...prev,
        product_id: '',
        is_new: true,
        name: '',
        sku: '',
        category: '',
        cost_price: '',
        selling_price: '',
        unit: 'piece',
        low_stock_threshold: '10'
      }));
    } else {
      const prod = productsList.find(p => String(p.id) === String(productId));
      if (prod) {
        setPoFormData(prev => ({
          ...prev,
          product_id: productId,
          is_new: false,
          name: prod.name,
          sku: prod.sku,
          category: prod.category || '',
          cost_price: prod.cost_price,
          selling_price: prod.price,
          unit: prod.unit || 'piece',
          low_stock_threshold: prod.low_stock_threshold || '10'
        }));
      } else {
        setPoFormData(prev => ({
          ...prev,
          product_id: '',
          is_new: false,
          name: '',
          sku: '',
          category: '',
          cost_price: '',
          selling_price: '',
          unit: 'piece',
          low_stock_threshold: '10'
        }));
      }
    }
  };

  const openEditPo = async (po) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/purchase-orders/${po.id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Could not retrieve PO details for editing.');
      const poDetails = await response.json();

      setSelectedPo(poDetails);
      const existingSupplier = suppliers.find(s => String(s.id) === String(poDetails.supplier_id));
      setSupplierSearch(existingSupplier ? existingSupplier.name : '');
      setProductSearch('');
      setShowSupplierSuggestions(false);
      setShowProductSuggestions(false);
      setEditingCartItemIndex(null);

      setPoFormData({
        supplier_id: String(poDetails.supplier_id),
        order_date: poDetails.order_date ? poDetails.order_date.split(/T|\s/)[0] : new Date().toISOString().split('T')[0],
        notes: poDetails.notes || '',
        product_id: '',
        is_new: false,
        name: '',
        sku: '',
        category: '',
        cost_price: '',
        selling_price: '',
        quantity_ordered: 1,
        unit: 'piece',
        low_stock_threshold: '10',
        payment_basis: poDetails.payment_basis || 'cash',
        paid_amount: poDetails.paid_amount || '',
        received_date: poDetails.received_date ? poDetails.received_date.split(/T|\s/)[0] : ''
      });

      setPoCart(poDetails.items.map(item => ({
        product_id: item.product_id,
        is_new: false,
        name: item.product_name,
        sku: item.product_sku,
        category: item.product_category || '',
        quantity_ordered: item.quantity_ordered,
        cost_price: item.cost_price,
        selling_price: item.selling_price || 0,
        unit: item.unit || 'piece'
      })));

      setIsEditPoMode(true);
      setShowAddPoModal(true);
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  // SUBMIT PURCHASE ORDER
  const handlePoSubmit = async (e, poStatus = 'draft') => {
    e.preventDefault();
    if (!poFormData.supplier_id) {
      triggerAlert('error', 'Supplier selection is required.');
      return;
    }

    if (poCart.length === 0) {
      triggerAlert('error', 'Please add at least one product to the cart.');
      return;
    }

    if (poFormData.payment_basis === 'credit') {
      const paidAmt = parseFloat(poFormData.paid_amount || 0);
      const totalAmt = calculatePOTotal();
      if (isNaN(paidAmt) || paidAmt < 0) {
        triggerAlert('error', 'Initial Paid Amount must be a valid non-negative number.');
        return;
      }
      if (paidAmt > totalAmt) {
        triggerAlert('error', `Initial Paid Amount cannot exceed the total PO amount of ${formatCurrency(totalAmt)}.`);
        return;
      }
    }

    try {
      const token = localStorage.getItem('token');
      const url = isEditPoMode && selectedPo
        ? `${API_BASE_URL}/suppliers/purchase-orders/${selectedPo.id}`
        : `${API_BASE_URL}/suppliers/purchase-orders`;

      const response = await fetch(url, {
        method: isEditPoMode && selectedPo ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          supplier_id: parseInt(poFormData.supplier_id),
          order_date: poFormData.order_date || null,
          received_date: poFormData.received_date || null,
          notes: poFormData.notes,
          status: poStatus,
          payment_basis: poFormData.payment_basis,
          paid_amount: poFormData.payment_basis === 'credit' ? parseFloat(poFormData.paid_amount || 0) : undefined,
          items: poCart
        })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || `Failed to ${isEditPoMode ? 'update' : 'create'} Purchase Order.`);

      triggerAlert('success', `Purchase Order ${isEditPoMode ? 'updated' : 'created'} successfully as ${poStatus}!`);
      setShowAddPoModal(false);
      setIsEditPoMode(false);
      setSupplierSearch('');
      setProductSearch('');
      setPoCart([]);
      setPoFormData({
        supplier_id: '',
        order_date: '',
        notes: '',
        product_id: '',
        is_new: false,
        name: '',
        sku: '',
        category: '',
        cost_price: '',
        selling_price: '',
        quantity_ordered: 1,
        unit: 'piece',
        low_stock_threshold: '10',
        payment_basis: 'cash',
        paid_amount: '',
        received_date: ''
      });
      fetchPurchaseOrders();
      fetchProducts(); // Refresh products cache
      if (selectedSupplierId) {
        loadProfileData(selectedSupplierId);
      }
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  // OPEN PO DETAILS MODAL
  const openPoDetails = async (poId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/purchase-orders/${poId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Could not retrieve PO details.');
      const po = await response.json();
      setSelectedPo(po);
      setShowPoDetailsModal(true);
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  // UPDATE PO STATUS (ORDERED OR CANCELLED)
  const updatePoStatus = async (poId, status) => {
    if (status === 'cancelled' && !window.confirm('Are you sure you want to cancel this order?')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/purchase-orders/${poId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status })
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to update PO status.');

      triggerAlert('success', `PO Status updated to ${status}!`);
      fetchPurchaseOrders();
      if (selectedPo && selectedPo.id === poId) {
        openPoDetails(poId);
      }
      if (selectedSupplierId) {
        loadProfileData(selectedSupplierId);
      }
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  // OPEN RECEIVE MODAL
  const openReceiveModal = (po) => {
    setSelectedPo(po);
    setReceiveItems(po.items.map(item => {
      const qtyOrdered = item.quantity_ordered !== undefined ? item.quantity_ordered : (item.quantity !== undefined ? item.quantity : 0);
      const costPrice = item.cost_price !== undefined ? item.cost_price : (item.unit_price !== undefined ? item.unit_price : 0);
      return {
        product_id: item.product_id,
        product_name: item.product_name,
        sku: item.product_sku,
        quantity_ordered: qtyOrdered,
        quantity_received: qtyOrdered, // Default match ordered qty
        cost_price: parseFloat(costPrice),
        selling_price: parseFloat(item.selling_price || 0),
        expiry_date: item.expiry_date ? item.expiry_date.split('T')[0] : ''
      };
    }));
    setReceiveNotes('');
    setShowReceiveModal(true);
  };

  // SUBMIT CONFIRMED RECEIVE
  const handleConfirmReceive = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/purchase-orders/${selectedPo.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          status: 'received',
          notes: receiveNotes,
          items: receiveItems.map(item => ({
            product_id: item.product_id,
            quantity_received: parseInt(item.quantity_received || 0),
            cost_price: parseFloat(item.cost_price || 0),
            selling_price: parseFloat(item.selling_price || 0),
            expiry_date: item.expiry_date || null
          }))
        })
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to process PO receipt.');

      triggerAlert('success', 'Purchase Order successfully received. Inventory stock and cost price logs updated!');
      setShowReceiveModal(false);
      setShowPoDetailsModal(false);
      fetchPurchaseOrders();
      fetchCostLogs();
      if (selectedSupplierId) {
        loadProfileData(selectedSupplierId);
      }
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const handlePayPoDue = async (e) => {
    e.preventDefault();
    if (!poPaymentAmount || parseFloat(poPaymentAmount) <= 0) {
      triggerAlert('error', 'Please enter a valid payment amount.');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/purchase-orders/${selectedPo.id}/pay`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ amount: parseFloat(poPaymentAmount) })
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to record payment.');
      triggerAlert('success', 'Payment recorded successfully!');
      setPoPaymentAmount('');
      openPoDetails(selectedPo.id);
      fetchPurchaseOrders();
      fetchSuppliers();
      if (selectedSupplierId) {
        loadProfileData(selectedSupplierId);
      }
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const handleReceivedSaleChange = (idx, val) => {
    const updated = [...receiveItems];
    updated[idx].selling_price = parseFloat(val) || 0.00;
    setReceiveItems(updated);
  };

  const handleReceivedExpiryChange = (idx, val) => {
    const updated = [...receiveItems];
    updated[idx].expiry_date = val || '';
    setReceiveItems(updated);
  };

  // DELETE PURCHASE ORDER
  const handleDeletePo = async (po) => {
    const isReceived = po.status === 'received';
    const confirmMessage = isReceived
      ? 'Are you sure you want to delete this RECEIVED purchase order? This will revert product stock quantities added by this order.'
      : `Are you sure you want to delete this purchase order (${po.status})?`;

    if (!window.confirm(confirmMessage)) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/purchase-orders/${po.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to delete PO.');

      triggerAlert('success', isReceived ? 'Received Purchase Order deleted and stock reverted!' : 'Purchase Order deleted successfully.');
      fetchPurchaseOrders();
      if (selectedSupplierId) {
        loadProfileData(selectedSupplierId);
      }
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  // DELETE PRODUCT FROM PO
  const handleDeletePoItem = async (poId, productId) => {
    if (!window.confirm('Are you sure you want to delete this product from the purchase order?')) return;
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/purchase-orders/${poId}/items/${productId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to remove product from Purchase Order.');

      triggerAlert('success', 'Product removed from Purchase Order successfully.');
      openPoDetails(poId); // Refresh details modal
      fetchPurchaseOrders(); // Refresh global PO list
      if (selectedSupplierId) {
        loadProfileData(selectedSupplierId); // Refresh profile if open
      }
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const handleReturnSubmit = async (e) => {
    e.preventDefault();
    if (!selectedExpiredProduct || !returnFormData.quantity || parseInt(returnFormData.quantity) <= 0) {
      triggerAlert('error', 'Please enter a valid quantity.');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/${selectedSupplierId}/returns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          product_id: selectedExpiredProduct.id,
          quantity: parseInt(returnFormData.quantity),
          action_type: 'return',
          notes: returnFormData.notes
        })
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to complete return.');

      triggerAlert('success', 'Product return processed successfully!');
      setShowReturnModal(false);
      setReturnFormData({ quantity: '', notes: '' });
      setSelectedExpiredProduct(null);
      loadProfileData(selectedSupplierId);
      fetchProducts(); // Refresh products
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const handleReplaceSubmit = async (e) => {
    e.preventDefault();
    if (!selectedExpiredProduct || !replaceFormData.quantity || parseInt(replaceFormData.quantity) <= 0 || !replaceFormData.new_expiry_date) {
      triggerAlert('error', 'Please fill out all fields.');
      return;
    }
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/${selectedSupplierId}/returns`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          product_id: selectedExpiredProduct.id,
          quantity: parseInt(replaceFormData.quantity),
          action_type: 'replace',
          new_expiry_date: replaceFormData.new_expiry_date,
          notes: replaceFormData.notes
        })
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to complete replacement.');

      triggerAlert('success', 'Product replacement processed successfully!');
      setShowReplaceModal(false);
      setReplaceFormData({ quantity: '', new_expiry_date: '', notes: '' });
      setSelectedExpiredProduct(null);
      loadProfileData(selectedSupplierId);
      fetchProducts(); // Refresh products
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const handleDeleteLog = async (log) => {
    const confirmMsg = log.action_type === 'return'
      ? `Are you sure you want to delete this return log? This will revert product stock quantity by adding ${log.quantity} units back.`
      : 'Are you sure you want to delete this replacement log?';
    if (!window.confirm(confirmMsg)) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/returns/${log.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to delete log.');

      triggerAlert('success', 'Log entry deleted and inventory reverted successfully!');
      loadProfileData(selectedSupplierId);
      fetchProducts(); // Refresh products
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const handleEditLogSubmit = async (e) => {
    e.preventDefault();
    if (!selectedLog || !editLogFormData.quantity || parseInt(editLogFormData.quantity) <= 0) {
      triggerAlert('error', 'Please enter a valid quantity.');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/returns/${selectedLog.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          quantity: parseInt(editLogFormData.quantity),
          notes: editLogFormData.notes,
          new_expiry_date: selectedLog.action_type === 'replace' ? editLogFormData.new_expiry_date : undefined
        })
      });
      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to update log.');

      triggerAlert('success', 'Log entry updated and inventory adjusted successfully!');
      setShowEditLogModal(false);
      setSelectedLog(null);
      setEditLogFormData({ quantity: '', notes: '', new_expiry_date: '' });
      loadProfileData(selectedSupplierId);
      fetchProducts(); // Refresh products
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const handleSaveProductEdit = async (e) => {
    e.preventDefault();
    if (!editingProductId) return;

    setUpdatingProduct(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/products/${editingProductId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: productEditForm.name,
          sku: productEditForm.sku,
          cost_price: parseFloat(productEditForm.cost_price),
          price: parseFloat(productEditForm.price),
          stock_quantity: parseFloat(productEditForm.stock_quantity),
          category: productEditForm.category
        })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to update product.');

      triggerAlert('success', data.message || 'Product updated successfully.');
      setShowEditProductModal(false);
      setEditingProductId(null);

      // Refresh products list and reload profile data
      await fetchProducts();
      if (selectedSupplierId) {
        await loadProfileData(selectedSupplierId);
      }
    } catch (err) {
      triggerAlert('error', err.message);
    } finally {
      setUpdatingProduct(false);
    }
  };

  const handleSupplierCsvUpload = async (e) => {
    e.preventDefault();
    if (!supplierCsvFile) {
      triggerAlert('error', 'Please select a CSV file.');
      return;
    }

    setSupplierCsvUploading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('csv_file', supplierCsvFile);

      const response = await fetch(`${API_BASE_URL}/products/bulk-upload?supplier_id=${selectedSupplierId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to upload CSV.');

      // Show detailed summary/alerts
      if (resData.error_count > 0 && resData.errors && resData.errors.length > 0) {
        const errorMsg = `${resData.message}\n\nErrors:\n${resData.errors.slice(0, 5).join('\n')}`;
        triggerAlert('error', errorMsg);
      } else {
        triggerAlert('success', resData.message || 'Supplied products imported successfully!');
      }

      setShowSupplierCsvModal(false);
      setSupplierCsvFile(null);

      // Reload profile data & baseline products
      await Promise.all([
        loadProfileData(selectedSupplierId),
        fetchProducts()
      ]);
    } catch (err) {
      triggerAlert('error', err.message);
    } finally {
      setSupplierCsvUploading(false);
    }
  };

  // HELPER FORMATTERS
  const formatCurrency = (val) => `৳${parseFloat(val).toFixed(2)}`;
  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  // FILTERED PURCHASE ORDERS FOR LISTINGS
  const getFilteredPOs = (ordersList) => {
    let filtered = ordersList;
    if (poFilterStatus !== 'all') {
      filtered = filtered.filter(o => o.status === poFilterStatus);
    }
    if (poSearchTerm.trim() !== '') {
      const term = poSearchTerm.toLowerCase();
      filtered = filtered.filter(o => 
        o.supplier_name?.toLowerCase().includes(term) || 
        String(o.id).includes(term)
      );
    }
    return filtered;
  };

  const handleDownloadPOCSV = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/purchase-orders/export/csv`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to download CSV.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `purchase_orders_export_${new Date().toBDISODateString()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      triggerAlert('success', 'CSV downloaded successfully!');
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const handleDownloadPOPDF = () => {
    try {
      const filteredPOs = getFilteredPOs(purchaseOrders);
      if (filteredPOs.length === 0) {
        triggerAlert('error', 'No purchase orders to export.');
        return;
      }

      const doc = new jsPDF();
      const tableData = filteredPOs.map(po => [
        `#PO-${po.id}`,
        po.supplier_name,
        po.order_date ? po.order_date.split('T')[0] : '-',
        po.payment_basis || 'cash',
        `Tk ${parseFloat(po.total_amount || 0).toFixed(2)}`,
        `Tk ${parseFloat(po.paid_amount || 0).toFixed(2)}`,
        `Tk ${parseFloat(po.due_amount || 0).toFixed(2)}`,
        po.status
      ]);

      autoTable(doc, {
        head: [['PO ID', 'Supplier', 'Order Date', 'Payment Basis', 'Total', 'Paid', 'Due', 'Status']],
        body: tableData,
        startY: 25,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { top: 25, right: 10, bottom: 20, left: 10 }
      });

      doc.setFontSize(16);
      doc.text('Purchase Orders', 14, 15);
      doc.setFontSize(10);
      doc.text(`Total Orders: ${filteredPOs.length}`, 14, doc.lastAutoTable.finalY + 10);

      doc.save(`purchase_orders_export_${new Date().toBDISODateString()}.pdf`);
      triggerAlert('success', 'PDF downloaded successfully!');
    } catch (err) {
      triggerAlert('error', 'Failed to generate PDF.');
    }
  };

  const handleDownloadCostLogsCSV = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/suppliers/cost-price-logs/export/csv`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to download CSV.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `cost_price_logs_export_${new Date().toBDISODateString()}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      triggerAlert('success', 'CSV downloaded successfully!');
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const handleDownloadCostLogsPDF = () => {
    try {
      if (costLogs.length === 0) {
        triggerAlert('error', 'No cost price logs to export.');
        return;
      }

      const doc = new jsPDF();
      const tableData = costLogs.map(log => [
        log.id,
        log.created_at ? log.created_at.split('T')[0] : '-',
        log.product_name || '-',
        log.product_sku || '-',
        log.supplier_name || '-',
        `Tk ${parseFloat(log.old_cost_price || 0).toFixed(2)}`,
        `Tk ${parseFloat(log.new_cost_price || 0).toFixed(2)}`,
        log.reason || '-'
      ]);

      autoTable(doc, {
        head: [['Log ID', 'Date', 'Product Name', 'Product SKU', 'Supplier', 'Old Cost', 'New Cost', 'Reason']],
        body: tableData,
        startY: 25,
        styles: { fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: [51, 65, 85], textColor: 255, fontStyle: 'bold' },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        margin: { top: 25, right: 10, bottom: 20, left: 10 }
      });

      doc.setFontSize(16);
      doc.text('Cost Price Logs', 14, 15);
      doc.setFontSize(10);
      doc.text(`Total Logs: ${costLogs.length}`, 14, doc.lastAutoTable.finalY + 10);

      doc.save(`cost_price_logs_export_${new Date().toBDISODateString()}.pdf`);
      triggerAlert('success', 'PDF downloaded successfully!');
    } catch (err) {
      triggerAlert('error', 'Failed to generate PDF.');
    }
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'draft':
        return 'bg-slate-100 text-slate-700 border-slate-200';
      case 'ordered':
        return 'bg-amber-100 text-amber-800 border-amber-200 animate-pulse';
      case 'received':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'cancelled':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  // PROFILE RENDER
  if (selectedSupplierId && profileData) {
    const { supplier, stats, purchaseOrders: sPOs, costLogs: sLogs } = profileData;

    // Apply profile-level PO filters
    const filteredProfilePOs = sPOs.filter(po => {
      // Payment status filter
      if (profilePoFilter === 'paid' && parseFloat(po.due_amount || 0) > 0) return false;
      if (profilePoFilter === 'due' && parseFloat(po.due_amount || 0) <= 0) return false;

      // Date range filter
      const poDate = new Date(po.order_date);
      if (profilePoDateFrom) {
        const from = new Date(profilePoDateFrom);
        from.setHours(0, 0, 0, 0);
        if (poDate < from) return false;
      }
      if (profilePoDateTo) {
        const to = new Date(profilePoDateTo);
        to.setHours(23, 59, 59, 999);
        if (poDate > to) return false;
      }

      // Month filter (overrides date range if set)
      if (profilePoMonth) {
        const [yr, mo] = profilePoMonth.split('-').map(Number);
        if (poDate.getFullYear() !== yr || poDate.getMonth() + 1 !== mo) return false;
      }

      return true;
    });

    // Unique list of products this supplier has supplied or historically adjusted
    const logProductIds = sLogs.map(l => String(l.product_id));
    const directProductIds = productsList
      .filter(p => String(p.supplier_id) === String(supplier.id))
      .map(p => String(p.id));

    const uniqueProducts = Array.from(new Set([...logProductIds, ...directProductIds]))
      .map(id => {
        const pDetails = productsList.find(p => String(p.id) === String(id));
        const log = sLogs.find(l => String(l.product_id) === String(id));
        return {
          id,
          name: pDetails ? pDetails.name : (log ? log.product_name : 'Unknown Product'),
          sku: pDetails ? pDetails.sku : (log ? log.product_sku : 'N/A'),
          category: pDetails ? (pDetails.category || '') : '',
          stock: pDetails ? pDetails.stock_quantity : 'N/A',
          stock_quantity: pDetails ? pDetails.stock_quantity : 0,
          current_cost: pDetails ? pDetails.cost_price : (log ? log.new_cost_price : 0)
        };
      });

    // Filter uniqueProducts by search term
    const filteredUniqueProducts = uniqueProducts.filter(p => {
      if (!suppliedProductSearch) return true;
      const search = suppliedProductSearch.toLowerCase();
      return (p.name && p.name.toLowerCase().includes(search)) ||
        (p.sku && p.sku.toLowerCase().includes(search));
    });

    // Group supplied products by category
    const groupedProducts = filteredUniqueProducts.reduce((acc, p) => {
      const cat = p.category && p.category.trim() !== '' ? p.category.trim() : 'Uncategorized';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(p);
      return acc;
    }, {});

    // Calculate Total Spent based on Cost Price * Active Stock
    const calculatedTotalSpent = uniqueProducts.reduce((sum, p) => {
      const cost = parseFloat(p.current_cost) || 0;
      const stock = parseFloat(p.stock_quantity) || 0;
      return sum + (cost * stock);
    }, 0);

    return (
      <div className="space-y-6">
        {/* Alerts Banner */}
        {alert && (
          <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg flex items-center transition-all ${alert.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
            }`}>
            <span className="text-sm font-semibold">{alert.message}</span>
          </div>
        )}

        {/* Back and Header Card */}
        <div className="flex items-center space-x-4">
          <button
            onClick={() => setSelectedSupplierId(null)}
            className="p-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl transition-colors"
            title="Back to Directory"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </button>
          <div>
            <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Supplier Profile</span>
            <h2 className="text-2xl font-bold text-slate-800">{supplier.name}</h2>
          </div>
        </div>

        {/* Info & Stats Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Supplier details card */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-4">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Contact Card</h3>
              <button
                onClick={() => openEdit(supplier)}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
              >
                Edit Vendor Details
              </button>
            </div>

            <div className="space-y-3.5 text-sm">
              <div>
                <span className="block text-xs font-semibold text-slate-400">CONTACT REPRESENTATIVE</span>
                <span className="font-semibold text-slate-700">{supplier.contact_name || 'N/A'}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-400">EMAIL ADDRESS</span>
                <span className="font-semibold text-slate-700">{supplier.email || 'N/A'}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-400">PHONE NUMBER</span>
                <span className="font-semibold text-slate-700">{supplier.phone || 'N/A'}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-400">VENDOR REGISTERED</span>
                <span className="font-semibold text-slate-700">{new Date(supplier.created_at).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="block text-xs font-semibold text-slate-400">OUTSTANDING DUE BALANCE</span>
                <span className="font-extrabold text-rose-650 bg-rose-50 px-2 py-0.5 rounded border border-rose-100 inline-block mt-1">
                  {formatCurrency(supplier.due_balance || 0)}
                </span>
              </div>
            </div>
            <div className="pt-2">
              <button
                onClick={() => handleDelete(supplier.id)}
                className="w-full text-center py-2 border border-rose-100 bg-rose-50/50 hover:bg-rose-50 text-rose-600 font-semibold text-xs rounded-xl transition-all"
              >
                Delete Supplier
              </button>
            </div>
          </div>

          {/* Quick Stats Block */}
          <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-6">
            {/* KPI 1 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-emerald-50 text-emerald-500 rounded-xl">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Spent</span>
              </div>
              <div className="mt-4">
                <span className="block text-2xl font-black text-slate-800">{formatCurrency(calculatedTotalSpent)}</span>
                <span className="text-xs text-slate-400">Based on Cost Price × Active Stock</span>
              </div>
            </div>

            {/* KPI 2 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-indigo-50 text-indigo-500 rounded-xl">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Completed POs</span>
              </div>
              <div className="mt-4">
                <span className="block text-2xl font-black text-slate-800">{stats.poStats.received}</span>
                <span className="text-xs text-slate-400">Shipments fully received</span>
              </div>
            </div>

            {/* KPI 3 */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-amber-50 text-amber-500 rounded-xl">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Active Orders</span>
              </div>
              <div className="mt-4">
                <span className="block text-2xl font-black text-slate-800">
                  {stats.poStats.draft + stats.poStats.ordered}
                </span>
                <span className="text-xs text-slate-400">{stats.poStats.ordered} ordered · {stats.poStats.draft} draft</span>
              </div>
            </div>
          </div>
        </div>

        {/* Details Section tabs */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="flex border-b border-slate-100 bg-slate-50/50">
            <button
              onClick={() => setProfileTab('pos_history')}
              className={`px-6 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${profileTab === 'pos_history'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-450 hover:text-slate-700'
                }`}
            >
              Purchase Orders ({sPOs.length})
            </button>
            <button
              onClick={() => setProfileTab('cost_history')}
              className={`px-6 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${profileTab === 'cost_history'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-450 hover:text-slate-700'
                }`}
            >
              Cost Logs ({sLogs.length})
            </button>
            <button
              onClick={() => setProfileTab('supplied_products')}
              className={`px-6 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${profileTab === 'supplied_products'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-450 hover:text-slate-700'
                }`}
            >
              Supplied Products ({uniqueProducts.length})
            </button>
            <button
              onClick={() => setProfileTab('expired_products')}
              className={`px-6 py-4 text-xs font-bold uppercase tracking-wider border-b-2 transition-all ${profileTab === 'expired_products'
                ? 'border-indigo-600 text-indigo-600 bg-white'
                : 'border-transparent text-slate-450 hover:text-slate-700'
                }`}
            >
              Expired & Returns ({profileData.expiredProducts?.length || 0})
            </button>
          </div>

          <div className="p-6">
            {profileTab === 'pos_history' && (
              <div className="space-y-4">
                {/* Filter bar */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Payment Status:</span>
                      {['all', 'paid', 'due'].map(f => (
                        <button
                          key={f}
                          onClick={() => setProfilePoFilter(f)}
                          className={`px-3 py-1 rounded-lg text-xs font-bold border transition-all ${profilePoFilter === f
                            ? f === 'paid'
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                              : f === 'due'
                                ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                                : 'bg-slate-700 text-white border-slate-700 shadow-sm'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                            }`}
                        >
                          {f === 'all' ? 'All POs' : f === 'paid' ? '✓ Fully Paid' : '⚠ Has Due'}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => openAddPo(supplier.id)}
                      className="bg-slate-600 hover:bg-indigo-700 text-white font-semibold py-1.5 px-4 rounded-lg text-xs shadow-sm transition-colors"
                    >
                      + Add Purchase Order
                    </button>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date Range:</span>
                      <input
                        type="date"
                        value={profilePoDateFrom}
                        onChange={e => { setProfilePoDateFrom(e.target.value); setProfilePoMonth(''); }}
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 text-slate-700"
                        placeholder="From"
                      />
                      <span className="text-slate-400 text-xs font-semibold">→</span>
                      <input
                        type="date"
                        value={profilePoDateTo}
                        onChange={e => { setProfilePoDateTo(e.target.value); setProfilePoMonth(''); }}
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 text-slate-700"
                        placeholder="To"
                      />
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Month:</span>
                      <input
                        type="month"
                        value={profilePoMonth}
                        onChange={e => { setProfilePoMonth(e.target.value); setProfilePoDateFrom(''); setProfilePoDateTo(''); }}
                        className="text-xs border border-slate-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-indigo-400 text-slate-700"
                      />
                    </div>
                    {(profilePoFilter !== 'all' || profilePoDateFrom || profilePoDateTo || profilePoMonth) && (
                      <button
                        onClick={() => { setProfilePoFilter('all'); setProfilePoDateFrom(''); setProfilePoDateTo(''); setProfilePoMonth(''); }}
                        className="text-xs font-semibold text-rose-500 hover:text-rose-700 underline transition-colors"
                      >
                        Clear Filters
                      </button>
                    )}
                    <span className="ml-auto text-[10px] font-bold text-slate-400">
                      Showing <span className="text-slate-700">{filteredProfilePOs.length}</span> of <span className="text-slate-700">{sPOs.length}</span> POs
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                        <th className="p-3">PO ID</th>
                        <th className="p-3">Order Date</th>
                        <th className="p-3">Basis</th>
                        <th className="p-3">Total</th>
                        <th className="p-3">Paid</th>
                        <th className="p-3">Due</th>
                        <th className="p-3">Status</th>
                        <th className="p-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {filteredProfilePOs.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="p-8 text-center text-slate-400">
                            {sPOs.length === 0 ? 'No POs recorded.' : 'No POs match the selected filters.'}
                          </td>
                        </tr>
                      ) : (
                        filteredProfilePOs.map(po => (
                          <tr key={po.id} className="hover:bg-slate-50/50">
                            <td className="p-3 font-mono font-bold text-slate-700">#PO-{po.id}</td>
                            <td className="p-3 text-slate-600">{formatDate(po.order_date).split(',')[0]}</td>
                            <td className="p-3">
                              <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase border ${po.payment_basis === 'credit'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                }`}>
                                {po.payment_basis || 'cash'}
                              </span>
                            </td>
                            <td className="p-3 font-bold text-slate-800">{formatCurrency(po.total_amount)}</td>
                            <td className="p-3 text-emerald-600 font-semibold">{formatCurrency(po.paid_amount || 0)}</td>
                            <td className="p-3 text-rose-650 font-bold">{formatCurrency(po.due_amount || 0)}</td>
                            <td className="p-3">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadge(po.status)}`}>
                                {po.status}
                              </span>
                            </td>
                            <td className="p-3 text-center space-x-2">
                              <button
                                onClick={() => openPoDetails(po.id)}
                                className="text-indigo-600 hover:text-indigo-800 font-semibold"
                              >
                                Details
                              </button>
                              {po.status === 'ordered' && (
                                <button
                                  onClick={() => openPoDetails(po.id)}
                                  className="text-emerald-600 hover:text-emerald-800 font-bold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100"
                                >
                                  Receive
                                </button>
                              )}
                              <button
                                onClick={() => openEditPo(po)}
                                className="text-indigo-600 hover:text-indigo-800 font-semibold mr-3"
                              >
                                Edit
                              </button>
                              {po.status === 'draft' && (
                                <button
                                  onClick={() => updatePoStatus(po.id, 'ordered')}
                                  className="text-amber-600 hover:text-gray-850 font-semibold mr-3"
                                >
                                  Place Order
                                </button>
                              )}
                              <button
                                onClick={() => handleDeletePo(po)}
                                className="text-rose-600 hover:text-rose-850 font-semibold"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {profileTab === 'cost_history' && (
              <div className="space-y-4">
                <h4 className="font-bold text-slate-700 text-sm">Product cost changes from this vendor</h4>
                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                        <th className="p-3">Date</th>
                        <th className="p-3">SKU</th>
                        <th className="p-3">Product Name</th>
                        <th className="p-3">Old Cost</th>
                        <th className="p-3">New Cost</th>
                        <th className="p-3">Difference</th>
                        <th className="p-3">Reason</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {sLogs.length === 0 ? (
                        <tr>
                          <td colSpan="7" className="p-8 text-center text-slate-400">No cost price logs matching this supplier.</td>
                        </tr>
                      ) : (
                        sLogs.map(log => {
                          const diff = parseFloat(log.new_cost_price) - parseFloat(log.old_cost_price);
                          return (
                            <tr key={log.id} className="hover:bg-slate-50/50">
                              <td className="p-3 text-slate-600">{formatDate(log.created_at)}</td>
                              <td className="p-3 font-mono text-slate-500 font-bold">{log.product_sku}</td>
                              <td className="p-3 font-semibold text-slate-800">{log.product_name}</td>
                              <td className="p-3 text-slate-550">{formatCurrency(log.old_cost_price)}</td>
                              <td className="p-3 font-extrabold text-slate-850">{formatCurrency(log.new_cost_price)}</td>
                              <td className="p-3">
                                {diff === 0 ? (
                                  <span className="text-slate-400 font-semibold">-</span>
                                ) : diff > 0 ? (
                                  <span className="text-rose-600 font-bold bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100">
                                    +{formatCurrency(diff)} ▲
                                  </span>
                                ) : (
                                  <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                                    {formatCurrency(diff)} ▼
                                  </span>
                                )}
                              </td>
                              <td className="p-3 font-medium text-indigo-600">{log.change_reason}</td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {profileTab === 'supplied_products' && (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-1 rounded-xl gap-3">
                  <h4 className="font-bold text-slate-700 text-sm">Products currently cataloged from this vendor</h4>
                  <div className="flex items-center space-x-3 w-full sm:w-auto">
                    <div className="relative w-full sm:w-64">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        placeholder="Search by name or SKU..."
                        value={suppliedProductSearch}
                        onChange={(e) => setSuppliedProductSearch(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                    <button
                      onClick={() => setShowSupplierCsvModal(true)}
                      className="bg-indigo-650 hover:bg-indigo-700 text-white font-semibold py-1.5 px-3 rounded-lg text-xs shadow-xs transition-colors flex items-center space-x-1.5 shrink-0"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                      <span className="hidden sm:inline">Import CSV</span>
                      <span className="sm:hidden">CSV</span>
                    </button>
                  </div>
                </div>
                <div className="overflow-x-auto border border-slate-100 rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                        <th className="p-3">SKU</th>
                        <th className="p-3">Product Name</th>
                        <th className="p-3">Last Cost Price</th>
                        <th className="p-3">Current Active Stock</th>
                        <th className="p-3 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {uniqueProducts.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs bg-white border border-slate-100 rounded-xl">No products recorded.</div>
                      ) : (
                        <div className="space-y-6">
                          {Object.entries(groupedProducts).map(([category, prods]) => (
                            <div key={category} className="space-y-2.5">
                              <div className="flex items-center space-x-2">
                                <span className="bg-indigo-50 text-indigo-700 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-indigo-150 uppercase tracking-wider">
                                  {category}
                                </span>
                                <span className="text-[10px] font-semibold text-slate-400">
                                  ({prods.length} {prods.length === 1 ? 'item' : 'items'})
                                </span>
                              </div>
                              <div className="overflow-x-auto border border-slate-100 rounded-xl bg-white">
                                <table className="w-full text-left border-collapse">
                                  <thead>
                                    <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                                      <th className="p-3">SKU</th>
                                      <th className="p-3">Product Name</th>
                                      <th className="p-3">Last Cost Price</th>
                                      <th className="p-3">Current Active Stock</th>
                                      <th className="p-3 text-center">Actions</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100 text-xs">
                                    {prods.map(p => (
                                      <tr key={p.id} className="hover:bg-slate-50/50">
                                        <td className="p-3 font-mono font-bold text-slate-500">{p.sku}</td>
                                        <td className="p-3 font-semibold text-slate-800">{p.name}</td>
                                        <td className="p-3 text-slate-750 font-bold">{formatCurrency(p.current_cost)}</td>
                                        <td className="p-3">
                                          <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded border border-slate-200">
                                            {p.stock} units
                                          </span>
                                        </td>
                                        <td className="p-3 text-center flex items-center justify-center space-x-1.5">
                                          {isAdmin && (
                                            <button
                                              onClick={() => {
                                                const fullProd = productsList.find(item => String(item.id) === String(p.id));
                                                if (fullProd) {
                                                  setEditingProductId(p.id);
                                                  setProductEditForm({
                                                    name: fullProd.name,
                                                    sku: fullProd.sku,
                                                    cost_price: fullProd.cost_price,
                                                    price: fullProd.price,
                                                    stock_quantity: fullProd.stock_quantity,
                                                    category: fullProd.category || ''
                                                  });
                                                  setShowEditProductModal(true);
                                                }
                                              }}
                                              className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 font-bold py-1 px-2.5 rounded text-xs transition-colors"
                                            >
                                              Edit
                                            </button>
                                          )}
                                          <button
                                            onClick={() => {
                                              setSelectedExpiredProduct(p);
                                              setReturnFormData({ quantity: String(p.stock_quantity || 0), notes: '' });
                                              setShowReturnModal(true);
                                            }}
                                            disabled={!(p.stock_quantity > 0)}
                                            className={`font-bold py-1 px-2.5 rounded border transition-colors ${p.stock_quantity > 0
                                              ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border-amber-200'
                                              : 'bg-slate-50 text-slate-400 border-slate-200 cursor-not-allowed'
                                              }`}
                                            title={p.stock_quantity > 0 ? "Return to Supplier" : "No stock available to return"}
                                          >
                                            Return
                                          </button>
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {profileTab === 'expired_products' && (
              <div className="space-y-6">
                <div>
                  <h4 className="font-bold text-slate-700 text-sm mb-3">Expired Products from this Supplier</h4>
                  <div className="overflow-x-auto border border-slate-100 rounded-xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                          <th className="p-3">SKU</th>
                          <th className="p-3">Product Name</th>
                          <th className="p-3">Expiry Date</th>
                          <th className="p-3">Current Stock</th>
                          <th className="p-3 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {!profileData.expiredProducts || profileData.expiredProducts.length === 0 ? (
                          <tr>
                            <td colSpan="5" className="p-8 text-center text-slate-400">No expired products found from this vendor.</td>
                          </tr>
                        ) : (
                          profileData.expiredProducts.map(p => (
                            <tr key={p.id} className="hover:bg-slate-50/50">
                              <td className="p-3 font-mono font-bold text-slate-500">{p.sku}</td>
                              <td className="p-3 font-semibold text-slate-800">{p.name}</td>
                              <td className="p-3">
                                <span className="text-rose-600 font-bold bg-rose-50 px-2 py-0.5 rounded border border-rose-100">
                                  {new Date(p.expiry_date).toLocaleDateString()}
                                </span>
                              </td>
                              <td className="p-3 font-semibold">{p.stock_quantity} units</td>
                              <td className="p-3 text-center space-x-2">
                                <button
                                  onClick={() => {
                                    setSelectedExpiredProduct(p);
                                    setReturnFormData({ quantity: String(p.stock_quantity), notes: '' });
                                    setShowReturnModal(true);
                                  }}
                                  className="bg-amber-50 hover:bg-amber-100 text-amber-700 font-bold py-1 px-2.5 rounded border border-amber-200 transition-colors"
                                >
                                  Return to Supplier
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedExpiredProduct(p);
                                    setReplaceFormData({ quantity: String(p.stock_quantity), new_expiry_date: '', notes: '' });
                                    setShowReplaceModal(true);
                                  }}
                                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold py-1 px-2.5 rounded border border-emerald-200 transition-colors"
                                >
                                  Replace Product
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div>
                  <h4 className="font-bold text-slate-700 text-sm mb-3">Return & Replacement Log History</h4>
                  <div className="overflow-x-auto border border-slate-100 rounded-xl">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                          <th className="p-3">Date</th>
                          <th className="p-3">SKU</th>
                          <th className="p-3">Product Name</th>
                          <th className="p-3">Qty</th>
                          <th className="p-3">Action Type</th>
                          <th className="p-3">New Expiry Date</th>
                          <th className="p-3">Notes</th>
                          <th className="p-3 text-center">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs">
                        {!profileData.returnsHistory || profileData.returnsHistory.length === 0 ? (
                          <tr>
                            <td colSpan="8" className="p-8 text-center text-slate-400">No returns or replacements history logged.</td>
                          </tr>
                        ) : (
                          profileData.returnsHistory.map(log => (
                            <tr key={log.id} className="hover:bg-slate-50/50">
                              <td className="p-3 text-slate-650">{formatDate(log.created_at)}</td>
                              <td className="p-3 font-mono text-slate-500 font-bold">{log.product_sku}</td>
                              <td className="p-3 font-semibold text-slate-800">{log.product_name}</td>
                              <td className="p-3 font-bold">{log.quantity}</td>
                              <td className="p-3">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${log.action_type === 'return'
                                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                  }`}>
                                  {log.action_type === 'return' ? 'Returned' : 'Replaced'}
                                </span>
                              </td>
                              <td className="p-3 text-slate-650">{log.new_expiry_date ? new Date(log.new_expiry_date).toLocaleDateString() : '-'}</td>
                              <td className="p-3 text-slate-600 italic">{log.notes || '-'}</td>
                              <td className="p-3 text-center space-x-2">
                                <button
                                  onClick={() => {
                                    setSelectedLog(log);
                                    setEditLogFormData({
                                      quantity: String(log.quantity),
                                      notes: log.notes || '',
                                      new_expiry_date: log.new_expiry_date ? log.new_expiry_date.split('T')[0] : ''
                                    });
                                    setShowEditLogModal(true);
                                  }}
                                  className="text-indigo-650 hover:text-indigo-900 font-bold"
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => handleDeleteLog(log)}
                                  className="text-rose-600 hover:text-rose-900 font-bold"
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RENDER EDIT SUPPLIER MODAL */}
        {showEditModal && renderSupplierFormModal(true)}

        {/* RENDER PO DETAILS MODAL */}
        {showPoDetailsModal && renderPoDetailsModal()}

        {/* RENDER RECEIVE MODAL */}
        {showReceiveModal && renderReceiveModal()}

        {/* RENDER ADD PO MODAL */}
        {showAddPoModal && renderAddPoModal()}

        {/* RENDER RETURN MODAL */}
        {showReturnModal && renderReturnModal()}

        {/* RENDER REPLACE MODAL */}
        {showReplaceModal && renderReplaceModal()}

        {/* RENDER EDIT LOG MODAL */}
        {showEditLogModal && renderEditLogModal()}

        {/* RENDER SUPPLIER CSV UPLOAD MODAL */}
        {showSupplierCsvModal && renderSupplierCsvUploadModal()}

        {/* RENDER EDIT PRODUCT MODAL */}
        {showEditProductModal && renderEditProductModal()}
      </div>
    );
  }

  // --- GENERAL LAYOUTS RENDER (selectedSupplierId is null) ---
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
          <h2 className="text-2xl font-bold text-slate-800">Supplier Directory</h2>
          <p className="text-sm text-slate-500">Manage vendor profiles, purchase orders, and cost price changes</p>
        </div>
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <button
            onClick={() => openAddPo()}
            className="bg-[#C4A484] hover:bg-[#A67B5B] text-white font-semibold py-2.5 px-5 border border-slate-200 rounded-xl text-sm shadow-xs transition-colors flex items-center space-x-2"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span>Create Purchase Order</span>
          </button>
          <button
            onClick={() => { resetForm(); setShowAddModal(true); }}
            className="bg-slate-600 hover:bg-indigo-700 text-white font-semibold py-2.5 px-5 rounded-xl text-sm shadow-sm transition-colors flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
            </svg>
            <span>Add New Supplier</span>
          </button>
          {activeTab === 'directory' && selectedSupplierIds.length > 0 && (
            <button
              onClick={handleBulkDeleteSuppliers}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 px-5 rounded-xl text-sm shadow-sm transition-colors flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Delete Selected ({selectedSupplierIds.length})</span>
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-slate-200 space-x-2 bg-slate-100/50 p-1.5 rounded-xl">
        <button
          onClick={() => setActiveTab('pos')}
          className={`flex-1 sm:flex-initial text-center px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'pos'
            ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/40'
            : 'text-slate-500 hover:text-slate-800'
            }`}
        >
          Purchase Orders
        </button>
        <button
          onClick={() => setActiveTab('directory')}
          className={`flex-1 sm:flex-initial text-center px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'directory'
            ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/40'
            : 'text-slate-500 hover:text-slate-800'
            }`}
        >
          Vendors Directory
        </button>

        <button
          onClick={() => setActiveTab('logs')}
          className={`flex-1 sm:flex-initial text-center px-5 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'logs'
            ? 'bg-white text-indigo-600 shadow-sm border border-slate-200/40'
            : 'text-slate-500 hover:text-slate-800'
            }`}
        >
          Cost Price Logs
        </button>
      </div>

      {/* --- TAB: DIRECTORY --- */}
      {activeTab === 'directory' && (() => {
        const totalSupplierPages = Math.ceil(suppliers.length / itemsPerPage);
        const indexOfFirstSupplier = (supplierPage - 1) * itemsPerPage;
        const indexOfLastSupplier = supplierPage * itemsPerPage;
        const paginatedSuppliers = suppliers.slice(indexOfFirstSupplier, indexOfLastSupplier);

        return (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                      <th className="p-4 w-12 text-center">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500"
                          checked={suppliers.length > 0 && suppliers.every(s => selectedSupplierIds.includes(s.id))}
                          onChange={(e) => handleSelectAllSuppliers(e, suppliers)}
                        />
                      </th>
                      <th className="p-4">Supplier Name</th>
                      <th className="p-4">Contact Person</th>
                      <th className="p-4">Email</th>
                      <th className="p-4">Phone</th>
                      <th className="p-4">Outstanding Due</th>
                      <th className="p-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {loading ? (
                      <tr>
                        <td colSpan="6" className="p-12 text-center">
                          <div className="flex justify-center items-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
                          </div>
                        </td>
                      </tr>
                    ) : suppliers.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="p-12 text-center text-slate-400">
                          No suppliers listed yet. Add a supplier to begin.
                        </td>
                      </tr>
                    ) : (
                      paginatedSuppliers.map((supplier) => (
                        <tr key={supplier.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 text-center">
                            <input
                              type="checkbox"
                              className="w-4 h-4 text-indigo-600 rounded border-slate-300 focus:ring-indigo-500 cursor-pointer"
                              checked={selectedSupplierIds.includes(supplier.id)}
                              onChange={() => handleSelectSupplier(supplier.id)}
                            />
                          </td>
                          <td className="p-4 font-semibold text-slate-800">{supplier.name}</td>
                          <td className="p-4 text-slate-700">{supplier.contact_name || '-'}</td>
                          <td className="p-4 text-slate-600">{supplier.email || '-'}</td>
                          <td className="p-4 text-slate-600">{supplier.phone || '-'}</td>
                          <td className="p-4 font-bold text-slate-700">
                            {parseFloat(supplier.due_balance) > 0 ? (
                              <span className="text-rose-600 bg-rose-50 px-2 py-1 rounded-lg border border-rose-100 font-extrabold">
                                {formatCurrency(supplier.due_balance)}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-semibold">-</span>
                            )}
                          </td>
                          <td className="p-4 text-center space-x-2">
                            <button
                              onClick={() => setSelectedSupplierId(supplier.id)}
                              className="text-indigo-600 hover:text-indigo-900 font-semibold text-xs border border-indigo-100 hover:bg-indigo-50 px-2.5 py-1.5 rounded-lg transition-colors"
                            >
                              View Profile
                            </button>
                            <button
                              onClick={() => openEdit(supplier)}
                              className="text-slate-500 hover:text-slate-800 font-semibold text-xs border border-slate-200 hover:bg-slate-50 px-2.5 py-1.5 rounded-lg transition-colors"
                            >
                              Edit
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Controls */}
            {totalSupplierPages > 1 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
                <div className="text-xs font-semibold text-slate-500">
                  Showing <span className="text-slate-800">{indexOfFirstSupplier + 1}</span> to <span className="text-slate-800">{Math.min(indexOfLastSupplier, suppliers.length)}</span> of <span className="text-slate-800">{suppliers.length}</span> entries
                </div>
                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => setSupplierPage(prev => Math.max(prev - 1, 1))}
                    disabled={supplierPage === 1}
                    className="px-3 py-2 bg-white hover:bg-slate-50 disabled:hover:bg-white disabled:opacity-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold transition-colors disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>

                  {Array.from({ length: totalSupplierPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setSupplierPage(page)}
                      className={`w-9 h-9 rounded-xl text-xs font-bold transition-all ${supplierPage === page
                        ? 'bg-slate-600 text-white shadow-xs'
                        : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200'
                        }`}
                    >
                      {page}
                    </button>
                  ))}

                  <button
                    onClick={() => setSupplierPage(prev => Math.min(prev + 1, totalSupplierPages))}
                    disabled={supplierPage === totalSupplierPages}
                    className="px-3 py-2 bg-white hover:bg-slate-50 disabled:hover:bg-white disabled:opacity-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold transition-colors disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* --- TAB: PURCHASE ORDERS --- */}
      {activeTab === 'pos' && (() => {
        const filteredPOs = getFilteredPOs(purchaseOrders);
        const totalPoPages = Math.ceil(filteredPOs.length / itemsPerPage);
        const indexOfFirstPo = (poPage - 1) * itemsPerPage;
        const indexOfLastPo = poPage * itemsPerPage;
        const paginatedPOs = filteredPOs.slice(indexOfFirstPo, indexOfLastPo);

        return (
          <div className="space-y-4">
            {/* PO Filters bar */}
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 shadow-xs">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full lg:w-auto">
                <div className="flex items-center space-x-2.5">
                  <span className="text-xs font-bold text-slate-400 uppercase whitespace-nowrap">Filter Status:</span>
                  <div className="flex flex-wrap gap-1.5">
                    {['all', 'draft', 'ordered', 'received', 'cancelled'].map((st) => (
                      <button
                        key={st}
                        onClick={() => {
                          setPoFilterStatus(st);
                          setPoPage(1);
                        }}
                        className={`px-3 py-1.5 text-xs font-bold rounded-lg uppercase tracking-wider transition-all border ${poFilterStatus === st
                          ? 'bg-slate-600 border-indigo-600 text-white'
                          : 'bg-white border-slate-200 text-slate-500 hover:text-slate-700'
                          }`}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="relative w-full sm:w-64">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    placeholder="Search by supplier or PO#..."
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
                    value={poSearchTerm}
                    onChange={(e) => {
                      setPoSearchTerm(e.target.value);
                      setPoPage(1);
                    }}
                  />
                </div>
              </div>
              <div className="flex items-center space-x-3 w-full lg:w-auto justify-end">
                <button
                  onClick={handleDownloadPOCSV}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-xl text-sm shadow transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span>CSV</span>
                </button>
                <button
                  onClick={handleDownloadPOPDF}
                  className="bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2 px-4 rounded-xl text-sm shadow transition-colors flex items-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  <span>PDF</span>
                </button>
              </div>
            </div>

            {/* PO Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                      <th className="p-4">PO ID</th>
                      <th className="p-4">Supplier</th>
                      <th className="p-4">Order Date</th>
                      <th className="p-4">Basis</th>
                      <th className="p-4">Total</th>
                      <th className="p-4">Paid</th>
                      <th className="p-4">Due</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {loading ? (
                      <tr>
                        <td colSpan="9" className="p-12 text-center">
                          <div className="flex justify-center items-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
                          </div>
                        </td>
                      </tr>
                    ) : filteredPOs.length === 0 ? (
                      <tr>
                        <td colSpan="9" className="p-12 text-center text-slate-400">
                          No purchase orders matching filters.
                        </td>
                      </tr>
                    ) : (
                      paginatedPOs.map((po) => (
                        <tr key={po.id} className="hover:bg-slate-50/50 transition-colors">
                          <td className="p-4 font-mono font-bold text-slate-650">#PO-{po.id}</td>
                          <td className="p-4 font-semibold text-slate-800">{po.supplier_name}</td>
                          <td className="p-4 text-slate-600">{formatDate(po.order_date).split(',')[0]}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${po.payment_basis === 'credit'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              }`}>
                              {po.payment_basis || 'cash'}
                            </span>
                          </td>
                          <td className="p-4 font-bold text-slate-800">{formatCurrency(po.total_amount)}</td>
                          <td className="p-4 text-emerald-600 font-semibold">{formatCurrency(po.paid_amount || 0)}</td>
                          <td className="p-4 text-rose-650 font-bold">{formatCurrency(po.due_amount || 0)}</td>
                          <td className="p-4">
                            <span className={`px-2.5 py-0.5 rounded text-xs font-bold border ${getStatusBadge(po.status)}`}>
                              {po.status}
                            </span>
                          </td>
                          <td className="p-4 text-center space-x-2">
                            <button
                              onClick={() => openPoDetails(po.id)}
                              className="text-indigo-600 hover:text-indigo-900 font-semibold text-xs border border-indigo-100 hover:bg-indigo-50 px-2.5 py-1 rounded-lg transition-colors"
                            >
                              View
                            </button>
                            {po.status === 'ordered' && (
                              <button
                                onClick={() => openPoDetails(po.id)}
                                className="text-emerald-600 hover:text-emerald-900 font-bold text-xs border border-emerald-100 bg-emerald-50 px-2.5 py-1 rounded-lg transition-colors animate-pulse"
                              >
                                Receive Stocks
                              </button>
                            )}
                            <button
                              onClick={() => openEditPo(po)}
                              className="text-indigo-600 hover:text-indigo-900 font-semibold text-xs border border-indigo-100 hover:bg-indigo-50 px-2.5 py-1 rounded-lg transition-colors mr-2"
                            >
                              Edit
                            </button>
                            {po.status === 'draft' && (
                              <button
                                onClick={() => updatePoStatus(po.id, 'ordered')}
                                className="text-amber-600 hover:text-amber-900 font-semibold text-xs border border-amber-100 hover:bg-amber-50 px-2.5 py-1 rounded-lg transition-colors mr-2"
                              >
                                Place Order
                              </button>
                            )}
                            <button
                              onClick={() => handleDeletePo(po)}
                              className="text-rose-600 hover:text-rose-900 font-semibold text-xs border border-rose-100 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition-colors"
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Controls */}
            {totalPoPages > 1 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
                <div className="text-xs font-semibold text-slate-500">
                  Showing <span className="text-slate-800">{indexOfFirstPo + 1}</span> to <span className="text-slate-800">{Math.min(indexOfLastPo, filteredPOs.length)}</span> of <span className="text-slate-800">{filteredPOs.length}</span> entries
                </div>
                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => setPoPage(prev => Math.max(prev - 1, 1))}
                    disabled={poPage === 1}
                    className="px-3 py-2 bg-white hover:bg-slate-50 disabled:hover:bg-white disabled:opacity-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold transition-colors disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>

                  {Array.from({ length: totalPoPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setPoPage(page)}
                      className={`w-9 h-9 rounded-xl text-xs font-bold transition-all ${poPage === page
                        ? 'bg-slate-600 text-white shadow-xs'
                        : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200'
                        }`}
                    >
                      {page}
                    </button>
                  ))}

                  <button
                    onClick={() => setPoPage(prev => Math.min(prev + 1, totalPoPages))}
                    disabled={poPage === totalPoPages}
                    className="px-3 py-2 bg-white hover:bg-slate-50 disabled:hover:bg-white disabled:opacity-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold transition-colors disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* --- TAB: COST PRICE LOGS --- */}
      {activeTab === 'logs' && (() => {
        const logsItemsPerPage = 50;
        const totalLogPages = Math.ceil(costLogs.length / logsItemsPerPage);
        const indexOfFirstLog = (logsPage - 1) * logsItemsPerPage;
        const indexOfLastLog = logsPage * logsItemsPerPage;
        const paginatedLogs = costLogs.slice(indexOfFirstLog, indexOfLastLog);

        let startPage = Math.max(1, logsPage - 9);
        let endPage = startPage + 19;
        if (endPage > totalLogPages) {
          endPage = totalLogPages;
          startPage = Math.max(1, endPage - 19);
        }

        const visiblePages = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i);

        return (
          <div className="space-y-4">
            <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-end gap-3 shadow-xs">
              <button
                onClick={handleDownloadCostLogsCSV}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-4 rounded-xl text-sm shadow transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span>CSV</span>
              </button>
              <button
                onClick={handleDownloadCostLogsPDF}
                className="bg-rose-600 hover:bg-rose-700 text-white font-semibold py-2 px-4 rounded-xl text-sm shadow transition-colors flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                <span>PDF</span>
              </button>
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                      <th className="p-4">Date Logged</th>
                      <th className="p-4">SKU</th>
                      <th className="p-4">Product Name</th>
                      <th className="p-4">Vendor Supplier</th>
                      <th className="p-4">Old Cost</th>
                      <th className="p-4">New Cost</th>
                      <th className="p-4">Difference</th>
                      <th className="p-4">Reason / Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {loading ? (
                      <tr>
                        <td colSpan="8" className="p-12 text-center">
                          <div className="flex justify-center items-center">
                            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
                          </div>
                        </td>
                      </tr>
                    ) : costLogs.length === 0 ? (
                      <tr>
                        <td colSpan="8" className="p-12 text-center text-slate-400">
                          No cost price logs recorded yet. Logs generate automatically when POs are received.
                        </td>
                      </tr>
                    ) : (
                      paginatedLogs.map((log) => {
                        const diff = parseFloat(log.new_cost_price) - parseFloat(log.old_cost_price);
                        return (
                          <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-4 text-slate-650">{formatDate(log.created_at)}</td>
                            <td className="p-4 font-mono text-xs font-bold text-slate-500">{log.product_sku}</td>
                            <td className="p-4 font-semibold text-slate-800">{log.product_name}</td>
                            <td className="p-4 font-semibold text-slate-700">{log.supplier_name || 'N/A'}</td>
                            <td className="p-4 text-slate-600">{formatCurrency(log.old_cost_price)}</td>
                            <td className="p-4 font-extrabold text-slate-800">{formatCurrency(log.new_cost_price)}</td>
                            <td className="p-4">
                              {diff === 0 ? (
                                <span className="text-slate-400 font-semibold">-</span>
                              ) : diff > 0 ? (
                                <span className="text-rose-600 font-bold bg-rose-50 border border-rose-100 px-2.5 py-0.5 rounded text-xs inline-flex items-center">
                                  +{formatCurrency(diff)} ▲
                                </span>
                              ) : (
                                <span className="text-emerald-600 font-bold bg-emerald-50 border border-emerald-100 px-2.5 py-0.5 rounded text-xs inline-flex items-center">
                                  {formatCurrency(diff)} ▼
                                </span>
                              )}
                            </td>
                            <td className="p-4 font-medium text-indigo-600">{log.change_reason}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pagination Controls */}
            {totalLogPages > 1 && (
              <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
                <div className="text-xs font-semibold text-slate-500">
                  Showing <span className="text-slate-800">{indexOfFirstLog + 1}</span> to <span className="text-slate-800">{Math.min(indexOfLastLog, costLogs.length)}</span> of <span className="text-slate-800">{costLogs.length}</span> entries
                </div>
                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => setLogsPage(prev => Math.max(prev - 1, 1))}
                    disabled={logsPage === 1}
                    className="px-3 py-2 bg-white hover:bg-slate-50 disabled:hover:bg-white disabled:opacity-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold transition-colors disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>

                  {startPage > 1 && (
                    <span className="text-slate-400 text-xs font-bold px-1">...</span>
                  )}
                  {visiblePages.map((page) => (
                    <button
                      key={page}
                      onClick={() => setLogsPage(page)}
                      className={`w-9 h-9 rounded-xl text-xs font-bold transition-all ${logsPage === page
                        ? 'bg-slate-600 text-white shadow-xs'
                        : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200'
                        }`}
                    >
                      {page}
                    </button>
                  ))}
                  {endPage < totalLogPages && (
                    <span className="text-slate-400 text-xs font-bold px-1">...</span>
                  )}

                  <button
                    onClick={() => setLogsPage(prev => Math.min(prev + 1, totalLogPages))}
                    disabled={logsPage === totalLogPages}
                    className="px-3 py-2 bg-white hover:bg-slate-50 disabled:hover:bg-white disabled:opacity-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold transition-colors disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* --- ADD SUPPLIER MODAL --- */}
      {showAddModal && renderSupplierFormModal(false)}

      {/* --- EDIT SUPPLIER MODAL --- */}
      {showEditModal && renderSupplierFormModal(true)}

      {/* --- ADD PO MODAL --- */}
      {showAddPoModal && renderAddPoModal()}

      {/* --- PO DETAILS MODAL --- */}
      {showPoDetailsModal && renderPoDetailsModal()}

      {/* --- RECEIVE MODAL --- */}
      {showReceiveModal && renderReceiveModal()}

    </div>
  );

  // --- RENDER COMPONENT PIECES AS UTILITIES TO KEEP CODE READABLE ---

  // SUPPLIER CSV UPLOAD MODAL
  function renderSupplierCsvUploadModal() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-800">Import Supplied Products via CSV</h3>
            <button
              onClick={() => {
                setShowSupplierCsvModal(false);
                setSupplierCsvFile(null);
              }}
              className="text-slate-400 hover:text-slate-600 animate-pulse"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-4 space-y-4">
            <div className="bg-indigo-50/50 rounded-xl p-3 border border-indigo-100/50 text-xs text-indigo-800 space-y-2">
              <span className="font-bold uppercase tracking-wider block text-[10px] text-indigo-600">CSV Requirements:</span>
              <ul className="list-disc pl-4 space-y-1">
                <li>Required: <strong>Product Name</strong>, <strong>SKU</strong>, <strong>Cost Price</strong>, and <strong>Sale Price</strong></li>
                <li>Optional: <strong>Stock Quantity</strong>, <strong>Low Stock Threshold</strong>, <strong>Expiry Date</strong> (YYYY-MM-DD), and <strong>Unit</strong></li>
                <li>All products will be linked to the current supplier automatically.</li>
              </ul>
            </div>

            <form onSubmit={handleSupplierCsvUpload} className="space-y-4">
              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 flex flex-col items-center justify-center bg-slate-50/50 hover:bg-slate-50 transition-colors">
                <svg className="w-10 h-10 text-slate-400 mb-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 13h6m-3-3v6m-9 1V4a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                </svg>
                {supplierCsvFile ? (
                  <div className="text-center">
                    <span className="text-sm font-semibold text-slate-800 block truncate max-w-[280px]">
                      {supplierCsvFile.name}
                    </span>
                    <span className="text-xs text-slate-400 block mt-0.5">
                      {(supplierCsvFile.size / 1024).toFixed(1)} KB
                    </span>
                    <button
                      type="button"
                      onClick={() => setSupplierCsvFile(null)}
                      className="text-xs text-rose-500 hover:text-rose-700 underline font-semibold mt-2.5 block mx-auto animate-pulse"
                    >
                      Remove File
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <label className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold py-2 px-4 rounded-xl text-xs transition-colors cursor-pointer inline-block">
                      <span>Choose CSV File</span>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => setSupplierCsvFile(e.target.files[0] || null)}
                        className="hidden"
                      />
                    </label>
                    <span className="text-[11px] text-slate-400 block mt-2">Maximum file size: 5MB</span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex space-x-3 justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowSupplierCsvModal(false);
                    setSupplierCsvFile(null);
                  }}
                  className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={supplierCsvUploading || !supplierCsvFile}
                  className="px-5 py-2 bg-slate-650 hover:bg-indigo-700 disabled:bg-slate-350 text-white rounded-xl text-sm font-semibold transition-colors shadow flex items-center space-x-1.5"
                >
                  {supplierCsvUploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white mr-1"></div>
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <span>Upload CSV</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // --- RENDER COMPONENT PIECES AS UTILITIES TO KEEP CODE READABLE ---

  // EDIT SUPPLIED PRODUCT MODAL
  function renderEditProductModal() {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-800">
              Edit Product Info
            </h3>
            <button
              onClick={() => {
                setShowEditProductModal(false);
                setEditingProductId(null);
              }}
              className="text-slate-400 hover:text-slate-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSaveProductEdit} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Product Name *</label>
              <input
                type="text"
                value={productEditForm.name}
                onChange={(e) => setProductEditForm(prev => ({ ...prev, name: e.target.value }))}
                required
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">SKU *</label>
              <input
                type="text"
                value={productEditForm.sku}
                onChange={(e) => setProductEditForm(prev => ({ ...prev, sku: e.target.value }))}
                required
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Cost Price *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={productEditForm.cost_price}
                  onChange={(e) => setProductEditForm(prev => ({ ...prev, cost_price: e.target.value }))}
                  required
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Selling Price *</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={productEditForm.price}
                  onChange={(e) => setProductEditForm(prev => ({ ...prev, price: e.target.value }))}
                  required
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Current Active Stock</label>
              <input
                type="number"
                step="any"
                min="0"
                value={productEditForm.stock_quantity}
                readOnly
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none bg-slate-50 cursor-not-allowed text-slate-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Category</label>
              <input
                list="suppliers-edit-categories-list"
                type="text"
                value={productEditForm.category || ''}
                onChange={(e) => setProductEditForm(prev => ({ ...prev, category: e.target.value }))}
                placeholder="Product category"
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-semibold"
              />
              <datalist id="suppliers-edit-categories-list">
                {Array.from(new Set(productsList.map(p => p.category).filter(Boolean))).map(cat => (
                  <option key={cat} value={cat} />
                ))}
              </datalist>
            </div>

            <div className="pt-4 border-t border-slate-100 flex space-x-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowEditProductModal(false);
                  setEditingProductId(null);
                }}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={updatingProduct}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-sm font-semibold transition-colors shadow"
              >
                {updatingProduct ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // SUPPLIER FORM MODAL (ADD & EDIT)
  function renderSupplierFormModal(isEdit = false) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-800">
              {isEdit ? `Edit Supplier: ${currentSupplier?.name}` : 'Add New Supplier'}
            </h3>
            <button
              onClick={() => isEdit ? setShowEditModal(false) : setShowAddModal(false)}
              className="text-slate-400 hover:text-slate-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={isEdit ? handleEditSubmit : handleAddSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Company / Vendor Name *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                placeholder="e.g. Acme Wholesale Corp"
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Contact Rep Name</label>
              <input
                type="text"
                name="contact_name"
                value={formData.contact_name}
                onChange={handleInputChange}
                placeholder="e.g. John Doe"
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Email Address</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="johndoe@acme.com"
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Phone Number</label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="555-0120"
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex space-x-3 justify-end">
              <button
                type="button"
                onClick={() => isEdit ? setShowEditModal(false) : setShowAddModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-slate-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-colors shadow"
              >
                {isEdit ? 'Save Changes' : 'Create Supplier'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ADD PURCHASE ORDER FORM MODAL
  function renderAddPoModal() {
    const calculatePOTotal = () => {
      const qty = parseInt(poFormData.quantity_ordered) || 0;
      const cost = parseFloat(poFormData.cost_price) || 0;
      return qty * cost;
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] p-5 shadow-2xl overflow-hidden flex flex-col">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <h3 className="text-lg font-bold text-slate-800">{isEditPoMode ? 'Edit Purchase Order' : 'Create Purchase Order'}</h3>
            <button onClick={() => { setShowAddPoModal(false); setIsEditPoMode(false); setEditingCartItemIndex(null); }} className="text-slate-400 hover:text-slate-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1">
            <div className={`grid grid-cols-1 ${isEditPoMode ? 'sm:grid-cols-4' : 'sm:grid-cols-3'} gap-4`}>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Order Date</label>
                <input
                  type="date"
                  value={poFormData.order_date}
                  onChange={(e) => setPoFormData({ ...poFormData, order_date: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-medium"
                />
              </div>

              {isEditPoMode && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Received Date</label>
                  <input
                    type="date"
                    value={poFormData.received_date || ''}
                    onChange={(e) => setPoFormData({ ...poFormData, received_date: e.target.value })}
                    disabled={!isAdmin}
                    title={!isAdmin ? "Only shop admins can modify the received date" : ""}
                    className={`w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 font-medium ${!isAdmin ? 'bg-slate-50 text-slate-500 cursor-not-allowed' : 'bg-white'}`}
                  />
                </div>
              )}

              <div className="relative">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Supplier *</label>
                {selectedSupplierId ? (
                  <input
                    type="text"
                    value={supplierSearch}
                    disabled
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm bg-slate-50 text-slate-500 font-medium"
                  />
                ) : (
                  <>
                    <input
                      type="text"
                      value={supplierSearch}
                      onChange={(e) => {
                        setSupplierSearch(e.target.value);
                        setShowSupplierSuggestions(true);
                        if (poFormData.supplier_id) {
                          setPoFormData(prev => ({ ...prev, supplier_id: '' }));
                        }
                      }}
                      onFocus={() => setShowSupplierSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowSupplierSuggestions(false), 200)}
                      placeholder="Search supplier name..."
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-medium"
                    />

                    {showSupplierSuggestions && (() => {
                      const query = supplierSearch.toLowerCase();
                      const suggestions = suppliers.filter(s =>
                        s.name.toLowerCase().includes(query)
                      );
                      if (suggestions.length === 0 && supplierSearch.trim() !== '') {
                        return (
                          <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 p-3 text-center text-slate-400 text-xs">
                            No matching suppliers found
                          </div>
                        );
                      }
                      if (suggestions.length === 0) return null;
                      return (
                        <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto divide-y divide-slate-100">
                          {suggestions.map(s => (
                            <div
                              key={s.id}
                              onClick={() => {
                                setSupplierSearch(s.name);
                                setPoFormData(prev => ({ ...prev, supplier_id: String(s.id) }));
                                setShowSupplierSuggestions(false);
                              }}
                              className="p-2 px-3 hover:bg-indigo-50 cursor-pointer text-left transition-colors"
                            >
                              <div className="text-xs font-semibold text-slate-800">{s.name}</div>
                              {s.contact_name && <div className="text-[10px] text-slate-400">Contact: {s.contact_name}</div>}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </>
                )}
              </div>

              <div className="relative">
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Choose Product *</label>
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setShowProductSuggestions(true);
                  }}
                  onFocus={() => setShowProductSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowProductSuggestions(false), 200)}
                  placeholder="Search existing product (Name or SKU)..."
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-medium"
                />

                {showProductSuggestions && (() => {
                  const query = productSearch.toLowerCase();
                  const suggestions = productsList.filter(p =>
                    p.name.toLowerCase().includes(query) || p.sku.toLowerCase().includes(query)
                  );

                  return (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg z-50 max-h-40 overflow-y-auto divide-y divide-slate-100">
                      <div
                        onClick={() => {
                          setProductSearch('+ New Product (Create on-the-fly)');
                          handlePoProductChange('new_product');
                          setShowProductSuggestions(false);
                        }}
                        className="p-2.5 px-3 hover:bg-indigo-50 cursor-pointer text-left transition-colors text-indigo-650 font-bold text-xs"
                      >
                        + Create New Product On-The-Fly
                      </div>
                      {suggestions.map(p => (
                        <div
                          key={p.id}
                          onClick={() => {
                            setProductSearch(`${p.name} (${p.sku})`);
                            handlePoProductChange(String(p.id));
                            setShowProductSuggestions(false);
                          }}
                          className="p-2 px-3 hover:bg-indigo-50 cursor-pointer text-left transition-colors"
                        >
                          <div className="text-xs font-semibold text-slate-800">{p.name}</div>
                          <div className="text-[10px] text-slate-400 flex justify-between">
                            <span>SKU: {p.sku}</span>
                            <span>Stock: {p.stock_quantity} left</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Product Name *</label>
                <input
                  type="text"
                  value={poFormData.name}
                  onChange={(e) => setPoFormData({ ...poFormData, name: e.target.value })}
                  disabled={!poFormData.is_new && editingCartItemIndex === null}
                  required
                  placeholder="Product Name"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50 disabled:bg-slate-50 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">SKU / Code *</label>
                <input
                  type="text"
                  value={poFormData.sku}
                  onChange={(e) => setPoFormData({ ...poFormData, sku: e.target.value })}
                  disabled={!poFormData.is_new && editingCartItemIndex === null}
                  required
                  placeholder="SKU Code"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-slate-50 disabled:bg-slate-50 font-semibold font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Category</label>
                <input
                  list="po-categories-list"
                  type="text"
                  value={poFormData.category || ''}
                  onChange={(e) => setPoFormData({ ...poFormData, category: e.target.value })}
                  placeholder="Search or enter category"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-semibold"
                />
                <datalist id="po-categories-list">
                  {Array.from(new Set(productsList.map(p => p.category).filter(Boolean))).map(cat => (
                    <option key={cat} value={cat} />
                  ))}
                </datalist>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Cost Price (৳) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={poFormData.cost_price}
                  onChange={(e) => setPoFormData({ ...poFormData, cost_price: e.target.value })}
                  required
                  placeholder="0.00"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Sale Price (৳)</label>
                <input
                  type="number"
                  step="0.01"
                  value={poFormData.selling_price}
                  onChange={(e) => setPoFormData({ ...poFormData, selling_price: e.target.value })}
                  placeholder="0.00"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Quantity to Order</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={poFormData.quantity_ordered}
                  onChange={(e) => setPoFormData({ ...poFormData, quantity_ordered: e.target.value })}
                  placeholder="0"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Unit *</label>
                <input
                  list="unit-options"
                  value={poFormData.unit}
                  onChange={(e) => setPoFormData({ ...poFormData, unit: e.target.value })}
                  placeholder="e.g. piece, kg, box"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-medium"
                />
                <datalist id="unit-options">
                  <option value="piece" />
                  <option value="kg" />
                  <option value="gm" />
                  <option value="liter" />
                  <option value="packet" />
                </datalist>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Payment Basis *</label>
                <select
                  value={poFormData.payment_basis}
                  onChange={(e) => setPoFormData({ ...poFormData, payment_basis: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white font-medium"
                >
                  <option value="cash">Cash</option>
                  <option value="credit">Credit</option>
                </select>
              </div>
              <div>
                {poFormData.payment_basis === 'credit' && (
                  <>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Initial Paid Amount (৳)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max={calculatePOTotal()}
                      value={poFormData.paid_amount}
                      onChange={(e) => setPoFormData({ ...poFormData, paid_amount: e.target.value })}
                      placeholder="0.00"
                      className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                    />
                  </>
                )}
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Notes / Instructions</label>
                <input
                  type="text"
                  value={poFormData.notes}
                  onChange={(e) => setPoFormData({ ...poFormData, notes: e.target.value })}
                  placeholder="e.g. Rush order for holiday stock"
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 mb-4"
                />
              </div>
            </div>

            {/* Add to Cart Button */}
            <div className="flex gap-2">
              {editingCartItemIndex !== null && (
                <button
                  type="button"
                  onClick={cancelEditCartItem}
                  className="flex-1 bg-slate-500 hover:bg-slate-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center space-x-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span>Cancel Edit</span>
                </button>
              )}
              <button
                type="button"
                onClick={addToPoCart}
                className="flex-1 bg-gray-600 hover:bg-yellow-600 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={editingCartItemIndex !== null ? "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" : "M12 6v6m0 0v6m0-6h6m-6 0H6"} />
                </svg>
                <span>{editingCartItemIndex !== null ? 'Update Product in Cart' : 'Add Product to Cart'}</span>
              </button>
            </div>

            {/* Cart Display */}
            {poCart.length > 0 && (
              <div className="mt-4 border border-slate-200 rounded-xl p-4 bg-slate-50">
                <h4 className="text-sm font-bold text-slate-700 mb-3 flex items-center justify-between">
                  <span>Order Cart ({poCart.length} items)</span>
                  <span className="text-xs font-normal text-slate-500">Total: {formatCurrency(calculatePOTotal())}</span>
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {poCart.map((item, index) => (
                    <div key={index} className={`flex items-center justify-between bg-white border border-slate-100 rounded-lg p-2 text-xs ${editingCartItemIndex === index ? 'ring-2 ring-indigo-500' : ''}`}>
                      <div className="flex-1">
                        <div className="font-semibold text-slate-800">
                          {item.name} {item.category && <span className="ml-1.5 px-1.5 py-0.25 bg-indigo-50 text-indigo-700 rounded text-[9px] font-bold border border-indigo-100">{item.category}</span>}
                          {editingCartItemIndex === index && <span className="ml-1.5 px-1.5 py-0.25 bg-amber-50 text-amber-700 rounded text-[9px] font-bold border border-amber-100">Editing</span>}
                        </div>
                        <div className="text-slate-500 mt-1 flex items-center gap-2">
                          <span>{item.sku}</span>
                          <span>•</span>
                          <div className="flex items-center border border-slate-200 rounded">
                            <button
                              type="button"
                              onClick={() => {
                                const newCart = [...poCart];
                                newCart[index].quantity_ordered = Math.max(1, (newCart[index].quantity_ordered || 1) - 1);
                                setPoCart(newCart);
                              }}
                              className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold"
                            >-</button>
                            <input
                              type="number"
                              min="1"
                              step="any"
                              value={item.quantity_ordered}
                              onChange={(e) => {
                                const newCart = [...poCart];
                                newCart[index].quantity_ordered = e.target.value === '' ? '' : Math.max(1, parseFloat(e.target.value) || 1);
                                setPoCart(newCart);
                              }}
                              className="w-12 text-center text-xs outline-none py-0.5 hide-arrow"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newCart = [...poCart];
                                newCart[index].quantity_ordered = (parseFloat(newCart[index].quantity_ordered) || 0) + 1;
                                setPoCart(newCart);
                              }}
                              className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold"
                            >+</button>
                          </div>
                          <span>• Tk {item.cost_price.toFixed(2)} × {item.quantity_ordered} = Tk {(item.cost_price * (parseFloat(item.quantity_ordered) || 0)).toFixed(2)}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          type="button"
                          onClick={() => editCartItem(index)}
                          className="text-indigo-600 hover:text-indigo-800 p-1 hover:bg-indigo-50 rounded"
                          title="Edit product"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => removeFromPoCart(index)}
                          className="text-rose-600 hover:text-rose-800 p-1 hover:bg-rose-50 rounded"
                          title="Remove product"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="text-sm font-bold text-slate-700 flex flex-col space-y-1">
                <div>
                  Running PO Total: <span className="text-lg font-black text-slate-800">{formatCurrency(calculatePOTotal())}</span>
                </div>
                {poFormData.payment_basis === 'credit' && (
                  <div className="text-xs text-slate-500">
                    Remaining Due: <span className="text-sm font-bold text-rose-650">
                      {formatCurrency(calculatePOTotal() - (parseFloat(poFormData.paid_amount || 0)))}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex space-x-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => { setShowAddPoModal(false); setIsEditPoMode(false); setEditingCartItemIndex(null); }}
                  className="w-full sm:w-auto px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-sm font-semibold hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                {isEditPoMode && selectedPo?.status === 'received' ? (
                  <button
                    type="button"
                    onClick={(e) => handlePoSubmit(e, 'received')}
                    className="w-full sm:w-auto px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-semibold transition-colors shadow"
                  >
                    Update Received Order
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={(e) => handlePoSubmit(e, 'draft')}
                      className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-sm font-semibold transition-colors"
                    >
                      {isEditPoMode ? 'Save Draft' : 'Draft'}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => handlePoSubmit(e, 'ordered')}
                      className="w-full sm:w-auto px-5 py-2 bg-slate-600 hover:bg-yellow-700 text-white rounded-xl text-sm font-semibold transition-colors shadow"
                    >
                      {isEditPoMode ? 'Update Order' : 'Place Order'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    );
  }

  function handlePrintPo() {
    if (!selectedPo) return;
    const printWindow = window.open('', 'PRINT', 'height=800,width=1000');
    const totalAmount = selectedPo.items.reduce((sum, item) => sum + ((item.quantity_ordered !== undefined ? item.quantity_ordered : item.quantity) * (item.cost_price !== undefined ? item.cost_price : item.unit_price)), 0);
    printWindow.document.write(`
      <html>
        <head>
          <title>Purchase Order #${selectedPo.id}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 30px; color: #1e293b; line-height: 1.5; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; }
            .header h1 { margin: 0 0 10px 0; font-size: 28px; color: #0f172a; }
            .header p { margin: 0; color: #64748b; font-size: 14px; }
            .info-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; margin-bottom: 30px; }
            .info-box { background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
            .info-box h4 { margin: 0 0 5px 0; font-size: 12px; color: #64748b; text-transform: uppercase; }
            .info-box p { margin: 0; font-size: 14px; font-weight: 600; color: #334155; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px; }
            th, td { border-bottom: 1px solid #e2e8f0; padding: 12px 8px; text-align: left; }
            th { background-color: #f1f5f9; font-weight: 600; color: #475569; text-transform: uppercase; font-size: 11px; }
            .text-right { text-align: right; }
            .text-center { text-align: center; }
            .totals { display: flex; justify-content: flex-end; margin-top: 20px; }
            .totals table { width: 300px; border: none; }
            .totals th, .totals td { border: none; padding: 8px; }
            .totals th { text-align: left; background: none; color: #64748b; font-size: 13px; }
            .totals td { text-align: right; font-weight: 600; font-size: 14px; }
            .grand-total { border-top: 2px solid #cbd5e1 !important; font-size: 16px !important; color: #0f172a !important; }
            @media print {
              body { padding: 0; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>Purchase Order</h1>
            <p>Order ID: #PO-${selectedPo.id} | Date: ${formatDate(selectedPo.order_date)}</p>
          </div>
          
          <div class="info-grid">
            <div class="info-box">
              <h4>Supplier Details</h4>
              <p>${selectedPo.supplier_name}</p>
              <p style="font-weight: 400; font-size: 13px;">${selectedPo.supplier_phone || ''}</p>
              <p style="font-weight: 400; font-size: 13px;">${selectedPo.supplier_email || ''}</p>
            </div>
            <div class="info-box">
              <h4>Order Information</h4>
              <p>Status: <span style="text-transform: uppercase;">${selectedPo.status}</span></p>
              <p>Payment Basis: <span style="text-transform: uppercase;">${selectedPo.payment_basis || 'CASH'}</span></p>
              <p>Received Date: ${selectedPo.received_date ? formatDate(selectedPo.received_date) : '-'}</p>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Product Name</th>
                <th class="text-center">Qty Ordered</th>
                <th class="text-center">Qty Received</th>
                <th class="text-right">Cost Price</th>
                <th class="text-right">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${selectedPo.items.map(item => `
                <tr>
                  <td>${item.product_sku}</td>
                  <td>${item.product_name}</td>
                  <td class="text-center">${item.quantity_ordered !== undefined ? item.quantity_ordered : item.quantity} ${item.product_unit || ''}</td>
                  <td class="text-center">${selectedPo.status === 'received' ? item.quantity_received : '-'} ${selectedPo.status === 'received' && item.product_unit ? item.product_unit : ''}</td>
                  <td class="text-right">Tk ${(item.cost_price !== undefined ? item.cost_price : item.unit_price).toFixed(2)}</td>
                  <td class="text-right">Tk ${((item.quantity_ordered !== undefined ? item.quantity_ordered : item.quantity) * (item.cost_price !== undefined ? item.cost_price : item.unit_price)).toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>

          <div class="totals">
            <table>
              <tr>
                <th>Total Amount:</th>
                <td>Tk ${totalAmount.toFixed(2)}</td>
              </tr>
              <tr>
                <th>Paid Amount:</th>
                <td>Tk ${parseFloat(selectedPo.paid_amount || 0).toFixed(2)}</td>
              </tr>
              <tr>
                <th class="grand-total">Due Amount:</th>
                <td class="grand-total">Tk ${parseFloat(selectedPo.due_amount || 0).toFixed(2)}</td>
              </tr>
            </table>
          </div>
          
          ${selectedPo.notes ? `<div style="margin-top: 30px; font-size: 13px;"><strong style="color: #64748b; text-transform: uppercase; font-size: 11px;">Notes:</strong><br/>${selectedPo.notes}</div>` : ''}
          
          <div style="margin-top: 50px; text-align: center; color: #94a3b8; font-size: 12px; border-top: 1px dashed #e2e8f0; padding-top: 20px;">
            Generated by POS System
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }

  // PO DETAILS VIEW MODAL
  function renderPoDetailsModal() {
    if (!selectedPo) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col max-h-[85vh]">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Purchase Order Detail</span>
              <h3 className="text-lg font-black text-slate-800">#PO-{selectedPo.id}</h3>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={handlePrintPo}
                className="text-emerald-600 hover:text-emerald-800 font-semibold text-sm border border-emerald-200 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors flex items-center space-x-1"
                title="Print Invoice"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                <span>Print</span>
              </button>
              <button
                onClick={() => {
                  setShowPoDetailsModal(false);
                  openEditPo(selectedPo);
                }}
                className="text-indigo-600 hover:text-indigo-800 font-semibold text-sm border border-indigo-200 hover:bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                Edit
              </button>
              <button onClick={() => setShowPoDetailsModal(false)} className="text-slate-400 hover:text-slate-600">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div className="mt-4 space-y-4 overflow-y-auto flex-1 pr-1 text-sm">
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
              <div>
                <span className="block text-xs font-bold text-slate-400">SUPPLIER</span>
                <span className="font-semibold text-slate-700">{selectedPo.supplier_name}</span>
                <span className="block text-xs text-slate-500">{selectedPo.supplier_phone} · {selectedPo.supplier_email}</span>
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-400">PO STATUS</span>
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border mt-1 ${getStatusBadge(selectedPo.status)}`}>
                  {selectedPo.status}
                </span>
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-400">PAYMENT BASIS</span>
                <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold border mt-1 uppercase ${selectedPo.payment_basis === 'credit'
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  }`}>
                  {selectedPo.payment_basis || 'cash'}
                </span>
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-400">ORDER DATE</span>
                <span className="font-semibold text-slate-700">{formatDate(selectedPo.order_date)}</span>
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-400">RECEIVED DATE</span>
                <span className="font-semibold text-slate-700">
                  {selectedPo.received_date ? formatDate(selectedPo.received_date) : '-'}
                </span>
              </div>
              <div>
                <span className="block text-xs font-bold text-slate-400">PAID VS DUE</span>
                <span className="font-semibold text-slate-700 block mt-1">
                  {formatCurrency(selectedPo.paid_amount || 0)} / <span className={parseFloat(selectedPo.due_amount) > 0 ? "text-rose-600 font-extrabold" : "text-slate-500"}>{formatCurrency(selectedPo.due_amount || 0)}</span>
                </span>
              </div>
              {selectedPo.notes && (
                <div className="col-span-2 md:col-span-3">
                  <span className="block text-xs font-bold text-slate-400">NOTES</span>
                  <span className="font-medium text-slate-650 italic">"{selectedPo.notes}"</span>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Order Line Items</h4>
              <div className="overflow-x-auto border border-slate-100 rounded-xl">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      <th className="p-3">SKU</th>
                      <th className="p-3">Product Name</th>
                      <th className="p-3">Cost Price</th>
                      <th className="p-3">Sale Price</th>
                      <th className="p-3">Qty Ordered</th>
                      <th className="p-3">Qty Received</th>
                      <th className="p-3">Expiry Date</th>
                      <th className="p-3 text-right">Subtotal</th>
                      {['draft', 'ordered'].includes(selectedPo.status) && (
                        <th className="p-3 text-center">Action</th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedPo.items.map((item) => (
                      <tr key={item.id}>
                        <td className="p-3 font-mono font-bold text-slate-500">{item.product_sku}</td>
                        <td className="p-3 font-semibold text-slate-800">
                          <div>{item.product_name}</div>
    {/*                       <div className="flex flex-wrap gap-1 items-center mt-0.5">
                            {item.product_category && (
                              <span className="inline-block bg-indigo-50 text-indigo-700 text-[9px] font-bold px-1.5 py-0.25 rounded border border-indigo-100">
                                {item.product_category}
                              </span>
                            )}
                            {item.product_unit && (
                              <span className="inline-block bg-emerald-50 text-emerald-700 text-[9px] font-bold px-1.5 py-0.25 rounded border border-emerald-100">
                                {item.product_unit}
                              </span>
                            )}
                          </div> */}
                        </td>
                        <td className="p-3 text-slate-650">{formatCurrency(item.cost_price !== undefined ? item.cost_price : item.unit_price)}</td>
                        <td className="p-3 text-slate-650">{formatCurrency(item.selling_price || 0)}</td>
                        <td className="p-3 text-slate-700 font-semibold">
                          {item.quantity_ordered !== undefined ? item.quantity_ordered : item.quantity} {item.product_unit && <span className="text-xs font-normal text-slate-500">{item.product_unit}</span>}
                        </td>
                        <td className="p-3 text-slate-750">
                          {selectedPo.status === 'received' ? (
                            <span className="text-emerald-600 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                              {item.quantity_received} {item.product_unit && <span className="font-normal">{item.product_unit}</span>}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          )}
                        </td>
                        <td className="p-3 text-slate-600">
                          {item.expiry_date ? (
                            <span className="bg-amber-50 text-amber-700 text-[10px] font-bold px-2 py-0.5 rounded-lg border border-amber-100">
                              {new Date(item.expiry_date).toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-medium">-</span>
                          )}
                        </td>
                        <td className="p-3 text-right font-extrabold text-slate-800">
                          {formatCurrency((item.quantity_ordered !== undefined ? item.quantity_ordered : item.quantity) * (item.cost_price !== undefined ? item.cost_price : item.unit_price))}
                        </td>
                        {['draft', 'ordered'].includes(selectedPo.status) && (
                          <td className="p-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeletePoItem(selectedPo.id, item.product_id)}
                              className="text-rose-600 hover:text-rose-800 font-bold bg-rose-50 hover:bg-rose-100 border border-rose-100 px-2 py-0.5 rounded transition-all text-[10px]"
                            >
                              Delete
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
              {selectedPo.payment_basis === 'credit' && parseFloat(selectedPo.due_amount) > 0 && ['ordered', 'received'].includes(selectedPo.status) && (
                <div className="bg-rose-50 border border-rose-100 rounded-xl p-4 flex-1">
                  <h4 className="text-xs font-bold text-rose-700 uppercase tracking-wider mb-2">Record Payment to Supplier</h4>
                  <form onSubmit={handlePayPoDue} className="flex items-center space-x-3">
                    <div className="relative flex-1 max-w-xs">
                      <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-500 text-xs">৳</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={parseFloat(selectedPo.due_amount)}
                        value={poPaymentAmount}
                        onChange={(e) => setPoPaymentAmount(e.target.value)}
                        placeholder="0.00"
                        required
                        className="w-full pl-7 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                      />
                    </div>
                    <button
                      type="submit"
                      className="bg-rose-600 hover:bg-rose-700 text-white font-semibold py-1.5 px-4 rounded-lg text-xs shadow-sm transition-colors"
                    >
                      Pay Supplier
                    </button>
                  </form>
                </div>
              )}
              <div className="text-right text-sm font-bold text-slate-700 md:ml-auto self-end">
                Total Order Value: <span className="text-lg font-black text-slate-800">{formatCurrency(selectedPo.items.reduce((sum, item) => sum + ((item.quantity_ordered !== undefined ? item.quantity_ordered : item.quantity) * (item.cost_price !== undefined ? item.cost_price : item.unit_price)), 0))}</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end space-x-3">
            <button
              onClick={() => setShowPoDetailsModal(false)}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
            >
              Close
            </button>
            {selectedPo.status === 'ordered' && (
              <button
                onClick={() => openReceiveModal(selectedPo)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors shadow"
              >
                Confirm Receive Stocks
              </button>
            )}
            {selectedPo.status === 'draft' && (
              <button
                onClick={() => updatePoStatus(selectedPo.id, 'ordered')}
                className="px-4 py-2 bg-slate-600 hover:bg-yellow-700 text-white rounded-xl text-xs font-semibold transition-colors shadow"
              >
                Place Order
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // CONFIRM STOCK RECEIVING DIALOG
  function renderReceiveModal() {
    if (!selectedPo) return null;

    const handleReceivedQtyChange = (idx, val) => {
      const updated = [...receiveItems];
      updated[idx].quantity_received = val === '' || val === '-' ? val : parseInt(val, 10);
      setReceiveItems(updated);
    };

    const handleReceivedCostChange = (idx, val) => {
      const updated = [...receiveItems];
      updated[idx].cost_price = parseFloat(val) || 0.00;
      setReceiveItems(updated);
    };

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
        <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl flex flex-col my-8 max-h-[85vh]">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Confirm Stock Receipt</span>
              <h3 className="text-lg font-black text-slate-800">Review PO #PO-{selectedPo.id}</h3>
            </div>
            <button onClick={() => setShowReceiveModal(false)} className="text-slate-400 hover:text-slate-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleConfirmReceive} className="mt-4 space-y-4 overflow-y-auto pr-1 flex-1">
            <p className="text-xs text-slate-500">
              Please count the physically received items below. Updating the cost price will automatically update the product's default purchase price in inventory and log a cost tracking entry.
            </p>

            <div className="space-y-3">
              {receiveItems.map((item, idx) => (
                <div key={item.product_id} className="p-4 bg-slate-50 border border-slate-100 rounded-xl space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="text-sm font-bold text-slate-800">{item.product_name}</h4>
                      <span className="text-xs font-mono font-bold text-slate-400">{item.sku}</span>
                    </div>
                    <span className="text-xs text-slate-500">
                      Ordered: <strong className="text-slate-700">{item.quantity_ordered} pcs</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Quantity Received
                      </label>
                      <input
                        type="number"
                        value={item.quantity_received}
                        onChange={(e) => handleReceivedQtyChange(idx, e.target.value)}
                        required
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Actual Unit Cost (৳)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.cost_price}
                        onChange={(e) => handleReceivedCostChange(idx, e.target.value)}
                        required
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Actual Unit Sale (৳)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.selling_price || 0.00}
                        onChange={(e) => handleReceivedSaleChange(idx, e.target.value)}
                        required
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                        Expire Date
                      </label>
                      <input
                        type="date"
                        value={item.expiry_date || ''}
                        onChange={(e) => handleReceivedExpiryChange(idx, e.target.value)}
                        className="w-full border border-slate-200 rounded-lg p-2 text-xs outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Receiving Notes</label>
              <input
                type="text"
                value={receiveNotes}
                onChange={(e) => setReceiveNotes(e.target.value)}
                placeholder="e.g. 2 items damaged, signed receipt attached"
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => setShowReceiveModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors shadow"
              >
                Confirm Receipt & Adjust Inventory
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // RETURN EXPIRED PRODUCT MODAL
  function renderReturnModal() {
    if (!selectedExpiredProduct) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl overflow-hidden flex flex-col">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold text-amber-600 uppercase tracking-wider">Return to Supplier</span>
              <h3 className="text-lg font-bold text-slate-800">{selectedExpiredProduct.name}</h3>
            </div>
            <button onClick={() => { setShowReturnModal(false); setSelectedExpiredProduct(null); }} className="text-slate-400 hover:text-slate-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleReturnSubmit} className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Quantity to Return (Max {selectedExpiredProduct.stock_quantity}) *</label>
              <input
                type="number"
                min="1"
                max={selectedExpiredProduct.stock_quantity}
                value={returnFormData.quantity}
                onChange={(e) => setReturnFormData({ ...returnFormData, quantity: e.target.value })}
                required
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Notes / Reason</label>
              <textarea
                value={returnFormData.notes}
                onChange={(e) => setReturnFormData({ ...returnFormData, notes: e.target.value })}
                placeholder="e.g. Expired batch return, requesting refund or credit"
                rows="3"
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => { setShowReturnModal(false); setSelectedExpiredProduct(null); }}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-semibold transition-colors shadow"
              >
                Submit Return
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // REPLACE EXPIRED PRODUCT MODAL
  function renderReplaceModal() {
    if (!selectedExpiredProduct) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl overflow-hidden flex flex-col">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Replace Product</span>
              <h3 className="text-lg font-bold text-slate-800">{selectedExpiredProduct.name}</h3>
            </div>
            <button onClick={() => { setShowReplaceModal(false); setSelectedExpiredProduct(null); }} className="text-slate-400 hover:text-slate-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleReplaceSubmit} className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Quantity Replaced *</label>
                <input
                  type="number"
                  min="1"
                  value={replaceFormData.quantity}
                  onChange={(e) => setReplaceFormData({ ...replaceFormData, quantity: e.target.value })}
                  required
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">New Expiry Date *</label>
                <input
                  type="date"
                  min={new Date().toBDISODateString()}
                  value={replaceFormData.new_expiry_date}
                  onChange={(e) => setReplaceFormData({ ...replaceFormData, new_expiry_date: e.target.value })}
                  required
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Notes / Details</label>
              <textarea
                value={replaceFormData.notes}
                onChange={(e) => setReplaceFormData({ ...replaceFormData, notes: e.target.value })}
                placeholder="e.g. Replaced by supplier with new unexpired batch"
                rows="3"
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => { setShowReplaceModal(false); setSelectedExpiredProduct(null); }}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold transition-colors shadow"
              >
                Confirm Replacement
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // EDIT LOG MODAL
  function renderEditLogModal() {
    if (!selectedLog) return null;
    const isReturn = selectedLog.action_type === 'return';
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
        <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl overflow-hidden flex flex-col">
          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
            <div>
              <span className="text-xs font-bold text-indigo-650 uppercase tracking-wider">
                Edit {isReturn ? 'Return' : 'Replacement'} Log
              </span>
              <h3 className="text-lg font-bold text-slate-800">{selectedLog.product_name}</h3>
            </div>
            <button onClick={() => { setShowEditLogModal(false); setSelectedLog(null); }} className="text-slate-400 hover:text-slate-600">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleEditLogSubmit} className="mt-4 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Quantity *</label>
                <input
                  type="number"
                  min="1"
                  value={editLogFormData.quantity}
                  onChange={(e) => setEditLogFormData({ ...editLogFormData, quantity: e.target.value })}
                  required
                  className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              {!isReturn && (
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">New Expiry Date *</label>
                  <input
                    type="date"
                    min={new Date().toBDISODateString()}
                    value={editLogFormData.new_expiry_date}
                    onChange={(e) => setEditLogFormData({ ...editLogFormData, new_expiry_date: e.target.value })}
                    required
                    className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Notes / Details</label>
              <textarea
                value={editLogFormData.notes}
                onChange={(e) => setEditLogFormData({ ...editLogFormData, notes: e.target.value })}
                placeholder="Edit notes..."
                rows="3"
                className="w-full border border-slate-200 rounded-lg p-2.5 text-sm outline-none focus:ring-1 focus:ring-indigo-500 bg-white"
              />
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => { setShowEditLogModal(false); setSelectedLog(null); }}
                className="px-4 py-2 border border-slate-200 text-slate-600 rounded-xl text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-slate-600 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors shadow"
              >
                Save Updates
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
}