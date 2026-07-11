const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'components', 'Inventory.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add new states
const statesToInsert = `
  const [historyFilterMode, setHistoryFilterMode] = useState('item'); 
  const [historyCategory, setHistoryCategory] = useState('all');
  const [historyShowProfits, setHistoryShowProfits] = useState(false);
  const [historyShowZeroQty, setHistoryShowZeroQty] = useState(false);
  const [historyAccountName, setHistoryAccountName] = useState('');
  const [historyVoucherType, setHistoryVoucherType] = useState('all');
  const [historySalesperson, setHistorySalesperson] = useState('');
  
  const uniqueCategories = [...new Set(products.map(p => p.category).filter(Boolean))].sort();
`;

content = content.replace(
  "const [isHistoryDropdownOpen, setIsHistoryDropdownOpen] = useState(false);",
  "const [isHistoryDropdownOpen, setIsHistoryDropdownOpen] = useState(false);\n" + statesToInsert
);

// 2. Replace fetchHistory
const newFetchHistory = `
  useEffect(() => {
    const fetchHistory = async () => {
      if (activeTab !== 'history') return;
      if (historyFilterMode === 'item' && !selectedHistoryProductId) return;
      
      setHistoryLoading(true);
      setHistoryError(null);
      try {
        const token = localStorage.getItem('token');
        let url = \`\${API_BASE_URL}/reports/stock-sales-history?filter_mode=\${historyFilterMode}\`;
        
        if (historyFilterMode === 'item') {
            url += \`&product_id=\${selectedHistoryProductId}\`;
        } else {
            url += \`&category=\${encodeURIComponent(historyCategory)}\`;
        }
        
        if (historyStartDate) url += \`&start_date=\${historyStartDate}\`;
        if (historyEndDate) url += \`&end_date=\${historyEndDate}\`;
        if (historyShowZeroQty) url += \`&show_zero_qty=true\`;
        if (historyAccountName) url += \`&account=\${encodeURIComponent(historyAccountName)}\`;
        if (historyVoucherType !== 'all') url += \`&voucher_type=\${encodeURIComponent(historyVoucherType)}\`;
        if (historySalesperson) url += \`&staff_id=\${encodeURIComponent(historySalesperson)}\`; // matching text in backend logic

        const response = await fetch(url, {
          headers: { 'Authorization': \`Bearer \${token}\` }
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to fetch history.');
        }
        const data = await response.json();
        setHistoryData(data);
      } catch (err) {
        setHistoryError(err.message);
      } finally {
        setHistoryLoading(false);
      }
    };
    fetchHistory();
  }, [activeTab, selectedHistoryProductId, historyFilterMode, historyCategory, historyStartDate, historyEndDate, historyShowZeroQty, historyAccountName, historyVoucherType, historySalesperson]);
`;

content = content.replace(
  /useEffect\(\(\) => \{\s*const fetchHistory = async \(\) => \{[\s\S]*?fetchHistory\(\);\s*\}, \[activeTab, selectedHistoryProductId, historyStartDate, historyEndDate\]\);/,
  newFetchHistory.trim()
);

// 3. Replace the UI block for Select Product & Filters Bar and Ledger Content
const regexUI = /\{\/\* Select Product & Filters Bar \*\/\}[\s\S]*?(?=\{\/\* Inventory Tab Content \*\/\}|\{\/\* Modals \*\/\}|  return \()/;

const newUI = `
          {/* Advanced Filters Bar */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col gap-4">
            
            <div className="flex flex-col md:flex-row gap-6">
                {/* Filter Mode Radio */}
                <div className="flex flex-col gap-2 min-w-[200px]">
                    <label className="flex items-center space-x-2 cursor-pointer">
                        <input 
                            type="radio" 
                            checked={historyFilterMode === 'category'}
                            onChange={() => setHistoryFilterMode('category')}
                            className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-semibold text-slate-700">Item Category</span>
                    </label>
                    <select
                        disabled={historyFilterMode !== 'category'}
                        value={historyCategory}
                        onChange={(e) => setHistoryCategory(e.target.value)}
                        className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400 outline-none"
                    >
                        <option value="all">ALL CATEGORIES</option>
                        {uniqueCategories.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>

                    <label className="flex items-center space-x-2 cursor-pointer mt-2">
                        <input 
                            type="radio" 
                            checked={historyFilterMode === 'item'}
                            onChange={() => setHistoryFilterMode('item')}
                            className="text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-semibold text-slate-700">Specific Inventory Item</span>
                    </label>
                    <div className="relative">
                        <input
                            type="text"
                            disabled={historyFilterMode !== 'item'}
                            placeholder="Search & select product..."
                            value={isHistoryDropdownOpen ? historySearchQuery : (() => {
                                const selectedProduct = products.find(p => String(p.id) === String(selectedHistoryProductId));
                                return selectedProduct ? \`\${selectedProduct.name} (\${selectedProduct.sku})\` : '';
                            })()}
                            onChange={(e) => {
                                setHistorySearchQuery(e.target.value);
                                setIsHistoryDropdownOpen(true);
                            }}
                            onFocus={() => {
                                setHistorySearchQuery('');
                                setIsHistoryDropdownOpen(true);
                            }}
                            className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-100 disabled:text-slate-400 outline-none"
                        />
                        {isHistoryDropdownOpen && historyFilterMode === 'item' && (
                            <div className="absolute left-0 right-0 mt-1 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-lg z-50 divide-y divide-slate-100">
                                {(() => {
                                    const filteredHistoryProducts = products.filter(p => 
                                        (p.name || '').toLowerCase().includes(historySearchQuery.toLowerCase()) ||
                                        (p.sku || '').toLowerCase().includes(historySearchQuery.toLowerCase())
                                    );
                                    if (filteredHistoryProducts.length === 0) return <div className="p-3 text-sm text-slate-400 text-center">No products found</div>;
                                    return filteredHistoryProducts.map(p => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => {
                                                setSelectedHistoryProductId(p.id);
                                                setHistorySearchQuery('');
                                                setIsHistoryDropdownOpen(false);
                                            }}
                                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 font-medium block"
                                        >
                                            <div className="font-bold">{p.name}</div>
                                            <div className="text-xs text-slate-400">SKU: {p.sku} | Stock: {p.stock_quantity}</div>
                                        </button>
                                    ));
                                })()}
                            </div>
                        )}
                    </div>
                </div>

                {/* Additional Filters */}
                <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label className="flex items-center space-x-2 cursor-pointer mt-1">
                            <input type="checkbox" checked={historyShowProfits} onChange={e => setHistoryShowProfits(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                            <span className="text-sm font-semibold text-slate-700">Show Profits?</span>
                        </label>
                        <label className="flex items-center space-x-2 cursor-pointer mt-1">
                            <input type="checkbox" checked={historyShowZeroQty} onChange={e => setHistoryShowZeroQty(e.target.checked)} className="rounded text-indigo-600 focus:ring-indigo-500" />
                            <span className="text-sm font-semibold text-slate-700">Show Zero Qty Item?</span>
                        </label>
                        
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Account Name (Customer/Supplier)</label>
                            <input type="text" placeholder="e.g. Walk-in, ALL" value={historyAccountName} onChange={e => setHistoryAccountName(e.target.value)} className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none" />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Voucher Type</label>
                            <select value={historyVoucherType} onChange={e => setHistoryVoucherType(e.target.value)} className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none">
                                <option value="all">ALL</option>
                                <option value="Sale">Sale</option>
                                <option value="Purchase">Purchase</option>
                                <option value="Customer Return">Customer Return</option>
                                <option value="Supplier Return">Supplier Return</option>
                                <option value="Wastage">Wastage</option>
                                <option value="Adjustment">Adjustment</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Salesperson</label>
                            <input type="text" placeholder="e.g. John Doe, ALL" value={historySalesperson} onChange={e => setHistorySalesperson(e.target.value)} className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none" />
                        </div>
                        <div className="flex space-x-2 mt-4">
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Start Date</label>
                                <input type="date" value={historyStartDate} onChange={e => setHistoryStartDate(e.target.value)} className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none" />
                            </div>
                            <div className="flex-1">
                                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">End Date</label>
                                <input type="date" value={historyEndDate} onChange={e => setHistoryEndDate(e.target.value)} className="w-full border border-slate-200 rounded-lg p-2 text-sm focus:ring-1 focus:ring-indigo-500 outline-none" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Reset Button */}
            <div className="flex justify-end">
                <button
                    onClick={() => {
                        setHistoryCategory('all');
                        setSelectedHistoryProductId('');
                        setHistoryShowProfits(false);
                        setHistoryShowZeroQty(false);
                        setHistoryAccountName('');
                        setHistoryVoucherType('all');
                        setHistorySalesperson('');
                        setHistoryStartDate('');
                        setHistoryEndDate('');
                    }}
                    className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 text-sm font-semibold rounded-lg transition-colors"
                >
                    Reset Filters
                </button>
            </div>
          </div>

          {/* Ledger Content */}
          {historyLoading ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center">
              <div className="flex justify-center items-center">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-indigo-600"></div>
              </div>
              <span className="text-sm font-semibold text-slate-500 mt-2 block">Loading ledger data...</span>
            </div>
          ) : historyError ? (
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center text-rose-700 font-semibold">
              Error: {historyError}
            </div>
          ) : historyData ? (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs flex flex-col">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/50">
                        <th className="p-3">Date</th>
                        <th className="p-3">Product (SKU)</th>
                        <th className="p-3">Voucher Type</th>
                        <th className="p-3">Account Name</th>
                        <th className="p-3">Salesperson</th>
                        <th className="p-3 text-center">Qty Change</th>
                        {historyShowProfits && <th className="p-3 text-right text-emerald-600">Profit</th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {historyData.length === 0 ? (
                        <tr>
                          <td colSpan={historyShowProfits ? 7 : 6} className="p-8 text-center text-slate-400 font-medium">
                            No transactions or events recorded for the selected filters.
                          </td>
                        </tr>
                      ) : (
                        historyData.map((d, index) => (
                          <tr key={index} className="hover:bg-slate-50/20 transition-colors">
                            <td className="p-3 text-slate-500 whitespace-nowrap">{new Date(d.event_date).toLocaleString()}</td>
                            <td className="p-3 font-semibold text-slate-700">{d.product_name} <span className="text-xs text-slate-400">({d.sku})</span></td>
                            <td className="p-3"><span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-full font-medium">{d.voucher_type}</span></td>
                            <td className="p-3 text-slate-600">{d.account_name || '-'}</td>
                            <td className="p-3 text-slate-600">{d.staff_name || '-'}</td>
                            <td className={\`p-3 text-center font-bold \${d.qty_change > 0 ? 'text-emerald-600' : d.qty_change < 0 ? 'text-rose-600' : 'text-slate-400'}\`}>
                              {d.qty_change > 0 ? '+' : ''}{d.qty_change}
                            </td>
                            {historyShowProfits && (
                              <td className="p-3 text-right font-bold text-emerald-600">
                                {d.profit != 0 ? \`৳\${d.profit.toFixed(2)}\` : '-'}
                              </td>
                            )}
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-400 font-medium">
              Select an item or category above to view its stock and sales ledger.
            </div>
          )}
        </div>
      )}
`;

content = content.replace(regexUI, newUI);

fs.writeFileSync(filePath, content, 'utf8');
console.log("Patched successfully!");
