import { NextRequest, NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const dbConfig = {
  host: 'localhost',
  user: 'fit2run',
  password: 'Fit2Run1!',
  database: process.env.DB_NAME || 'sales_data',
};

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

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const selectedDate = searchParams.get('date');

  if (!selectedDate) {
    return NextResponse.json({ error: 'Date parameter is required' }, { status: 400 });
  }

  try {
    const connection = await mysql.createConnection(dbConfig);

    // Get current year and last year dates
    const currentDate = new Date(selectedDate);
    const lastYearDate = new Date(currentDate);
    lastYearDate.setFullYear(currentDate.getFullYear() - 1);

    const currentDateStr = currentDate.toISOString().split('T')[0];
    const lastYearDateStr = lastYearDate.toISOString().split('T')[0];

    // Get current year data (excluding ECOM)
    const [currentStoreRows] = await connection.execute(`
      SELECT 
        oi.vendor,
        COUNT(*) as units,
        SUM(oi.lineitem_price * oi.lineitem_quantity) as dollars
      FROM shopify_orders o
      JOIN shopify_order_items oi ON o.id = oi.order_id
      WHERE DATE(o.created_at) = ?
        AND o.location != 'ecom' 
        AND o.location != 'unknown'
        AND oi.vendor IS NOT NULL 
        AND oi.vendor != ''
      GROUP BY oi.vendor
      ORDER BY SUM(oi.lineitem_price * oi.lineitem_quantity) DESC
    `, [currentDateStr]);

    // Get current year ECOM data
    const [currentEcomRows] = await connection.execute(`
      SELECT 
        oi.vendor,
        COUNT(*) as units,
        SUM(oi.lineitem_price * oi.lineitem_quantity) as dollars
      FROM shopify_orders o
      JOIN shopify_order_items oi ON o.id = oi.order_id
      WHERE DATE(o.created_at) = ?
        AND o.location = 'ecom'
        AND oi.vendor IS NOT NULL 
        AND oi.vendor != ''
      GROUP BY oi.vendor
      ORDER BY SUM(oi.lineitem_price * oi.lineitem_quantity) DESC
    `, [currentDateStr]);

    // Get last year data (excluding ECOM)
    const [lastYearStoreRows] = await connection.execute(`
      SELECT 
        oi.vendor,
        COUNT(*) as units,
        SUM(oi.lineitem_price * oi.lineitem_quantity) as dollars
      FROM shopify_orders o
      JOIN shopify_order_items oi ON o.id = oi.order_id
      WHERE DATE(o.created_at) = ?
        AND o.location != 'ecom' 
        AND o.location != 'unknown'
        AND oi.vendor IS NOT NULL 
        AND oi.vendor != ''
      GROUP BY oi.vendor
    `, [lastYearDateStr]);

    // Get last year ECOM data
    const [lastYearEcomRows] = await connection.execute(`
      SELECT 
        oi.vendor,
        COUNT(*) as units,
        SUM(oi.lineitem_price * oi.lineitem_quantity) as dollars
      FROM shopify_orders o
      JOIN shopify_order_items oi ON o.id = oi.order_id
      WHERE DATE(o.created_at) = ?
        AND o.location = 'ecom'
        AND oi.vendor IS NOT NULL 
        AND oi.vendor != ''
      GROUP BY oi.vendor
    `, [lastYearDateStr]);

    await connection.end();

    // Process the data
    const processVendorData = (rows: any[], isEcom: boolean = false) => {
      const totalUnits = rows.reduce((sum: number, row: any) => sum + parseInt(row.units), 0);
      const totalDollars = rows.reduce((sum: number, row: any) => sum + parseFloat(row.dollars), 0);

      return rows.map((row: any) => ({
        vendor: row.vendor,
        units: parseInt(row.units),
        dollars: parseFloat(row.dollars),
        unitsPercent: totalUnits > 0 ? (parseInt(row.units) / totalUnits) * 100 : 0,
        dollarsPercent: totalDollars > 0 ? (parseFloat(row.dollars) / totalDollars) * 100 : 0,
        isStoreSection: !isEcom
      }));
    };

    // Create vendor maps for last year data
    const createVendorMap = (rows: any[]) => {
      const map: { [key: string]: { units: number; dollars: number } } = {};
      rows.forEach((row: any) => {
        map[row.vendor] = {
          units: parseInt(row.units),
          dollars: parseFloat(row.dollars)
        };
      });
      return map;
    };

    const lastYearStoreMap = createVendorMap(lastYearStoreRows as any[]);
    const lastYearEcomMap = createVendorMap(lastYearEcomRows as any[]);

    // Process current year data with year-over-year comparisons
    const processedStoreData = processVendorData(currentStoreRows as any[], false);
    const processedEcomData = processVendorData(currentEcomRows as any[], true);

    // Add year-over-year comparisons
    const addYearOverYearComparison = (vendorData: any[], lastYearMap: { [key: string]: { units: number; dollars: number } }) => {
      return vendorData.map(vendor => {
        const lastYearData = lastYearMap[vendor.vendor] || { units: 0, dollars: 0 };
        
        let unitsPercentChange = 0;
        let dollarsPercentChange = 0;
        let dollarsDifference = vendor.dollars - lastYearData.dollars;

        if (lastYearData.units > 0) {
          unitsPercentChange = ((vendor.units - lastYearData.units) / lastYearData.units) * 100;
        } else if (vendor.units > 0) {
          unitsPercentChange = 100; // New vendor
        }

        if (lastYearData.dollars > 0) {
          dollarsPercentChange = ((vendor.dollars - lastYearData.dollars) / lastYearData.dollars) * 100;
        } else if (vendor.dollars > 0) {
          dollarsPercentChange = 100; // New vendor
        }

        return {
          ...vendor,
          unitsPercentChange,
          dollarsPercentChange,
          dollarsDifference
        };
      });
    };

    // Add comparisons
    const storeDataWithComparison = addYearOverYearComparison(processedStoreData, lastYearStoreMap);
    const ecomDataWithComparison = addYearOverYearComparison(processedEcomData, lastYearEcomMap);

    // Calculate totals for store section
    const storeTotalUnits = storeDataWithComparison.reduce((sum, v) => sum + v.units, 0);
    const storeTotalDollars = storeDataWithComparison.reduce((sum, v) => sum + v.dollars, 0);
    const storeTotalLastYearUnits = Object.values(lastYearStoreMap).reduce((sum, v) => sum + v.units, 0);
    const storeTotalLastYearDollars = Object.values(lastYearStoreMap).reduce((sum, v) => sum + v.dollars, 0);

    // Calculate totals for ECOM section
    const ecomTotalUnits = ecomDataWithComparison.reduce((sum, v) => sum + v.units, 0);
    const ecomTotalDollars = ecomDataWithComparison.reduce((sum, v) => sum + v.dollars, 0);
    const ecomTotalLastYearUnits = Object.values(lastYearEcomMap).reduce((sum, v) => sum + v.units, 0);
    const ecomTotalLastYearDollars = Object.values(lastYearEcomMap).reduce((sum, v) => sum + v.dollars, 0);

    // Calculate grand totals
    const grandTotalUnits = storeTotalUnits + ecomTotalUnits;
    const grandTotalDollars = storeTotalDollars + ecomTotalDollars;

    // Create store total row
    const storeTotal: VendorSalesData = {
      vendor: 'STORES Total',
      units: storeTotalUnits,
      unitsPercent: grandTotalUnits > 0 ? (storeTotalUnits / grandTotalUnits) * 100 : 0,
      dollars: storeTotalDollars,
      dollarsPercent: grandTotalDollars > 0 ? (storeTotalDollars / grandTotalDollars) * 100 : 0,
      unitsPercentChange: storeTotalLastYearUnits > 0 ? ((storeTotalUnits - storeTotalLastYearUnits) / storeTotalLastYearUnits) * 100 : 0,
      dollarsPercentChange: storeTotalLastYearDollars > 0 ? ((storeTotalDollars - storeTotalLastYearDollars) / storeTotalLastYearDollars) * 100 : 0,
      dollarsDifference: storeTotalDollars - storeTotalLastYearDollars,
      isStoreSection: true
    };

    // Create ECOM total row
    const ecomTotal: VendorSalesData = {
      vendor: 'ECOM',
      units: ecomTotalUnits,
      unitsPercent: grandTotalUnits > 0 ? (ecomTotalUnits / grandTotalUnits) * 100 : 0,
      dollars: ecomTotalDollars,
      dollarsPercent: grandTotalDollars > 0 ? (ecomTotalDollars / grandTotalDollars) * 100 : 0,
      unitsPercentChange: ecomTotalLastYearUnits > 0 ? ((ecomTotalUnits - ecomTotalLastYearUnits) / ecomTotalLastYearUnits) * 100 : 0,
      dollarsPercentChange: ecomTotalLastYearDollars > 0 ? ((ecomTotalDollars - ecomTotalLastYearDollars) / ecomTotalLastYearDollars) * 100 : 0,
      dollarsDifference: ecomTotalDollars - ecomTotalLastYearDollars,
      isStoreSection: false
    };

    // Recalculate percentages for individual vendors relative to grand totals
    const recalculatePercentages = (vendors: any[]) => {
      return vendors.map(vendor => ({
        ...vendor,
        unitsPercent: grandTotalUnits > 0 ? (vendor.units / grandTotalUnits) * 100 : 0,
        dollarsPercent: grandTotalDollars > 0 ? (vendor.dollars / grandTotalDollars) * 100 : 0,
      }));
    };

    const finalStoreData = recalculatePercentages(storeDataWithComparison);
    const finalEcomData = recalculatePercentages(ecomDataWithComparison);

    // Handle vendors that existed last year but not this year
    const handleMissingVendors = (currentData: any[], lastYearMap: { [key: string]: { units: number; dollars: number } }, isEcom: boolean) => {
      const currentVendors = new Set(currentData.map(v => v.vendor));
      const missingVendors: VendorSalesData[] = [];

      Object.keys(lastYearMap).forEach(vendor => {
        if (!currentVendors.has(vendor)) {
          missingVendors.push({
            vendor,
            units: 0,
            unitsPercent: 0,
            dollars: 0,
            dollarsPercent: 0,
            unitsPercentChange: -100,
            dollarsPercentChange: -100,
            dollarsDifference: -lastYearMap[vendor].dollars,
            isStoreSection: !isEcom
          });
        }
      });

      return missingVendors;
    };

    const missingStoreVendors = handleMissingVendors(finalStoreData, lastYearStoreMap, false);
    const missingEcomVendors = handleMissingVendors(finalEcomData, lastYearEcomMap, true);

    // Combine all data
    const allData: VendorSalesData[] = [
      storeTotal,
      ...finalStoreData,
      ...missingStoreVendors,
      ecomTotal,
      ...finalEcomData,
      ...missingEcomVendors
    ];

    return NextResponse.json({
      date: currentDateStr,
      lastYearDate: lastYearDateStr,
      data: allData,
      totals: {
        grandTotalUnits,
        grandTotalDollars,
        storeTotalUnits,
        storeTotalDollars,
        ecomTotalUnits,
        ecomTotalDollars
      }
    });

  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
  }
}