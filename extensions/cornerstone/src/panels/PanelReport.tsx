import React, { useState, useEffect } from 'react';
import Editor from 'react-simple-wysiwyg';
import { DicomMetadataStore } from '@ohif/core';
import DOMPurify from 'dompurify';
import axios from 'axios';
import { PanelSection } from '@ohif/ui-next';
import './ReportPanel.css';
import toast, { Toaster } from 'react-hot-toast';
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition';
import { useAppConfig } from '@state';

function formatPN(name) {
  if (!name) {
    return '';
  }

  let nameToUse = name.Alphabetic ?? name;
  if (typeof nameToUse === 'object') {
    nameToUse = '';
  }

  const commaBetweenFirstAndLast = nameToUse.replace('^', ', ');
  const cleaned = commaBetweenFirstAndLast.replace(/\^/g, ' ');
  return cleaned.trim();
}

export default function PanelReport(props) {
  const [html, setHtml] = useState('');
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [studyUID, setStudyUID] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isEdited, setIsEdited] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [clinicalInfo, setClinicalInfo] = useState('Not Available');
  const [isPopupVisible, setIsPopupVisible] = useState(false);
  const [symptoms, setSymptoms] = useState('');
  const [findings, setFindings] = useState('');
  const [isListening, setIsListening] = useState(false);
  const { transcript, interimTranscript, resetTranscript } = useSpeechRecognition();
  const [appConfig] = useAppConfig();

  useEffect(() => {
    if (!SpeechRecognition.browserSupportsSpeechRecognition()) {
      return;
    }

    if (isListening) {
      const liveText = interimTranscript || transcript;
      if (liveText) {
        console.log('🎤 Live speech input:', liveText);
        setHtml(prev => {
          const updated = prev + (prev ? ' ' : '') + liveText;
          console.log('📝 Updated editor HTML:', updated);
          return updated;
        });
      }
    }
  }, [interimTranscript, transcript, isListening]);

  useEffect(() => {
    const handleBeforeUnload = event => {
      if (isEdited && !isSaved) {
        event.preventDefault();
        event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isEdited, isSaved]);

  useEffect(() => {
    localStorage.setItem('isEdited', JSON.stringify(isEdited));
    localStorage.setItem('isSaved', JSON.stringify(isSaved));
  }, [isEdited, isSaved]);

  useEffect(() => {
    fetchDicomMetadata();
    fetchTemplates();
  }, []);

  useEffect(() => {
    if (studyUID) {
      loadReport();
      fetchClinicalInfo();
    }
  }, [studyUID]);

  useEffect(() => {
    if (clinicalInfo) {
      setSymptoms(clinicalInfo);
    }
  }, [clinicalInfo]);

  const toggleListening = () => {
    if (!SpeechRecognition.browserSupportsSpeechRecognition()) {
      toast.error('Speech recognition is not supported in this browser.');
      return;
    }

    if (isListening) {
      SpeechRecognition.stopListening();
      setIsListening(false);
      console.log('🛑 Stopped listening');
    } else {
      resetTranscript();
      SpeechRecognition.startListening({ continuous: true, language: 'en-US' });
      setIsListening(true);
      console.log('🎤 Started listening...');
    }
  };

  const handleFindingsChange = e => {
    setFindings(e.target.value);
    props.onFindingsChange?.(e.target.value);
  };

  const fetchTemplates = async () => {
    try {
      const response = await axios.get(
        appConfig.getTemplates
        // 'http://35.157.184.183/radshare-appapi/api/radshareopenapi/getPublicReportTemplate/MR'
      );
      setTemplates(response.data.ReportData || []);
    } catch (error) {
      console.error('Error fetching templates:', error);
      setError('Failed to load templates.');
    }
  };

  const fetchDicomMetadata = () => {
    const studyUIDs = DicomMetadataStore.getStudyInstanceUIDs();
    if (studyUIDs.length > 0) {
      setStudyUID(studyUIDs[0]);
    } else {
      console.error('No Study Instance UIDs found.');
      setError('No Study Instance UIDs available.');
    }
  };
  const logSaveReport = appConfig => {
    console.log('appConfig.saveReport:', appConfig?.saveReport);
    console.log('Keys:', Object.keys(appConfig));
    console.log('Hello');
  };
  const cleanClinicalInfo = info => {
    if (!info) {
      return '';
    }
    return info
      .replace(/[-–—]+/g, ' ')
      .replace(/[^\w\s.,]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const fetchClinicalInfo = async () => {
    setLoading(true);
    setError(null);

    const savedClinicalInfo = localStorage.getItem(`clinicalInfo_${studyUID}`);
    if (savedClinicalInfo) {
      setClinicalInfo(cleanClinicalInfo(savedClinicalInfo));
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get(
        appConfig.fetchClinicalInfo
        // `http://3.77.246.193/radshare-appapi/api/radshareopenapi/fetch-clinical-infoByStudyIuID?studyIuId=${studyUID}`
      );
      if (response.data.info) {
        const info = String(response.data.info);
        setClinicalInfo(cleanClinicalInfo(info));
        localStorage.setItem(`clinicalInfo_${studyUID}`, info);
      } else {
        setClinicalInfo('No clinical information available');
      }
    } catch (error) {
      console.error('Error fetching clinical info:', error);
      setError('Failed to fetch clinical information.');
    }
    setLoading(false);
  };

  const handleGenerateClick = () => {
    setIsPopupVisible(!isPopupVisible);
  };

  const handleSubmitReport = async () => {
    let Modality;
    const studies = DicomMetadataStore.getStudyInstanceUIDs();
    if (studies.length > 0) {
      const study = DicomMetadataStore.getStudy(studies[0]);
      Modality = study.series?.[0]?.Modality;
    }

    try {
      const payload = { modality: Modality, symptoms, findings };
      const response = await axios.post(
        appConfig.generateReport,
        // 'http://3.77.246.193/api/radshareopenapi/report-gen-stream',
        payload,
        { headers: { 'Content-Type': 'application/json' } }
      );
      console.log('API Response:', response.data);
      toast.success('Report generated successfully!');
      setIsPopupVisible(false);
    } catch (error) {
      console.error('Error generating report:', error);
      toast.error('Failed to generate report.');
    }
  };

  const loadReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const savedContent = localStorage.getItem(`editorContent_${studyUID}`);
      if (savedContent) {
        setHtml(savedContent);
        console.log('Loaded content from localStorage:', studyUID);
      } else {
        const response = await axios.get(
          `${appConfig.getStudyInfo}/${studyUID}`
          // `http://35.157.184.183/radshare-appapi/api/radshareopenapi/getStudyiuidinfo/${studyUID}`
        );
        if (response.data?.status === 'S' && response.data.ReportContent) {
          setHtml(response.data.ReportContent);
          console.log('Report loaded successfully:', studyUID);
        } else {
          console.log('No saved report found for the given StudyUID');
          setHtml('');
        }
      }
    } catch (error) {
      console.error('Error loading report:', error);
      setError('Failed to load report content.');
    }
    setLoading(false);
  };

  const saveReport = async () => {
    if (!studyUID) {
      toast.error('Study UID is not available. Cannot save report.');
      return;
    }

    try {
      const jsonPayload = { report: html, STUDYINSTANCEUID: studyUID };
      const response = await axios.post(
        appConfig.saveReport,
        // 'http://13.202.29.77:85/api/radshareopenapi/saveEditorOpenReport',
        jsonPayload,
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (response.data?.includes('Data Received Successfully')) {
        toast.success('Report saved successfully!');
        setIsSaved(true);
        setIsEdited(false);
        localStorage.removeItem('hasUnsavedChanges');
      } else {
        toast.error('Failed to save report.');
      }
    } catch (error) {
      console.error('Error saving report:', error);
      toast.error('Failed to save report due to a network or server error.');
    }
  };

  const handleLoadTemplate = templateId => {
    const selected = templates.find(template => template.id === templateId);
    if (selected) {
      setHtml(selected.content);
      setSelectedTemplate(templateId);
      setIsEdited(true);
    } else {
      console.error('Template not found!');
      toast.error('Template not found.');
    }
  };

  const onChange = newHtml => {
    try {
      const content = typeof newHtml === 'string' ? newHtml : newHtml.target?.value || '';
      const sanitizedHtml = DOMPurify.sanitize(content);
      if (sanitizedHtml !== html) {
        setHtml(sanitizedHtml);
        setIsEdited(true);
        localStorage.setItem(`editorContent_${studyUID}`, sanitizedHtml);
      }
    } catch (error) {
      console.error('Error updating editor content:', error);
      toast.error('Error updating editor content.');
    }
  };

  const { viewportGridService, displaySetService } = props.servicesManager.services;
  const { activeViewportId, viewports } = viewportGridService.getState();
  const activeViewportSpecificData = viewports.get(activeViewportId);
  if (!activeViewportSpecificData) {
    return null;
  }

  const { displaySetInstanceUIDs } = activeViewportSpecificData;
  const displaySetInstanceUID = displaySetInstanceUIDs?.[0];
  if (!displaySetInstanceUID) {
    return null;
  }

  const displaySets = displaySetService.activeDisplaySets;
  const activeDisplaySet = displaySets.find(
    ds => ds.displaySetInstanceUID === displaySetInstanceUID
  );

  let patientDetails = {
    sopInstanceUID: 'Not Available',
    patientName: 'Not Available',
    patientID: 'Not Available',
    patientAge: 'Not Available',
    patientSex: 'Not Available',
    performedProcedureStepStartDate: 'Not Available',
    studyDescription: 'Not Available',
  };

  if (activeDisplaySet) {
    const firstMetadata = activeDisplaySet.images
      ? activeDisplaySet.images[0]
      : activeDisplaySet.instance;

    if (firstMetadata) {
      patientDetails = {
        sopInstanceUID:
          firstMetadata?.['00080018'] || firstMetadata?.SOPInstanceUID || 'Not Available',
        patientName:
          formatPN(firstMetadata?.['00100010'] || firstMetadata?.PatientName) || 'Not Available',
        patientID: firstMetadata?.['00100020'] || firstMetadata?.PatientID || 'Not Available',
        patientAge: firstMetadata?.['00101010'] || firstMetadata?.PatientAge || 'Not Available',
        patientSex: firstMetadata?.['00100040'] || firstMetadata?.PatientSex || 'Not Available',
        performedProcedureStepStartDate:
          firstMetadata?.['00400244'] ||
          firstMetadata?.PerformedProcedureStepStartDate ||
          'Not Available',
        studyDescription:
          firstMetadata?.['00081030'] || firstMetadata?.StudyDescription || 'Not Available',
      };
    }
  }

  return (
    <PanelSection defaultOpen={true}>
      <PanelSection.Header className="report-header">
        <span>Report</span>
      </PanelSection.Header>
      <PanelSection.Content>
        <div className="patient-info-container">
          <div className="patient-info-grid">
            <div className="flex flex-wrap gap-x-4 text-lg text-white">
              <span className="font-semibold">
                Name: {patientDetails.patientName} Sex: {patientDetails.patientSex}
                Patient ID: {patientDetails.patientID} Age: {patientDetails.patientAge}
              </span>
              <span>
                <span className="font-semibold">Clinical info:</span>
                {loading ? <em className="text-gray-400">Loading...</em> : clinicalInfo}
              </span>
            </div>
          </div>
        </div>
        <div className="template-dropdown">
          <label
            htmlFor="templateDropdown"
            className="template-label white"
          >
            Load Template:{' '}
          </label>
          <select
            id="templateDropdownmenu"
            value={selectedTemplate}
            onChange={e => handleLoadTemplate(e.target.value)}
          >
            <option value="">Select a template</option>
            {templates.map(template => (
              <option
                key={template.id}
                value={template.id}
              >
                {template.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="save-button"
            onClick={() => logSaveReport(appConfig)}
          >
            Save/Confirm
          </button>
          <button
            onClick={toggleListening}
            className="rounded-full bg-gray-200 p-2 text-2xl hover:bg-gray-300"
            title={isListening ? 'Stop Listening' : 'Start Speaking'}
          >
            {isListening ? '🛑' : '🎤'}
          </button>
          <button
            type="button"
            className="save-button"
            onClick={handleGenerateClick}
          >
            Generate Report {isPopupVisible ? '🔼' : '🔽'}
          </button>
          {isPopupVisible && (
            <div className="popup">
              <div className="popup-content">
                <span
                  className="close-button"
                  onClick={() => setIsPopupVisible(false)}
                >
                  ×
                </span>
                <h2>Generate Report</h2>
                <div>
                  <label>Symptoms:</label>
                  <input
                    type="text"
                    value={symptoms}
                    onChange={e => setSymptoms(e.target.value)}
                  />
                </div>
                <div>
                  <label>Findings:</label>
                  <textarea
                    rows={4}
                    value={findings}
                    onChange={handleFindingsChange}
                  />
                </div>
                <button
                  className="submit-button"
                  onClick={handleSubmitReport}
                >
                  Submit Report
                </button>
              </div>
            </div>
          )}
        </div>
        <div className="editor-wrapper">
          <Editor
            value={html}
            onChange={onChange}
          />
        </div>
      </PanelSection.Content>
      <Toaster />
    </PanelSection>
  );
}
