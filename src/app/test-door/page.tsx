'use client';

import { useState } from 'react';

export default function TestDoor() {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const testButton = () => {
    alert('Button clicked!');
    console.log('Button was clicked!');
    setLoading(true);
    
    fetch('/api/solink-door-counts?store=all&startDate=2025-08-12&endDate=2025-08-15')
      .then(response => response.json())
      .then(result => {
        console.log('Got data:', result);
        setData(result);
        alert(`Got ${result.length} stores`);
      })
      .catch(error => {
        console.error('Error:', error);
        alert('Error: ' + error.message);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>Test Door Counts - Simple Version</h1>
      
      <button 
        onClick={testButton}
        style={{
          backgroundColor: '#0066cc',
          color: 'white',
          padding: '10px 20px',
          fontSize: '16px',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          marginBottom: '20px'
        }}
        disabled={loading}
      >
        {loading ? 'Loading...' : 'TEST BUTTON - Click Me!'}
      </button>

      <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f5f5f5' }}>
        <h3>Results: {data.length} stores</h3>
        {data.map((store, i) => (
          <div key={i} style={{ margin: '10px 0', padding: '10px', backgroundColor: 'white' }}>
            <strong>{store.store_name?.toUpperCase()}</strong>: {store.total_entries} entries
          </div>
        ))}
      </div>
    </div>
  );
}