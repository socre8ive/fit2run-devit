'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/Layout/DashboardLayout';

export default function DoorCounts() {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [store, setStore] = useState('all');
  const [startDate, setStartDate] = useState('2025-08-12');
  const [endDate, setEndDate] = useState('2025-08-15');

  function fetchData() {
    setLoading(true);
    const url = `/api/solink-door-counts?store=${store}&startDate=${startDate}&endDate=${endDate}`;
    
    fetch(url)
      .then(res => res.json())
      .then(result => {
        setData(result);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }

  return (
    <DashboardLayout>
      <div className="p-6">
        <h1 className="text-3xl font-bold mb-6">SoLink Door Counts</h1>
        
        <div className="bg-white p-6 rounded-lg shadow mb-6">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Store</label>
              <select 
                value={store} 
                onChange={(e) => setStore(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2"
              >
                <option value="all">All Stores</option>
                <option value="tampa">Tampa</option>
                <option value="utc">UTC</option>
                <option value="tyrone">Tyrone</option>
                <option value="perimeter">Perimeter</option>
                <option value="clearwater">Clearwater</option>
                <option value="augusta">Augusta</option>
                <option value="mallofgeorgia">Mall of Georgia</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Start Date</label>
              <input 
                type="date" 
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">End Date</label>
              <input 
                type="date" 
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
            
            <div className="flex items-end">
              <button 
                onClick={fetchData}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
              >
                {loading ? 'Loading...' : 'Get Data'}
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Results</h2>
          {loading && <p>Loading...</p>}
          {!loading && data.length === 0 && <p>No data. Click Get Data to load.</p>}
          {!loading && data.length > 0 && (
            <div className="space-y-2">
              {data.map(store => (
                <div key={store.store_name} className="border p-3 rounded">
                  <div className="flex justify-between">
                    <span className="font-bold">{store.store_name.toUpperCase()}</span>
                    <span className="text-xl font-bold text-blue-600">{store.total_entries} entries</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {store.total_events} events
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}