import React, { useState, useEffect } from 'react';
import Editor from 'react-simple-wysiwyg';
import { DicomMetadataStore } from '@ohif/core';
import DOMPurify from 'dompurify';
import { PanelSection } from '@ohif/ui-next';
import './ReportPanel.css';
import toast, { Toaster } from 'react-hot-toast';
import { useAppConfig } from '@state';
import { marked } from 'marked';
import { generateRadiologyReport } from './chatGPTService';
import AssemblyAIStreamingTranscriber from './AssemblyAIStreamingTranscriber';
import { reportService, Template, PatientDetails } from './ReportService';

export default function PanelReport(props) {
  const [html, setHtml] = useState('');
  const [templates, setTemplates] = useState<Template[]>([]);
  const [filteredTemplates, setFilteredTemplates] = useState<Template[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState('');
  const [studyUID, setStudyUID] = useState('');
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isEdited, setIsEdited] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [clinicalInfo, setClinicalInfo] = useState('Not Available');
  const [isListening, setIsListening] = useState(false);
  const [mainTranscriber, setMainTranscriber] = useState(null);
  const [isAiModalVisible, setIsAiModalVisible] = useState(false);
  const [aiPromptText, setAiPromptText] = useState('');
  const [isDictating, setIsDictating] = useState(false);
  const [promptTranscriber, setPromptTranscriber] = useState(null);
  const [appConfig] = useAppConfig();

  useEffect(() => {
    if (appConfig.fetchClinicalInfo) {
      reportService.config = {
        ...reportService.config,
        fetchClinicalInfo: appConfig.fetchClinicalInfo,
      };
    }
  }, [appConfig]);

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
    reportService.setEditedState(isEdited);
    reportService.setSavedState(isSaved);
  }, [isEdited, isSaved]);

  useEffect(() => {
    initializeData();
  }, []);

  useEffect(() => {
    if (studyUID) {
      loadReportData();
      loadClinicalInfo();
    }
  }, [studyUID]);

  useEffect(() => {}, [clinicalInfo]);

  const initializeData = async () => {
    const studyUIDs = DicomMetadataStore.getStudyInstanceUIDs();
    if (studyUIDs.length > 0) {
      setStudyUID(studyUIDs[0]);
    } else {
      console.error('No Study Instance UIDs found.');
      setError('No Study Instance UIDs available.');
    }

    setLoading(true);
    try {
      const fetchedTemplates = await reportService.fetchTemplates();
      setTemplates(fetchedTemplates);
    } catch (error) {
      setError('Failed to load templates.');
    } finally {
      setLoading(false);
    }
  };

  const loadReportData = async () => {
    setLoading(true);
    setError(null);
    try {
      const reportContent = await reportService.loadReport(studyUID);
      setHtml(reportContent);
    } catch (err) {
      console.error('Error loading report:', err);
      setError('Failed to load report.');
    } finally {
      setLoading(false);
    }
  };

  const loadClinicalInfo = async () => {
    setLoading(true);
    try {
      const info = await reportService.fetchClinicalInfo(studyUID);
      setClinicalInfo(info);
    } catch (error) {
      console.error('Error loading clinical info:', error);
      setClinicalInfo('Failed to load clinical information');
    } finally {
      setLoading(false);
    }
  };

  const saveReport = async () => {
    const success = await reportService.saveReport(html, studyUID);
    if (success) {
      setIsSaved(true);
      setIsEdited(false);
    }
  };

  const handleLoadTemplate = (templateId: string) => {
    const templateContent = reportService.loadTemplate(templateId);
    if (templateContent) {
      setHtml(templateContent);
      setSelectedTemplate(templateId);
      setIsEdited(true);
      reportService.saveToLocalStorage(studyUID, templateContent);
    }
  };

  const onChange = (newHtml: any) => {
    try {
      const content = typeof newHtml === 'string' ? newHtml : newHtml.target?.value || '';
      const sanitizedHtml = DOMPurify.sanitize(content);
      if (sanitizedHtml !== html) {
        setHtml(sanitizedHtml);
        setIsEdited(true);
        reportService.saveToLocalStorage(studyUID, sanitizedHtml);
      }
    } catch (error) {
      console.error('Error updating editor content:', error);
      toast.error('Error updating editor content.');
    }
  };
  //Test Comment: Update

  const handleMainTranscription = (text: string) => {
    setHtml(prev => (prev ? prev + ' ' : '') + text);
  };

  const handleMainCommand = (command: string) => {
    console.log('🎯 Executing voice command:', command);
    if (command === 'nextLine') {
      console.log('📝 Adding line break');
      setHtml(prev => (prev ? prev + '<br>' : ''));
    } else if (command === 'nextParagraph') {
      console.log('📝 Adding paragraph break');
      setHtml(prev => (prev ? prev + '<br><br>' : ''));
    } else if (command === 'comma') {
      setHtml(prev => {
        const base = prev || '';
        const trimmed = base.replace(/\s+$/, '');
        return trimmed + ', ';
      });
    } else if (command === 'period') {
      setHtml(prev => {
        const base = prev || '';
        const trimmed = base.replace(/\s+$/, '');
        return trimmed + '. ';
      });
    } else if (command === 'question') {
      setHtml(prev => {
        const base = prev || '';
        const trimmed = base.replace(/\s+$/, '');
        return trimmed + '? ';
      });
    } else if (command === 'exclamation') {
      setHtml(prev => {
        const base = prev || '';
        const trimmed = base.replace(/\s+$/, '');
        return trimmed + '! ';
      });
    } else if (command === 'colon') {
      setHtml(prev => {
        const base = prev || '';
        const trimmed = base.replace(/\s+$/, '');
        return trimmed + ': ';
      });
    } else if (command === 'semicolon') {
      setHtml(prev => {
        const base = prev || '';
        const trimmed = base.replace(/\s+$/, '');
        return trimmed + '; ';
      });
    } else if (command === 'dash' || command === 'hyphen') {
      setHtml(prev => {
        const base = prev || '';
        const trimmed = base.replace(/\s+$/, '');
        return trimmed + '- ';
      });
    } else if (command === 'asterisk') {
      setHtml(prev => {
        const base = prev || '';
        const trimmed = base.replace(/\s+$/, '');
        return trimmed + '* ';
      });
    }
  };

  const toggleMainListening = async () => {
    if (isListening) {
      mainTranscriber?.stop();
      setIsListening(false);
    } else {
      setIsListening(true);
      const newTranscriber = new AssemblyAIStreamingTranscriber(
        handleMainTranscription,
        e => toast.error(e),
        handleMainCommand
      );
      setMainTranscriber(newTranscriber);
      await newTranscriber.start();
    }
  };

  const openAiModal = () => {
    setAiPromptText('');
    setIsAiModalVisible(true);
  };

  const closeAiModal = () => {
    if (isDictating) {
      promptTranscriber?.stop();
      setIsDictating(false);
    }
    setIsAiModalVisible(false);
  };

  const handlePromptTranscription = (text: string) => {
    setAiPromptText(prev => (prev ? prev + ' ' : '') + text);
  };

  const togglePromptDictation = async () => {
    if (isDictating) {
      promptTranscriber?.stop();
      setIsDictating(false);
    } else {
      setIsDictating(true);
      const newTranscriber = new AssemblyAIStreamingTranscriber(handlePromptTranscription, e => {
        toast.error(e);
        setIsDictating(false);
      });
      setPromptTranscriber(newTranscriber);
      await newTranscriber.start();
    }
  };

  const handleGenerateWithAi = async (userInstruction: string) => {
    setIsGenerating(true);
    setIsAiModalVisible(false);
    toast.loading('Generating report with AI...');
    try {
      const markdownReport = await generateRadiologyReport({
        html,
        clinicalInfo,
        userInstruction,
        studyUID,
      });
      const htmlReport = marked(markdownReport, { breaks: true });
      setHtml(htmlReport);
      setIsEdited(true);
      reportService.saveToLocalStorage(studyUID, htmlReport);
      toast.dismiss();
      toast.success('Report generated successfully! ✨');
    } catch (error) {
      console.error('AI generation error:', error);
      toast.dismiss();
      toast.error('Failed to generate report.');
    } finally {
      setIsGenerating(false);
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
  let modality = 'N/A';
  if (displaySets && displaySets.length > 0 && displaySets[0].Modality) {
    modality = displaySets[0].Modality;
  }

  useEffect(() => {
    const filtered = reportService.getFilteredTemplates(modality);
    setFilteredTemplates(filtered);
  }, [templates, modality]);

  const activeDisplaySet = displaySets.find(
    ds => ds.displaySetInstanceUID === displaySetInstanceUID
  );

  const patientDetails: PatientDetails = reportService.extractPatientDetails(activeDisplaySet);

  useEffect(() => {
    return () => {
      if (mainTranscriber) {
        mainTranscriber.stop();
      }
      if (promptTranscriber) {
        promptTranscriber.stop();
      }
    };
  }, [mainTranscriber, promptTranscriber]);

  return (
    <PanelSection defaultOpen={true}>
      <PanelSection.Header className="report-header">
        <span>Report</span>
      </PanelSection.Header>
      <PanelSection.Content>
        <div className="patient-info-container">
          <div className="patient-info-grid">
            <div className="flex flex-wrap gap-x-4 text-lg text-white">
              <span className="font-medium">
                {`Name: ${patientDetails.patientName} Sex: ${patientDetails.patientSex} Patient ID: ${patientDetails.patientID} Age: ${patientDetails.patientAge} `}
              </span>
              <span>Modality: {modality}</span>
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
            {filteredTemplates.map(template => (
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

          <button
            onClick={toggleMainListening}
            className={`rounded-full p-2 text-2xl ${
              isListening
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'bg-gray-200 hover:bg-gray-300'
            }`}
            title={isListening ? 'Stop Dictation' : 'Dictate into Editor'}
          >
            {isListening ? '🛑' : '🎤'}
          </button>

          <button
            type="button"
            className="save-button"
            onClick={openAiModal}
            disabled={isGenerating}
          >
            {isGenerating ? 'Working...' : 'AI Report'}
          </button>
        </div>

        {isAiModalVisible && (
          <div className="ai-modal-overlay">
            <div className="ai-modal-content">
              <h2>Generate Report with AI</h2>
              <p>Type your prompt below or use the microphone to dictate.</p>

              <div className="prompt-input-area">
                <textarea
                  className="ai-modal-textarea"
                  placeholder="e.g., 'Summarize the findings and create an impression.'"
                  value={aiPromptText}
                  onChange={e => setAiPromptText(e.target.value)}
                />
                <button
                  onClick={togglePromptDictation}
                  className={`mic-button-inline ${isDictating ? 'recording' : ''}`}
                  title={isDictating ? 'Stop Dictation' : 'Start Dictation'}
                >
                  {isDictating ? '🛑' : '🎤'}
                </button>
              </div>

              <div className="ai-modal-actions">
                <button
                  className="modal-button cancel"
                  onClick={closeAiModal}
                >
                  Cancel
                </button>
                <button
                  className="modal-button submit"
                  onClick={() => handleGenerateWithAi(aiPromptText)}
                  disabled={isGenerating}
                >
                  {isGenerating ? 'Generating...' : 'Generate'}
                </button>
              </div>
            </div>
          </div>
        )}

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
