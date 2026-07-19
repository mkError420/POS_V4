import React, { useState, useEffect } from 'react';
import API_BASE_URL from '../config';

export default function Subscription({ onNavigate }) {
  const [plans, setPlans] = useState([]);
  const [mySubscription, setMySubscription] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showSubscribeModal, setShowSubscribeModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [docMessage, setDocMessage] = useState('');
  const [paymentDoc, setPaymentDoc] = useState(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const [plansRes, subRes] = await Promise.all([
        fetch(`${API_BASE_URL}/subscription-plans`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API_BASE_URL}/my-subscription`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (plansRes.ok) {
        const plansData = await plansRes.json();
        setPlans(plansData);
      }
      if (subRes.ok) {
        const subData = await subRes.json();
        setMySubscription(subData);
      }
    } catch (err) {
      console.error('Failed to fetch subscription data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!selectedPlan) return;

    setSubmitting(true);
    setSubmitMessage('');

    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_BASE_URL}/subscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
          plan_id: selectedPlan.id,
          payment_method: paymentMethod,
          transaction_id: transactionId,
          amount_paid: selectedPlan.price
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Subscription failed.');

      setSubmitMessage('Subscription request submitted! Please upload your payment document.');
      setShowPaymentModal(true);
      setShowSubscribeModal(false);
      fetchData();
    } catch (err) {
      setSubmitMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleUploadDocument = async (e) => {
    e.preventDefault();
    if (!paymentDoc || !mySubscription) return;

    setUploadingDoc(true);
    setDocMessage('');

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('payment_document', paymentDoc);

      const res = await fetch(`${API_BASE_URL}/subscriptions/${mySubscription.id}/upload-document`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: formData
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed.');

      setDocMessage('Payment document uploaded successfully! Waiting for admin approval.');
      setPaymentDoc(null);
      setShowPaymentModal(false);
      fetchData();
    } catch (err) {
      setDocMessage(err.message);
    } finally {
      setUploadingDoc(false);
    }
  };

  const getBillingLabel = (cycle) => {
    switch (cycle) {
      case 'monthly': return '/month';
      case 'quarterly': return '/quarter';
      case 'yearly': return '/year';
      default: return '';
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      pending: 'bg-amber-50 text-amber-700 border-amber-200',
      active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      expired: 'bg-rose-50 text-rose-700 border-rose-200',
      cancelled: 'bg-slate-50 text-slate-700 border-slate-200',
      rejected: 'bg-rose-50 text-rose-700 border-rose-200'
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
          <h2 className="text-2xl font-bold text-slate-800">Subscription Plans</h2>
          <p className="text-sm text-slate-500 mt-1">Manage your shop subscription and billing</p>
        </div>
      </div>

      {/* Current Subscription Status */}
      {mySubscription && (
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Current Subscription</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Plan</p>
              <p className="text-sm font-bold text-slate-800 mt-1">{mySubscription.plan_name}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</p>
              <span className={`inline-block mt-1 text-xs font-bold px-2.5 py-1 rounded-full border ${getStatusBadge(mySubscription.status)}`}>
                {mySubscription.status}
              </span>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Period</p>
              <p className="text-sm font-bold text-slate-800 mt-1">{mySubscription.start_date} to {mySubscription.end_date}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Payment Method</p>
              <p className="text-sm font-bold text-slate-800 mt-1 capitalize">{mySubscription.payment_method || 'N/A'}</p>
            </div>
          </div>

          {mySubscription.status === 'pending' && (
            <div className="mt-4 flex gap-3">
              <button
                onClick={() => setShowPaymentModal(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl shadow transition-colors"
              >
                Upload Payment Document
              </button>
            </div>
          )}

          {mySubscription.status === 'active' && (
            <div className="mt-4">
              <p className="text-xs text-emerald-600 font-medium">Your subscription is active. Enjoy full access!</p>
            </div>
          )}
        </div>
      )}

      {/* Available Plans */}
      <div>
        <h3 className="text-lg font-bold text-slate-800 mb-4">Available Plans</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`bg-white border rounded-2xl p-6 shadow-xs transition-all hover:shadow-lg ${selectedPlan?.id === plan.id ? 'border-indigo-500 ring-2 ring-indigo-200' : 'border-slate-200'}`}
            >
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-bold text-slate-800">{plan.name}</h3>
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full border ${plan.billing_cycle === 'monthly' ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : plan.billing_cycle === 'quarterly' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                      {plan.billing_cycle}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold text-slate-800">৳{parseFloat(plan.price).toFixed(0)}</span>
                    <span className="text-sm text-slate-500">{getBillingLabel(plan.billing_cycle)}</span>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <ul className="space-y-2.5">
                    {(plan.features || []).map((feature, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm text-slate-600">
                        <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                        {feature}
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={() => {
                    if (mySubscription && mySubscription.status === 'pending') {
                      setDocMessage('You already have a pending subscription.');
                      setShowPaymentModal(true);
                      return;
                    }
                    setSelectedPlan(plan);
                    setShowSubscribeModal(true);
                  }}
                  className="w-full py-2.5 bg-slate-600 hover:bg-indigo-700 text-white font-semibold rounded-xl text-sm shadow transition-colors"
                >
                  {mySubscription ? 'Change Plan' : 'Subscribe Now'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Subscribe Modal */}
      {showSubscribeModal && selectedPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-slate-800 mb-4">Subscribe to {selectedPlan.name}</h3>

            <div className="bg-slate-50 rounded-xl p-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-600">Plan</span>
                <span className="font-semibold text-slate-800">{selectedPlan.name}</span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-slate-600">Billing</span>
                <span className="font-semibold text-slate-800 capitalize">{selectedPlan.billing_cycle}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600">Amount</span>
                <span className="font-bold text-indigo-600">৳{parseFloat(selectedPlan.price).toFixed(2)}</span>
              </div>
            </div>

            <form onSubmit={handleSubscribe} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Method</label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  required
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select payment method</option>
                  <option value="bkash">bKash</option>
                  <option value="nagad">Nagad</option>
                  <option value="rocket">Rocket</option>
                  <option value="banking">Bank Transfer</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Transaction ID (Optional)</label>
                <input
                  type="text"
                  value={transactionId}
                  onChange={(e) => setTransactionId(e.target.value)}
                  placeholder="e.g. TXN123456789"
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowSubscribeModal(false); setSubmitMessage(''); }}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !paymentMethod}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-xl text-sm shadow transition-colors"
                >
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>

            {submitMessage && (
              <div className={`mt-4 p-3 rounded-xl text-sm ${submitMessage.includes('successfully') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                {submitMessage}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Payment Document Upload Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Upload Payment Proof</h3>
            <p className="text-sm text-slate-500 mb-4">Upload a screenshot or document of your payment (bKash/Nagad/Rocket/Banking).</p>

            <form onSubmit={handleUploadDocument} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Payment Screenshot / Document</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,application/pdf"
                  onChange={(e) => setPaymentDoc(e.target.files[0])}
                  required
                  className="w-full bg-white border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <p className="text-xs text-slate-400 mt-1">Max 5MB. JPG, PNG, WEBP or PDF.</p>
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => { setShowPaymentModal(false); setDocMessage(''); }}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={uploadingDoc || !paymentDoc}
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold rounded-xl text-sm shadow transition-colors"
                >
                  {uploadingDoc ? 'Uploading...' : 'Upload Document'}
                </button>
              </div>
            </form>

            {docMessage && (
              <div className={`mt-4 p-3 rounded-xl text-sm ${docMessage.includes('successfully') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                {docMessage}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
