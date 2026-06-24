import React, { useState, useEffect, useMemo } from 'react';
import { CreditCard } from 'lucide-react';
import { User, BillingRecord } from '../../types';
import { api } from '../../services/api';

interface BillingPanelProps {
  user: User;
}

export default function BillingPanel({ user }: BillingPanelProps) {
  const [billing, setBilling] = useState<BillingRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getBilling(user.id)
      .then(setBilling)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user.id]);

  const sorted = useMemo(
    () => [...billing].sort((a, b) => b.date.localeCompare(a.date)),
    [billing]
  );

  const unpaidTotal = useMemo(
    () => sorted.filter((b) => b.status !== 'paid').reduce((acc, b) => acc + b.amount, 0),
    [sorted]
  );

  const statusClass = (status: BillingRecord['status']) => {
    if (status === 'paid') return 'text-green-600 bg-green-50';
    if (status === 'unpaid') return 'text-red-600 bg-red-50';
    return 'text-amber-600 bg-amber-50';
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-3">
            <CreditCard className="text-amber-600" size={28} />
            My Billing
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Outstanding balance: <span className="font-bold text-slate-800">${unpaidTotal.toFixed(2)}</span>
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200/60 rounded-3xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 text-center text-slate-500 text-sm font-medium">Loading billing records…</div>
        ) : sorted.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm font-medium">No billing records found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/80">
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Date</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Description</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Doctor</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Nurse</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Amount</th>
                  <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Status</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((bill) => (
                  <tr key={bill.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-600 whitespace-nowrap">{bill.date}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">{bill.description}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{bill.doctorName || bill.doctorId || '—'}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{bill.nurseName || bill.nurseId || '—'}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900">${bill.amount.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-full ${statusClass(bill.status)}`}>
                        {bill.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
