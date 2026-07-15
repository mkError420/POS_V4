import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import API_BASE_URL from '../config';

export default function SalesHistory() {
  const [sales, setSales] = useState([]);
  const [heldBills, setHeldBills] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [error, setError] = useState(null);
  const [alert, setAlert] = useState(null);
  const [chartType, setChartType] = useState('revenue'); // 'revenue' or 'sales'
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [search, setSearch] = useState('');
  const [searchFocusedIndex, setSearchFocusedIndex] = useState(-1);
  const [productName, setProductName] = useState('');
  const [productDailySales, setProductDailySales] = useState(null);
  const [dailySalesLoading, setDailySalesLoading] = useState(false);
  const [trendCollapsed, setTrendCollapsed] = useState(true);

  // CSV Import State
  const fileInputRef = useRef(null);
  const [isImporting, setIsImporting] = useState(false);

  // Edit Sale state
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editSaleData, setEditSaleData] = useState(null);
  const [editSaleLoading, setEditSaleLoading] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productSearchFocusedIndex, setProductSearchFocusedIndex] = useState(-1);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerSearchFocusedIndex, setCustomerSearchFocusedIndex] = useState(-1);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);

  const customerDropdownRef = useRef(null);
  // Modal viewer state
  const [selectedSale, setSelectedSale] = useState(null);
  const [saleDetails, setSaleDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [previewMode, setPreviewMode] = useState('thermal'); // 'thermal' | 'regular'
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const isAdmin = user.role === 'shop_admin';
  const [selectedSaleIds, setSelectedSaleIds] = useState([]);

  // Profit breakdown modal state
  const [profitModal, setProfitModal] = useState(null); // { sale, details } | null
  const [profitLoading, setProfitLoading] = useState(false);

  // Revenue data for Sales Profit section
  const [revenueData, setRevenueData] = useState(null);
  const [revenueLoading, setRevenueLoading] = useState(false);

  // Filtered Profit Breakdown modal state
  const [showFilteredProfitModal, setShowFilteredProfitModal] = useState(false);
  const [filteredProfitData, setFilteredProfitData] = useState(null);
  const [filteredProfitLoading, setFilteredProfitLoading] = useState(false);

  const handlePrint = (mode) => {
    document.body.classList.add(`print-mode-${mode}`);
    window.print();
    setTimeout(() => {
      document.body.classList.remove(`print-mode-${mode}`);
    }, 500);
  };

  const triggerAlert = (type, message) => {
    setAlert({ type, message });
    setTimeout(() => setAlert(null), 4000);
  };

  const formatCurrency = (val) => {
    const numericVal = parseFloat(val || 0);
    return `BDT ${numericVal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const fetchSales = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${API_BASE_URL}/sales`;
      const params = [];
      if (startDate && endDate) {
        params.push(`start_date=${startDate}&end_date=${endDate}`);
      }
      if (productName) {
        params.push(`product_name=${encodeURIComponent(productName)}`);
      }
      if (params.length > 0) {
        url += `?${params.join('&')}`;
      }
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to retrieve sales log.');
      const data = await response.json();
      setSales(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchFilteredProfit = async () => {
    if (!startDate || !endDate) return;
    setFilteredProfitLoading(true);
    setShowFilteredProfitModal(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(
        `${API_BASE_URL}/analytics/filtered-profit?start_date=${startDate}&end_date=${endDate}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!response.ok) throw new Error('Failed to load profit breakdown.');
      const data = await response.json();
      setFilteredProfitData(data);
    } catch (err) {
      triggerAlert('error', err.message);
      setShowFilteredProfitModal(false);
    } finally {
      setFilteredProfitLoading(false);
    }
  };

  const downloadProfitPDF = () => {
    if (!filteredProfitData) {
      triggerAlert('error', 'No profit data available to download.');
      return;
    }

    try {
      const doc = new jsPDF();
      const d = filteredProfitData;
      const isLoss = d.grand_profit < 0;

      // Header
      doc.setFontSize(18);
      doc.text('Profit Breakdown Report', 14, 20);

      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.text(`Filtered Period: ${d.start_date} to ${d.end_date}`, 14, 28);
      doc.text(`Generated At: ${new Date().toLocaleString()}`, 14, 34);

      // Summary Totals
      doc.setFontSize(12);
      doc.setTextColor(0);
      doc.text(`Total Cost: BDT ${parseFloat(d.grand_cost).toFixed(3)}`, 14, 45);
      doc.text(`Total Revenue: BDT ${parseFloat(d.grand_revenue).toFixed(3)}`, 14, 52);

      doc.setTextColor(isLoss ? 220 : 20, isLoss ? 38 : 160, isLoss ? 38 : 20); // Red if loss, green if profit
      doc.text(`Net Profit: ${isLoss ? '-' : '+'}BDT ${Math.abs(parseFloat(d.grand_profit)).toFixed(3)} (${d.grand_margin}% margin)`, 14, 59);

      // Table Data
      const tableColumn = ["#", "Product", "Qty", "Cost Price", "Selling Price", "Profit", "Margin"];
      const tableRows = [];

      if (d.products && Array.isArray(d.products)) {
        d.products.forEach((p, index) => {
          const pIsLoss = p.total_profit < 0;
          const rowData = [
            index + 1,
            `${p.product_name}\n(SKU: ${p.product_sku || 'N/A'})`,
            parseFloat(p.total_qty).toFixed(p.total_qty % 1 === 0 ? 0 : 3),
            `BDT ${parseFloat(p.total_cost).toFixed(3)}`,
            `BDT ${parseFloat(p.total_revenue).toFixed(3)}`,
            `${pIsLoss ? '-' : '+'}BDT ${Math.abs(parseFloat(p.total_profit)).toFixed(3)}`,
            `${p.margin}%`
          ];
          tableRows.push(rowData);
        });
      }

      // Generate Table
      autoTable(doc, {
        startY: 68,
        head: [tableColumn],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [51, 65, 85] },
        styles: { fontSize: 9, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 55 },
          2: { halign: 'center', cellWidth: 15 },
          3: { halign: 'right' },
          4: { halign: 'right' },
          5: { halign: 'right' },
          6: { halign: 'center' }
        },
        didParseCell: function (data) {
          if (data.section === 'body' && data.column.index === 5) { // Profit column color
            const val = data.cell.raw.toString();
            if (val.startsWith('-')) data.cell.styles.textColor = [220, 38, 38]; // Red
            else data.cell.styles.textColor = [5, 150, 105]; // Emerald
          }
        }
      });

      // Save PDF
      doc.save(`Profit_Breakdown_${d.start_date}_to_${d.end_date}.pdf`);
      triggerAlert('success', 'PDF downloaded successfully.');
    } catch (err) {
      console.error('PDF download error:', err);
      triggerAlert('error', 'Failed to generate PDF. Please try again.');
    }
  };

  const fetchProductDailySales = async () => {
    if (!startDate || !endDate) {
      setProductDailySales(null);
      return;
    }
    setDailySalesLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/analytics/daily-products?start_date=${startDate}&end_date=${endDate}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) {
        throw new Error('Could not load daily product sales summary.');
      }
      const data = await response.json();
      setProductDailySales(data);
    } catch (err) {
      triggerAlert('error', err.message);
    } finally {
      setDailySalesLoading(false);
    }
  };

  const fetchRevenue = async () => {
    setRevenueLoading(true);
    try {
      const token = localStorage.getItem('token');
      let url = `${API_BASE_URL}/analytics/revenue`;
      const queryParams = [];
      if (startDate) queryParams.push(`start_date=${startDate}`);
      if (endDate) queryParams.push(`end_date=${endDate}`);

      if (queryParams.length > 0) {
        url += `?${queryParams.join('&')}`;
      }

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to retrieve financial analytics data.');
      }

      const data = await response.json();
      setRevenueData(data);
    } catch (err) {
      console.error('Failed to fetch revenue data:', err);
    } finally {
      setRevenueLoading(false);
    }
  };

  const fetchHeldBills = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/held-bills`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setHeldBills(data);
      }
    } catch (e) {
      console.error('Failed to fetch held bills in sales history', e);
    }
  };

  const fetchProducts = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/products`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch (e) {
      console.error('Failed to fetch products', e);
    }
  };

  const fetchCustomers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/customers`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
      }
    } catch (e) {
      console.error('Failed to fetch customers', e);
    }
  };

  const fetchSaleDetails = async (saleId) => {
    setDetailsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/sales/${saleId}?i=1`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      if (!response.ok) throw new Error('Failed to load transaction details.');
      const data = await response.json();
      setSaleDetails(data);
    } catch (err) {
      alert(err.message);
      setSelectedSale(null);
    } finally {
      setDetailsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCustomers();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedSaleIds([]);
    fetchSales();
    fetchHeldBills();
    fetchProductDailySales();
    fetchRevenue();
  }, [startDate, endDate, productName]);

  useEffect(() => {
    setCurrentPage(1);
    setSelectedSaleIds([]);
  }, [search]);

  useEffect(() => {
    function handleClickOutside(event) {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(event.target)) {
        setShowCustomerDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const openReceipt = (sale) => {
    setSelectedSale(sale);
    fetchSaleDetails(sale.id);
  };

  const openEditSale = async (sale) => {
    setDetailsLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/sales/${sale.id}?i=1`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Requested-With': 'XMLHttpRequest'
        }
      });
      if (!response.ok) throw new Error('Failed to load transaction details.');

      const data = await response.json();
      setCustomerSearch(data.customer_name || '');
      const initialData = {
        ...data,
        items: data.items.map(i => ({
          product_id: i.product_id || i.id,
          name: i.product_name || i.name,
          quantity: parseInt(i.quantity),
          unit_price: parseFloat(i.unit_price || i.price),
          subtotal: parseFloat(i.unit_price || i.price) * parseInt(i.quantity)
        })),
        discount: parseFloat(data.discount || 0),
        tax: parseFloat(data.tax || 0),
        paid_amount: parseFloat(data.paid_amount || 0)
      };

      updateEditSaleTotals(initialData);
      setShowEditModal(true);
    } catch (err) {
      triggerAlert('error', err.message);
    } finally {
      setDetailsLoading(false);
    }
  };

  const getFilteredCustomers = () => {
    if (!customerSearch) return customers;
    const lowerTerm = customerSearch.toLowerCase();
    return customers.filter(c =>
      c.name.toLowerCase().includes(lowerTerm) ||
      (c.phone && c.phone.toLowerCase().includes(lowerTerm))
    );
  };

  const handleEditItemQty = (idx, newQty) => {
    const parsedQty = parseFloat(newQty);
    let qtyVal = newQty;
    if (newQty === '') {
      qtyVal = '';
    } else if (isNaN(parsedQty) || parsedQty < 0) {
      qtyVal = 0;
    }
    const newData = { ...editSaleData };
    newData.items[idx].quantity = qtyVal;
    newData.items[idx].subtotal = newData.items[idx].unit_price * (parseFloat(qtyVal) || 0);
    updateEditSaleTotals(newData);
  };

  const handleEditItemBlur = (idx, qtyStr) => {
    const parsedQty = parseFloat(qtyStr) || 0;
    if (parsedQty <= 0) {
      const newData = { ...editSaleData };
      newData.items[idx].quantity = 1;
      newData.items[idx].subtotal = newData.items[idx].unit_price * 1;
      updateEditSaleTotals(newData);
    } else {
      const newData = { ...editSaleData };
      newData.items[idx].quantity = parsedQty;
      updateEditSaleTotals(newData);
    }
  };

  const handleRemoveEditItem = (idx) => {
    const newData = { ...editSaleData };
    newData.items.splice(idx, 1);
    updateEditSaleTotals(newData);
  };

  const handleEditItemPrice = (idx, newPrice) => {
    const parsedPrice = parseFloat(newPrice);
    let priceVal = newPrice;
    if (newPrice === '') {
      priceVal = '';
    } else if (isNaN(parsedPrice) || parsedPrice < 0) {
      priceVal = 0;
    }
    const newData = { ...editSaleData };
    newData.items[idx].unit_price = priceVal;
    newData.items[idx].subtotal = (parseFloat(priceVal) || 0) * newData.items[idx].quantity;
    updateEditSaleTotals(newData);
  };

  const handleEditItemSubtotal = (idx, newSubtotal) => {
    const newData = { ...editSaleData };
    newData.items[idx].subtotal = parseFloat(newSubtotal) || 0;
    updateEditSaleTotals(newData);
  };

  const handleAddEditProduct = (prod) => {
    const newData = { ...editSaleData };
    const existing = newData.items.find(i => i.product_id === prod.id);
    if (existing) {
      existing.quantity += 1;
      existing.subtotal = existing.quantity * existing.unit_price;
    } else {
      newData.items.push({
        product_id: prod.id,
        name: prod.name,
        quantity: 1,
        unit_price: parseFloat(prod.price),
        subtotal: parseFloat(prod.price)
      });
    }
    setProductSearch('');
    updateEditSaleTotals(newData);
  };

  const updateEditSaleTotals = (data) => {
    const subtotal = data.items.reduce((sum, item) => sum + item.subtotal, 0);
    data.subtotal = subtotal;
    const final_amount = subtotal - parseFloat(data.discount || 0) + parseFloat(data.tax || 0);
    data.final_amount = final_amount;
    setEditSaleData(data);
  };

  const saveEditSale = async () => {
    if (editSaleData.items.length === 0) {
      return triggerAlert('error', 'Sale must have at least one item.');
    }
    setEditSaleLoading(true);
    try {
      const token = localStorage.getItem('token');
      const payload = {
        customer_id: editSaleData.customer_id,
        customer_name: editSaleData.customer_name,
        customer_phone: editSaleData.customer_phone,
        customer_address: editSaleData.customer_address,
        items: editSaleData.items,
        discount: editSaleData.discount,
        tax: editSaleData.tax,
        payment_method: editSaleData.payment_method,
        paid_amount: editSaleData.paid_amount,
        created_at: editSaleData.created_at
      };

      const response = await fetch(`${API_BASE_URL}/sales/${editSaleData.id}?i=1`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify(payload)
      });

      const resData = await response.json();
      if (!response.ok) throw new Error(resData.error || 'Failed to update sale.');

      triggerAlert('success', 'Sale updated successfully.');
      setShowEditModal(false);
      fetchSales();
    } catch (err) {
      triggerAlert('error', err.message);
    } finally {
      setEditSaleLoading(false);
    }
  };

  const openProfitModal = async (sale) => {
    setProfitModal({ sale, details: null });
    setProfitLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/sales/${sale.id}?i=1`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Failed to load profit details.');
      const data = await response.json();
      setProfitModal({ sale, details: data });
    } catch (err) {
      triggerAlert('error', err.message);
      setProfitModal(null);
    } finally {
      setProfitLoading(false);
    }
  };

  const handleDeleteSale = async (saleId) => {
    if (!window.confirm(`Are you sure you want to delete Sale #${saleId}?\n\nThis will:\n• Restore all product stock quantities\n• Reverse any customer due balance\n• Remove this transaction from all reports\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/sales/${saleId}?i=1`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete sale.');

      triggerAlert('success', data.message);

      // Close receipt modal if this sale was being viewed
      if (selectedSale && selectedSale.id === saleId) {
        setSelectedSale(null);
        setSaleDetails(null);
      }

      // Refresh sales list (totals auto-adjust)
      fetchSales();
      fetchHeldBills();
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const handleSelectAllToggle = (currentSales) => {
    const currentSaleIds = currentSales.map(s => s.id);
    const areAllCurrentPageSelected = currentSaleIds.length > 0 && currentSaleIds.every(id => selectedSaleIds.includes(id));
    if (areAllCurrentPageSelected) {
      setSelectedSaleIds(prev => prev.filter(id => !currentSaleIds.includes(id)));
    } else {
      setSelectedSaleIds(prev => {
        const union = new Set([...prev, ...currentSaleIds]);
        return Array.from(union);
      });
    }
  };

  const handleSelectToggle = (saleId) => {
    setSelectedSaleIds(prev =>
      prev.includes(saleId)
        ? prev.filter(id => id !== saleId)
        : [...prev, saleId]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedSaleIds.length === 0) return;

    if (!window.confirm(`Are you sure you want to delete the ${selectedSaleIds.length} selected sales?\n\nThis will:\n• Restore all product stock quantities for these transactions\n• Reverse any customer due balances associated with them\n• Remove these transactions from all reports\n\nThis action cannot be undone.`)) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/sales/bulk-delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ ids: selectedSaleIds })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to delete selected sales.');

      triggerAlert('success', data.message);
      setSelectedSaleIds([]);

      if (selectedSale && selectedSaleIds.includes(selectedSale.id)) {
        setSelectedSale(null);
        setSaleDetails(null);
      }

      fetchSales();
      fetchHeldBills();
    } catch (err) {
      triggerAlert('error', err.message);
    }
  };

  const exportToCSV = () => {
    if (filteredSales.length === 0) {
      triggerAlert('error', 'No sales history to export.');
      return;
    }

    const headers = ['Invoice ID', 'Date', 'Products', 'Customer', 'Cashier', 'Payment Method', 'Total Amount', 'Paid Amount', 'Due Amount'];

    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      let str = String(val);
      if (/[",\n\r]/.test(str)) {
        str = `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = filteredSales.map(sale => [
      sale.id,
      `"${new Date(sale.created_at).toLocaleString()}"`,
      escapeCSV(sale.product_names || ''),
      escapeCSV(sale.customer_name || 'Walk-in Customer'),
      escapeCSV(sale.staff_name),
      escapeCSV(sale.payment_method.replace('_', ' ')),
      parseFloat(sale.final_amount).toFixed(3),
      parseFloat(sale.paid_amount !== null && sale.paid_amount !== undefined ? sale.paid_amount : sale.final_amount || 0).toFixed(3),
      parseFloat(sale.due_amount || 0).toFixed(3)
    ]);

    const csvContent = "\uFEFF" + [
      headers.join(','),
      ...rows.map(e => e.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const dateSuffix = new Date().toBDISODateString();
    link.setAttribute('download', `sales_history_${dateSuffix}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerAlert('success', 'Sales history exported successfully!');
  };

  const handleCSVUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'text/csv' && !file.name.endsWith('.csv')) {
      triggerAlert('error', 'Please upload a valid CSV file.');
      return;
    }

    setIsImporting(true);
    const formData = new FormData();
    formData.append('csv_file', file);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/sales/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to import CSV.');
      }

      triggerAlert('success', `Imported ${data.imported_count} sales successfully!`);
      fetchSales(); // Refresh the sales list
      fetchRevenue();
    } catch (err) {
      triggerAlert('error', err.message);
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDueBillsPrint = () => {
    const printWindow = window.open('', 'PRINT', 'height=800,width=1200');

    printWindow.document.write('<html><head><title>Due ammount Bills Report</title>');
    printWindow.document.write(`
      <style>
        body { font-family: sans-serif; margin: 20px; }
        h1 { text-align: center; color: #333; }
        table { width: 100%; border-collapse: collapse; font-size: 10px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
        tr:nth-child(even) { background-color: #f9f9f9; }
        @page { size: A4 landscape; margin: 20mm; }
      </style>
    `);
    printWindow.document.write('</head><body>');
    printWindow.document.write('<h1>Due ammount Bills</h1>');
    printWindow.document.write(document.getElementById('due-bills-table-wrapper').innerHTML);
    printWindow.document.write('</body></html>');
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const exportDueBillsToCSV = () => {
    const dueBills = heldBills.filter(b => b.status === 'held' && parseFloat(b.due_amount || 0) > 0);
    if (dueBills.length === 0) {
      triggerAlert('error', 'No due bills to export.');
      return;
    }

    const headers = ['Due Bill ID', 'Date Created', 'Original Sale ID', 'Customer', 'Cashier', 'Due Amount'];

    const escapeCSV = (val) => {
      if (val === null || val === undefined) return '';
      let str = String(val);
      if (/[",\n\r]/.test(str)) {
        str = `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = dueBills.map(bill => {
      const saleIdMatch = (bill.notes || '').match(/Sale #(\d+)/);
      const originalSaleId = saleIdMatch ? saleIdMatch[1] : 'N/A';

      return [
        bill.id,
        `"${new Date(bill.created_at).toLocaleString()}"`,
        originalSaleId,
        escapeCSV(bill.customer_name || 'Walk-in'),
        escapeCSV(bill.staff_name || 'N/A'),
        parseFloat(bill.due_amount || 0).toFixed(3)
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `all_bills_history_${new Date().toBDISODateString()}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    triggerAlert('success', 'Due bills history exported successfully!');
  };

  // Computed summary stats
  const filteredSales = sales.filter((sale) => {
    const query = search.toLowerCase().trim();
    if (!query) return true;
    return (
      String(sale.id).includes(query) ||
      (sale.customer_name && sale.customer_name.toLowerCase().includes(query)) ||
      (sale.staff_name && sale.staff_name.toLowerCase().includes(query)) ||
      (sale.payment_method && sale.payment_method.toLowerCase().includes(query)) ||
      (sale.final_amount && String(sale.final_amount).includes(query))
    );
  }).sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0) || (b.id || 0) - (a.id || 0));

  const totalSalesCount = filteredSales.length;
  const totalRevenue = filteredSales.reduce((sum, s) => sum + parseFloat(s.final_amount || 0), 0);
  const totalPaid = filteredSales.reduce((sum, s) => {
    const val = s.paid_amount !== null && s.paid_amount !== undefined ? s.paid_amount : (s.final_amount || 0);
    return sum + parseFloat(val || 0);
  }, 0);
  const totalDue = heldBills
    .filter(b => b.status === 'held' && parseFloat(b.due_amount || 0) > 0)
    .reduce((sum, b) => sum + parseFloat(b.due_amount || 0), 0);

  const totalPages = Math.ceil(filteredSales.length / itemsPerPage);
  const indexOfLastSale = currentPage * itemsPerPage;
  const indexOfFirstSale = indexOfLastSale - itemsPerPage;
  const currentSales = filteredSales.slice(indexOfFirstSale, indexOfLastSale);

  const renderEditSaleModal = () => {
    if (!editSaleData) return null;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowEditModal(false)}></div>
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-slate-800">Edit Sale #{editSaleData.id}</h2>
              </div>
              <p className="text-sm text-slate-500 mt-1">Modify items, discount, tax, or payment method</p>
            </div>
            <button onClick={() => setShowEditModal(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
              <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            <div className="flex flex-col md:flex-row gap-6 mb-6">
              {isAdmin && (
                <div className="w-full md:w-1/3">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Sale Date</label>
                  <input
                    type="date"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                    value={editSaleData.created_at ? editSaleData.created_at.split(' ')[0].split('T')[0] : ''}
                    onChange={e => setEditSaleData({ ...editSaleData, created_at: e.target.value })}
                  />
                </div>
              )}

              <div className="relative flex-1" ref={customerDropdownRef}>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Customer</label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                  placeholder="Search customers..."
                  value={customerSearch}
                  onFocus={() => setShowCustomerDropdown(true)}
                  onChange={e => {
                    setCustomerSearch(e.target.value);
                    setShowCustomerDropdown(true);
                    setCustomerSearchFocusedIndex(-1);
                    setEditSaleData({ ...editSaleData, customer_id: null, customer_name: e.target.value });
                  }}
                  onKeyDown={(e) => {
                    const filtered = getFilteredCustomers();
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setCustomerSearchFocusedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setCustomerSearchFocusedIndex(prev => (prev > 0 ? prev - 1 : prev));
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      if (customerSearchFocusedIndex >= 0 && filtered[customerSearchFocusedIndex]) {
                        const cust = filtered[customerSearchFocusedIndex];
                        setEditSaleData({ ...editSaleData, customer_id: cust.id, customer_name: cust.name });
                        setCustomerSearch(cust.name);
                        setShowCustomerDropdown(false);
                        setCustomerSearchFocusedIndex(-1);
                      }
                    }
                  }}
                />
                {showCustomerDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {getFilteredCustomers().map((cust, idx) => (
                      <button
                        key={cust.id}
                        onClick={() => {
                          setEditSaleData({ ...editSaleData, customer_id: cust.id, customer_name: cust.name });
                          setCustomerSearch(cust.name);
                          setShowCustomerDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2 hover:bg-indigo-50 text-sm ${customerSearchFocusedIndex === idx ? 'bg-indigo-100 ring-1 ring-indigo-500' : ''}`}
                      >{cust.name} <span className="text-xs text-slate-500">({cust.phone || 'No Phone'})</span></button>
                    ))}
                  </div>
                )}
              </div>

              {/* Search Product */}
              <div className="relative flex-1">
                <label className="block text-sm font-semibold text-slate-700 mb-2">Add Product</label>
                <input
                  type="text"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-sm"
                  placeholder="Search products by name or SKU..."
                  value={productSearch}
                  onChange={e => { setProductSearch(e.target.value); setProductSearchFocusedIndex(-1); }}
                  onKeyDown={(e) => {
                    const filtered = products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase())));
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setProductSearchFocusedIndex(prev => (prev < filtered.length - 1 ? prev + 1 : prev));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setProductSearchFocusedIndex(prev => (prev > 0 ? prev - 1 : prev));
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      if (productSearchFocusedIndex >= 0 && filtered[productSearchFocusedIndex]) {
                        handleAddEditProduct(filtered[productSearchFocusedIndex]);
                        setProductSearchFocusedIndex(-1);
                      }
                    }
                  }}
                />
                {productSearch && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                    {products.filter(p => p.name.toLowerCase().includes(productSearch.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(productSearch.toLowerCase()))).map((prod, idx) => (
                      <button
                        key={prod.id}
                        onClick={() => handleAddEditProduct(prod)}
                        className={`w-full text-left px-4 py-2 hover:bg-indigo-50 flex justify-between items-center text-sm ${productSearchFocusedIndex === idx ? 'bg-indigo-100 ring-1 ring-indigo-500' : ''}`}
                      >
                        <span>{prod.name} <span className="text-xs text-slate-500 ml-2">Stock: {prod.stock_quantity}</span></span>
                        <span className="font-semibold text-indigo-600">৳{parseFloat(prod.price).toFixed(3)}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Cart Items Table */}
            <div className="border border-slate-200 rounded-xl overflow-hidden mb-6">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="p-3 font-semibold">Product</th>
                    <th className="p-3 font-semibold text-center w-24">Price</th>
                    <th className="p-3 font-semibold text-center w-32">Qty</th>
                    <th className="p-3 font-semibold text-right w-24">Subtotal</th>
                    <th className="p-3 font-semibold text-center w-12"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {editSaleData.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-3 font-medium text-slate-700">{item.name}</td>
                      <td className="p-3 text-center text-slate-500">
                        <input
                          type="number"
                          className="w-24 h-8 text-center border border-slate-200 rounded-md text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          value={item.unit_price}
                          onChange={(e) => handleEditItemPrice(idx, e.target.value)}
                          min="0"
                          step="0.01"
                        />
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-center">
                          <button onClick={() => handleEditItemQty(idx, item.quantity - 1)} className="w-8 h-8 rounded-l-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center">-</button>
                          <input
                            type="number"
                            className="w-12 h-8 text-center border-y border-slate-100 text-sm font-semibold focus:outline-none focus:ring-0"
                            value={item.quantity}
                            onChange={(e) => {
                              let valStr = e.target.value;
                              const parts = valStr.split('.');
                              if (parts[1] && parts[1].length > 3) {
                                valStr = parts[0] + '.' + parts[1].substring(0, 3);
                              }
                              handleEditItemQty(idx, valStr);
                            }}
                            onBlur={() => handleEditItemBlur(idx, item.quantity)}
                            min="0"
                            step="0.001"
                          />
                          <button onClick={() => handleEditItemQty(idx, item.quantity + 1)} className="w-8 h-8 rounded-r-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold flex items-center justify-center">+</button>
                        </div>
                      </td>
                      <td className="p-3 text-right font-bold text-slate-700">
                        <input
                          type="number"
                          className="w-24 h-8 text-right border border-slate-200 rounded-md text-sm font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          value={item.subtotal.toFixed(3)}
                          onChange={(e) => handleEditItemSubtotal(idx, e.target.value)}
                          min="0"
                          step="0.01"
                        />
                      </td>
                      <td className="p-3 text-center">
                        <button onClick={() => handleRemoveEditItem(idx)} className="text-rose-400 hover:text-rose-600 p-1">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {editSaleData.items.length === 0 && (
                    <tr>
                      <td colSpan="5" className="p-6 text-center text-slate-400 italic">No items in this sale.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Totals & Payment */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Discount (৳)</label>
                  <input type="number" step="0.01" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={editSaleData.discount || ''} onChange={e => updateEditSaleTotals({ ...editSaleData, discount: parseFloat(e.target.value) || 0 })} />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Tax (৳)</label>
                  <input type="number" step="0.01" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={editSaleData.tax || ''} onChange={e => updateEditSaleTotals({ ...editSaleData, tax: parseFloat(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="space-y-4">
                <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-2 text-sm">
                  <div className="flex justify-between text-slate-500">
                    <span>Subtotal:</span>
                    <span className="font-semibold text-slate-700">৳{editSaleData.subtotal.toFixed(3)}</span>
                  </div>
                  <div className="flex justify-between text-indigo-600 font-bold text-lg pt-2 border-t border-slate-200">
                    <span>Final Amount:</span>
                    <span>৳{editSaleData.final_amount.toFixed(3)}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Paid Amount (৳)</label>
                  <input type="number" step="0.01" className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-emerald-600" value={editSaleData.paid_amount === null ? '' : editSaleData.paid_amount} onChange={e => setEditSaleData({ ...editSaleData, paid_amount: e.target.value === '' ? 0 : parseFloat(e.target.value) })} />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Payment Method</label>
                  <select className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm" value={editSaleData.payment_method} onChange={e => setEditSaleData({ ...editSaleData, payment_method: e.target.value })}>
                    <option value="cash">Cash</option>
                    <option value="card">Card</option>
                    <option value="mobile_banking">Mobile Banking</option>
                  </select>
                </div>

                {editSaleData.final_amount > editSaleData.paid_amount && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-semibold flex justify-between">
                    <span>New Due Created:</span>
                    <span>৳{(editSaleData.final_amount - editSaleData.paid_amount).toFixed(3)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="p-5 border-t border-slate-100 flex justify-end space-x-3 bg-slate-50">
            <button onClick={() => setShowEditModal(false)} className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors">Cancel</button>
            <button
              onClick={saveEditSale}
              disabled={editSaleLoading || editSaleData.items.length === 0}
              className="px-5 py-2.5 text-sm font-bold text-white bg-gray-600 hover:bg-purple-700 disabled:opacity-50 rounded-xl shadow-lg shadow-indigo-200 transition-all"
            >
              {editSaleLoading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">

      {/* Alert Banner */}
      {alert && (
        <div className={`fixed top-4 right-4 z-50 p-4 rounded-xl shadow-lg flex items-center transition-all ${alert.type === 'success' ? 'bg-emerald-500 text-white' : 'bg-rose-500 text-white'
          }`}>
          <span className="text-sm font-semibold">{alert.message}</span>
        </div>
      )}

      {/* Title Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Sales Transactions</h2>
          <p className="text-sm text-slate-500">Search and audit invoice histories, payment logs, and totals</p>
        </div>
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          <input
            type="file"
            accept=".csv"
            ref={fileInputRef}
            onChange={handleCSVUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current && fileInputRef.current.click()}
            disabled={isImporting}
            className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-2.5 px-5 border border-slate-200 rounded-xl text-sm shadow-xs transition-colors flex items-center space-x-2 disabled:opacity-50"
          >
            {isImporting ? (
              <svg className="animate-spin w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
              </svg>
            ) : (
              <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            )}
            <span>{isImporting ? 'Importing...' : 'Import CSV'}</span>
          </button>
          <button
            onClick={exportToCSV}
            className="bg-gray-700 hover:bg-slate-50 text-white hover:text-black font-semibold py-2.5 px-5 border border-slate-200 rounded-xl text-sm shadow-xs transition-colors flex items-center space-x-2"
          >
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export CSV</span>
          </button>
        </div>
      </div>


      {/* Daily Product Sales Summary */}
      {productDailySales && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
          <div className="p-4 bg-slate-50/50 border-b border-slate-100">
            <h3 className="font-bold text-slate-800">Products Sold Summary</h3>
            <p className="text-xs text-slate-500">
              Aggregated view of all products sold between <span className="font-semibold text-indigo-600">{new Date(startDate).toLocaleDateString()}</span> and <span className="font-semibold text-indigo-600">{new Date(endDate).toLocaleDateString()}</span>.
            </p>
          </div>
          <div className="overflow-x-auto">
            {dailySalesLoading ? (
              <div className="p-12 text-center text-slate-400">Loading summary...</div>
            ) : productDailySales.length === 0 ? (
              <div className="p-12 text-center text-slate-400">No products were sold in this period.</div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider">
                    <th className="p-3 pl-4">SKU</th>
                    <th className="p-3">Product Name</th>
                    <th className="p-3">Invoice IDs</th>
                    <th className="p-3 text-center">Total Quantity Sold</th>
                    <th className="p-3 text-right pr-4">Total Purchase Amount</th>
                    <th className="p-3 text-right pr-4">Total Revenue Generated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {productDailySales.map(item => (
                    <tr key={item.product_id} className="hover:bg-slate-50/50">
                      <td className="p-3 pl-4 font-mono text-xs font-bold text-slate-500">{item.product_sku}</td>
                      <td className="p-3 font-semibold text-slate-800">{item.product_name}</td>
                      <td className="p-3 text-xs text-slate-500 max-w-xs break-words">{item.invoice_ids || '-'}</td>
                      <td className="p-3 text-center">
                        <span className="bg-indigo-50 text-indigo-700 font-bold px-2 py-0.5 rounded border border-indigo-100">
                          {item.total_quantity_sold} units
                        </span>
                      </td>
                      <td className="p-3 text-right pr-4 font-bold text-rose-600">
                        ৳{parseFloat(item.total_cost || 0).toFixed(3)}
                      </td>
                      <td className="p-3 text-right pr-4 font-extrabold text-emerald-600">
                        ৳{parseFloat(item.total_revenue).toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-50/50 border-t border-slate-200 font-bold">
                    <td colSpan="3" className="p-3 pl-4 text-slate-500 uppercase text-xs">Total</td>
                    <td className="p-3 text-center text-indigo-800">
                      {productDailySales.reduce((sum, item) => sum + item.total_quantity_sold, 0)} units
                    </td>
                    <td className="p-3 text-right pr-4 text-rose-700">
                      ৳{productDailySales.reduce((sum, item) => sum + parseFloat(item.total_cost || 0), 0).toFixed(3)}
                    </td>
                    <td className="p-3 text-right pr-4 text-emerald-700">
                      ৳{productDailySales.reduce((sum, item) => sum + parseFloat(item.total_revenue), 0).toFixed(3)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      )}


      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Sales Profit Card */}
        {revenueData && (
          <div className={`border rounded-2xl p-4 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between ${(parseFloat(revenueData.sales_revenue || 0) - parseFloat(revenueData.cost_of_goods_sold || 0)) >= 0
            ? 'bg-indigo-50/40 border-indigo-200 text-indigo-800'
            : 'bg-rose-50/40 border-rose-200 text-rose-800'
            }`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Sales Profit</span>
              <div className={`p-2 rounded-xl ${(parseFloat(revenueData.sales_revenue || 0) - parseFloat(revenueData.cost_of_goods_sold || 0)) >= 0 ? 'bg-indigo-100 text-indigo-600' : 'bg-rose-100 text-rose-600'
                }`}>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div className="mt-3">
              <span className="block text-xl font-black">{formatCurrency((parseFloat(revenueData.sales_revenue || 0) - parseFloat(revenueData.cost_of_goods_sold || 0)))}</span>
              <span className="text-xs opacity-75 mt-1 block">Sales: {formatCurrency(revenueData.sales_revenue || 0)}</span>
            </div>
          </div>
        )}
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Sales</p>
            <h3 className="text-xl font-extrabold text-slate-800">{totalSalesCount}</h3>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Revenue</p>
            <h3 className="text-xl font-extrabold text-indigo-600"><span className="text-sm">BDT:</span> {totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</h3>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center space-x-3">
          <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Collected</p>
            <h3 className="text-xl font-extrabold text-emerald-600"><span className="text-sm">BDT:</span> {totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</h3>
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex items-center space-x-3">
          <div className={`p-2.5 rounded-xl ${totalDue > 0 ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Due</p>
            <h3 className={`text-xl font-extrabold ${totalDue > 0 ? 'text-rose-600' : 'text-emerald-600'}`}><span className="text-sm">BDT:</span> {totalDue.toLocaleString('en-IN', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}</h3>
          </div>
        </div>
      </div>

      {/* Dynamic Graph Chart */}
      {/* {(() => {
        
        const trendMap = {};
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          const dateStr = d.toBDISODateString();
          trendMap[dateStr] = { date: dateStr, revenue: 0, count: 0 };
        }

        filteredSales.forEach(sale => {
          const dateStr = new Date(sale.created_at).toBDISODateString();
          if (trendMap[dateStr]) {
            trendMap[dateStr].revenue += parseFloat(sale.final_amount || 0);
            trendMap[dateStr].count += 1;
          }
        });

        const chartData = Object.values(trendMap);
        const chartValues = chartData.map(d => chartType === 'revenue' ? d.revenue : d.count);
        const maxVal = Math.max(...chartValues, 5);

        return (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs relative">
            <div
              className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer"
              onClick={() => setTrendCollapsed(!trendCollapsed)}
            >
              <div className="flex items-center space-x-3">
                <svg
                  className={`w-5 h-5 text-slate-500 transition-transform duration-200 ${trendCollapsed ? '-rotate-90' : 'rotate-0'}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
                <div>
                  <h3 className="text-lg font-bold text-slate-800">Sales Transactions Trend</h3>
                  <p className="text-xs text-slate-500">Chronological summary of successful sales volume and transaction count</p>
                </div>
              </div>

              {!trendCollapsed && (
                <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200/60 self-end sm:self-auto" onClick={(e) => e.stopPropagation()}>
                  <button
                    onClick={() => setChartType('revenue')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${chartType === 'revenue'
                      ? 'bg-white text-indigo-650 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                      }`}
                  >
                    Revenue (৳)
                  </button>
                  <button
                    onClick={() => setChartType('sales')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${chartType === 'sales'
                      ? 'bg-white text-indigo-650 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                      }`}
                  >
                    Sales Volume
                  </button>
                </div>
              )}
            </div>

            {!trendCollapsed && (
              <div className="relative w-full h-[180px]">
                
                <svg
                  viewBox="0 0 600 180"
                  className="w-full h-full overflow-visible"
                  preserveAspectRatio="none"
                >
                  <defs>
                    <linearGradient id="salesAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#818cf8" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#818cf8" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => {
                    const y = 15 + (1 - ratio) * 125;
                    const labelVal = ratio * maxVal;
                    return (
                      <g key={idx}>
                        <line
                          x1={55}
                          y1={y}
                          x2={575}
                          y2={y}
                          stroke="#f1f5f9"
                          strokeWidth="1.5"
                        />
                        <text
                          x={43}
                          y={y + 4}
                          textAnchor="end"
                          className="text-[10px] font-bold text-slate-400 fill-current font-sans"
                        >
                          {chartType === 'revenue' ? `৳${Math.round(labelVal)}` : Math.round(labelVal)}
                        </text>
                      </g>
                    );
                  })}

                 
                  {(() => {
                    const chartPoints = chartData.map((d, index) => {
                      const val = chartType === 'revenue' ? d.revenue : d.count;
                      const x = 55 + (index * (600 - 55 - 25) / 6);
                      const y = 140 - ((val / maxVal) * 125);
                      return { x, y, val, date: d.date };
                    });

                    const linePath = chartPoints.reduce((path, pt, i) => {
                      return path + (i === 0 ? `M ${pt.x} ${pt.y}` : ` L ${pt.x} ${pt.y}`);
                    }, '');

                    const areaPath = `${linePath} L ${chartPoints[chartPoints.length - 1].x} 140 L ${chartPoints[0].x} 140 Z`;

                    return (
                      <>
                        <path d={areaPath} fill="url(#salesAreaGradient)" />
                        <path
                          d={linePath}
                          fill="none"
                          stroke="#6366f1"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />

                        {chartPoints.map((pt, idx) => (
                          <g key={idx}>
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r="15"
                              fill="transparent"
                              className="cursor-pointer"
                              onMouseEnter={() => setHoveredPoint({ ...pt, index: idx })}
                              onMouseLeave={() => setHoveredPoint(null)}
                            />
                            <circle
                              cx={pt.x}
                              cy={pt.y}
                              r={hoveredPoint?.index === idx ? "5" : "3.5"}
                              fill={hoveredPoint?.index === idx ? "#6366f1" : "#ffffff"}
                              stroke="#6366f1"
                              strokeWidth={hoveredPoint?.index === idx ? "2.5" : "1.5"}
                              className="pointer-events-none transition-all duration-150"
                            />
                          </g>
                        ))}

                        {chartPoints.map((pt, idx) => {
                          const dateObj = new Date(pt.date);
                          const label = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                          return (
                            <text
                              key={idx}
                              x={pt.x}
                              y={160}
                              textAnchor="middle"
                              className="text-[10px] font-bold text-slate-400 fill-current font-sans"
                            >
                              {label}
                            </text>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>

                
                {hoveredPoint && (
                  <div
                    className="absolute bg-slate-900/95 backdrop-blur-md text-white rounded-xl p-2.5 shadow-xl border border-slate-700 pointer-events-none text-xs flex flex-col space-y-0.5 transition-all duration-75 z-10"
                    style={{
                      left: `${(hoveredPoint.x / 600) * 100}%`,
                      top: `${(hoveredPoint.y / 180) * 100 - 5}%`,
                      transform: 'translate(-50%, -100%)'
                    }}
                  >
                    <span className="font-semibold text-slate-400">
                      {new Date(hoveredPoint.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <span className="font-extrabold text-white text-sm">
                      {chartType === 'revenue' ? `Revenue: ৳${parseFloat(hoveredPoint.val).toFixed(3)}` : `Sales: ${hoveredPoint.val}`}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })()}
 */}
      {/* Bulk Action Bar */}
      {isAdmin && selectedSaleIds.length > 0 && (
        <div className="bg-slate-900 text-white rounded-2xl p-4 flex items-center justify-between shadow-xl animate-fade-in">
          <div className="flex items-center space-x-3">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-450 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
            </span>
            <span className="text-sm font-semibold">
              Selected <span className="font-extrabold text-rose-400">{selectedSaleIds.length}</span> transaction{selectedSaleIds.length > 1 ? 's' : ''} for deletion
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setSelectedSaleIds([])}
              className="text-xs font-semibold text-slate-300 hover:text-white px-3 py-2 rounded-xl hover:bg-slate-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleBulkDelete}
              className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs py-2 px-4 rounded-xl shadow-md transition-colors flex items-center space-x-1.5"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Delete Selected</span>
            </button>
          </div>
        </div>
      )}

      {/* Date Filters bar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-wrap items-center gap-4 shadow-xs">
        <div className="flex items-center space-x-2">
          <label className="text-xs font-bold text-slate-500 uppercase">From:</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="border border-slate-200 rounded-lg p-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
          />
        </div>
        <div className="flex items-center space-x-2">
          <label className="text-xs font-bold text-slate-500 uppercase">To:</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="border border-slate-200 rounded-lg p-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none"
          />
        </div>
        {(startDate || endDate) && (
          <button
            onClick={() => { setStartDate(''); setEndDate(''); }}
            className="text-xs font-semibold text-rose-500 hover:text-rose-700 bg-rose-50 px-3 py-2 rounded-lg border border-rose-100 transition-colors"
          >
            Clear Filter
          </button>
        )}

        {/* Profit Breakdown Button — always shown to admin, disabled when dates not set */}
        {isAdmin && (
          <button
            onClick={fetchFilteredProfit}
            disabled={!startDate || !endDate || filteredProfitLoading}
            className={`${!startDate || !endDate ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed shadow-none' : 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-600 text-white shadow-md shadow-emerald-200'} flex items-center space-x-2 font-bold px-4 py-2 rounded-lg text-xs border transition-all`}
          >
            {filteredProfitLoading ? (
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            )}
            <span>{filteredProfitLoading ? 'Loading...' : 'Profit Breakdown'}</span>
          </button>
        )}

        {/* Search Input */}
        <div className="relative flex-1 min-w-[240px] max-w-md md:ml-auto">
          <input
            type="text"
            placeholder="Search by Invoice ID, customer, cashier, or method..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setSearchFocusedIndex(-1); }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSearchFocusedIndex(prev => (prev < currentSales.length - 1 ? prev + 1 : prev));
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSearchFocusedIndex(prev => (prev > 0 ? prev - 1 : prev));
              } else if (e.key === 'Enter') {
                e.preventDefault();
                if (searchFocusedIndex >= 0 && currentSales[searchFocusedIndex]) {
                  openReceipt(currentSales[searchFocusedIndex]);
                }
              }
            }}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <svg className="absolute left-3 top-2.5 w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
      </div>

      {/* Sales Logs Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <div className="p-4 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
            <div>
              <h3 className="font-bold text-slate-800">All Sales History</h3>
              <p className="text-xs text-slate-500">List of all recorded transactions.</p>
            </div>
            {/*   <button
              onClick={exportDueBillsToCSV}
              className="bg-gray-600 hover:bg-gray-700 text-white font-semibold py-2 px-4 border border-gray-200 rounded-xl text-xs shadow-xs transition-colors flex items-center space-x-2"
            >
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>Export All Due</span>
            </button> */}
          </div>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 text-xs font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                {isAdmin && (
                  <th className="p-4 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={currentSales.length > 0 && currentSales.every(s => selectedSaleIds.includes(s.id))}
                      onChange={() => handleSelectAllToggle(currentSales)}
                      className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                    />
                  </th>
                )}
                <th className="p-4">Invoice ID</th>
                <th className="p-4">Date</th>
                <th className="p-4">Customer</th>
                <th className="p-4">Cashier</th>
                <th className="p-4">Method</th>
                <th className="p-4 text-right">Total Final</th>
                <th className="p-4 text-right">Paid</th>
                <th className="p-4 text-right">Due</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan="11" className="p-12 text-center">
                    <div className="flex justify-center items-center">
                      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
                    </div>
                  </td>
                </tr>
              ) : sales.length === 0 ? (
                <tr>
                  <td colSpan="11" className="p-12 text-center text-slate-400">
                    No matching sales transactions found.
                  </td>
                </tr>
              ) : (
                currentSales.map((sale, idx) => (
                  <tr key={sale.id} className={`hover:bg-slate-50/50 transition-colors ${selectedSaleIds.includes(sale.id) ? 'bg-indigo-50/10' : ''} ${searchFocusedIndex === idx ? 'bg-indigo-100 ring-2 ring-indigo-500 ring-inset' : ''}`}>
                    {isAdmin && (
                      <td className="p-4 text-center">
                        <input
                          type="checkbox"
                          checked={selectedSaleIds.includes(sale.id)}
                          onChange={() => handleSelectToggle(sale.id)}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300 cursor-pointer"
                        />
                      </td>
                    )}
                    <td className="p-4 font-semibold text-slate-700">#{sale.id}</td>
                    <td className="p-4 text-slate-500">{new Date(sale.created_at).toLocaleString()}</td>
                    <td className="p-4 text-slate-800 font-medium">{sale.customer_name || 'Walk-in Customer'}</td>
                    <td className="p-4 text-slate-600">{sale.staff_name}</td>
                    <td className="p-4">
                      <span className="capitalize px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-xs font-medium">
                        {sale.payment_method.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="p-4 text-right font-extrabold text-indigo-600">৳{parseFloat(sale.final_amount).toFixed(3)}</td>
                    <td className="p-4 text-right">
                      <span className="text-emerald-700 font-bold text-xs">
                        ৳{parseFloat(sale.paid_amount !== null && sale.paid_amount !== undefined ? sale.paid_amount : sale.final_amount || 0).toFixed(3)}
                      </span>
                    </td>
                    <td className="p-4 text-right">
                      {parseFloat(sale.due_amount || 0) > 0 ? (
                        <span className="bg-rose-50 text-rose-700 text-xs font-bold px-2 py-0.5 rounded-lg border border-rose-100">
                          ৳{parseFloat(sale.due_amount || 0).toFixed(3)}
                        </span>
                      ) : (
                        <span className="bg-emerald-50 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-lg border border-emerald-100">
                          Paid ✓
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        <button
                          onClick={() => openEditSale(sale)}
                          className="text-amber-600 hover:text-amber-900 font-semibold text-xs border border-amber-100 hover:bg-amber-50 px-2.5 py-1 rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => openReceipt(sale)}
                          className="text-indigo-600 hover:text-indigo-900 font-semibold text-xs border border-indigo-100 hover:bg-indigo-50 px-2.5 py-1 rounded-lg transition-colors"
                        >
                          View
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => openProfitModal(sale)}
                            className="text-emerald-600 hover:text-emerald-900 font-semibold text-xs border border-emerald-100 hover:bg-emerald-50 px-2.5 py-1 rounded-lg transition-colors flex items-center space-x-1"
                            title="View profit breakdown (Admin Only)"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                            </svg>
                            <span>Details</span>
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteSale(sale.id)}
                          className="text-rose-500 hover:text-rose-800 border border-rose-100 hover:bg-rose-50 p-1 rounded-lg transition-colors"
                          title="Delete this sale (Admin Only)"
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

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xs">
          <div className="text-xs font-semibold text-slate-500">
            Showing <span className="text-slate-800">{indexOfFirstSale + 1}</span> to <span className="text-slate-800">{Math.min(indexOfLastSale, sales.length)}</span> of <span className="text-slate-800">{sales.length}</span> entries
          </div>
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 bg-white hover:bg-slate-50 disabled:hover:bg-white disabled:opacity-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold transition-colors disabled:cursor-not-allowed"
            >
              Previous
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <button
                key={page}
                onClick={() => setCurrentPage(page)}
                className={`w-9 h-9 rounded-xl text-xs font-bold transition-all ${currentPage === page
                  ? 'bg-slate-600 text-white shadow-xs'
                  : 'bg-white hover:bg-slate-50 text-slate-600 border border-slate-200'
                  }`}
              >
                {page}
              </button>
            ))}

            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-3 py-2 bg-white hover:bg-slate-50 disabled:hover:bg-white disabled:opacity-50 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold transition-colors disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
      {/* --- PROFIT BREAKDOWN MODAL (ADMIN ONLY) --- */}
      {profitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden">

            {/* Modal Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-white font-extrabold text-base tracking-tight">Profit Breakdown</h2>
                  <p className="text-emerald-100 text-xs mt-0.5">Sale #{profitModal.sale.id} · {new Date(profitModal.sale.created_at).toLocaleDateString()}</p>
                </div>
              </div>
              <button
                onClick={() => setProfitModal(null)}
                className="text-white/70 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded-lg"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              {profitLoading ? (
                <div className="py-16 flex flex-col items-center justify-center space-y-3">
                  <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-emerald-600"></div>
                  <p className="text-sm text-slate-400 font-medium">Loading profit data...</p>
                </div>
              ) : profitModal.details ? (() => {
                const items = profitModal.details.items || [];
                const totalCost = items.reduce((s, i) => s + parseFloat(i.cost_price || 0) * i.quantity, 0);
                const totalRevenue = items.reduce((s, i) => s + parseFloat(i.unit_price || 0) * i.quantity, 0);
                const totalProfit = totalRevenue - totalCost;
                const profitMargin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0.0';

                return (
                  <>
                    {/* Per-product Table */}
                    <div className="overflow-x-auto rounded-xl border border-slate-200 mb-5">
                      <table className="w-full text-left text-sm border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-xs font-bold text-slate-500 uppercase tracking-wider border-b border-slate-200">
                            <th className="px-4 py-3">Product</th>
                            <th className="px-4 py-3 text-center w-12">Qty</th>
                            <th className="px-4 py-3 text-right">Cost Price</th>
                            <th className="px-4 py-3 text-right">Selling Price</th>
                            <th className="px-4 py-3 text-right">Profit</th>
                            <th className="px-4 py-3 text-center w-20">Margin</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {items.map((item, idx) => {
                            const costPerUnit = parseFloat(item.cost_price || 0);
                            const sellPerUnit = parseFloat(item.unit_price || 0);
                            const qty = item.quantity;
                            const totalCostRow = costPerUnit * qty;
                            const totalSellRow = sellPerUnit * qty;
                            const profitRow = totalSellRow - totalCostRow;
                            const marginRow = totalSellRow > 0 ? ((profitRow / totalSellRow) * 100).toFixed(1) : '0.0';
                            const isLoss = profitRow < 0;

                            return (
                              <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                                <td className="px-4 py-3">
                                  <div className="font-semibold text-slate-800">{item.product_name || item.name}</div>
                                  <div className="text-xs text-slate-400 font-mono mt-0.5">{item.product_sku || 'N/A'}</div>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className="font-bold text-slate-700">{qty}</span>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="text-slate-600 font-medium">৳{totalCostRow.toFixed(3)}</div>
                                  <div className="text-xs text-slate-400">৳{costPerUnit.toFixed(3)}/unit</div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <div className="text-slate-800 font-semibold">৳{totalSellRow.toFixed(3)}</div>
                                  <div className="text-xs text-slate-400">৳{sellPerUnit.toFixed(3)}/unit</div>
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className={`font-extrabold ${isLoss ? 'text-rose-600' : 'text-emerald-600'}`}>
                                    {isLoss ? '-' : '+'}৳{Math.abs(profitRow).toFixed(3)}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isLoss
                                    ? 'bg-rose-50 text-rose-700 border border-rose-100'
                                    : parseFloat(marginRow) >= 20
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                      : 'bg-amber-50 text-amber-700 border border-amber-100'
                                    }`}>
                                    {isLoss ? '' : ''}{marginRow}%
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Summary Totals */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Total Cost Price</p>
                        <p className="text-xl font-extrabold text-slate-700">৳{totalCost.toFixed(3)}</p>
                        <p className="text-xs text-slate-400 mt-1">What you paid</p>
                      </div>
                      <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 text-center">
                        <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest mb-1">Total Selling Price</p>
                        <p className="text-xl font-extrabold text-indigo-700">৳{totalRevenue.toFixed(3)}</p>
                        <p className="text-xs text-indigo-400 mt-1">What customer paid</p>
                      </div>
                      <div className={`border rounded-xl p-4 text-center ${totalProfit >= 0 ? 'bg-emerald-50 border-emerald-100' : 'bg-rose-50 border-rose-100'}`}>
                        <p className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          Total Profit
                        </p>
                        <p className={`text-xl font-extrabold ${totalProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {totalProfit >= 0 ? '+' : '-'}৳{Math.abs(totalProfit).toFixed(3)}
                        </p>
                        <p className={`text-xs mt-1 font-semibold ${totalProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {profitMargin}% margin
                        </p>
                      </div>
                    </div>

                    {/* Footer */}
                    <div className="mt-5 flex justify-end">
                      <button
                        onClick={() => setProfitModal(null)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-2.5 px-6 rounded-xl text-sm transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </>
                );
              })() : (
                <div className="py-16 text-center text-slate-400 text-sm">No data available.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- DETAILED RECEIPT VIEWER MODAL --- */}
      {selectedSale && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">

            {detailsLoading ? (
              <div className="flex-1 py-24 flex justify-center items-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-600"></div>
              </div>
            ) : saleDetails ? (
              <>
                {/* Local normalization mapping */}
                {(() => {
                  const receipt = {
                    sale_id: saleDetails.id,
                    items: saleDetails.items || [],
                    subtotal: parseFloat(saleDetails.total_amount || 0),
                    discount: parseFloat(saleDetails.discount || 0),
                    tax: parseFloat(saleDetails.tax || 0),
                    total: parseFloat(saleDetails.final_amount || 0),
                    payment_method: saleDetails.payment_method,
                    created_at: new Date(saleDetails.created_at).toLocaleString(),
                    customer_name: saleDetails.customer_name || 'Walk-in Customer',
                    customer_phone: saleDetails.customer_phone || '',
                    customer_address: saleDetails.customer_address || '',
                    shop_name: saleDetails.shop_name || 'Boutique POS',
                    shop_phone: saleDetails.shop_phone || '',
                    shop_address: saleDetails.shop_address || '',
                    shop_email: saleDetails.shop_email || '',
                    staff_name: saleDetails.staff_name || 'Cashier',
                    reduce_due_amount: 0,
                    paid_amount: parseFloat(saleDetails.paid_amount !== undefined ? saleDetails.paid_amount : saleDetails.final_amount),
                    due_amount: parseFloat(saleDetails.due_amount || 0)
                  };

                  const taxRatePercent = receipt.subtotal > 0
                    ? ((receipt.tax / receipt.subtotal) * 100).toFixed(1).replace(/\.0$/, '')
                    : '10';

                  return (
                    <>
                      {/* Left Side: Receipt Live Preview Canvas */}
                      <div className="flex-1 bg-slate-100 p-6 flex flex-col items-center justify-center overflow-y-auto min-h-0">
                        <div className="w-full flex justify-between items-center mb-4">
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Receipt Preview</span>
                          <span className="text-[10px] bg-slate-200 text-slate-600 font-semibold px-2 py-0.5 rounded-full uppercase">
                            {previewMode === 'thermal' ? 'Thermal 80mm Roll' : 'Regular A4 Sheet'}
                          </span>
                        </div>

                        <div className="w-full py-4 flex justify-center items-start min-h-0 overflow-y-auto">
                          {previewMode === 'thermal' ? (
                            /* Thermal Receipt Mockup */
                            <div className="w-[320px] bg-white text-slate-800 shadow-lg p-6 font-mono text-[11px] leading-relaxed border-t-8 border-indigo-600 rounded-b-md">
                              <div className="text-center mb-4">
                                <h2 className="text-sm font-bold tracking-tight uppercase text-slate-950">{receipt.shop_name}</h2>
                                {receipt.shop_address && <p className="text-[10px] text-slate-500 mt-0.5">{receipt.shop_address}</p>}
                                {receipt.shop_phone && <p className="text-[10px] text-slate-500">Tel: {receipt.shop_phone}</p>}
                                {receipt.shop_email && <p className="text-[10px] text-slate-500">Email: {receipt.shop_email}</p>}
                                <p className="text-[9px] text-slate-400 mt-2 font-sans tracking-widest">*** TRANSACTION RECEIPT ***</p>
                              </div>

                              <div className="border-b border-dashed border-slate-300 py-2 my-2 text-[10px] space-y-0.5 text-slate-600">
                                <div><span className="font-semibold text-slate-800">Sale ID:</span> #{receipt.sale_id}</div>
                                <div><span className="font-semibold text-slate-800">Date:</span> {receipt.created_at}</div>
                                <div><span className="font-semibold text-slate-800">Cashier:</span> {receipt.staff_name}</div>
                                <div><span className="font-semibold text-slate-800">Customer:</span> {receipt.customer_name}</div>
                                {receipt.customer_phone && <div><span className="font-semibold text-slate-800">Phone:</span> {receipt.customer_phone}</div>}
                              </div>

                              <table className="w-full text-left text-[10px] border-collapse">
                                <thead>
                                  <tr className="border-b border-dashed border-slate-300 font-bold text-slate-700">
                                    <th className="pb-1 text-left">Item</th>
                                    <th className="pb-1 text-center w-8">Qty</th>
                                    <th className="pb-1 text-center w-8">Unit</th>
                                    <th className="pb-1 text-right w-16">Price</th>
                                    <th className="pb-1 text-right w-20">Total</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {receipt.items.map((item, idx) => (
                                    <tr key={idx} className="border-b border-dotted border-slate-100">
                                      <td className="py-2 pr-1 text-slate-800 break-words max-w-[90px]">
                                        <div>{item.product_name || item.name}</div>
                                      </td>
                                      <td className="py-2 text-center text-slate-600">{item.quantity}</td>
                                      <td className="py-2 text-center text-slate-500">{item.unit || 'pcs'}</td>
                                      <td className="py-2 text-right text-slate-600">৳{parseFloat(item.unit_price || item.price).toFixed(3)}</td>
                                      <td className="py-2 text-right font-semibold text-slate-800">
                                        ৳{((item.unit_price || item.price) * item.quantity).toFixed(3)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>

                              <div className="border-t border-dashed border-slate-300 pt-2.5 mt-2.5 text-[10px] space-y-1.5 text-slate-600">
                                <div className="flex justify-between">
                                  <span>Subtotal:</span>
                                  <span className="font-medium text-slate-800">৳{receipt.subtotal.toFixed(3)}</span>
                                </div>
                                {receipt.discount > 0 && (
                                  <div className="flex justify-between text-rose-500">
                                    <span>Discount:</span>
                                    <span>-৳{receipt.discount.toFixed(3)}</span>
                                  </div>
                                )}
                                <div className="flex justify-between">
                                  <span>Tax ({taxRatePercent}%):</span>
                                  <span className="font-medium text-slate-800">৳{receipt.tax.toFixed(3)}</span>
                                </div>
                                <div className="flex justify-between font-bold text-slate-900 border-t border-dotted border-slate-200 pt-1.5 text-[12px]">
                                  <span>Total Paid:</span>
                                  <span>৳{receipt.paid_amount.toFixed(3)}</span>
                                </div>
                                {receipt.due_amount > 0 && (
                                  <div className="flex justify-between font-bold text-rose-600 border-t border-dotted border-slate-200 pt-1 text-[11px]">
                                    <span>Due ammount:</span>
                                    <span>৳{receipt.due_amount.toFixed(3)}</span>
                                  </div>
                                )}
                              </div>

                              <div className="text-center mt-6 pt-3 border-t border-dashed border-slate-300">
                                <p className="text-[10px] text-slate-600 uppercase font-semibold">Payment: {receipt.payment_method.replace('_', ' ')}</p>
                                <p className="text-[10px] font-bold text-slate-800 tracking-wider mt-2">*** THANK YOU ***</p>
                              </div>
                            </div>
                          ) : (
                            /* Regular A4 Sheet Mockup */
                            <div className="w-full max-w-[620px] bg-white text-slate-800 shadow-lg p-8 font-sans text-[11px] leading-relaxed border-t-8 border-indigo-600 rounded-b-md">
                              <div className="flex justify-between items-start border-b border-slate-200 pb-4 mb-4">
                                <div>
                                  <h1 className="text-lg font-extrabold text-slate-900 tracking-tight">{receipt.shop_name}</h1>
                                  {receipt.shop_address && <p className="text-slate-500 mt-1 text-[10px]">{receipt.shop_address}</p>}
                                  <div className="text-slate-400 mt-0.5 text-[9px] space-x-2">
                                    {receipt.shop_phone && <span>Tel: {receipt.shop_phone}</span>}
                                    {receipt.shop_email && <span>Email: {receipt.shop_email}</span>}
                                  </div>
                                </div>
                                <div className="text-right">
                                  <h2 className="text-sm font-black text-indigo-600 tracking-widest uppercase">INVOICE</h2>
                                  <p className="text-slate-500 mt-1 text-[10px]">Invoice ID: <span className="font-semibold text-slate-800">#{receipt.sale_id}</span></p>
                                  <p className="text-slate-400 text-[9px]">{receipt.created_at}</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3 rounded-lg mb-4 text-[10px]">
                                <div>
                                  <h3 className="text-[8px] font-bold uppercase tracking-wider text-slate-400 mb-1">Billed To</h3>
                                  <div className="font-bold text-slate-800">{receipt.customer_name}</div>
                                  {receipt.customer_phone && <p className="text-slate-600 mt-0.5">Phone: {receipt.customer_phone}</p>}
                                  {receipt.customer_address && <p className="text-slate-600">Address: {receipt.customer_address}</p>}
                                </div>
                                <div>
                                  <h3 className="text-[8px] font-bold uppercase tracking-wider text-slate-400 mb-1">Billed By</h3>
                                  <div className="font-bold text-slate-800">{receipt.shop_name}</div>
                                  <p className="text-slate-600 mt-0.5">Cashier: {receipt.staff_name}</p>
                                  <p className="text-slate-600">Payment: <span className="uppercase text-[9px] font-bold text-slate-700 bg-slate-200 px-1.5 py-0.5 rounded">{receipt.payment_method.replace('_', ' ')}</span></p>
                                </div>
                              </div>

                              <table className="w-full text-left border-collapse text-[10px]">
                                <thead>
                                  <tr className="border-b-2 border-slate-200 text-[9px] uppercase font-bold text-slate-500">
                                    <th className="pb-2 text-left">Item Description</th>
                                    <th className="pb-2 text-center w-16">SKU</th>
                                    <th className="pb-2 text-center w-12">Qty</th>
                                    <th className="pb-2 text-right w-20">Unit Price</th>
                                    <th className="pb-2 text-right w-20">Total</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {receipt.items.map((item, idx) => (
                                    <tr key={idx}>
                                      <td className="py-2.5 font-semibold text-slate-800">{item.product_name || item.name}</td>
                                      <td className="py-2.5 text-center text-slate-400 text-[9px] font-mono">{item.product_sku || item.sku || 'N/A'}</td>
                                      <td className="py-2.5 text-center text-slate-600 font-medium">{item.quantity}</td>
                                      <td className="py-2.5 text-right text-slate-600">৳{parseFloat(item.unit_price || item.price).toFixed(3)}</td>
                                      <td className="py-2.5 text-right font-bold text-slate-900">
                                        ৳{((item.unit_price || item.price) * item.quantity).toFixed(3)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>

                              <div className="flex justify-end mt-4 border-t border-slate-100 pt-3">
                                <div className="w-56 space-y-1.5 text-slate-600 text-[10px]">
                                  <div className="flex justify-between">
                                    <span>Subtotal:</span>
                                    <span className="font-semibold text-slate-800">৳{receipt.subtotal.toFixed(3)}</span>
                                  </div>
                                  {receipt.discount > 0 && (
                                    <div className="flex justify-between text-rose-500">
                                      <span>Discount:</span>
                                      <span>-৳{receipt.discount.toFixed(3)}</span>
                                    </div>
                                  )}
                                  <div className="flex justify-between">
                                    <span>Tax ({taxRatePercent}%):</span>
                                    <span className="font-semibold text-slate-800">৳{receipt.tax.toFixed(3)}</span>
                                  </div>
                                  <div className="flex justify-between font-black text-indigo-600 border-t border-slate-255 pt-1.5 text-xs">
                                    <span>Total Paid:</span>
                                    <span>৳{receipt.paid_amount.toFixed(3)}</span>
                                  </div>
                                  {receipt.due_amount > 0 && (
                                    <div className="flex justify-between font-bold text-rose-600 border-t border-slate-200 pt-1">
                                      <span>Due ammount:</span>
                                      <span>৳{receipt.due_amount.toFixed(3)}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="text-center mt-8 pt-3 border-t border-slate-100 text-slate-400 text-[9px]">
                                <p>Thank you for shopping with us! Please contact us for any inquiries.</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Side: Options & Actions Control Panel */}
                      <div className="w-full md:w-80 flex flex-col justify-between border-t md:border-t-0 md:border-l border-slate-100 p-6 bg-slate-50">
                        <div>
                          <h3 className="text-lg font-extrabold text-slate-800">Invoice Viewer</h3>
                          <p className="text-xs text-slate-500 mt-1">Review transaction details and select format for print output:</p>

                          {/* Print Layout Selector */}
                          <div className="mt-5 space-y-2">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Receipt Format</span>
                            <div className="grid grid-cols-2 gap-2 bg-slate-200/60 p-1 rounded-xl">
                              <button
                                type="button"
                                onClick={() => setPreviewMode('thermal')}
                                className={`py-2 text-xs font-semibold rounded-lg transition-all ${previewMode === 'thermal'
                                  ? 'bg-white text-indigo-700 shadow-sm'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
                                  }`}
                              >
                                Thermal (80mm)
                              </button>
                              <button
                                type="button"
                                onClick={() => setPreviewMode('regular')}
                                className={`py-2 text-xs font-semibold rounded-lg transition-all ${previewMode === 'regular'
                                  ? 'bg-white text-indigo-700 shadow-sm'
                                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/50'
                                  }`}
                              >
                                Regular (A4)
                              </button>
                            </div>
                          </div>

                          {/* Summary Metadata Card */}
                          <div className="mt-6 bg-white border border-slate-200/80 rounded-xl p-3.5 space-y-2.5 text-xs">
                            <div className="flex justify-between text-slate-500">
                              <span>Invoice ID:</span>
                              <span className="font-semibold text-slate-700">#{receipt.sale_id}</span>
                            </div>
                            <div className="flex justify-between text-slate-500">
                              <span>Payment Method:</span>
                              <span className="font-semibold text-slate-700 uppercase">{receipt.payment_method}</span>
                            </div>
                            <div className="flex justify-between text-slate-500 border-t border-slate-100 pt-2 mt-2">
                              <span>Total Paid:</span>
                              <span className="font-bold text-indigo-600">৳{receipt.paid_amount.toFixed(3)}</span>
                            </div>
                            {receipt.due_amount > 0 && (
                              <div className="flex justify-between text-rose-500 font-semibold">
                                <span>Due ammount:</span>
                                <span>৳{receipt.due_amount.toFixed(3)}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Actions Footer */}
                        <div className="mt-8 space-y-2">
                          <button
                            onClick={() => handlePrint(previewMode)}
                            className="w-full bg-slate-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl text-sm transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/30 flex items-center justify-center space-x-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                            </svg>
                            <span>Print {previewMode === 'thermal' ? 'Thermal' : 'Regular A4'}</span>
                          </button>

                          {/* Admin delete transaction */}
                          <button
                            onClick={() => handleDeleteSale(receipt.sale_id)}
                            className="w-full bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 font-bold py-2.5 rounded-xl text-sm transition-colors flex items-center justify-center space-x-2"
                            title="Delete this transaction permanently"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            <span>Delete Transaction</span>
                          </button>

                          <button
                            onClick={() => { setSelectedSale(null); setSaleDetails(null); }}
                            className="w-full bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2.5 rounded-xl text-sm transition-colors"
                          >
                            Close
                          </button>
                        </div>
                      </div>

                      {/* --- DYNAMIC PRINT AREA (OFF-SCREEN PORTAL FOR CLEAN INVOICE PRINTING) --- */}
                      {createPortal(
                        <div id="receipt-print-area">
                          {/* Thermal View Container */}
                          <div className="thermal-only">
                            <div style={{ textAlign: 'center', marginBottom: '8px' }}>
                              <h2 style={{ fontSize: '15px', fontWeight: 'bold', margin: '0 0 2px 0' }}>{receipt.shop_name}</h2>
                              {receipt.shop_address && <p style={{ margin: '0 0 2px 0', fontSize: '9px' }}>{receipt.shop_address}</p>}
                              <div style={{ fontSize: '9px', margin: '0 0 4px 0' }}>
                                {receipt.shop_phone && <span style={{ marginRight: '6px' }}>Tel: {receipt.shop_phone}</span>}
                                {receipt.shop_email && <span>Email: {receipt.shop_email}</span>}
                              </div>
                              <p style={{ margin: '4px 0 0 0', fontSize: '9px', fontWeight: 'bold', letterSpacing: '0.05em' }}>*** TRANSACTION RECEIPT ***</p>
                            </div>

                            <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', margin: '8px 0', fontSize: '9px', lineHeight: '1.3' }}>
                              <div><strong>Sale ID:</strong> #{receipt.sale_id}</div>
                              <div><strong>Date:</strong> {receipt.created_at}</div>
                              <div><strong>Cashier:</strong> {receipt.staff_name}</div>
                              <div><strong>Customer:</strong> {receipt.customer_name}</div>
                              {receipt.customer_phone && <div><strong>Phone:</strong> {receipt.customer_phone}</div>}
                            </div>

                            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9px', margin: '8px 0' }}>
                              <thead>
                                <tr style={{ borderBottom: '1px dashed #000' }}>
                                  <th style={{ textAlign: 'left', paddingBottom: '3px' }}>Item</th>
                                  <th style={{ textAlign: 'center', paddingBottom: '3px', width: '25px' }}>Qty</th>
                                  <th style={{ textAlign: 'center', paddingBottom: '3px', width: '25px' }}>Unit</th>
                                  <th style={{ textAlign: 'right', paddingBottom: '3px', width: '55px' }}>Price</th>
                                  <th style={{ textAlign: 'right', paddingBottom: '3px', width: '60px' }}>Total</th>
                                </tr>
                              </thead>
                              <tbody>
                                {receipt.items.map((item, idx) => (
                                  <tr key={idx}>
                                    <td style={{ paddingTop: '3px', maxWidth: '90px', wordBreak: 'break-all' }}>
                                      {item.product_name || item.name}
                                    </td>
                                    <td style={{ textAlign: 'center', paddingTop: '3px' }}>{item.quantity}</td>
                                    <td style={{ textAlign: 'center', paddingTop: '3px', color: '#666' }}>{item.unit || 'pcs'}</td>
                                    <td style={{ textAlign: 'right', paddingTop: '3px' }}>৳{parseFloat(item.unit_price || item.price).toFixed(3)}</td>
                                    <td style={{ textAlign: 'right', paddingTop: '3px' }}>৳{((item.unit_price || item.price) * item.quantity).toFixed(3)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>

                            <div style={{ borderTop: '1px dashed #000', paddingTop: '4px', fontSize: '9px', lineHeight: '1.3' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Subtotal:</span>
                                <span>৳{receipt.subtotal.toFixed(3)}</span>
                              </div>
                              {receipt.discount > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span>Discount:</span>
                                  <span>-৳{receipt.discount.toFixed(3)}</span>
                                </div>
                              )}
                              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span>Tax ({taxRatePercent}%):</span>
                                <span>৳{receipt.tax.toFixed(3)}</span>
                              </div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', fontWeight: 'bold', borderTop: '1px dashed #000', paddingTop: '3px', marginTop: '3px' }}>
                                <span>Total Paid:</span>
                                <span>৳{receipt.paid_amount.toFixed(3)}</span>
                              </div>
                              {receipt.due_amount > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 'bold', color: '#ef4444', borderTop: '1px dashed #000', paddingTop: '2px', marginTop: '2px' }}>
                                  <span>Due ammount:</span>
                                  <span>৳{receipt.due_amount.toFixed(3)}</span>
                                </div>
                              )}
                            </div>

                            <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '9px' }}>
                              <p style={{ margin: '0 0 2px 0' }}>Payment: {receipt.payment_method.toUpperCase()}</p>
                              <p style={{ margin: '0', fontWeight: 'bold' }}>*** THANK YOU ***</p>
                            </div>
                          </div>

                          {/* Regular A4 View Container */}
                          <div className="regular-only">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #e2e8f0', paddingBottom: '16px', marginBottom: '16px' }}>
                              <div>
                                <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#1e293b', margin: '0 0 4px 0' }}>{receipt.shop_name}</h1>
                                {receipt.shop_address && <p style={{ margin: '0 0 2px 0', color: '#64748b', fontSize: '12px' }}>{receipt.shop_address}</p>}
                                <div style={{ color: '#64748b', fontSize: '12px', marginTop: '2px' }}>
                                  {receipt.shop_phone && <span style={{ marginRight: '10px' }}>Tel: {receipt.shop_phone}</span>}
                                  {receipt.shop_email && <span>Email: {receipt.shop_email}</span>}
                                </div>
                              </div>
                              <div style={{ textAlign: 'right' }}>
                                <h2 style={{ fontSize: '18px', fontWeight: 'bold', color: '#6366f1', margin: '0 0 4px 0' }}>INVOICE</h2>
                                <p style={{ margin: '0 0 2px 0', color: '#64748b', fontSize: '12px' }}><strong>Invoice ID:</strong> #{receipt.sale_id}</p>
                                <p style={{ margin: '0', color: '#64748b', fontSize: '12px' }}><strong>Date:</strong> {receipt.created_at}</p>
                              </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px', gap: '30px' }}>
                              <div style={{ flex: 1, backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                                <h3 style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px 0' }}>Billed To</h3>
                                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>{receipt.customer_name}</div>
                                {receipt.customer_phone && <div style={{ color: '#475569', fontSize: '12px', marginBottom: '2px' }}>Phone: {receipt.customer_phone}</div>}
                                {receipt.customer_address && <div style={{ color: '#475569', fontSize: '12px' }}>Address: {receipt.customer_address}</div>}
                              </div>
                              <div style={{ flex: 1, backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px' }}>
                                <h3 style={{ fontSize: '11px', fontWeight: 'bold', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px 0' }}>Billed By</h3>
                                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1e293b', marginBottom: '4px' }}>{receipt.shop_name}</div>
                                <div style={{ color: '#475569', fontSize: '12px', marginBottom: '2px' }}>Cashier: {receipt.staff_name}</div>
                                <div style={{ color: '#475569', fontSize: '12px' }}>Payment Method: {receipt.payment_method.toUpperCase()}</div>
                              </div>
                            </div>

                            <table style={{ width: '100%', borderCollapse: 'collapse', margin: '16px 0' }}>
                              <thead>
                                <tr style={{ borderBottom: '2px solid #cbd5e1', color: '#475569', fontSize: '11px', textTransform: 'uppercase', fontBold: 'true', textAlign: 'left' }}>
                                  <th style={{ padding: '8px 0' }}>Item Description</th>
                                  <th style={{ padding: '8px 0', textAlign: 'center', width: '100px' }}>SKU</th>
                                  <th style={{ padding: '8px 0', textAlign: 'center', width: '60px' }}>Qty</th>
                                  <th style={{ padding: '8px 0', textAlign: 'right', width: '100px' }}>Unit Price</th>
                                  <th style={{ padding: '8px 0', textAlign: 'right', width: '100px' }}>Total</th>
                                </tr>
                              </thead>
                              <tbody style={{ fontSize: '13px', color: '#334155' }}>
                                {receipt.items.map((item, idx) => (
                                  <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                    <td style={{ padding: '10px 0', fontWeight: '500' }}>{item.product_name || item.name}</td>
                                    <td style={{ padding: '10px 0', textAlign: 'center', color: '#64748b' }}>{item.product_sku || item.sku || 'N/A'}</td>
                                    <td style={{ padding: '10px 0', textAlign: 'center' }}>{item.quantity}</td>
                                    <td style={{ padding: '10px 0', textAlign: 'right' }}>৳{parseFloat(item.unit_price || item.price).toFixed(3)}</td>
                                    <td style={{ padding: '10px 0', textAlign: 'right', fontWeight: 'bold' }}>৳{((item.unit_price || item.price) * item.quantity).toFixed(3)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
                              <div style={{ width: '250px', fontSize: '13px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#64748b' }}>
                                  <span>Subtotal</span>
                                  <span style={{ fontWeight: '600', color: '#1e293b' }}>৳{receipt.subtotal.toFixed(3)}</span>
                                </div>
                                {receipt.discount > 0 && (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#ef4444' }}>
                                    <span>Discount</span>
                                    <span>-৳{receipt.discount.toFixed(3)}</span>
                                  </div>
                                )}
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#64748b' }}>
                                  <span>Tax ({taxRatePercent}%)</span>
                                  <span style={{ fontWeight: '600', color: '#1e293b' }}>৳{receipt.tax.toFixed(3)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: '15px', fontWeight: 'bold', borderTop: '2px solid #e2e8f0', marginTop: '6px' }}>
                                  <span>Total Paid</span>
                                  <span style={{ color: '#6366f1' }}>৳{receipt.paid_amount.toFixed(3)}</span>
                                </div>
                                {receipt.due_amount > 0 && (
                                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: '#ef4444', fontWeight: 'bold', borderTop: '1px solid #e2e8f0', marginTop: '4px' }}>
                                    <span>Due ammount</span>
                                    <span>৳{receipt.due_amount.toFixed(3)}</span>
                                  </div>
                                )}
                              </div>
                            </div>

                            <div style={{ marginTop: '60px', borderTop: '1px solid #e2e8f0', paddingTop: '16px', textAlign: 'center', color: '#94a3b8', fontSize: '11px' }}>
                              <p style={{ margin: '0 0 3px 0' }}>Thank you for shopping with us!</p>
                              <p style={{ margin: '0' }}>Please contact us for any inquiry regarding this invoice.</p>
                            </div>
                          </div>
                        </div>,
                        document.body
                      )}
                    </>
                  );
                })()}
              </>
            ) : (
              <div className="p-12 text-center text-slate-400 flex-1">Failed to render details.</div>
            )}

          </div>
        </div>
      )}

      {showEditModal && renderEditSaleModal()}

      {/* ===== FILTERED PROFIT BREAKDOWN MODAL ===== */}
      {showFilteredProfitModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-10 bg-slate-900/70 backdrop-blur-sm overflow-y-auto">
          <div className="bg-white rounded-2xl w-full max-w-5xl shadow-2xl overflow-hidden mb-10">

            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-5 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-white font-extrabold text-lg tracking-tight">Profit Breakdown</h2>
                  <p className="text-emerald-100 text-xs mt-0.5">
                    Filtered period: <span className="font-bold">{startDate}</span> → <span className="font-bold">{endDate}</span>
                  </p>
                </div>
              </div>
              <button
                onClick={() => { setShowFilteredProfitModal(false); setFilteredProfitData(null); }}
                className="text-white/70 hover:text-white p-2 hover:bg-white/10 rounded-xl transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-6">
              {filteredProfitLoading ? (
                <div className="py-20 flex flex-col items-center justify-center space-y-4">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-600"></div>
                  <p className="text-slate-400 text-sm font-medium">Calculating profit data...</p>
                </div>
              ) : filteredProfitData ? (() => {
                const d = filteredProfitData;
                const isLoss = d.grand_profit < 0;

                return (
                  <>
                    {/* Product Table Card */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden mb-6 shadow-sm">
                      {d.products.length === 0 ? (
                        <div className="py-12 text-center text-slate-400 text-sm">
                          No products were sold in this date range.
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-left text-sm border-collapse">
                            <thead>
                              <tr className="bg-slate-50 border-b border-slate-200">
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider">Product</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">Qty</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">Cost Price</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">Selling Price</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">Profit</th>
                                <th className="px-6 py-4 text-[11px] font-bold text-slate-500 uppercase tracking-wider text-center">Margin</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {d.products.map((p, idx) => {
                                const isRowLoss = p.total_profit < 0;
                                const qty = parseFloat(p.total_qty) || 1; // Prevent division by zero just in case
                                const unitCost = parseFloat(p.total_cost) / qty;
                                const unitRev = parseFloat(p.total_revenue) / qty;

                                return (
                                  <tr key={p.product_id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                      <div className="font-bold text-slate-800 text-[15px]">{p.product_name}</div>
                                      <div className="text-[12px] text-slate-400 mt-1 font-mono">{p.product_sku || 'N/A'}</div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                      <span className="font-bold text-slate-700 text-[15px]">
                                        {qty.toFixed(qty % 1 === 0 ? 0 : 3)}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                      <div className="font-semibold text-slate-600 text-[15px]">৳{parseFloat(p.total_cost).toFixed(3)}</div>
                                      <div className="text-[12px] text-slate-400 mt-1">৳{unitCost.toFixed(3)}/unit</div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                      <div className="font-bold text-slate-800 text-[15px]">৳{parseFloat(p.total_revenue).toFixed(3)}</div>
                                      <div className="text-[12px] text-slate-400 mt-1">৳{unitRev.toFixed(3)}/unit</div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                      <span className={`font-bold text-[15px] tracking-tight ${isRowLoss ? 'text-rose-600' : 'text-emerald-600'}`}>
                                        {isRowLoss ? '-' : '+'}৳{Math.abs(parseFloat(p.total_profit)).toFixed(3)}
                                      </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                      <span className={`text-[12px] font-bold px-3 py-1 rounded-full border ${isRowLoss
                                        ? 'bg-rose-50 text-rose-700 border-rose-200'
                                        : p.margin >= 20
                                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                          : 'bg-amber-50 text-amber-700 border-amber-200'
                                        }`}>
                                        {p.margin}%
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {/* Total Cost Price */}
                      <div className="bg-white border border-slate-200 rounded-xl p-6 text-center shadow-sm">
                        <p className="text-[12px] font-bold text-slate-400 uppercase tracking-wider mb-2">Total Cost Price</p>
                        <p className="text-3xl font-extrabold text-slate-700">৳{parseFloat(d.grand_cost).toFixed(3)}</p>
                        <p className="text-[13px] text-slate-400 mt-2 font-medium">What you paid</p>
                      </div>

                      {/* Total Selling Price */}
                      <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-6 text-center shadow-sm">
                        <p className="text-[12px] font-bold text-indigo-400 uppercase tracking-wider mb-2">Total Selling Price</p>
                        <p className="text-3xl font-extrabold text-indigo-600">৳{parseFloat(d.grand_revenue).toFixed(3)}</p>
                        <p className="text-[13px] text-indigo-400/90 mt-2 font-medium">What customer paid</p>
                      </div>

                      {/* Total Profit */}
                      <div className={`border rounded-xl p-6 text-center shadow-sm ${isLoss ? 'bg-rose-50/60 border-rose-100' : 'bg-emerald-50/60 border-emerald-100'}`}>
                        <p className={`text-[12px] font-bold uppercase tracking-wider mb-2 ${isLoss ? 'text-rose-400' : 'text-emerald-500'}`}>Total Profit</p>
                        <p className={`text-3xl font-extrabold tracking-tight ${isLoss ? 'text-rose-700' : 'text-emerald-700'}`}>
                          {isLoss ? '-' : '+'}৳{Math.abs(parseFloat(d.grand_profit)).toFixed(3)}
                        </p>
                        <p className={`text-[13px] mt-2 font-bold ${isLoss ? 'text-rose-500' : 'text-emerald-500'}`}>{d.grand_margin}% margin</p>
                      </div>
                    </div>

                    {/* Footer note */}
                    <p className="text-xs text-slate-400 mt-4 text-center">
                      ℹ️ Cost price is taken from the product's recorded cost at the time of sale. Profit = Revenue − Cost of Goods Sold.
                    </p>

                    <div className="mt-5 flex justify-end space-x-3">
                      <button
                        onClick={downloadProfitPDF}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-6 rounded-xl text-sm transition-colors flex items-center space-x-2"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        <span>Download PDF</span>
                      </button>
                      <button
                        onClick={() => { setShowFilteredProfitModal(false); setFilteredProfitData(null); }}
                        className="bg-slate-700 hover:bg-slate-800 text-white font-bold py-2.5 px-8 rounded-xl text-sm transition-colors"
                      >
                        Close
                      </button>
                    </div>
                  </>
                );
              })() : (
                <div className="py-16 text-center text-slate-400 text-sm">No data available.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
