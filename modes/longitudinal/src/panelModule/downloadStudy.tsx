import React, { useState, useEffect } from 'react';

type DownloadStudyPanelProps = {
  configuration?: Record<string, unknown>;
  servicesManager?: Record<string, unknown>;
};

const DownloadStudyPanel: React.FC<DownloadStudyPanelProps> = ({ servicesManager }) => {
  const [currentStudyUID, setCurrentStudyUID] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Get the current study UID and automatically download
  useEffect(() => {
    if (servicesManager) {
      const hangingProtocolService = servicesManager.services.hangingProtocolService;
      if (hangingProtocolService) {
        const updateStudyUID = () => {
          try {
            const state = hangingProtocolService.getState();
            const activeStudyUID = state?.activeStudyUID || '';

            // Only download if we have a new study UID and we're not already downloading
            if (activeStudyUID && activeStudyUID !== currentStudyUID && !isLoading) {
              setCurrentStudyUID(activeStudyUID);
              handleDownload(activeStudyUID);
            } else if (activeStudyUID !== currentStudyUID) {
              setCurrentStudyUID(activeStudyUID);
            }
          } catch (error) {
            console.warn('Could not get study UID:', error);
            setCurrentStudyUID('');
          }
        };

        // Get initial value and auto-download
        updateStudyUID();

        // Use polling instead of events for reliability
        const interval = setInterval(updateStudyUID, 2000); // Check every 2 seconds

        return () => {
          clearInterval(interval);
        };
      }
    }
  }, [servicesManager, isLoading, currentStudyUID]);

  const handleDownload = async (studyUID?: string) => {
    const uid = studyUID || currentStudyUID;

    if (!uid) {
      console.log('No study loaded. Please load a study first.');
      return;
    }

    setIsLoading(true);
    try {
      const studyUrl = `http://102.67.142.34:8084/dcm4chee-arc/aets/RADSHARE/rs/studies/${uid}?accept=application/zip`;
      // const studyUrl = `http://102.67.142.34:8084/dcm4chee-arc/aets/RADSHARE/rs/studies/1.3.51.0.7.12818622524.48903.26189.40049.6017.32402.18190?accept=application/zip`;

      console.log('Starting download...');
      console.log('Study UID:', uid);
      console.log('Download URL:', studyUrl);

      const response = await fetch('http://102.67.142.10:8082/api/download-study', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studyUrl,
        }),
      });

      console.log('Response received:', response.status, response.statusText);
      if (!response.ok) {
        if (response.status === 404) {
          console.log('No images found for this study');
          return;
        } else {
          console.log('Download failed:', response.statusText || 'Failed to download');
          return;
        }
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = `study-${uid}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      console.log('Download completed successfully!');
    } catch (error) {
      console.error('Error downloading study:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        padding: '20px',
        textAlign: 'center',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <h3
        style={{
          margin: '0 0 20px 0',
          color: '#333',
          fontSize: '18px',
          fontWeight: '600',
        }}
      >
        Download Study
      </h3>

      {currentStudyUID ? (
        <div
          style={{
            marginBottom: '16px',
            fontSize: '13px',
            color: '#666',
            backgroundColor: '#f8f9fa',
            padding: '12px',
            borderRadius: '6px',
            border: '1px solid #e9ecef',
          }}
        >
          <strong>Current Study:</strong>
          <br />
          <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>
            {currentStudyUID.substring(0, 25)}...
          </span>
        </div>
      ) : (
        <div
          style={{
            marginBottom: '16px',
            fontSize: '13px',
            color: '#dc3545',
            backgroundColor: '#f8d7da',
            padding: '12px',
            borderRadius: '6px',
            border: '1px solid #f5c6cb',
          }}
        >
          No study loaded
        </div>
      )}

      {isLoading && (
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#007bff',
            color: 'white',
            borderRadius: '8px',
            textAlign: 'center',
            marginBottom: '16px',
            boxShadow: '0 2px 4px rgba(0,123,255,0.3)',
            animation: 'pulse 2s infinite',
          }}
        >
          <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
            ⬇️ Started downloading...
          </div>
          <div style={{ fontSize: '12px', opacity: '0.9' }}>
            Please wait while we prepare your ZIP file
          </div>
        </div>
      )}

      {!isLoading && currentStudyUID && (
        <div
          style={{
            padding: '16px 20px',
            backgroundColor: '#28a745',
            color: 'white',
            borderRadius: '8px',
            textAlign: 'center',
            boxShadow: '0 2px 4px rgba(40,167,69,0.3)',
          }}
        >
          <div style={{ fontSize: '16px', fontWeight: '600', marginBottom: '8px' }}>
            ✅ Downloaded successfully!
          </div>
          <div style={{ fontSize: '12px', opacity: '0.9' }}>
            Check your downloads folder for the ZIP file
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.02); }
            100% { transform: scale(1); }
          }
        `}
      </style>
    </div>
  );
};

export default {
  id: 'download-study',
  name: 'download-study',
  label: 'Download',
  component: DownloadStudyPanel,
};
