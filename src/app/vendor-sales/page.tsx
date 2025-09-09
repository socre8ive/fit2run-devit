'use client';

import React, { useState, useEffect } from 'react';
import DashboardLayout from '@/components/Layout/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface VendorSalesData {
  vendor: string;
  units: number;
  unitsPercent: number;
  dollars: number;
  dollarsPercent: number;
  unitsPercentChange: number;
  dollarsPercentChange: number;
  dollarsDifference: number;
  isStoreSection: boolean;
}

interface VendorSalesResponse {
  date: string;
  lastYearDate: string;
  data: VendorSalesData[];
  totals: {
    grandTotalUnits: number;
    grandTotalDollars: number;
    storeTotalUnits: number;
    storeTotalDollars: number;
    ecomTotalUnits: number;
    ecomTotalDollars: number;
  };
}

export default function VendorSalesPage() {
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [vendorData, setVendorData] = useState<VendorSalesResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buttonClicked, setButtonClicked] = useState(false);

  const fetchVendorSales = async (date: string) => {
    console.log('fetchVendorSales called with date:', date);
    
    // Only run on client-side
    if (typeof window === 'undefined') {
      console.log('Server-side detected, returning early');
      return;
    }
    
    console.log('Setting loading to true');
    setLoading(true);
    setError(null);
    
    try {
      console.log('Making fetch request to:', `/api/vendor-sales?date=${date}`);
      const response = await fetch(`/api/vendor-sales?date=${date}`);
      console.log('Fetch response status:', response.status);
      
      if (!response.ok) {
        throw new Error('Failed to fetch vendor sales data');
      }
      const data = await response.json();
      console.log('Fetch successful, data length:', data.data?.length || 0);
      setVendorData(data);
    } catch (err) {
      console.error('Fetch error:', err);
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      console.log('Setting loading to false');
      setLoading(false);
    }
  };

  // Remove automatic useEffect - make data loading purely manual via button click

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatPercent = (percent: number, decimals: number = 2) => {
    return `${percent.toFixed(decimals)}%`;
  };

  const formatPercentChange = (percent: number) => {
    const formatted = formatPercent(Math.abs(percent));
    if (percent === 0) return '0.00%';
    return percent > 0 ? `+${formatted}` : `-${formatted}`;
  };

  const formatDollarChange = (amount: number) => {
    const formatted = formatCurrency(Math.abs(amount));
    if (amount === 0) return '$0.00';
    return amount > 0 ? formatted : `(${formatted})`;
  };

  const getChangeColor = (value: number) => {
    if (value > 0) return 'text-green-600';
    if (value < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl">Loading vendor sales data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-red-600">Error: {error}</div>
      </div>
    );
  }

  const storeVendors = vendorData?.data.filter(v => v.isStoreSection) || [];
  const ecomVendors = vendorData?.data.filter(v => !v.isStoreSection) || [];
  
  // Remove debug logging for cleaner logs

  return (
    <DashboardLayout>
      <div className="max-w-full mx-auto">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle className="text-2xl font-bold">Vendor Sales Report</CardTitle>
            <div className="flex items-center gap-4">
              <label htmlFor="date-select" className="font-medium">
                Select Date:
              </label>
              <input
                id="date-select"
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="border border-gray-300 rounded px-3 py-1"
              />
              <button
                onClick={() => {
                  setButtonClicked(true);
                  fetchVendorSales(selectedDate);
                }}
                disabled={loading}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Loading...' : buttonClicked ? 'Clicked!' : 'Load Data'}
              </button>
            </div>
          </div>
          {vendorData && (
            <div className="text-sm text-gray-600">
              Date Selected: {new Date(vendorData.date).toLocaleDateString()} | 
              Comparing to: {new Date(vendorData.lastYearDate).toLocaleDateString()}
            </div>
          )}
        </CardHeader>
        
        <CardContent>
          {vendorData && vendorData.data.length > 0 ? (
            <div className="space-y-8">
              {/* Store Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Store Sales (All Physical Locations)</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300 text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-3 py-2 text-left">VENDOR</th>
                        <th className="border border-gray-300 px-3 py-2 text-right">UNITS SOLD</th>
                        <th className="border border-gray-300 px-3 py-2 text-right">UNITS % TOTAL</th>
                        <th className="border border-gray-300 px-3 py-2 text-right">DOLLARS</th>
                        <th className="border border-gray-300 px-3 py-2 text-right">$ % TOTAL</th>
                        <th className="border border-gray-300 px-3 py-2 text-right">UNITS % +/- LY</th>
                        <th className="border border-gray-300 px-3 py-2 text-right">$ % +/- LY</th>
                        <th className="border border-gray-300 px-3 py-2 text-right">$ +/- LY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {storeVendors.map((vendor, index) => (
                        <tr 
                          key={index}
                          className={vendor.vendor === 'STORES Total' ? 'bg-blue-50 font-bold' : 'hover:bg-gray-50'}
                        >
                          <td className="border border-gray-300 px-3 py-2">{vendor.vendor}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">
                            {vendor.units.toLocaleString()}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-right">
                            {formatPercent(vendor.unitsPercent)}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-right">
                            {formatCurrency(vendor.dollars)}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-right">
                            {formatPercent(vendor.dollarsPercent)}
                          </td>
                          <td className={`border border-gray-300 px-3 py-2 text-right ${getChangeColor(vendor.unitsPercentChange)}`}>
                            {formatPercentChange(vendor.unitsPercentChange)}
                          </td>
                          <td className={`border border-gray-300 px-3 py-2 text-right ${getChangeColor(vendor.dollarsPercentChange)}`}>
                            {formatPercentChange(vendor.dollarsPercentChange)}
                          </td>
                          <td className={`border border-gray-300 px-3 py-2 text-right ${getChangeColor(vendor.dollarsDifference)}`}>
                            {formatDollarChange(vendor.dollarsDifference)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* ECOM Section */}
              <div>
                <h3 className="text-lg font-semibold mb-4">ECOM Sales</h3>
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse border border-gray-300 text-sm">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 px-3 py-2 text-left">VENDOR</th>
                        <th className="border border-gray-300 px-3 py-2 text-right">UNITS SOLD</th>
                        <th className="border border-gray-300 px-3 py-2 text-right">UNITS % TOTAL</th>
                        <th className="border border-gray-300 px-3 py-2 text-right">DOLLARS</th>
                        <th className="border border-gray-300 px-3 py-2 text-right">$ % TOTAL</th>
                        <th className="border border-gray-300 px-3 py-2 text-right">UNITS % +/- LY</th>
                        <th className="border border-gray-300 px-3 py-2 text-right">$ % +/- LY</th>
                        <th className="border border-gray-300 px-3 py-2 text-right">$ +/- LY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ecomVendors.map((vendor, index) => (
                        <tr 
                          key={index}
                          className={vendor.vendor === 'ECOM' ? 'bg-green-50 font-bold' : 'hover:bg-gray-50'}
                        >
                          <td className="border border-gray-300 px-3 py-2">{vendor.vendor}</td>
                          <td className="border border-gray-300 px-3 py-2 text-right">
                            {vendor.units.toLocaleString()}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-right">
                            {formatPercent(vendor.unitsPercent)}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-right">
                            {formatCurrency(vendor.dollars)}
                          </td>
                          <td className="border border-gray-300 px-3 py-2 text-right">
                            {formatPercent(vendor.dollarsPercent)}
                          </td>
                          <td className={`border border-gray-300 px-3 py-2 text-right ${getChangeColor(vendor.unitsPercentChange)}`}>
                            {formatPercentChange(vendor.unitsPercentChange)}
                          </td>
                          <td className={`border border-gray-300 px-3 py-2 text-right ${getChangeColor(vendor.dollarsPercentChange)}`}>
                            {formatPercentChange(vendor.dollarsPercentChange)}
                          </td>
                          <td className={`border border-gray-300 px-3 py-2 text-right ${getChangeColor(vendor.dollarsDifference)}`}>
                            {formatDollarChange(vendor.dollarsDifference)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary Stats */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Total Sales</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold">
                        {formatCurrency(vendorData.totals.grandTotalDollars)}
                      </div>
                      <div className="text-sm text-gray-600">
                        {vendorData.totals.grandTotalUnits.toLocaleString()} units
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Store Sales</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold">
                        {formatCurrency(vendorData.totals.storeTotalDollars)}
                      </div>
                      <div className="text-sm text-gray-600">
                        {vendorData.totals.storeTotalUnits.toLocaleString()} units
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">ECOM Sales</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1">
                      <div className="text-2xl font-bold">
                        {formatCurrency(vendorData.totals.ecomTotalDollars)}
                      </div>
                      <div className="text-sm text-gray-600">
                        {vendorData.totals.ecomTotalUnits.toLocaleString()} units
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          ) : vendorData ? (
            <div className="text-center py-12">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Vendor Sales Data
              </h3>
              <p className="text-gray-600">
                No sales data found for {vendorData.date}. Try selecting a different date.
              </p>
            </div>
          ) : null}
        </CardContent>
      </Card>
      </div>
    </DashboardLayout>
  );
}