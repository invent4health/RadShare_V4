import React, { useState, useEffect } from 'react';
import Editor from 'react-simple-wysiwyg';
import { DicomMetadataStore } from '@ohif/core';
import DOMPurify from 'dompurify';
import axios from 'axios';
import { PanelSection } from '@ohif/ui-next';
import './ReportPanel.css';
import toast, { Toaster } from 'react-hot-toast';
function formatPN(name) {
  if (!name) {
    return;
  }

  let nameToUse = name.Alphabetic ?? name;
  if (typeof nameToUse === 'object') {
    nameToUse = '';
  }

  // Convert the first ^ to a ', '. String.replace() only affects
  // the first appearance of the character.
  const commaBetweenFirstAndLast = nameToUse.replace('^', ', ');

  // Replace any remaining '^' characters with spaces
  const cleaned = commaBetweenFirstAndLast.replace(/\^/g, ' ');

  // Trim any extraneous whitespace
  return cleaned.trim();
}

export default function PanelReport(props) {
  const [html, setHtml] = useState(''); // Initial editor content
  const [templates, setTemplates] = useState([]); // For dropdown options
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [studyUID, setStudyUID] = useState(''); // To track the current studyUID
  const [loading, setLoading] = useState(false); // To handle loading states
  const [error, setError] = useState(null); // To handle errors
  const [isEdited, setIsEdited] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  // Assuming commandsModule is a function that takes parameters
  useEffect(() => {
    const handleBeforeUnload = event => {
      if (isEdited && !isSaved) {
        event.preventDefault();
        event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

 

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isEdited, isSaved]);

  useEffect(() => {
    localStorage.setItem('isEdited', JSON.stringify(isEdited));
    localStorage.setItem('isSaved', JSON.stringify(isSaved));
  }, [isEdited, isSaved]); // Only include state variables in dependencies

  useEffect(() => {
    fetchDicomMetadata(); // Fetch StudyUID when the component mounts
    fetchTemplates(); // Fetch templates
  }, []);
  useEffect(() => {
    if (studyUID) {
      loadReport(); // Load report content if a studyUID is available
    }
  }, [studyUID]);
  const fetchTemplates = async () => {
    try {
      const response = await axios.get(
        'http://35.157.184.183/radshare-appapi/api/radshareopenapi/getPublicReportTemplate/MR'
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
      setStudyUID(studyUIDs[0]); // Use the first studyUID as an example
    } else {
      console.error('No Study Instance UIDs found.');
      setError('No Study Instance UIDs available.');
    }
  };
  const loadReport = async () => {
    setLoading(true);
    setError(null);

    try {
      // Retrieve content from localStorage specific to the studyUID
      const savedContent = localStorage.getItem(`editorContent_${studyUID}`);
      if (savedContent) {
        setHtml(savedContent); // Load saved content for this studyUID
        console.log('Loaded content from localStorage for studyUID:', studyUID);
      } else {
        // If no saved content exists, proceed with the API call
        const response = await axios.get(
          `http://35.157.184.183/radshare-appapi/api/radshareopenapi/getStudyiuidinfo/${studyUID}`
        );

        if (response.data?.status === 'S' && response.data.ReportContent) {
          setHtml(response.data.ReportContent); // Load content from API
          console.log('Report loaded successfully:', studyUID);
        } else {
          console.log('No saved report found for the given StudyUID');
          setHtml(''); // Clear editor if no report is found
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
      alert('Study UID is not available. Cannot save report.');
      return;
    }

    try {
      // Construct the JSON payload
      const jsonPayload = {
        report: html, // Editor content
        STUDYINSTANCEUID: studyUID, // Study UID
      };

      // Sending POST request with JSON
      const response = await axios.post(
        'http://3.77.246.193/radshare-appapi/api/radshareopenapi/saveEditorOpenReport',
        jsonPayload,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      console.log('Full API Response:', response);

      if (response.data?.includes('Data Received Successfully')) {
        alert('Report saved successfully!');
        setIsSaved(true);
        setIsEdited(false);
        localStorage.removeItem('hasUnsavedChanges');
      } else {
        alert('Failed to save report. Please try again.');
      }
    } catch (error) {
      console.error('Error saving report:', error);
      if (error.response) {
        console.error('Error Response Data:', error.response.data);
        console.error('Error Response Status:', error.response.status);
      }
      alert('Failed to save report due to a network or server error.');
    }
  };
  const handleLoadTemplate = templateId => {
    const selected = templates.find(template => template.id === templateId);
    if (selected) {
      setHtml(selected.content); // Load template content into editor
      setSelectedTemplate(templateId);
      setIsEdited(true);
    } else {
      console.error('Template not found!');
    }
  };
  const onChange = newHtml => {
    try {
      const content = typeof newHtml === 'string' ? newHtml : newHtml.target?.value || '';
      const sanitizedHtml = DOMPurify.sanitize(content); // Sanitize HTML content

      // Check if content has changed before updating
      if (sanitizedHtml !== html) {
        setHtml(sanitizedHtml); // Update state
        setIsEdited(true); // Mark as edited
        localStorage.setItem(`editorContent_${studyUID}`, sanitizedHtml); // Save with studyUID key
      }
    } catch (error) {
      console.error('Error updating editor content:', error);
    }
  };

  // const handleGoBack = () => {
  //   if (isEdited && !isSaved) {
  //     // Store true if there are unsaved changes
  //     localStorage.setItem('hasUnsavedChanges', JSON.stringify(true));
  //   } else {
  //     // Clear the state if there are no unsaved changes
  //     localStorage.setItem('hasUnsavedChanges', JSON.stringify(false));
  //   }

  //   onClose(); // Proceed with the navigation
  // };
  const commands = props;
  const panelService = commands.servicesManager.services.panelService;
  const { viewportGridService, displaySetService } = commands.servicesManager.services;
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
      ? activeDisplaySet.images[0] // For image stacks
      : activeDisplaySet.instance; // For single instance

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

  // Log the output to console
  console.log(
    'Commands Module Output:',
    panelService.getPanelStatus('@ohif/extension-cornerstone.panelModule.PanelReport')
  );

  return (
    <PanelSection defaultOpen={true}>
      <PanelSection.Header className="report-header">
        <span>Report</span>
      </PanelSection.Header>

      <PanelSection.Content>
        <div className="patient-info-container">
          <div className="patient-info-grid">
            <div className="patient-info-row">
              <span className="info-value">{patientDetails.patientName}</span>
              <span className="info-value">{patientDetails.patientSex}</span>
              <span className="info-value">{patientDetails.patientID}</span>
              <span className="info-value">{patientDetails.patientAge}</span>
            </div>
          </div>
        </div>
        <div className="template-dropdown white">
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
            onClick={saveReport}
          >
            Save/Confirm
          </button>
        </div>
        <div className="editor-wrapper">
          <Editor
            value={html}
            onChange={onChange}
          />
        </div>
      </PanelSection.Content>
    </PanelSection>
  );
}
