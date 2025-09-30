import React, { useEffect, useState } from 'react';

const LicenseGate = ({ onLicenseValid }) => {
  const [licenseKey, setLicenseKey] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  // Check for existing saved key
  useEffect(() => {
    const savedKey = localStorage.getItem('licenseKey');
    if (savedKey) {
      validateLicense(savedKey);
    } else {
      setLoading(false);
    }
  }, []);

  const validateLicense = async (key: string) => {
    setLoading(true);
    setError('');

    try {
      const res = await fetch('http://localhost:5000/api/verifyLicense', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ licenseKey: key }),
      });

      const data = await res.json();

      if (data.status === 'valid') {
        localStorage.setItem('licenseKey', key);
        onLicenseValid();
      } else {
        setError('Invalid or expired license key.');
        setLoading(false);
      }
    } catch (err) {
      console.error(err);
      setError('Server error. Please try again.');
      setLoading(false);
    }
  };

  const handleSubmit = e => {
    e.preventDefault();
    if (!licenseKey) {
      setError('Please enter a license key.');
      return;
    }
    validateLicense(licenseKey);
  };

  if (loading) return <div style={{ padding: '2rem' }}>🔐 Checking license...</div>;

  return (
    <div style={{ textAlign: 'center', marginTop: '15%' }}>
      <h2>🔐 Enter License Key</h2>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          placeholder="Enter your license key"
          value={licenseKey}
          onChange={e => setLicenseKey(e.target.value)}
          style={{
            padding: '10px',
            fontSize: '16px',
            width: '300px',
            marginBottom: '10px',
            border: '1px solid #ccc',
            borderRadius: '5px',
          }}
        />
        <br />
        <button
          type="submit"
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
          }}
        >
          Submit
        </button>
      </form>
      {error && <p style={{ color: 'red', marginTop: '10px' }}>{error}</p>}
    </div>
  );
};

export default LicenseGate;
