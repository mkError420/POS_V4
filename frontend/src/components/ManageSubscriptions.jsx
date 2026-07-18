import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config';

export default function ManageSubscriptions() {
  const [plans, setPlans] = useState([]);
  const [subscriptions, setSubscriptions] = useState([]);
  const [carts, setCarts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('plans');
  const [filterStatus, setFilterStatus] = useState('');
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState(null);
  const [planForm, setPlanForm] = useState({ name: '', billing_cycle: 'monthly', price: '', features: '', status: 'active' });
  const [savingPlan, setSavingPlan] = useState(false);
  const [planMessage, setPlanMessage] = useState('');
  const [viewingSubscription, setViewingSubscription] = useState(null);
  const [viewingCart, setViewingCart] = useState(null);

  useEffect(() => {
    fetchData();
  }, [filterStatus]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const [plansRes, subsRes, cartsRes] = await Promise.all([
        fetch(`${API_BASE_URL}/subscription-plans/all`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE_URL}/subscriptions${filterStatus ? '?status=' + filterStatus : ''}`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE_URL}/subscription-carts`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (plansRes.ok) setPlans(await plansRes.json());
      if (subsRes.ok) setSubscriptions(await subsRes.json());
      if (cartsRes.ok) setCarts(await cartsRes.json());
    } catch (err) {
      console.error('Failed to fetch subscription data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async (e) => {
    e.preventDefault();
    setSavingPlan(true);
    setPlanMessage('');

    try {
      const token = localStorage.getItem('token');
      const features = planForm.features.split('\n').filter(f => f.trim());
      const res = await fetch(`${API_BASE_URL}/subscription-plans`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
          name: planForm.name,
          billing_cycle: planForm.billing_cycle,
          price: parseFloat(planForm.price),
          features: features,
          status: planForm.status
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create plan.');

      setPlanMessage('Plan created successfully!');
      setShowPlanModal(false);
      setPlanForm({ name: '', billing_cycle: 'monthly', price: '', features: '', status: 'active' });
      fetchData();
    } catch (err) {
      setPlanMessage(err.message);
    } finally {
      setSavingPlan(false);
    }
  };

  const handleUpdatePlan = async (e) => {
    e.preventDefault();
    if (!editingPlan) return;

    setSavingPlan(true);
    setPlanMessage('');

    try {
      const token = localStorage.getItem('token');
      const features = planForm.features.split('\n').filter(f => f.trim());
      const res = await fetch(`${API_BASE_URL}/subscription-plans/${editingPlan.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
          name: planForm.name,
          billing_cycle: planForm.billing_cycle,
          price: parseFloat(planForm.price),
          features: features,
          status: planForm.status
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update plan.');

      setPlanMessage('Plan updated successfully!');
      setShowPlanModal(false);
      setEditingPlan(null);
      setPlanForm({ name: '', billing_cycle: 'monthly', price: '', features: '', status: 'active' });
      fetchData();
    } catch (err) {
      setPlanMessage(err.message);
    } finally {
      setSavingPlan(false);
    }
  };

  const handleDeletePlan = async (planId) => {
    if (!window.confirm('Are you sure you want to delete this plan?')) return;

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/subscription-plans/${planId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete plan.');

      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSubscriptionAction = async (subscriptionId, action) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/subscriptions/${subscriptionId}/${action}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action} subscription.`);

      fetchData();
      if (viewingSubscription?.id === subscriptionId) {
        setViewingSubscription(null);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCartAction = async (cartId, action) => {
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/subscription-carts/${cartId}/${action}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Requested-With': 'XMLHttpRequest'
        }
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Failed to ${action} cart.`);

      fetchData();
      if (viewingCart?.id === cartId) {
        setViewingCart(null);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const openEditPlan = (plan) => {
    setEditingPlan(plan);
    setPlanForm({
      name: plan.name,
      billing_cycle: plan.billing_cycle,
      price: plan.price.toString(),
      features: (plan.features || []).join('\n'),
      status: plan.status
    });
    setShowPlanModal(true);
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: 'bg-amber-50 text-amber-700 border-amber-200',
      active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      expired: 'bg-rose-50 text-rose-700 border-rose-200',
      cancelled: 'bg-slate-50 text-slate-700 border-slate-200',
      rejected: 'bg-rose-50 text-rose-700 border-rose-200',
      completed: 'bg-emerald-50 text-emerald-700 border-emerald-200'
    };
    return colors[status] || 'bg-slate-50 text-slate-700 border-slate-200';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Subscription Management</h2>
          <p className="text-sm text-slate-500 mt-1">Manage subscription plans and verify payments</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('plans')}
          className={`px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'plans' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Plans ({plans.length})
        </button>
        <button
          onClick={() => setActiveTab('subscriptions')}
          className={`px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'subscriptions' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Subscriptions ({subscriptions.length})
        </button>
        <button
          onClick={() => setActiveTab('carts')}
          className={`px-4 py-2 text-sm font-semibold transition-colors ${activeTab === 'carts' ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
        >
          Carts ({carts.length})
        </button>
      </div>

      {activeTab === 'plans' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold text-slate-800">Subscription Plans</h3>
            <button
              onClick={() => { setEditingPlan(null); setPlanForm({ name: '', billing_cycle: 'monthly', price: '', features: '', status: 'active' }); setShowPlanModal(true); }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow transition-colors"
            >
              + Add Plan
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="p-4">Name</th>
                    <th className="p-4">Billing Cycle</th>
                    <th className="p-4 text-right">Price</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm">
                  {plans.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-slate-400">
                        No subscription plans found.
                      </td>
                    </tr>
                  ) : (
                    plans.map((plan) => (
                      <tr key={plan.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4 font-semibold text-slate-800">{plan.name}</td>
                        <td className="p-4">
                          <span className="capitalize px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                            {plan.billing_cycle}
                          </span>
                        </td>
                        <td className="p-4 text-right font-bold text-slate-800">৳{parseFloat(plan.price).toFixed(2)}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${plan.status === 'active' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-50 text-slate-700'}`}>
                            {plan.status}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => openEditPlan(plan)}
                              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition-colors"
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleDeletePlan(plan.id)}
                              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg transition-colors"
                            >
                              Delete
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
        </div>
      )}

      {activeTab === 'subscriptions' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-slate-700">Filter:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Status</option>
              <option value="pending">Pending</option>
              <option value="active">Active</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    <th className="p-4">Shop</th>
                    <th className="p-4">Plan</th>
                    <th className="p-4">Payment</th>
                    <th className="p-4">Amount</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Date</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm">
                  {subscriptions.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-8 text-center text-slate-400">
                        No subscriptions found.
                      </td>
                    </tr>
                  ) : (
                    subscriptions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-4">
                          <div>
                            <p className="font-semibold text-slate-800">{sub.shop_name}</p>
                            <p className="text-xs text-slate-500">{sub.shop_email}</p>
                          </div>
                        </td>
                        <td className="p-4 font-medium text-slate-700">{sub.plan_name}</td>
                        <td className="p-4 capitalize text-slate-600">{sub.payment_method || 'N/A'}</td>
                        <td className="p-4 font-bold text-slate-800">৳{parseFloat(sub.amount_paid).toFixed(2)}</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${getStatusBadge(sub.status)}`}>
                            {sub.status}
                          </span>
                        </td>
                        <td className="p-4 text-slate-500 text-xs">{sub.created_at}</td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {sub.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleSubscriptionAction(sub.id, 'approve')}
                                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg transition-colors"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleSubscriptionAction(sub.id, 'reject')}
                                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg transition-colors"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                            {sub.status === 'active' && (
                              <button
                                onClick={() => handleSubscriptionAction(sub.id, 'cancel')}
                                className="px-3 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg transition-colors"
                              >
                                Cancel
                              </button>
                            )}
                            {sub.payment_document && (
                              <button
                                onClick={() => setViewingSubscription(sub)}
                                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition-colors"
                              >
                                View Proof
                              </button>
                            )}
                          </div>
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

      {activeTab === 'carts' && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-800">Subscription Requests</h3>
              <p className="text-xs text-slate-500 mt-0.5">Cart-based subscription requests submitted from the login page</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 border border-amber-200 px-2 py-1 rounded-full font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                {carts.filter(c => c.status === 'pending').length} Pending
              </span>
            </div>
          </div>

          {/* Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider bg-slate-50/60">
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Plans</th>
                    <th className="px-4 py-3">Payment</th>
                    <th className="px-4 py-3">Amount</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 text-sm">
                  {carts.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="p-10 text-center text-slate-400">No subscription requests found.</td>
                    </tr>
                  ) : (
                    carts.map((cart) => (
                      <tr key={cart.id} className="hover:bg-slate-50/50 transition-colors">
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-800">{cart.customer_name}</p>
                          <p className="text-xs text-slate-500">{cart.customer_email}</p>
                          <p className="text-xs text-slate-400">{cart.customer_phone}</p>
                        </td>
                        <td className="px-4 py-4">
                          <div className="space-y-1">
                            {(cart.plans || []).map((plan, idx) => (
                              <span key={idx} className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-[11px] font-semibold px-2 py-0.5 rounded border border-indigo-100 mr-1">
                                {plan.name}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          {cart.payment_method ? (
                            <div>
                              <span className={`inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded border
                                ${cart.payment_method === 'bkash'   ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                  cart.payment_method === 'nagad'   ? 'bg-orange-50 text-orange-700 border-orange-200' :
                                  cart.payment_method === 'rocket'  ? 'bg-violet-50 text-violet-700 border-violet-200' :
                                  cart.payment_method === 'banking' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                                  'bg-slate-50 text-slate-700 border-slate-200'}`}>
                                {cart.payment_method.charAt(0).toUpperCase() + cart.payment_method.slice(1)}
                              </span>
                              {cart.transaction_id && (
                                <p className="text-[11px] text-slate-400 font-mono mt-0.5">{cart.transaction_id}</p>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400 italic">Not provided</span>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-bold text-slate-800">৳{parseFloat(cart.amount_paid ?? cart.total_amount).toFixed(2)}</p>
                          {cart.amount_paid && parseFloat(cart.amount_paid) !== parseFloat(cart.total_amount) && (
                            <p className="text-[11px] text-amber-600">Plan: ৳{parseFloat(cart.total_amount).toFixed(2)}</p>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold capitalize border ${getStatusBadge(cart.status)}`}>
                            {cart.status}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-slate-500 text-xs whitespace-nowrap">
                          {new Date(cart.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                        </td>
                        <td className="px-4 py-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setViewingCart(cart)}
                              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-lg transition-colors"
                            >
                              Review
                            </button>
                            {cart.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => handleCartAction(cart.id, 'approved')}
                                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-lg transition-colors"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleCartAction(cart.id, 'rejected')}
                                  className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold rounded-lg transition-colors"
                                >
                                  Reject
                                </button>
                              </>
                            )}
                          </div>
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

      {/* Plan Modal */}
      {showPlanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-800 mb-4">{editingPlan ? 'Edit Plan' : 'Create New Plan'}</h3>

            <form onSubmit={editingPlan ? handleUpdatePlan : handleCreatePlan} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Plan Name</label>
                <input
                  type="text"
                  value={planForm.name}
                  onChange={(e) => setPlanForm({ ...planForm, name: e.target.value })}
                  required
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Billing Cycle</label>
                <select
                  value={planForm.billing_cycle}
                  onChange={(e) => setPlanForm({ ...planForm, billing_cycle: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Price (BDT)</label>
                <input
                  type="number"
                  step="0.01"
                  value={planForm.price}
                  onChange={(e) => setPlanForm({ ...planForm, price: e.target.value })}
                  required
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Features (one per line)</label>
                <textarea
                  value={planForm.features}
                  onChange={(e) => setPlanForm({ ...planForm, features: e.target.value })}
                  rows="4"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                <select
                  value={planForm.status}
                  onChange={(e) => setPlanForm({ ...planForm, status: e.target.value })}
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowPlanModal(false); setEditingPlan(null); setPlanMessage(''); }}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPlan}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-xl text-sm shadow transition-colors"
                >
                  {savingPlan ? 'Saving...' : (editingPlan ? 'Update' : 'Create')}
                </button>
              </div>
            </form>

            {planMessage && (
              <div className={`mt-4 p-3 rounded-xl text-sm ${planMessage.includes('successfully') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                {planMessage}
              </div>
            )}
          </div>
        </div>
      )}

      {/* View Payment Proof Modal */}
      {viewingSubscription && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-slate-800">Payment Proof</h3>
              <button
                onClick={() => setViewingSubscription(null)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Shop:</span>
                <span className="font-semibold text-slate-800">{viewingSubscription.shop_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Plan:</span>
                <span className="font-semibold text-slate-800">{viewingSubscription.plan_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Payment Method:</span>
                <span className="font-semibold text-slate-800 capitalize">{viewingSubscription.payment_method || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Transaction ID:</span>
                <span className="font-semibold text-slate-800">{viewingSubscription.transaction_id || 'N/A'}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Amount Paid:</span>
                <span className="font-bold text-indigo-600">৳{parseFloat(viewingSubscription.amount_paid).toFixed(2)}</span>
              </div>
            </div>

            {viewingSubscription.payment_document && (
              <div className="border border-slate-200 rounded-xl overflow-hidden">
                {viewingSubscription.payment_document.startsWith('data:image') ? (
                  <img
                    src={viewingSubscription.payment_document}
                    alt="Payment proof"
                    className="w-full max-h-96 object-contain bg-slate-50"
                  />
                ) : (
                  <div className="p-8 text-center">
                    <svg className="w-12 h-12 text-slate-400 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    <p className="text-sm text-slate-600">PDF Document</p>
                    <a
                      href={viewingSubscription.payment_document}
                      download="payment_proof.pdf"
                      className="inline-block mt-2 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
                    >
                      Download PDF
                    </a>
                  </div>
                )}
              </div>
            )}

            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setViewingSubscription(null)}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors"
              >
                Close
              </button>
              {viewingSubscription.status === 'pending' && (
                <>
                  <button
                    onClick={() => handleSubscriptionAction(viewingSubscription.id, 'approve')}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm shadow transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleSubscriptionAction(viewingSubscription.id, 'reject')}
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-sm shadow transition-colors"
                  >
                    Reject
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cart Details / Review Modal */}
      {viewingCart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">

            {/* Header */}
            <div className="bg-gradient-to-r from-slate-700 to-slate-900 px-6 py-5 flex items-center justify-between rounded-t-2xl">
              <div>
                <p className="text-slate-300 text-xs font-semibold uppercase tracking-wider mb-0.5">Subscription Request #{viewingCart.id}</p>
                <h3 className="text-white font-extrabold text-lg">Review Request</h3>
              </div>
              <button onClick={() => setViewingCart(null)} className="text-white/60 hover:text-white p-2 hover:bg-white/10 rounded-xl transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Status badge */}
              <div className="flex items-center justify-between">
                <span className={`px-3 py-1.5 rounded-full text-xs font-bold capitalize border ${getStatusBadge(viewingCart.status)}`}>
                  {viewingCart.status}
                </span>
                <span className="text-xs text-slate-400">
                  {new Date(viewingCart.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Customer info */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Customer Information</h4>
                <div className="space-y-2">
                  {[
                    { label: 'Name',  value: viewingCart.customer_name },
                    { label: 'Email', value: viewingCart.customer_email },
                    { label: 'Phone', value: viewingCart.customer_phone },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center text-sm">
                      <span className="text-slate-500">{label}</span>
                      <span className="font-semibold text-slate-800">{value}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Selected plans */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Selected Plans</h4>
                <div className="space-y-2">
                  {(viewingCart.plans || []).map((plan, idx) => (
                    <div key={idx} className="flex justify-between items-center bg-white p-3 rounded-lg border border-slate-100">
                      <div>
                        <p className="font-semibold text-slate-800 text-sm">{plan.name}</p>
                        <p className="text-xs text-slate-400 capitalize">{plan.billing_cycle}</p>
                      </div>
                      <p className="font-bold text-indigo-600 text-sm">৳{parseFloat(plan.price).toFixed(2)}</p>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200 mt-2">
                    <span className="font-bold text-slate-700 text-sm">Plan Total</span>
                    <span className="font-extrabold text-slate-800">৳{parseFloat(viewingCart.total_amount).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Payment details */}
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Payment Details</h4>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Method</span>
                    {viewingCart.payment_method ? (
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border capitalize
                        ${viewingCart.payment_method === 'bkash'   ? 'bg-rose-50 text-rose-700 border-rose-200' :
                          viewingCart.payment_method === 'nagad'   ? 'bg-orange-50 text-orange-700 border-orange-200' :
                          viewingCart.payment_method === 'rocket'  ? 'bg-violet-50 text-violet-700 border-violet-200' :
                          viewingCart.payment_method === 'banking' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                          'bg-slate-100 text-slate-600 border-slate-200'}`}>
                        {viewingCart.payment_method}
                      </span>
                    ) : <span className="text-slate-400 text-xs italic">Not provided</span>}
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Transaction ID</span>
                    <span className="font-mono font-bold text-indigo-600 text-sm">
                      {viewingCart.transaction_id || <span className="text-slate-400 font-normal not-italic text-xs">Not provided</span>}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-slate-500">Amount Paid</span>
                    <span className={`font-extrabold text-base ${parseFloat(viewingCart.amount_paid ?? 0) >= parseFloat(viewingCart.total_amount) ? 'text-emerald-600' : 'text-amber-600'}`}>
                      ৳{parseFloat(viewingCart.amount_paid ?? viewingCart.total_amount).toFixed(2)}
                    </span>
                  </div>
                  {viewingCart.amount_paid && parseFloat(viewingCart.amount_paid) < parseFloat(viewingCart.total_amount) && (
                    <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-1">
                      <svg className="w-4 h-4 text-amber-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M12 3a9 9 0 100 18A9 9 0 0012 3z" />
                      </svg>
                      <p className="text-xs text-amber-700 font-semibold">
                        Underpaid by ৳{(parseFloat(viewingCart.total_amount) - parseFloat(viewingCart.amount_paid)).toFixed(2)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Admin notes field (only for pending) */}
              {viewingCart.status === 'pending' && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <h4 className="text-xs font-bold text-amber-600 uppercase tracking-wider mb-2">Admin Notes (optional)</h4>
                  <textarea
                    rows="2"
                    placeholder="Add a note for your records before approving or rejecting…"
                    className="w-full border border-amber-200 bg-white rounded-xl px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
                    id={`cart-notes-${viewingCart.id}`}
                  />
                </div>
              )}

              {/* Action buttons */}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setViewingCart(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors">
                  Close
                </button>
                {viewingCart.status === 'pending' && (
                  <>
                    <button
                      onClick={() => handleCartAction(viewingCart.id, 'approved')}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-xl text-sm shadow transition-colors">
                      ✓ Approve
                    </button>
                    <button
                      onClick={() => handleCartAction(viewingCart.id, 'rejected')}
                      className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-semibold rounded-xl text-sm shadow transition-colors">
                      ✕ Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
