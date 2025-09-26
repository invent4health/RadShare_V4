import React from 'react';

interface DownloadPanelProps {
  title: string;
  url: string;
}

const DownloadPanel: React.FC<DownloadPanelProps> = ({ title, url }) => {
  const handleDownload = () => {
    console.log('Download button clicked!');
    alert('Download button clicked! Starting download...');
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dicom-study.zip';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    console.log('Download initiated');
  };

  return (
    <div style={{ padding: '16px' }}>
      <h3 style={{ margin: '0 0 16px 0', color: '#fff' }}>{title}</h3>
      <button
        onClick={handleDownload}
        style={{
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        Download ZIP
      </button>
      <p style={{ margin: '16px 0 0 0', fontSize: '12px', color: '#ccc' }}>
        Click to download the DICOM study as a ZIP file
      </p>
    </div>
  );
};

const getPanelModule = () => [
  {
    name: 'downloadPanel',
    iconName: 'download',
    iconLabel: 'Download DICOM',
    label: 'Download DICOM',
    component: DownloadPanel,
    weight: 1,
  },
];

export default getPanelModule;
