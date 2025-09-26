import axios from 'axios';
import toast from 'react-hot-toast';

export interface Template {
  id: string;
  name: string;
  content: string;
  modality: string;
}

export interface PatientDetails {
  sopInstanceUID: string;
  patientName: string;
  patientID: string;
  patientAge: string;
  patientSex: string;
  performedProcedureStepStartDate: string;
  studyDescription: string;
}

export interface ReportServiceConfig {
  fetchClinicalInfo?: string;
  templatesApiUrl?: string;
  saveReportUrl?: string;
  fetchReportUrl?: string;
}

class ReportService {
  private config: ReportServiceConfig;
  private templates: Template[] = [];
  private clinicalInfoCache: Map<string, string> = new Map();
  // 102.67.142.10
  constructor(config: ReportServiceConfig = {}) {
    this.config = {
      templatesApiUrl: 'http://localhost:8082/api/templates',
      saveReportUrl: 'http://localhost:8082/api/save-report',
      fetchReportUrl: 'http://localhost:8082/api/fetch-report',
      ...config,
    };
  }

  async fetchTemplates(): Promise<Template[]> {
    try {
      const response = await axios.get(this.config.templatesApiUrl!);

      if (Array.isArray(response.data)) {
        this.templates = response.data.map(item => ({
          id: item.templatePk,
          name: item.templateName,
          content: item.template,
          modality: item.modalityAbbr,
        }));
        return this.templates;
      } else {
        this.templates = [];
        return [];
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Failed to load templates.');
      return [];
    }
  }

  getTemplates(): Template[] {
    return this.templates;
  }

  getFilteredTemplates(modality: string): Template[] {
    if (!modality || modality === 'N/A') {
      return this.templates;
    }
    return this.templates.filter(template => template.modality === modality);
  }

  getTemplateById(templateId: string): Template | undefined {
    return this.templates.find(template => template.id === templateId);
  }

  loadTemplate(templateId: string): string | null {
    const template = this.getTemplateById(templateId);
    if (template) {
      return template.content;
    }
    toast.error('Template not found.');
    return null;
  }

  private cleanClinicalInfo(info: string): string {
    if (!info) {
      return '';
    }
    return info
      .replace(/[-–—]+/g, ' ')
      .replace(/[^\w\s.,]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  async fetchClinicalInfo(studyUID: string): Promise<string> {
    const cacheKey = `clinicalInfo_${studyUID}`;
    const savedInfo = localStorage.getItem(cacheKey);
    if (savedInfo) {
      const cleanedInfo = this.cleanClinicalInfo(savedInfo);
      this.clinicalInfoCache.set(studyUID, cleanedInfo);
      return cleanedInfo;
    }

    try {
      if (!this.config.fetchClinicalInfo) {
        console.warn('fetchClinicalInfo URL not configured');
        return 'Clinical info API not configured';
      }

      const url = this.config.fetchClinicalInfo.includes('?')
        ? `${this.config.fetchClinicalInfo}&studyIuId=${studyUID}`
        : `${this.config.fetchClinicalInfo}?studyIuId=${studyUID}`;

      console.log('Fetching clinical info from:', url);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 8000);

      const response = await axios.get(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (response.data.info) {
        const info = String(response.data.info);
        const cleanedInfo = this.cleanClinicalInfo(info);
        localStorage.setItem(cacheKey, info);
        this.clinicalInfoCache.set(studyUID, cleanedInfo);
        return cleanedInfo;
      } else {
        return 'No clinical information available';
      }
    } catch (error) {
      console.warn('Clinical info fetch failed, continuing without it:', error);

      let errorMessage = 'Clinical info temporarily unavailable';
      if (error.name === 'AbortError') {
        errorMessage = 'Clinical info request timed out';
      } else if (error.code === 'ERR_NETWORK') {
        errorMessage = 'Clinical info service unavailable';
      } else if (error.code === 'ECONNABORTED') {
        errorMessage = 'Clinical info service timeout';
      }

      this.clinicalInfoCache.set(studyUID, errorMessage);
      return errorMessage;
    }
  }

  getCachedClinicalInfo(studyUID: string): string | undefined {
    return this.clinicalInfoCache.get(studyUID);
  }

  async loadReport(studyUID: string): Promise<string> {
    if (!studyUID) {
      throw new Error('Study UID is required');
    }

    const localStorageKey = `editorContent_${studyUID}`;

    try {
      console.log(`Fetching report from API for studyUID: ${studyUID}`);
      const response = await fetch(this.config.fetchReportUrl!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studyIuid: studyUID }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data && data.report) {
          localStorage.setItem(localStorageKey, data.report);
          console.log('Report loaded from server and saved to localStorage.');
          return data.report;
        } else {
          console.log('No report found in server response, checking localStorage...');
          return this.loadFallbackReport(studyUID);
        }
      } else if (response.status === 404) {
        console.log('Report not found (404). Falling back to localStorage...');
        return this.loadFallbackReport(studyUID);
      } else {
        throw new Error(`Server responded with status ${response.status}`);
      }
    } catch (error) {
      console.error('Error loading report from server:', error);
      console.log('Attempting to load from localStorage...');
      return this.loadFallbackReport(studyUID);
    }
  }

  private loadFallbackReport(studyUID: string): string {
    const localStorageKey = `editorContent_${studyUID}`;
    const savedContent = localStorage.getItem(localStorageKey);

    if (savedContent) {
      console.log('Report loaded from localStorage.');
      return savedContent;
    } else {
      console.log('No report found in localStorage either.');
      return '';
    }
  }

  async saveReport(html: string, studyUID: string): Promise<boolean> {
    if (!studyUID) {
      toast.error('Study UID is not available. Cannot save report.');
      return false;
    }

    if (!html.trim()) {
      toast.error('Cannot save empty report.');
      return false;
    }

    try {
      const jsonPayload = { report: html, STUDYINSTANCEUID: studyUID };

      const response = await axios.post(this.config.saveReportUrl!, jsonPayload, {
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.data?.includes('Data Received Successfully')) {
        toast.success('Report saved successfully! ✅');

        const localStorageKey = `editorContent_${studyUID}`;
        localStorage.setItem(localStorageKey, html);
        localStorage.removeItem('hasUnsavedChanges');

        return true;
      } else {
        toast.error(`Failed to save report: ${response.data || 'Unknown server response'}`);
        return false;
      }
    } catch (error) {
      console.error('Error saving report:', error);
      toast.error('Failed to save report due to a network or server error. 😞');
      return false;
    }
  }

  saveToLocalStorage(studyUID: string, content: string): void {
    if (studyUID && content) {
      const localStorageKey = `editorContent_${studyUID}`;
      localStorage.setItem(localStorageKey, content);
    }
  }

  loadFromLocalStorage(studyUID: string): string | null {
    if (!studyUID) {
      return null;
    }
    const localStorageKey = `editorContent_${studyUID}`;
    return localStorage.getItem(localStorageKey);
  }

  clearLocalStorage(studyUID: string): void {
    if (studyUID) {
      const localStorageKey = `editorContent_${studyUID}`;
      localStorage.removeItem(localStorageKey);
      localStorage.removeItem(`clinicalInfo_${studyUID}`);
    }
  }

  formatPatientName(name: any): string {
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

  extractPatientDetails(activeDisplaySet: any): PatientDetails {
    let patientDetails: PatientDetails = {
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
            this.formatPatientName(firstMetadata?.['00100010'] || firstMetadata?.PatientName) ||
            'Not Available',
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

    return patientDetails;
  }

  setEditedState(isEdited: boolean): void {
    localStorage.setItem('isEdited', JSON.stringify(isEdited));
    if (isEdited) {
      localStorage.setItem('hasUnsavedChanges', 'true');
    } else {
      localStorage.removeItem('hasUnsavedChanges');
    }
  }

  setSavedState(isSaved: boolean): void {
    localStorage.setItem('isSaved', JSON.stringify(isSaved));
  }

  getEditedState(): boolean {
    const saved = localStorage.getItem('isEdited');
    return saved ? JSON.parse(saved) : false;
  }

  getSavedState(): boolean {
    const saved = localStorage.getItem('isSaved');
    return saved ? JSON.parse(saved) : false;
  }

  hasUnsavedChanges(): boolean {
    return localStorage.getItem('hasUnsavedChanges') === 'true';
  }

  cleanup(): void {
    this.clinicalInfoCache.clear();
    this.templates = [];
  }
}

export const reportService = new ReportService();

export { ReportService };
