import React from 'react';
import { Types, DicomMetadataStore } from '@ohif/core';
import { reportService } from '../../cornerstone/src/panels/ReportService';
import { annotation as csToolsAnnotation } from '@cornerstonejs/tools';

import { ContextMenuController } from './CustomizableContextMenu';
import DicomTagBrowser from './DicomTagBrowser/DicomTagBrowser';
import reuseCachedLayouts from './utils/reuseCachedLayouts';
import findViewportsByPosition, {
  findOrCreateViewport as layoutFindOrCreate,
} from './findViewportsByPosition';

import { ContextMenuProps } from './CustomizableContextMenu/types';
import { NavigateHistory } from './types/commandModuleTypes';
import { history } from '@ohif/app';
import { useViewportGridStore } from './stores/useViewportGridStore';
import { useDisplaySetSelectorStore } from './stores/useDisplaySetSelectorStore';
import { useHangingProtocolStageIndexStore } from './stores/useHangingProtocolStageIndexStore';
import { useToggleHangingProtocolStore } from './stores/useToggleHangingProtocolStore';
import { useViewportsByPositionStore } from './stores/useViewportsByPositionStore';
import { useToggleOneUpViewportGridStore } from './stores/useToggleOneUpViewportGridStore';
import requestDisplaySetCreationForStudy from './Panels/requestDisplaySetCreationForStudy';

export type HangingProtocolParams = {
  protocolId?: string;
  stageIndex?: number;
  activeStudyUID?: string;
  stageId?: string;
  reset?: false;
};

export type UpdateViewportDisplaySetParams = {
  direction: number;
  excludeNonImageModalities?: boolean;
};

const commandsModule = ({
  servicesManager,
  commandsManager,
  extensionManager,
}: Types.Extensions.ExtensionParams): Types.Extensions.CommandsModule => {
  const {
    customizationService,
    measurementService,
    hangingProtocolService,
    uiNotificationService,
    viewportGridService,
    displaySetService,
    multiMonitorService,
    studyPrefetcherService,
  } = servicesManager.services;

  // Define a context menu controller for use with any context menus
  const contextMenuController = new ContextMenuController(servicesManager, commandsManager);

  const actions = {
    /**
     * Runs a command in multi-monitor mode.  No-op if not multi-monitor.
     */
    multimonitor: async options => {
      const { screenDelta, StudyInstanceUID, commands, hashParams } = options;
      if (multiMonitorService.numberOfScreens < 2) {
        return options.fallback?.(options);
      }

      const newWindow = await multiMonitorService.launchWindow(
        StudyInstanceUID,
        screenDelta,
        hashParams
      );

      // Only run commands if we successfully got a window with a commands manager
      if (newWindow && commands) {
        // Todo: fix this properly, but it takes time for the new window to load
        // and then the commandsManager is available for it
        setTimeout(() => {
          multiMonitorService.run(screenDelta, commands, options);
        }, 1000);
      }
    },

    /**
     * Ensures that the specified study is available for display
     * Then, if commands is specified, runs the given commands list/instance
     */
    loadStudy: async options => {
      const { StudyInstanceUID } = options;
      const displaySets = displaySetService.getActiveDisplaySets();
      console.log('displaySets:', displaySets);
      const isActive = displaySets.find(ds => ds.StudyInstanceUID === StudyInstanceUID);
      if (isActive) {
        return;
      }
      const [dataSource] = extensionManager.getActiveDataSource();
      await requestDisplaySetCreationForStudy(dataSource, displaySetService, StudyInstanceUID);

      const study = DicomMetadataStore.getStudy(StudyInstanceUID);
      // console.log('🔍 DicomMetadataStore.getStudy result:', study);
      // console.log('Study modalities:', study?.modalities);
      // console.log('Study series count:', study?.series?.length);
      // if (study?.series) {
      //   console.log(
      //     'Study series modalities:',
      //     study.series.map(s => s.Modality)
      //   );
      // }
      hangingProtocolService.addStudy(study);
    },

    /**
     * Show the context menu.
     * @param options.menuId defines the menu name to lookup, from customizationService
     * @param options.defaultMenu contains the default menu set to use
     * @param options.element is the element to show the menu within
     * @param options.event is the event that caused the context menu
     * @param options.selectorProps is the set of selection properties to use
     */
    showContextMenu: (options: ContextMenuProps) => {
      const {
        menuCustomizationId,
        element,
        event,
        selectorProps,
        defaultPointsPosition = [],
      } = options;

      const optionsToUse = { ...options };

      if (menuCustomizationId) {
        Object.assign(optionsToUse, customizationService.getCustomization(menuCustomizationId));
      }

      // TODO - make the selectorProps richer by including the study metadata and display set.
      const { protocol, stage } = hangingProtocolService.getActiveProtocol();
      optionsToUse.selectorProps = {
        event,
        protocol,
        stage,
        ...selectorProps,
      };

      contextMenuController.showContextMenu(optionsToUse, element, defaultPointsPosition);
    },

    /** Close a context menu currently displayed */
    closeContextMenu: () => {
      contextMenuController.closeContextMenu();
    },

    displayNotification: ({ text, title, type }) => {
      uiNotificationService.show({
        title: title,
        message: text,
        type: type,
      });
    },
    clearMeasurements: () => {
      measurementService.clearMeasurements();
    },

    /**
     * Downloads the current study as a ZIP file
     */
    downloadStudy: async () => {
      try {
        console.log('=== DOWNLOAD STUDY FUNCTION CALLED ===');
        // Get the current study UID from hanging protocol service
        const state = hangingProtocolService.getState();
        const activeStudyUID = state?.activeStudyUID;

        if (!activeStudyUID) {
          uiNotificationService.show({
            title: 'Download Failed',
            message: 'No study loaded. Please load a study first.',
            type: 'error',
          });
          return;
        }

        const studyUrl = `http://102.67.142.34:8084/dcm4chee-arc/aets/RADSHARE/rs/studies/1.2.410.200059.11.1.100.20250813183017910.6281?accept=application/zip`;
        // const studyUrl = `https://hcis.frisdns.com/dcm4chee-arc/aets/RADSHARE/rs/studies/${activeStudyUID}?accept=application/zip`;

        console.log('Starting direct download...');
        console.log('Study UID:', activeStudyUID);
        console.log('Download URL:', studyUrl);

        // Download directly from DICOM server
        const response = await fetch(studyUrl, {
          method: 'GET',
          headers: {
            Accept: 'application/zip',
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            uiNotificationService.show({
              title: 'Download Failed',
              message: 'No images found for this study',
              type: 'error',
            });
          } else {
            uiNotificationService.show({
              title: 'Download Failed',
              message: response.statusText || 'Failed to download',
              type: 'error',
            });
          }
          return;
        }

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = `study-${activeStudyUID}.zip`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        uiNotificationService.show({
          title: 'Download Successful',
          message: `Study ${activeStudyUID} downloaded successfully!`,
          type: 'success',
        });
      } catch (error) {
        console.error('Error downloading study:', error);
        uiNotificationService.show({
          title: 'Download Failed',
          message: 'Network error or CORS issue. Please check your connection.',
          type: 'error',
        });
      }
    },

    /**
     * Downloads the current viewport as a JPG image
     */
    downloadViewportAsImage: async () => {
      try {
        console.log('=== DOWNLOAD VIEWPORT IMAGE FUNCTION CALLED ===');
        const { viewportGridService, cornerstoneViewportService } = servicesManager.services;
        const { activeViewportId } = viewportGridService.getState();

        if (!activeViewportId) {
          uiNotificationService.show({
            title: 'Download Failed',
            message: 'No active viewport found. Please select a viewport first.',
            type: 'error',
          });
          return;
        }

        // Get the cornerstone viewport from the service
        const viewport = cornerstoneViewportService.getCornerstoneViewport(activeViewportId);
        if (!viewport) {
          uiNotificationService.show({
            title: 'Download Failed',
            message: 'Viewport not available. Please ensure an image is loaded.',
            type: 'error',
          });
          return;
        }

        // Determine patient name from active display set (same logic as PanelReport)
        let patientName = 'Not Available';
        try {
          const { viewports } = viewportGridService.getState();
          const activeViewportSpecificData = viewports.get(activeViewportId);
          const displaySetInstanceUID = activeViewportSpecificData?.displaySetInstanceUIDs?.[0];

          const displaySets = displaySetService.activeDisplaySets;
          const activeDisplaySet = displaySets?.find(
            ds => ds.displaySetInstanceUID === displaySetInstanceUID
          );

          const patientDetails = reportService.extractPatientDetails(activeDisplaySet);
          const extractedName = patientDetails?.patientName || '';

          // Sanitize for filename: preserve original casing, only strip OS-invalid characters
          patientName = extractedName.replace(/[\\/:*?"<>|]/g, '').trim() || 'Not Available';
        } catch (error) {
          console.warn('Could not derive patient name from active display set:', error);
          patientName = 'Not Available';
        }

        // Get the canvas from the viewport
        const canvas = viewport.getCanvas();
        if (!canvas) {
          uiNotificationService.show({
            title: 'Download Failed',
            message: 'No canvas found in viewport. Please ensure an image is loaded.',
            type: 'error',
          });
          return;
        }

        // Convert canvas to blob as JPG
        const blob = await new Promise<Blob | null>(resolve => {
          canvas.toBlob(resolve, 'image/jpeg', 0.9);
        });

        if (!blob) {
          uiNotificationService.show({
            title: 'Download Failed',
            message: 'Failed to generate image blob.',
            type: 'error',
          });
          return;
        }

        // Create download link
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;

        // Filename should be only the patient name (no timestamp)
        const filename = `${patientName}.jpg`;
        a.download = filename;
        a.setAttribute('download', filename);
        console.log('Download filename:', filename);
        console.log('Anchor download attr before click:', a.getAttribute('download'));

        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        uiNotificationService.show({
          title: 'Download Successful',
          message: 'Viewport image downloaded successfully!',
          type: 'success',
        });
      } catch (error) {
        console.error('Error downloading viewport image:', error);
        uiNotificationService.show({
          title: 'Download Failed',
          message: 'Failed to download viewport image. Please try again.',
          type: 'error',
        });
      }
    },

    showPopup: async () => {
      try {
        console.log('🎯 showPopup command called!');

        // First, let's test with a simple notification
        uiNotificationService.show({
          title: 'Dicom Print',
          message: 'Please select appropriate options.',
          type: 'success',
        });

        const { uiModalService } = servicesManager.services;
        console.log('🔍 uiModalService:', uiModalService);

        // helper to open a second lightweight custom modal (no overlay)
        const refreshPrinters = () => {
          try {
            const key = 'dicomPrinters';
            // Prefer backend list; fallback to localStorage
            const applyList = (list: any[]) => {
              const sel = document.getElementById(
                'print-printer-select'
              ) as HTMLSelectElement | null;
              if (!sel) {
                return;
              }
              // Clear all options to avoid leading blank placeholder
              sel.innerHTML = '';
              if (Array.isArray(list)) {
                list.forEach((p: any) => {
                  const opt = document.createElement('option');
                  const value = `${p.ae}@${p.host}:${p.port}`;
                  opt.value = value;
                  opt.textContent = p.desc || p.ae || value;
                  (opt as any).dataset.ae = p.ae;
                  (opt as any).dataset.host = p.host;
                  (opt as any).dataset.port = p.port;
                  sel.appendChild(opt);
                });
              }
              // continue with applying selection below
              return sel;
            };

            const selFromBackend = async () => {
              const backendBase = (window as any).RADSHARE_BACKEND || 'http://localhost:8082';
              try {
                const r = await fetch(`${backendBase}/api/printers`);
                if (r.ok) {
                  const backendList = await r.json();
                  return applyList(backendList);
                }
              } catch {}
              const localList = JSON.parse(localStorage.getItem(key) || '[]');
              return applyList(localList);
            };

            // helpers for applying saved values
            const normalize = (id: string, v: any) => {
              if (!v) {
                return v;
              }
              const s = String(v);
              if (id === 'print-priority') {
                if (s.toUpperCase() === 'MEDIUM') {
                  return 'MED';
                }
              }
              if (id === 'print-orientation') {
                return s.toUpperCase();
              }
              if (id === 'print-smoothing-type') {
                const up = s.toUpperCase();
                if (up === 'MEDIUM' || up === 'SHARP' || up === 'SMOOTH') {
                  return up;
                }
              }
              return s;
            };

            const applySaved = (ae: string, host: string, port: string) => {
              const run = async () => {
                try {
                  // Prefer backend settings; fallback to localStorage
                  let list: any[] = [];
                  try {
                    const backendBase = (window as any).RADSHARE_BACKEND || 'http://localhost:8082';
                    const r = await fetch(`${backendBase}/api/printers`);
                    if (r.ok) {
                      list = await r.json();
                    }
                  } catch {}
                  if (!Array.isArray(list) || list.length === 0) {
                    list = JSON.parse(localStorage.getItem(key) || '[]');
                  }
                  const found = Array.isArray(list)
                    ? list.find((p: any) => p.ae === ae && p.host === host && p.port === port)
                    : undefined;
                  const setV = (id: string, v: any) => {
                    v = normalize(id, v);
                    const el = document.getElementById(id) as
                      | HTMLSelectElement
                      | HTMLInputElement
                      | null;
                    if (!el || v === undefined || v === null || v === '') {
                      return;
                    }
                    if ((el as HTMLSelectElement).tagName === 'SELECT') {
                      const sel = el as HTMLSelectElement;
                      if (!Array.from(sel.options).some(o => o.value === String(v))) {
                        const o = document.createElement('option');
                        o.value = String(v);
                        o.text = String(v);
                        sel.appendChild(o);
                      }
                      sel.value = String(v);
                      sel.dispatchEvent(new Event('change', { bubbles: true }));
                    } else {
                      (el as HTMLInputElement).value = String(v);
                      (el as HTMLInputElement).dispatchEvent(new Event('input', { bubbles: true }));
                      (el as HTMLInputElement).dispatchEvent(
                        new Event('change', { bubbles: true })
                      );
                    }
                  };
                  const setC = (id: string, v: boolean) => {
                    const el = document.getElementById(id) as HTMLInputElement | null;
                    if (el == null) {
                      return;
                    }
                    el.checked = !!v;
                    el.dispatchEvent(new Event('change', { bubbles: true }));
                  };
                  if (found?.settings) {
                    const s = found.settings;
                    setV('print-copies-input', s.copies);
                    setV('print-medium-type', s.mediumType);
                    setV('print-destination', s.destination);
                    setV('print-orientation', s.orientation);
                    setV('print-display-format', s.displayFormat);
                    setV('print-smoothing-type', s.smoothingType);
                    setV('print-trim', s.trim);
                    setV('print-priority', s.priority);
                    setV('print-film-size', s.filmSize);
                    setV('print-magnification', s.magnification);
                    setV('print-border-density', s.borderDensity);
                    setV('print-empty-density', s.emptyImageDensity);
                    setV('print-dpi', s.dpi);
                    setC('print-color', s.printColor);
                    setC('print-annot', s.printAnnotations);
                    setC('print-selected-only', s.printSelectedOnly);
                  }
                } catch {}
              };
              if (typeof requestAnimationFrame !== 'undefined') {
                requestAnimationFrame(() => requestAnimationFrame(() => void run()));
              } else {
                setTimeout(() => void run(), 0);
              }
            };

            // Load printers once, then apply and wire events
            (async () => {
              const selResolved = (await selFromBackend()) as HTMLSelectElement | null;
              if (!selResolved) {
                return;
              }
              const sel = selResolved;
              // auto-select first saved printer and sync fields
              if (sel.options.length > 0 && !sel.value) {
                sel.selectedIndex = 0;
              }
              const s = sel.selectedOptions?.[0];
              if (s) {
                const ae = s.dataset.ae || '';
                const host = s.dataset.host || '';
                const port = s.dataset.port || '';
                const calling = document.getElementById(
                  'print-calling-node'
                ) as HTMLSelectElement | null;
                if (calling) {
                  calling.value = 'Default';
                  calling.dispatchEvent(new Event('change', { bubbles: true }));
                }
                const info = document.getElementById('print-printer-info');
                if (info) {
                  info.textContent = ae ? `AE: ${ae}  Host: ${host}  Port: ${port}` : '';
                }
                applySaved(ae, host, port);
              }
              sel.onchange = () => {
                const s = sel.selectedOptions[0];
                const ae = s?.dataset?.ae || '';
                const host = s?.dataset?.host || '';
                const port = s?.dataset?.port || '';
                const calling = document.getElementById(
                  'print-calling-node'
                ) as HTMLSelectElement | null;
                if (calling) {
                  calling.value = 'Default';
                  calling.dispatchEvent(new Event('change', { bubbles: true }));
                }
                const info = document.getElementById('print-printer-info');
                if (info) {
                  info.textContent = ae ? `AE: ${ae}  Host: ${host}  Port: ${port}` : '';
                }
                applySaved(ae, host, port);
              };
            })();
          } catch (e) {
            console.warn('refreshPrinters error', e);
          }
        };

        const openDicomNodeModal = () => {
          const NodeContent = () => {
            return React.createElement(
              'div',
              {
                style: {
                  padding: '15px',
                  minWidth: '560px',
                  backgroundColor: '#2a2a2a',
                  color: '#ffffff',
                  borderRadius: '6px',
                  fontFamily: 'Arial, sans-serif',
                  fontSize: '13px',
                  boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
                  border: '1px solid #444',
                },
              },
              [
                // Title Bar
                React.createElement(
                  'div',
                  {
                    key: 'title-bar-node',
                    style: {
                      backgroundColor: '#1a1a1a',
                      padding: '12px 16px',
                      margin: '-15px -15px 15px -15px',
                      borderRadius: '6px 6px 0 0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderBottom: '1px solid #444',
                    },
                  },
                  [
                    React.createElement(
                      'h2',
                      {
                        key: 'title-text-node',
                        style: {
                          margin: 0,
                          fontSize: '16px',
                          fontWeight: 'bold',
                          color: '#ffffff',
                        },
                      },
                      'DICOM Node'
                    ),
                    React.createElement(
                      'button',
                      {
                        key: 'close-btn-node',
                        onClick: () => {
                          if (window.currentDicomNodeModal) {
                            window.currentDicomNodeModal.element.removeEventListener(
                              'click',
                              window.currentDicomNodeModal.handleClickOutside
                            );
                            window.currentDicomNodeModal.root.unmount();
                            document.body.removeChild(window.currentDicomNodeModal.element);
                            window.currentDicomNodeModal = null;
                          }
                        },
                        style: {
                          background: 'none',
                          border: 'none',
                          color: '#ffffff',
                          fontSize: '18px',
                          cursor: 'pointer',
                          padding: '4px',
                          borderRadius: '3px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '24px',
                          height: '24px',
                        },
                      },
                      '×'
                    ),
                  ]
                ),

                // Top form inputs
                React.createElement(
                  'div',
                  {
                    key: 'node-top-fields',
                    style: {
                      display: 'grid',
                      gridTemplateColumns: '120px 1fr',
                      rowGap: '10px',
                      columnGap: '10px',
                      marginBottom: '14px',
                    },
                  },
                  [
                    React.createElement(
                      'label',
                      { key: 'lbl-desc', style: { alignSelf: 'center' } },
                      'Description:'
                    ),
                    React.createElement('input', {
                      key: 'inp-desc',
                      id: 'node-desc-input',
                      style: {
                        backgroundColor: '#1f1f1f',
                        color: '#fff',
                        border: '1px solid #666',
                        borderRadius: '3px',
                        padding: '6px',
                      },
                    }),

                    React.createElement(
                      'label',
                      { key: 'lbl-ae', style: { alignSelf: 'center' } },
                      'AE title:'
                    ),
                    React.createElement('input', {
                      key: 'inp-ae',
                      id: 'node-ae-input',
                      style: {
                        backgroundColor: '#1f1f1f',
                        color: '#fff',
                        border: '1px solid #666',
                        borderRadius: '3px',
                        padding: '6px',
                      },
                    }),

                    React.createElement(
                      'label',
                      { key: 'lbl-host', style: { alignSelf: 'center' } },
                      'Hostname:'
                    ),
                    React.createElement('input', {
                      key: 'inp-host',
                      id: 'node-host-input',
                      style: {
                        backgroundColor: '#1f1f1f',
                        color: '#fff',
                        border: '1px solid #666',
                        borderRadius: '3px',
                        padding: '6px',
                      },
                    }),

                    React.createElement(
                      'label',
                      { key: 'lbl-port', style: { alignSelf: 'center' } },
                      'Port:'
                    ),
                    React.createElement('input', {
                      key: 'inp-port',
                      id: 'node-port-input',
                      type: 'number',
                      style: {
                        width: '120px',
                        backgroundColor: '#1f1f1f',
                        color: '#fff',
                        border: '1px solid #666',
                        borderRadius: '3px',
                        padding: '6px',
                      },
                    }),
                  ]
                ),

                // Print Options header
                React.createElement(
                  'div',
                  {
                    key: 'node-print-header',
                    style: { fontWeight: 'bold', margin: '6px 0 10px 0' },
                  },
                  'Print Options'
                ),

                // Reuse a compact grid with the same dropdowns as main dialog
                React.createElement(
                  'div',
                  {
                    key: 'node-print-grid',
                    style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' },
                  },
                  [
                    // LEFT COLUMN
                    React.createElement(
                      'div',
                      { key: 'node-left', style: { display: 'grid', rowGap: '10px' } },
                      [
                        // Medium Type
                        React.createElement(
                          'div',
                          {
                            key: 'node-medium',
                            style: { display: 'flex', flexDirection: 'column' },
                          },
                          [
                            React.createElement(
                              'label',
                              { key: 'l', style: { marginBottom: '4px' } },
                              'Medium Type:'
                            ),
                            React.createElement(
                              'select',
                              {
                                key: 's',
                                id: 'node-medium-type',
                                style: {
                                  padding: '4px',
                                  border: '1px solid #666',
                                  borderRadius: '3px',
                                  backgroundColor: '#444',
                                  color: '#fff',
                                },
                              },
                              [
                                React.createElement(
                                  'option',
                                  { key: 'm1', value: 'BLUE FILM' },
                                  'BLUE FILM'
                                ),
                                React.createElement(
                                  'option',
                                  { key: 'm2', value: 'CLEAR FILM' },
                                  'CLEAR FILM'
                                ),
                                React.createElement(
                                  'option',
                                  { key: 'm3', value: 'MAMMO CLEAR FILM' },
                                  'MAMMO CLEAR FILM'
                                ),
                                React.createElement(
                                  'option',
                                  { key: 'm4', value: 'MAMMO BLUE FILM' },
                                  'MAMMO BLUE FILM'
                                ),
                                React.createElement(
                                  'option',
                                  { key: 'm5', value: 'PAPER' },
                                  'PAPER'
                                ),
                              ]
                            ),
                          ]
                        ),

                        // Film Destination
                        React.createElement(
                          'div',
                          { key: 'node-dest', style: { display: 'flex', flexDirection: 'column' } },
                          [
                            React.createElement(
                              'label',
                              { key: 'l', style: { marginBottom: '4px' } },
                              'Film Destination:'
                            ),
                            React.createElement(
                              'select',
                              {
                                key: 's',
                                id: 'node-destination',
                                style: {
                                  padding: '4px',
                                  border: '1px solid #666',
                                  borderRadius: '3px',
                                  backgroundColor: '#444',
                                  color: '#fff',
                                },
                              },
                              [
                                React.createElement(
                                  'option',
                                  { key: 'fd1', value: 'MAGAZINE' },
                                  'MAGAZINE'
                                ),
                                React.createElement(
                                  'option',
                                  { key: 'fd2', value: 'PROCESSOR' },
                                  'PROCESSOR'
                                ),
                                React.createElement('option', { key: 'fd3', value: 'BIN' }, 'BIN'),
                              ]
                            ),
                            // Print in color directly under Film Destination
                            React.createElement(
                              'label',
                              {
                                key: 'node-color-inline',
                                style: {
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '8px',
                                  marginTop: '8px',
                                },
                              },
                              [
                                React.createElement('input', {
                                  key: 'i',
                                  id: 'node-color',
                                  type: 'checkbox',
                                }),
                                'Print in color',
                              ]
                            ),
                          ]
                        ),

                        // Film Orientation
                        React.createElement(
                          'div',
                          {
                            key: 'node-orient',
                            style: { display: 'flex', flexDirection: 'column' },
                          },
                          [
                            React.createElement(
                              'label',
                              { key: 'l', style: { marginBottom: '4px' } },
                              'Film Orientation:'
                            ),
                            React.createElement(
                              'select',
                              {
                                key: 's',
                                id: 'node-orientation',
                                style: {
                                  padding: '4px',
                                  border: '1px solid #666',
                                  borderRadius: '3px',
                                  backgroundColor: '#444',
                                  color: '#fff',
                                },
                              },
                              [
                                React.createElement(
                                  'option',
                                  { key: 'fo1', value: 'PORTRAIT' },
                                  'PORTRAIT'
                                ),
                                React.createElement(
                                  'option',
                                  { key: 'fo2', value: 'LANDSCAPE' },
                                  'LANDSCAPE'
                                ),
                              ]
                            ),
                          ]
                        ),

                        // Display Format
                        React.createElement(
                          'div',
                          {
                            key: 'node-format',
                            style: { display: 'flex', flexDirection: 'column' },
                          },
                          [
                            React.createElement(
                              'label',
                              { key: 'l', style: { marginBottom: '4px' } },
                              'Display Format:'
                            ),
                            React.createElement(
                              'select',
                              {
                                key: 's',
                                id: 'node-display-format',
                                style: {
                                  padding: '4px',
                                  border: '1px solid #666',
                                  borderRadius: '3px',
                                  backgroundColor: '#444',
                                  color: '#fff',
                                },
                              },
                              [
                                React.createElement(
                                  'option',
                                  { key: 'df1', value: 'STANDARD\\1,1' },
                                  'STANDARD\\1,1'
                                ),
                              ]
                            ),
                          ]
                        ),

                        // Smoothing Type
                        React.createElement(
                          'div',
                          {
                            key: 'node-smooth',
                            style: { display: 'flex', flexDirection: 'column' },
                          },
                          [
                            React.createElement(
                              'label',
                              { key: 'l', style: { marginBottom: '4px' } },
                              'Smoothing Type:'
                            ),
                            React.createElement(
                              'select',
                              {
                                key: 's',
                                id: 'node-smoothing-type',
                                style: {
                                  padding: '4px',
                                  border: '1px solid #666',
                                  borderRadius: '3px',
                                  backgroundColor: '#444',
                                  color: '#fff',
                                },
                              },
                              [
                                React.createElement(
                                  'option',
                                  { key: 'st1', value: 'MEDIUM' },
                                  'MEDIUM'
                                ),
                                React.createElement(
                                  'option',
                                  { key: 'st2', value: 'SHARP' },
                                  'SHARP'
                                ),
                                React.createElement(
                                  'option',
                                  { key: 'st3', value: 'SMOOTH' },
                                  'SMOOTH'
                                ),
                              ]
                            ),
                          ]
                        ),

                        // Trim
                        React.createElement(
                          'div',
                          { key: 'node-trim', style: { display: 'flex', flexDirection: 'column' } },
                          [
                            React.createElement(
                              'label',
                              { key: 'l', style: { marginBottom: '4px' } },
                              'Trim:'
                            ),
                            React.createElement(
                              'select',
                              {
                                key: 's',
                                id: 'node-trim',
                                style: {
                                  padding: '4px',
                                  border: '1px solid #666',
                                  borderRadius: '3px',
                                  backgroundColor: '#444',
                                  color: '#fff',
                                },
                              },
                              [
                                React.createElement('option', { key: 't1', value: 'NO' }, 'NO'),
                                React.createElement('option', { key: 't2', value: 'YES' }, 'YES'),
                              ]
                            ),
                          ]
                        ),

                        // Checkboxes
                        React.createElement(
                          'div',
                          { key: 'node-checks', style: { display: 'grid', rowGap: '6px' } },
                          [
                            // (moved Print in color inline under Film Destination)
                            React.createElement(
                              'label',
                              {
                                key: 'c1',
                                style: { display: 'flex', alignItems: 'center', gap: '8px' },
                              },
                              [
                                React.createElement('input', {
                                  key: 'i',
                                  id: 'node-annot',
                                  type: 'checkbox',
                                  defaultChecked: true,
                                }),
                                'Print image with annotations',
                              ]
                            ),
                            React.createElement(
                              'label',
                              {
                                key: 'c2',
                                style: { display: 'flex', alignItems: 'center', gap: '8px' },
                              },
                              [
                                React.createElement('input', {
                                  key: 'i',
                                  id: 'node-selected-only',
                                  type: 'checkbox',
                                }),
                                'Print only the selected view',
                              ]
                            ),
                          ]
                        ),
                      ]
                    ),

                    // RIGHT COLUMN
                    React.createElement(
                      'div',
                      { key: 'node-right', style: { display: 'grid', rowGap: '10px' } },
                      [
                        // Priority
                        React.createElement(
                          'div',
                          {
                            key: 'node-priority',
                            style: { display: 'flex', flexDirection: 'column' },
                          },
                          [
                            React.createElement(
                              'label',
                              { key: 'l', style: { marginBottom: '4px' } },
                              'Priority:'
                            ),
                            React.createElement(
                              'select',
                              {
                                key: 's',
                                id: 'node-priority',
                                style: {
                                  padding: '4px',
                                  border: '1px solid #666',
                                  borderRadius: '3px',
                                  backgroundColor: '#444',
                                  color: '#fff',
                                },
                              },
                              [
                                React.createElement('option', { key: 'p1', value: 'LOW' }, 'LOW'),
                                React.createElement('option', { key: 'p2', value: 'MED' }, 'MED'),
                                React.createElement('option', { key: 'p3', value: 'HIGH' }, 'HIGH'),
                              ]
                            ),
                          ]
                        ),

                        // Copies
                        React.createElement(
                          'div',
                          {
                            key: 'node-copies',
                            style: { display: 'flex', alignItems: 'center', gap: '10px' },
                          },
                          [
                            React.createElement('label', { key: 'l' }, 'Copies:'),
                            React.createElement(
                              'div',
                              {
                                key: 'copies-wrap',
                                style: { display: 'flex', alignItems: 'center', gap: '6px' },
                              },
                              [
                                React.createElement('input', {
                                  key: 'inp',
                                  id: 'node-copies-input',
                                  type: 'number',
                                  defaultValue: 1,
                                  min: 1,
                                  step: 1,
                                  style: {
                                    width: '70px',
                                    padding: '4px',
                                    border: '1px solid #666',
                                    borderRadius: '3px',
                                    backgroundColor: '#444',
                                    color: '#fff',
                                  },
                                }),
                                React.createElement(
                                  'div',
                                  {
                                    key: 'stepper',
                                    style: { display: 'flex', flexDirection: 'column', gap: '2px' },
                                  },
                                  [
                                    React.createElement(
                                      'button',
                                      {
                                        key: 'up',
                                        onClick: () => {
                                          const el = document.getElementById(
                                            'node-copies-input'
                                          ) as HTMLInputElement;
                                          if (!el) {
                                            return;
                                          }
                                          const val = parseInt(el.value || '0', 10) || 0;
                                          el.value = String(val + 1);
                                        },
                                        style: {
                                          width: '16px',
                                          height: '12px',
                                          lineHeight: '10px',
                                          textAlign: 'center',
                                          backgroundColor: '#555',
                                          color: '#fff',
                                          border: '1px solid #666',
                                          borderRadius: '2px',
                                          cursor: 'pointer',
                                          padding: 0,
                                          fontSize: '10px',
                                        },
                                      },
                                      '▲'
                                    ),
                                    React.createElement(
                                      'button',
                                      {
                                        key: 'down',
                                        onClick: () => {
                                          const el = document.getElementById(
                                            'node-copies-input'
                                          ) as HTMLInputElement;
                                          if (!el) {
                                            return;
                                          }
                                          const val = parseInt(el.value || '0', 10) || 0;
                                          const next = Math.max(1, val - 1);
                                          el.value = String(next);
                                        },
                                        style: {
                                          width: '16px',
                                          height: '12px',
                                          lineHeight: '10px',
                                          textAlign: 'center',
                                          backgroundColor: '#555',
                                          color: '#fff',
                                          border: '1px solid #666',
                                          borderRadius: '2px',
                                          cursor: 'pointer',
                                          padding: 0,
                                          fontSize: '10px',
                                        },
                                      },
                                      '▼'
                                    ),
                                  ]
                                ),
                              ]
                            ),
                          ]
                        ),

                        // Film Size ID
                        React.createElement(
                          'div',
                          { key: 'node-size', style: { display: 'flex', flexDirection: 'column' } },
                          [
                            React.createElement(
                              'label',
                              { key: 'l', style: { marginBottom: '4px' } },
                              'Film Size ID:'
                            ),
                            React.createElement(
                              'select',
                              {
                                key: 's',
                                id: 'node-film-size',
                                style: {
                                  padding: '4px',
                                  border: '1px solid #666',
                                  borderRadius: '3px',
                                  backgroundColor: '#444',
                                  color: '#fff',
                                },
                              },
                              [
                                React.createElement(
                                  'option',
                                  { key: 'fs1', value: '8INX10IN' },
                                  '8INX10IN'
                                ),
                                React.createElement(
                                  'option',
                                  { key: 'fs2', value: '8_5INX11IN' },
                                  '8_5INX11IN'
                                ),
                                React.createElement(
                                  'option',
                                  { key: 'fs3', value: '10INX12IN' },
                                  '10INX12IN'
                                ),
                                React.createElement(
                                  'option',
                                  { key: 'fs4', value: '10INX14IN' },
                                  '10INX14IN'
                                ),
                                React.createElement(
                                  'option',
                                  { key: 'fs5', value: '11INX14IN' },
                                  '11INX14IN'
                                ),
                                React.createElement(
                                  'option',
                                  { key: 'fs6', value: '11INX17IN' },
                                  '11INX17IN'
                                ),
                                React.createElement(
                                  'option',
                                  { key: 'fs7', value: '14INX14IN' },
                                  '14INX14IN'
                                ),
                                React.createElement(
                                  'option',
                                  { key: 'fs8', value: '14INX17IN' },
                                  '14INX17IN'
                                ),
                                React.createElement(
                                  'option',
                                  { key: 'fs9', value: '24CMX24CM' },
                                  '24CMX24CM'
                                ),
                                React.createElement(
                                  'option',
                                  { key: 'fs10', value: '24CMX30CM' },
                                  '24CMX30CM'
                                ),
                                React.createElement('option', { key: 'fs11', value: 'A4' }, 'A4'),
                                React.createElement('option', { key: 'fs12', value: 'A3' }, 'A3'),
                              ]
                            ),
                          ]
                        ),

                        // Magnification Type
                        React.createElement(
                          'div',
                          { key: 'node-mag', style: { display: 'flex', flexDirection: 'column' } },
                          [
                            React.createElement(
                              'label',
                              { key: 'l', style: { marginBottom: '4px' } },
                              'Magnification Type:'
                            ),
                            React.createElement(
                              'select',
                              {
                                key: 's',
                                id: 'node-magnification',
                                style: {
                                  padding: '4px',
                                  border: '1px solid #666',
                                  borderRadius: '3px',
                                  backgroundColor: '#444',
                                  color: '#fff',
                                },
                              },
                              [
                                React.createElement(
                                  'option',
                                  { key: 'mg1', value: 'REPLICATE' },
                                  'REPLICATE'
                                ),
                                React.createElement(
                                  'option',
                                  { key: 'mg2', value: 'BILINEAR' },
                                  'BILINEAR'
                                ),
                                React.createElement(
                                  'option',
                                  { key: 'mg3', value: 'CUBIC' },
                                  'CUBIC'
                                ),
                              ]
                            ),
                          ]
                        ),

                        // Border Density
                        React.createElement(
                          'div',
                          {
                            key: 'node-border',
                            style: { display: 'flex', flexDirection: 'column' },
                          },
                          [
                            React.createElement(
                              'label',
                              { key: 'l', style: { marginBottom: '4px' } },
                              'Border Density:'
                            ),
                            React.createElement(
                              'select',
                              {
                                key: 's',
                                id: 'node-border-density',
                                style: {
                                  padding: '4px',
                                  border: '1px solid #666',
                                  borderRadius: '3px',
                                  backgroundColor: '#444',
                                  color: '#fff',
                                },
                              },
                              [
                                React.createElement(
                                  'option',
                                  { key: 'bd1', value: 'BLACK' },
                                  'BLACK'
                                ),
                                React.createElement(
                                  'option',
                                  { key: 'bd2', value: 'WHITE' },
                                  'WHITE'
                                ),
                              ]
                            ),
                          ]
                        ),

                        // Empty Image Density
                        React.createElement(
                          'div',
                          {
                            key: 'node-empty',
                            style: { display: 'flex', flexDirection: 'column' },
                          },
                          [
                            React.createElement(
                              'label',
                              { key: 'l', style: { marginBottom: '4px' } },
                              'Empty Image Density:'
                            ),
                            React.createElement(
                              'select',
                              {
                                key: 's',
                                id: 'node-empty-density',
                                style: {
                                  padding: '4px',
                                  border: '1px solid #666',
                                  borderRadius: '3px',
                                  backgroundColor: '#444',
                                  color: '#fff',
                                },
                              },
                              [
                                React.createElement(
                                  'option',
                                  { key: 'ed1', value: 'BLACK' },
                                  'BLACK'
                                ),
                                React.createElement(
                                  'option',
                                  { key: 'ed2', value: 'WHITE' },
                                  'WHITE'
                                ),
                              ]
                            ),
                          ]
                        ),

                        // DPI
                        React.createElement(
                          'div',
                          {
                            key: 'node-dpi',
                            style: { display: 'flex', alignItems: 'center', gap: '10px' },
                          },
                          [
                            React.createElement('label', { key: 'l' }, 'DPI:'),
                            React.createElement(
                              'select',
                              {
                                key: 's',
                                id: 'node-dpi',
                                style: {
                                  padding: '4px',
                                  border: '1px solid #666',
                                  borderRadius: '3px',
                                  backgroundColor: '#444',
                                  color: '#fff',
                                  width: '90px',
                                },
                              },
                              [
                                React.createElement('option', { key: 'd1', value: '100' }, '100'),
                                React.createElement('option', { key: 'd2', value: '150' }, '150'),
                                React.createElement('option', { key: 'd3', value: '200' }, '200'),
                                React.createElement('option', { key: 'd4', value: '250' }, '250'),
                                React.createElement('option', { key: 'd5', value: '300' }, '300'),
                              ]
                            ),
                          ]
                        ),
                      ]
                    ),
                  ]
                ),

                // Footer buttons
                React.createElement(
                  'div',
                  {
                    key: 'node-buttons',
                    style: {
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: '10px',
                      marginTop: '16px',
                    },
                  },
                  [
                    React.createElement(
                      'button',
                      {
                        key: 'ok',
                        onClick: () => {
                          // Save DICOM node to localStorage and refresh main printer list
                          const desc =
                            (document.getElementById('node-desc-input') as HTMLInputElement)
                              ?.value || '';
                          const ae =
                            (document.getElementById('node-ae-input') as HTMLInputElement)?.value ||
                            '';
                          const host =
                            (document.getElementById('node-host-input') as HTMLInputElement)
                              ?.value || '';
                          const port =
                            (document.getElementById('node-port-input') as HTMLInputElement)
                              ?.value || '';
                          if (!ae || !host || !port) {
                            uiNotificationService.show({
                              title: 'Missing fields',
                              message: 'Please enter AE title, Hostname and Port.',
                              type: 'error',
                            });
                            return;
                          }
                          try {
                            const key = 'dicomPrinters';
                            const list = JSON.parse(localStorage.getItem(key) || '[]');
                            // ensure uniqueness by AE/host/port
                            const exists =
                              Array.isArray(list) &&
                              list.find(p => p.ae === ae && p.host === host && p.port === port);
                            // gather settings
                            const getN = (id: string) =>
                              (
                                document.getElementById(id) as
                                  | HTMLSelectElement
                                  | HTMLInputElement
                                  | null
                              )?.value || '';
                            const getB = (id: string) =>
                              (document.getElementById(id) as HTMLInputElement | null)?.checked ||
                              false;
                            const settings = {
                              copies: getN('node-copies-input'),
                              mediumType: getN('node-medium-type'),
                              destination: getN('node-destination'),
                              orientation: getN('node-orientation'),
                              displayFormat: getN('node-display-format'),
                              smoothingType: getN('node-smoothing-type'),
                              trim: getN('node-trim'),
                              priority: getN('node-priority'),
                              filmSize: getN('node-film-size'),
                              magnification: getN('node-magnification'),
                              borderDensity: getN('node-border-density'),
                              emptyImageDensity: getN('node-empty-density'),
                              dpi: getN('node-dpi'),
                              printColor: getB('node-color'),
                              printAnnotations: getB('node-annot'),
                              printSelectedOnly: getB('node-selected-only'),
                            };
                            if (!exists) {
                              list.push({ desc, ae, host, port, settings });
                            } else {
                              // update description if provided
                              exists.desc = desc || exists.desc;
                              exists.settings = settings;
                            }
                            localStorage.setItem(key, JSON.stringify(list));
                            // persist to backend as well
                            try {
                              const backendBase =
                                (window as any).RADSHARE_BACKEND || 'http://localhost:8082';
                              fetch(`${backendBase}/api/printers`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ desc, ae, host, port, settings }),
                              });
                            } catch {}
                            // repopulate from storage (single source of truth)
                            refreshPrinters();
                            uiNotificationService.show({
                              title: 'Saved',
                              message: `Saved printer ${ae}`,
                              type: 'success',
                            });
                          } catch {}
                          if (window.currentDicomNodeModal) {
                            window.currentDicomNodeModal.element.removeEventListener(
                              'click',
                              window.currentDicomNodeModal.handleClickOutside
                            );
                            window.currentDicomNodeModal.root.unmount();
                            document.body.removeChild(window.currentDicomNodeModal.element);
                            window.currentDicomNodeModal = null;
                          }
                        },
                        style: {
                          padding: '6px 12px',
                          backgroundColor: '#007bff',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          fontSize: '12px',
                        },
                      },
                      'OK'
                    ),
                    React.createElement(
                      'button',
                      {
                        key: 'cancel',
                        onClick: () => {
                          if (window.currentDicomNodeModal) {
                            window.currentDicomNodeModal.element.removeEventListener(
                              'click',
                              window.currentDicomNodeModal.handleClickOutside
                            );
                            window.currentDicomNodeModal.root.unmount();
                            document.body.removeChild(window.currentDicomNodeModal.element);
                            window.currentDicomNodeModal = null;
                          }
                        },
                        style: {
                          padding: '6px 12px',
                          backgroundColor: '#6c757d',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '3px',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          fontSize: '12px',
                        },
                      },
                      'Cancel'
                    ),
                  ]
                ),
              ]
            );
          };

          const modalElement = document.createElement('div');
          modalElement.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            z-index: 10001; display: flex; justify-content: center; align-items: center; background: transparent;
          `;
          const contentElement = document.createElement('div');
          const handleClickOutside = e => {
            if (e.target === modalElement) {
              if (window.currentDicomNodeModal) {
                window.currentDicomNodeModal.root.unmount();
                document.body.removeChild(window.currentDicomNodeModal.element);
                window.currentDicomNodeModal = null;
              }
            }
          };
          modalElement.addEventListener('click', handleClickOutside);
          const { createRoot } = require('react-dom/client');
          const root = createRoot(contentElement);
          root.render(React.createElement(NodeContent));
          modalElement.appendChild(contentElement);
          document.body.appendChild(modalElement);
          window.currentDicomNodeModal = { element: modalElement, root, handleClickOutside };
        };

        // Create DICOM Print dialog modal
        const PopupContent = () => {
          return React.createElement(
            'div',
            {
              style: {
                padding: '15px',
                minWidth: '480px',
                maxWidth: '520px',
                backgroundColor: '#2a2a2a',
                color: '#ffffff',
                borderRadius: '6px',
                fontFamily: 'Arial, sans-serif',
                fontSize: '13px',
                boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
                border: '1px solid #444',
              },
            },
            [
              // Custom Title Bar
              React.createElement(
                'div',
                {
                  key: 'title-bar',
                  style: {
                    backgroundColor: '#1a1a1a',
                    padding: '12px 16px',
                    margin: '-15px -15px 15px -15px',
                    borderRadius: '6px 6px 0 0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderBottom: '1px solid #444',
                  },
                },
                [
                  React.createElement(
                    'h2',
                    {
                      key: 'title-text',
                      style: {
                        margin: 0,
                        fontSize: '16px',
                        fontWeight: 'bold',
                        color: '#ffffff',
                      },
                    },
                    'DICOM Print'
                  ),
                  React.createElement(
                    'button',
                    {
                      key: 'close-btn',
                      onClick: () => {
                        // Clean up our custom modal
                        if (window.currentDicomModal) {
                          window.currentDicomModal.element.removeEventListener(
                            'click',
                            window.currentDicomModal.handleClickOutside
                          );
                          window.currentDicomModal.root.unmount();
                          document.body.removeChild(window.currentDicomModal.element);
                          window.currentDicomModal = null;
                        }
                      },
                      style: {
                        background: 'none',
                        border: 'none',
                        color: '#ffffff',
                        fontSize: '18px',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '3px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '24px',
                        height: '24px',
                      },
                    },
                    '×'
                  ),
                ]
              ),

              // DICOM Printer Section
              React.createElement(
                'div',
                {
                  key: 'printer-section',
                  style: {
                    marginBottom: '12px',
                    marginTop: '8px',
                  },
                },
                [
                  React.createElement(
                    'h3',
                    {
                      key: 'printer-title',
                      style: {
                        margin: '0 0 8px 0',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        color: '#ffffff',
                      },
                    },
                    'DICOM Printer'
                  ),
                  React.createElement(
                    'div',
                    {
                      key: 'printer-controls',
                      style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        marginBottom: '10px',
                      },
                    },
                    [
                      React.createElement(
                        'label',
                        {
                          key: 'printer-label',
                          style: { fontWeight: 'bold', color: '#ffffff' },
                        },
                        'Printer:'
                      ),
                      React.createElement(
                        'select',
                        {
                          key: 'printer-select',
                          id: 'print-printer-select',
                          style: {
                            flex: 1,
                            padding: '4px',
                            border: '2px solid #ffeb3b',
                            borderRadius: '3px',
                            backgroundColor: '#fffacd',
                            color: '#000000',
                          },
                        },
                        React.createElement('option', { value: '' }, '')
                      ),
                      React.createElement(
                        'button',
                        {
                          key: 'add-btn',
                          onClick: () => openDicomNodeModal(),
                          style: {
                            padding: '4px 8px',
                            backgroundColor: '#444',
                            color: '#ffffff',
                            border: '1px solid #666',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          },
                        },
                        'Add'
                      ),
                      React.createElement(
                        'button',
                        {
                          key: 'edit-btn',
                          style: {
                            padding: '4px 8px',
                            backgroundColor: '#444',
                            color: '#ffffff',
                            border: '1px solid #666',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          },
                        },
                        'Edit'
                      ),
                      React.createElement(
                        'button',
                        {
                          key: 'delete-btn',
                          style: {
                            padding: '4px 8px',
                            backgroundColor: '#444',
                            color: '#ffffff',
                            border: '1px solid #666',
                            borderRadius: '3px',
                            cursor: 'pointer',
                            fontSize: '12px',
                          },
                        },
                        'Delete'
                      ),
                    ]
                  ),
                  // printer info line (AE/Host/Port)
                  React.createElement(
                    'div',
                    {
                      key: 'printer-info',
                      id: 'print-printer-info',
                      style: { color: '#c7c7c7', fontSize: '12px', marginBottom: '8px' },
                    },
                    ''
                  ),
                ]
              ),

              // Print Options Section
              React.createElement(
                'div',
                {
                  key: 'options-section',
                  style: {
                    marginBottom: '12px',
                  },
                },
                [
                  React.createElement(
                    'h3',
                    {
                      key: 'options-title',
                      style: {
                        margin: '0 0 10px 0',
                        fontSize: '13px',
                        fontWeight: 'bold',
                        color: '#ffffff',
                      },
                    },
                    'Print Options'
                  ),

                  // First row of options
                  React.createElement(
                    'div',
                    {
                      key: 'options-row1',
                      style: {
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '12px',
                        marginBottom: '8px',
                      },
                    },
                    [
                      React.createElement(
                        'div',
                        {
                          key: 'medium-type',
                          style: { display: 'flex', flexDirection: 'column' },
                        },
                        [
                          React.createElement(
                            'label',
                            {
                              key: 'medium-label',
                              style: {
                                fontWeight: 'bold',
                                marginBottom: '4px',
                                color: '#ffffff',
                                fontSize: '12px',
                              },
                            },
                            'Medium Type:'
                          ),
                          React.createElement(
                            'select',
                            {
                              key: 'medium-select',
                              id: 'print-medium-type',
                              style: {
                                padding: '4px',
                                border: '1px solid #666',
                                borderRadius: '3px',
                                backgroundColor: '#444',
                                color: '#ffffff',
                                fontSize: '12px',
                              },
                            },
                            React.createElement(
                              'option',
                              { value: 'BLUE FILM', selected: true },
                              'BLUE FILM'
                            ),
                            React.createElement('option', { value: 'CLEAR FILM' }, 'CLEAR FILM'),
                            React.createElement(
                              'option',
                              { value: 'MAMMO CLEAR FILM' },
                              'MAMMO CLEAR FILM'
                            ),
                            React.createElement(
                              'option',
                              { value: 'MAMMO BLUE FILM' },
                              'MAMMO BLUE FILM'
                            ),
                            React.createElement('option', { value: 'PAPER' }, 'PAPER')
                          ),
                        ]
                      ),
                      React.createElement(
                        'div',
                        {
                          key: 'film-destination',
                          style: { display: 'flex', flexDirection: 'column' },
                        },
                        [
                          React.createElement(
                            'label',
                            {
                              key: 'destination-label',
                              style: {
                                fontWeight: 'bold',
                                marginBottom: '4px',
                                color: '#ffffff',
                                fontSize: '12px',
                              },
                            },
                            'Film Destination:'
                          ),
                          React.createElement(
                            'select',
                            {
                              key: 'destination-select',
                              id: 'print-destination',
                              style: {
                                padding: '4px',
                                border: '1px solid #666',
                                borderRadius: '3px',
                                backgroundColor: '#444',
                                color: '#ffffff',
                                fontSize: '12px',
                              },
                            },
                            React.createElement(
                              'option',
                              { value: 'MAGAZINE', selected: true },
                              'MAGAZINE'
                            ),
                            React.createElement('option', { value: 'PROCESSOR' }, 'PROCESSOR')
                          ),
                        ]
                      ),
                    ]
                  ),

                  // Checkbox row
                  React.createElement(
                    'div',
                    {
                      key: 'checkbox-row',
                      style: {
                        display: 'flex',
                        alignItems: 'center',
                        marginBottom: '10px',
                      },
                    },
                    [
                      React.createElement('input', {
                        key: 'color-checkbox',
                        id: 'print-color',
                        type: 'checkbox',
                        style: { marginRight: '8px' },
                      }),
                      React.createElement(
                        'label',
                        {
                          key: 'color-label',
                          style: { fontWeight: 'bold', color: '#ffffff', fontSize: '12px' },
                        },
                        'Print in color'
                      ),
                    ]
                  ),

                  // More options in grid
                  React.createElement(
                    'div',
                    {
                      key: 'options-grid',
                      style: {
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '12px',
                        marginBottom: '8px',
                      },
                    },
                    [
                      // Film Orientation
                      React.createElement(
                        'div',
                        {
                          key: 'orientation',
                          style: { display: 'flex', flexDirection: 'column' },
                        },
                        [
                          React.createElement(
                            'label',
                            {
                              key: 'orientation-label',
                              style: {
                                fontWeight: 'bold',
                                marginBottom: '4px',
                                color: '#ffffff',
                                fontSize: '12px',
                              },
                            },
                            'Film Orientation:'
                          ),
                          React.createElement(
                            'select',
                            {
                              key: 'orientation-select',
                              id: 'print-orientation',
                              style: {
                                padding: '4px',
                                border: '1px solid #666',
                                borderRadius: '3px',
                                backgroundColor: '#444',
                                color: '#ffffff',
                                fontSize: '12px',
                              },
                            },
                            React.createElement(
                              'option',
                              { value: 'PORTRAIT', selected: true },
                              'PORTRAIT'
                            ),
                            React.createElement('option', { value: 'LANDSCAPE' }, 'LANDSCAPE')
                          ),
                        ]
                      ),
                      // Display Format
                      React.createElement(
                        'div',
                        {
                          key: 'display-format',
                          style: { display: 'flex', flexDirection: 'column' },
                        },
                        [
                          React.createElement(
                            'label',
                            {
                              key: 'format-label',
                              style: {
                                fontWeight: 'bold',
                                marginBottom: '4px',
                                color: '#ffffff',
                                fontSize: '12px',
                              },
                            },
                            'Display Format:'
                          ),
                          React.createElement(
                            'select',
                            {
                              key: 'format-select',
                              id: 'print-display-format',
                              style: {
                                padding: '4px',
                                border: '1px solid #666',
                                borderRadius: '3px',
                                backgroundColor: '#444',
                                color: '#ffffff',
                                fontSize: '12px',
                              },
                            },
                            React.createElement(
                              'option',
                              { value: 'STANDARD\\1,1', selected: true },
                              'STANDARD\\1,1'
                            )
                          ),
                        ]
                      ),
                      // Smoothing Type
                      React.createElement(
                        'div',
                        {
                          key: 'smoothing',
                          style: { display: 'flex', flexDirection: 'column' },
                        },
                        [
                          React.createElement(
                            'label',
                            {
                              key: 'smoothing-label',
                              style: {
                                fontWeight: 'bold',
                                marginBottom: '4px',
                                color: '#ffffff',
                                fontSize: '12px',
                              },
                            },
                            'Smoothing Type:'
                          ),
                          React.createElement(
                            'select',
                            {
                              key: 'smoothing-select',
                              id: 'print-smoothing-type',
                              style: {
                                padding: '4px',
                                border: '1px solid #666',
                                borderRadius: '3px',
                                backgroundColor: '#444',
                                color: '#ffffff',
                                fontSize: '12px',
                              },
                            },
                            React.createElement(
                              'option',
                              { value: 'MEDIUM', selected: true },
                              'MEDIUM'
                            ),
                            React.createElement('option', { value: 'SHARP' }, 'SHARP'),
                            React.createElement('option', { value: 'SMOOTH' }, 'SMOOTH')
                          ),
                        ]
                      ),
                      // Trim
                      React.createElement(
                        'div',
                        {
                          key: 'trim',
                          style: { display: 'flex', flexDirection: 'column' },
                        },
                        [
                          React.createElement(
                            'label',
                            {
                              key: 'trim-label',
                              style: {
                                fontWeight: 'bold',
                                marginBottom: '4px',
                                color: '#ffffff',
                                fontSize: '12px',
                              },
                            },
                            'Trim:'
                          ),
                          React.createElement(
                            'select',
                            {
                              key: 'trim-select',
                              id: 'print-trim',
                              style: {
                                padding: '4px',
                                border: '1px solid #666',
                                borderRadius: '3px',
                                backgroundColor: '#444',
                                color: '#ffffff',
                                fontSize: '12px',
                              },
                            },
                            React.createElement('option', { value: 'NO', selected: true }, 'NO'),
                            React.createElement('option', { value: 'YES' }, 'YES')
                          ),
                        ]
                      ),
                      // Priority
                      React.createElement(
                        'div',
                        {
                          key: 'priority',
                          style: { display: 'flex', flexDirection: 'column' },
                        },
                        [
                          React.createElement(
                            'label',
                            {
                              key: 'priority-label',
                              style: {
                                fontWeight: 'bold',
                                marginBottom: '4px',
                                color: '#ffffff',
                                fontSize: '12px',
                              },
                            },
                            'Priority:'
                          ),
                          React.createElement(
                            'select',
                            {
                              key: 'priority-select',
                              id: 'print-priority',
                              style: {
                                padding: '4px',
                                border: '1px solid #666',
                                borderRadius: '3px',
                                backgroundColor: '#444',
                                color: '#ffffff',
                                fontSize: '12px',
                              },
                            },
                            React.createElement('option', { value: 'LOW', selected: true }, 'LOW'),
                            React.createElement('option', { value: 'MED' }, 'MED'),
                            React.createElement('option', { value: 'HIGH' }, 'HIGH')
                          ),
                        ]
                      ),
                      // Copies
                      React.createElement(
                        'div',
                        {
                          key: 'copies',
                          style: { display: 'flex', flexDirection: 'column' },
                        },
                        [
                          React.createElement(
                            'label',
                            {
                              key: 'copies-label',
                              style: {
                                fontWeight: 'bold',
                                marginBottom: '4px',
                                color: '#ffffff',
                                fontSize: '12px',
                              },
                            },
                            'Copies:'
                          ),
                          React.createElement(
                            'div',
                            {
                              key: 'copies-wrap-print',
                              style: { display: 'flex', alignItems: 'center', gap: '6px' },
                            },
                            [
                              React.createElement('input', {
                                key: 'inp',
                                id: 'print-copies-input',
                                type: 'number',
                                defaultValue: '1',
                                min: 1,
                                step: 1,
                                style: {
                                  padding: '4px',
                                  border: '1px solid #666',
                                  borderRadius: '3px',
                                  backgroundColor: '#444',
                                  color: '#ffffff',
                                  fontSize: '12px',
                                  width: '60px',
                                },
                              }),
                              React.createElement(
                                'div',
                                {
                                  key: 'stepper',
                                  style: { display: 'flex', flexDirection: 'column', gap: '2px' },
                                },
                                [
                                  React.createElement(
                                    'button',
                                    {
                                      key: 'up',
                                      onClick: () => {
                                        const el = document.getElementById(
                                          'print-copies-input'
                                        ) as HTMLInputElement;
                                        if (!el) {
                                          return;
                                        }
                                        const val = parseInt(el.value || '0', 10) || 0;
                                        el.value = String(val + 1);
                                      },
                                      style: {
                                        width: '16px',
                                        height: '12px',
                                        lineHeight: '10px',
                                        textAlign: 'center',
                                        backgroundColor: '#555',
                                        color: '#fff',
                                        border: '1px solid #666',
                                        borderRadius: '2px',
                                        cursor: 'pointer',
                                        padding: 0,
                                        fontSize: '10px',
                                      },
                                    },
                                    '▲'
                                  ),
                                  React.createElement(
                                    'button',
                                    {
                                      key: 'down',
                                      onClick: () => {
                                        const el = document.getElementById(
                                          'print-copies-input'
                                        ) as HTMLInputElement;
                                        if (!el) {
                                          return;
                                        }
                                        const val = parseInt(el.value || '0', 10) || 0;
                                        const next = Math.max(1, val - 1);
                                        el.value = String(next);
                                      },
                                      style: {
                                        width: '16px',
                                        height: '12px',
                                        lineHeight: '10px',
                                        textAlign: 'center',
                                        backgroundColor: '#555',
                                        color: '#fff',
                                        border: '1px solid #666',
                                        borderRadius: '2px',
                                        cursor: 'pointer',
                                        padding: 0,
                                        fontSize: '10px',
                                      },
                                    },
                                    '▼'
                                  ),
                                ]
                              ),
                            ]
                          ),
                        ]
                      ),
                    ]
                  ),

                  // More options continued
                  React.createElement(
                    'div',
                    {
                      key: 'more-options',
                      style: {
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: '12px',
                        marginBottom: '8px',
                      },
                    },
                    [
                      // Film Size ID
                      React.createElement(
                        'div',
                        {
                          key: 'film-size',
                          style: { display: 'flex', flexDirection: 'column' },
                        },
                        [
                          React.createElement(
                            'label',
                            {
                              key: 'size-label',
                              style: {
                                fontWeight: 'bold',
                                marginBottom: '4px',
                                color: '#ffffff',
                                fontSize: '12px',
                              },
                            },
                            'Film Size ID:'
                          ),
                          React.createElement(
                            'select',
                            {
                              key: 'size-select',
                              id: 'print-film-size',
                              style: {
                                padding: '4px',
                                border: '1px solid #666',
                                borderRadius: '3px',
                                backgroundColor: '#444',
                                color: '#ffffff',
                                fontSize: '12px',
                              },
                            },
                            React.createElement(
                              'option',
                              { value: '8INX10IN', selected: true },
                              '8INX10IN'
                            ),
                            React.createElement('option', { value: '8_5INX11IN' }, '8_5INX11IN'),
                            React.createElement('option', { value: '10INX12IN' }, '10INX12IN'),
                            React.createElement('option', { value: '10INX14IN' }, '10INX14IN'),
                            React.createElement('option', { value: '11INX14IN' }, '11INX14IN'),
                            React.createElement('option', { value: '11INX17IN' }, '11INX17IN'),
                            React.createElement('option', { value: '14INX14IN' }, '14INX14IN'),
                            React.createElement('option', { value: '14INX17IN' }, '14INX17IN'),
                            React.createElement('option', { value: '24CMX24CM' }, '24CMX24CM'),
                            React.createElement('option', { value: '24CMX30CM' }, '24CMX30CM'),
                            React.createElement('option', { value: 'A4' }, 'A4'),
                            React.createElement('option', { value: 'A3' }, 'A3')
                          ),
                        ]
                      ),
                      // Magnification Type
                      React.createElement(
                        'div',
                        {
                          key: 'magnification',
                          style: { display: 'flex', flexDirection: 'column' },
                        },
                        [
                          React.createElement(
                            'label',
                            {
                              key: 'mag-label',
                              style: {
                                fontWeight: 'bold',
                                marginBottom: '4px',
                                color: '#ffffff',
                                fontSize: '12px',
                              },
                            },
                            'Magnification Type:'
                          ),
                          React.createElement(
                            'select',
                            {
                              key: 'mag-select',
                              id: 'print-magnification',
                              style: {
                                padding: '4px',
                                border: '1px solid #666',
                                borderRadius: '3px',
                                backgroundColor: '#444',
                                color: '#ffffff',
                                fontSize: '12px',
                              },
                            },
                            React.createElement(
                              'option',
                              { value: 'REPLICATE', selected: true },
                              'REPLICATE'
                            ),
                            React.createElement('option', { value: 'BILINEAR' }, 'BILINEAR'),
                            React.createElement('option', { value: 'CUBIC' }, 'CUBIC')
                          ),
                        ]
                      ),
                      // Border Density
                      React.createElement(
                        'div',
                        {
                          key: 'border-density',
                          style: { display: 'flex', flexDirection: 'column' },
                        },
                        [
                          React.createElement(
                            'label',
                            {
                              key: 'border-label',
                              style: {
                                fontWeight: 'bold',
                                marginBottom: '4px',
                                color: '#ffffff',
                                fontSize: '12px',
                              },
                            },
                            'Border Density:'
                          ),
                          React.createElement(
                            'select',
                            {
                              key: 'border-select',
                              id: 'print-border-density',
                              style: {
                                padding: '4px',
                                border: '1px solid #666',
                                borderRadius: '3px',
                                backgroundColor: '#444',
                                color: '#ffffff',
                                fontSize: '12px',
                              },
                            },
                            React.createElement(
                              'option',
                              { value: 'BLACK', selected: true },
                              'BLACK'
                            ),
                            React.createElement('option', { value: 'WHITE' }, 'WHITE')
                          ),
                        ]
                      ),
                      // Empty Image Density
                      React.createElement(
                        'div',
                        {
                          key: 'empty-density',
                          style: { display: 'flex', flexDirection: 'column' },
                        },
                        [
                          React.createElement(
                            'label',
                            {
                              key: 'empty-label',
                              style: {
                                fontWeight: 'bold',
                                marginBottom: '4px',
                                color: '#ffffff',
                                fontSize: '12px',
                              },
                            },
                            'Empty Image Density:'
                          ),
                          React.createElement(
                            'select',
                            {
                              key: 'empty-select',
                              id: 'print-empty-density',
                              style: {
                                padding: '4px',
                                border: '1px solid #666',
                                borderRadius: '3px',
                                backgroundColor: '#444',
                                color: '#ffffff',
                                fontSize: '12px',
                              },
                            },
                            React.createElement(
                              'option',
                              { value: 'BLACK', selected: true },
                              'BLACK'
                            ),
                            React.createElement('option', { value: 'WHITE' }, 'WHITE')
                          ),
                        ]
                      ),
                    ]
                  ),

                  // Checkboxes row
                  React.createElement(
                    'div',
                    {
                      key: 'checkboxes-row',
                      style: {
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        marginBottom: '8px',
                      },
                    },
                    [
                      React.createElement(
                        'div',
                        {
                          key: 'annotations-checkbox',
                          style: { display: 'flex', alignItems: 'center' },
                        },
                        [
                          React.createElement('input', {
                            key: 'annotations-input',
                            id: 'print-annot',
                            type: 'checkbox',
                            defaultChecked: true,
                            style: { marginRight: '8px' },
                          }),
                          React.createElement(
                            'label',
                            {
                              key: 'annotations-label',
                              style: { fontWeight: 'bold' },
                            },
                            'Print image with annotations'
                          ),
                        ]
                      ),
                      React.createElement(
                        'div',
                        {
                          key: 'selected-view-checkbox',
                          style: { display: 'flex', alignItems: 'center' },
                        },
                        [
                          React.createElement('input', {
                            key: 'selected-input',
                            id: 'print-selected-only',
                            type: 'checkbox',
                            style: { marginRight: '8px' },
                          }),
                          React.createElement(
                            'label',
                            {
                              key: 'selected-label',
                              style: { fontWeight: 'bold' },
                            },
                            'Print only the selected view'
                          ),
                        ]
                      ),
                    ]
                  ),

                  // DPI
                  React.createElement(
                    'div',
                    {
                      key: 'dpi-section',
                      style: {
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '10px',
                      },
                    },
                    [
                      React.createElement(
                        'label',
                        {
                          key: 'dpi-label',
                          style: { fontWeight: 'bold', color: '#ffffff', fontSize: '12px' },
                        },
                        'DPI:'
                      ),
                      React.createElement(
                        'select',
                        {
                          key: 'dpi-select',
                          id: 'print-dpi',
                          style: {
                            padding: '4px',
                            border: '1px solid #666',
                            borderRadius: '3px',
                            backgroundColor: '#444',
                            color: '#ffffff',
                            fontSize: '12px',
                            width: '80px',
                          },
                        },
                        React.createElement('option', { value: '100', selected: true }, '100'),
                        React.createElement('option', { value: '150' }, '150'),
                        React.createElement('option', { value: '200' }, '200'),
                        React.createElement('option', { value: '250' }, '250'),
                        React.createElement('option', { value: '300' }, '300')
                      ),
                    ]
                  ),
                ]
              ),

              // Calling Node Section
              React.createElement(
                'div',
                {
                  key: 'calling-node',
                  style: {
                    marginBottom: '12px',
                  },
                },
                [
                  React.createElement(
                    'label',
                    {
                      key: 'calling-label',
                      style: {
                        fontWeight: 'bold',
                        marginRight: '8px',
                        color: '#ffffff',
                        fontSize: '12px',
                      },
                    },
                    'Calling Node:'
                  ),
                  React.createElement(
                    'select',
                    {
                      key: 'calling-select',
                      id: 'print-calling-node',
                      style: {
                        padding: '4px',
                        border: '1px solid #666',
                        borderRadius: '3px',
                        backgroundColor: '#444',
                        color: '#ffffff',
                        fontSize: '12px',
                        width: '150px',
                      },
                    },
                    React.createElement('option', { value: 'Default', selected: true }, 'Default')
                  ),
                ]
              ),

              // Buttons
              React.createElement(
                'div',
                {
                  key: 'buttons',
                  style: {
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: '10px',
                  },
                },
                [
                  React.createElement(
                    'button',
                    {
                      key: 'print-btn',
                      onClick: async () => {
                        // Gather selected options from the main DICOM Print popup
                        const getVal = (id: string, fallback = '') => {
                          const el = document.getElementById(id) as
                            | HTMLSelectElement
                            | HTMLInputElement
                            | null;
                          if (!el) {
                            return fallback;
                          }
                          return (el as any).value ?? fallback;
                        };

                        const copies = getVal('print-copies-input', '1');
                        const mediumType = getVal('print-medium-type', 'PAPER');
                        const filmSize = getVal('print-film-size', '8INX10IN');
                        const orientation = getVal('print-orientation', 'PORTRAIT')
                          .toString()
                          .toLowerCase();
                        const magnification = getVal('print-magnification', 'REPLICATE');

                        // Read printer from select
                        const printerSel = document.getElementById(
                          'print-printer-select'
                        ) as HTMLSelectElement | null;
                        const selectedOpt = printerSel?.selectedOptions?.[0];
                        const printerAET = selectedOpt?.dataset?.ae || 'PRINTER_AE';
                        const printerHost = selectedOpt?.dataset?.host || '127.0.0.1';
                        const printerPort = selectedOpt?.dataset?.port || '104';

                        // Calling Node → AE Title if present
                        const aeTitle = getVal('print-calling-node', 'PRINTSCU') || 'PRINTSCU';

                        // Use backend to download ZIP and spool all images via dcmpsprt
                        // Build dynamic ZIP URL from active study when not provided
                        let zipUrl =
                          (window as any).dicomZipUrl || localStorage.getItem('dicomZipUrl') || '';
                        if (!zipUrl) {
                          try {
                            const studyUids =
                              (DicomMetadataStore &&
                                typeof (DicomMetadataStore as any).getStudyInstanceUIDs ===
                                  'function' &&
                                (DicomMetadataStore as any).getStudyInstanceUIDs()) ||
                              [];
                            const activeStudyUID =
                              Array.isArray(studyUids) && studyUids.length > 0 ? studyUids[0] : '';
                            if (activeStudyUID) {
                              zipUrl = `https://hcis.frisdns.com/dcm4chee-arc/aets/RADSHARE/rs/studies/${activeStudyUID}?accept=application/zip`;
                            }
                          } catch {}
                        }
                        if (!zipUrl) {
                          uiNotificationService.show({
                            title: 'Print',
                            message:
                              'No ZIP URL set. Set window.dicomZipUrl or localStorage.dicomZipUrl before printing.',
                            type: 'warning',
                          });
                        } else {
                          try {
                            const backendBase =
                              (window as any).RADSHARE_BACKEND || 'http://localhost:8082';
                            const resp = await fetch(`${backendBase}/api/print-zip`, {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                zipUrl,
                                printerProfile: printerAET,
                                cfgPath: 'radshareBackend/dcmpstat.cfg',
                              }),
                            });
                            const raw = await resp.text();
                            let data: any = null;
                            try {
                              data = raw ? JSON.parse(raw) : null;
                            } catch {
                              // non-JSON response
                            }
                            if (resp.ok && data?.ok) {
                              uiNotificationService.show({
                                title: 'Print',
                                message: `Spooling ${data.count} image(s) to printer ${printerAET}`,
                                type: 'success',
                              });
                            } else {
                              uiNotificationService.show({
                                title: 'Print Error',
                                message:
                                  (data && (data.error || data.stderr)) ||
                                  (raw && `HTTP ${resp.status}: ${raw}`) ||
                                  `HTTP ${resp.status}: Failed to print ZIP`,
                                type: 'error',
                              });
                            }
                          } catch (e) {
                            uiNotificationService.show({
                              title: 'Print Error',
                              message: (e as any)?.message || 'Failed to call backend',
                              type: 'error',
                            });
                          }
                        }

                        // Clean up our custom modal
                        if (window.currentDicomModal) {
                          window.currentDicomModal.element.removeEventListener(
                            'click',
                            window.currentDicomModal.handleClickOutside
                          );
                          window.currentDicomModal.root.unmount();
                          document.body.removeChild(window.currentDicomModal.element);
                          window.currentDicomModal = null;
                        }
                      },
                      style: {
                        padding: '6px 12px',
                        backgroundColor: '#007bff',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '12px',
                      },
                    },
                    'Print'
                  ),
                  React.createElement(
                    'button',
                    {
                      key: 'cancel-btn',
                      onClick: () => {
                        // Trigger error popup when Cancel is clicked
                        setTimeout(() => {
                          const error = new Error('Print operation cancelled by user');
                          error.name = 'PrintCancelledError';
                          // Dispatch as a global error event
                          window.dispatchEvent(
                            new ErrorEvent('error', {
                              error: error,
                              message: error.message,
                              filename: 'DICOM Print Dialog',
                              lineno: 0,
                              colno: 0,
                            })
                          );
                        }, 100);

                        // Clean up our custom modal
                        if (window.currentDicomModal) {
                          window.currentDicomModal.element.removeEventListener(
                            'click',
                            window.currentDicomModal.handleClickOutside
                          );
                          window.currentDicomModal.root.unmount();
                          document.body.removeChild(window.currentDicomModal.element);
                          window.currentDicomModal = null;
                        }
                      },
                      style: {
                        padding: '6px 12px',
                        backgroundColor: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '3px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '12px',
                      },
                    },
                    'Cancel'
                  ),
                ]
              ),
            ]
          );
        };

        // Create a custom modal without background overlay
        const modalElement = document.createElement('div');
        modalElement.style.cssText = `
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: 9999;
          display: flex;
          justify-content: center;
          align-items: center;
          background: transparent;
        `;

        const contentElement = document.createElement('div');
        contentElement.style.cssText = `
          position: relative;
          z-index: 10000;
        `;

        // Handle click outside to close
        const handleClickOutside = event => {
          if (event.target === modalElement) {
            if (window.currentDicomModal) {
              window.currentDicomModal.root.unmount();
              document.body.removeChild(window.currentDicomModal.element);
              window.currentDicomModal = null;
            }
          }
        };

        modalElement.addEventListener('click', handleClickOutside);

        // Render the popup content
        const { createRoot } = require('react-dom/client');
        const root = createRoot(contentElement);
        root.render(React.createElement(PopupContent));

        modalElement.appendChild(contentElement);
        document.body.appendChild(modalElement);

        // Store reference for cleanup
        window.currentDicomModal = { element: modalElement, root, handleClickOutside };

        // Populate printers from localStorage on open
        refreshPrinters();

        console.log('✅ Modal show called successfully');
      } catch (error) {
        console.error('Show popup error:', error);
        uiNotificationService.show({
          title: 'Popup Error',
          message: 'Failed to show popup. Please try again.',
          type: 'error',
        });
      }
    },

    /**
     *  Sets the specified protocol
     *    1. Records any existing state using the viewport grid service
     *    2. Finds the destination state - this can be one of:
     *       a. The specified protocol stage
     *       b. An alternate (toggled or restored) protocol stage
     *       c. A restored custom layout
     *    3. Finds the parameters for the specified state
     *       a. Gets the displaySetSelectorMap
     *       b. Gets the map by position
     *       c. Gets any toggle mapping to map position to/from current view
     *    4. If restore, then sets layout
     *       a. Maps viewport position by currently displayed viewport map id
     *       b. Uses toggle information to map display set id
     *    5. Else applies the hanging protocol
     *       a. HP Service is provided displaySetSelectorMap
     *       b. HP Service will throw an exception if it isn't applicable
     * @param options - contains information on the HP to apply
     * @param options.activeStudyUID - the updated study to apply the HP to
     * @param options.protocolId - the protocol ID to change to
     * @param options.stageId - the stageId to apply
     * @param options.stageIndex - the index of the stage to go to.
     * @param options.reset - flag to indicate if the HP should be reset to its original and not restored to a previous state
     *
     * commandsManager.run('setHangingProtocol', {
     *   activeStudyUID: '1.2.3',
     *   protocolId: 'myProtocol',
     *   stageId: 'myStage',
     *   stageIndex: 0,
     *   reset: false,
     * });
     */
    setHangingProtocol: ({
      activeStudyUID = '',
      StudyInstanceUID = '',
      protocolId,
      stageId,
      stageIndex,
      reset = false,
    }: HangingProtocolParams): boolean => {
      const toUseStudyInstanceUID = activeStudyUID || StudyInstanceUID;
      try {
        // Stores in the state the display set selector id to displaySetUID mapping
        // Pass in viewportId for the active viewport.  This item will get set as
        // the activeViewportId
        const state = viewportGridService.getState();
        const hpInfo = hangingProtocolService.getState();
        reuseCachedLayouts(state, hangingProtocolService);
        const { hangingProtocolStageIndexMap } = useHangingProtocolStageIndexStore.getState();
        const { displaySetSelectorMap } = useDisplaySetSelectorStore.getState();

        if (!protocolId) {
          // Reuse the previous protocol id, and optionally stage
          protocolId = hpInfo.protocolId;
          if (stageId === undefined && stageIndex === undefined) {
            stageIndex = hpInfo.stageIndex;
          }
        } else if (stageIndex === undefined && stageId === undefined) {
          // Re-set the same stage as was previously used
          const hangingId = `${toUseStudyInstanceUID || hpInfo.activeStudyUID}:${protocolId}`;
          stageIndex = hangingProtocolStageIndexMap[hangingId]?.stageIndex;
        }

        const useStageIdx =
          stageIndex ??
          hangingProtocolService.getStageIndex(protocolId, {
            stageId,
            stageIndex,
          });

        const activeStudyChanged = hangingProtocolService.setActiveStudyUID(toUseStudyInstanceUID);

        const storedHanging = `${toUseStudyInstanceUID || hangingProtocolService.getState().activeStudyUID}:${protocolId}:${
          useStageIdx || 0
        }`;

        const { viewportGridState } = useViewportGridStore.getState();
        const restoreProtocol = !reset && viewportGridState[storedHanging];

        if (
          reset ||
          (activeStudyChanged &&
            !viewportGridState[storedHanging] &&
            stageIndex === undefined &&
            stageId === undefined)
        ) {
          // Run the hanging protocol fresh, re-using the existing study data
          // This is done on reset or when the study changes and we haven't yet
          // applied it, and don't specify exact stage to use.
          const displaySets = displaySetService.getActiveDisplaySets();
          const activeStudy = {
            StudyInstanceUID: toUseStudyInstanceUID,
            displaySets,
          };
          hangingProtocolService.run(activeStudy, protocolId);
        } else if (
          protocolId === hpInfo.protocolId &&
          useStageIdx === hpInfo.stageIndex &&
          !toUseStudyInstanceUID
        ) {
          // Clear the HP setting to reset them
          hangingProtocolService.setProtocol(protocolId, {
            stageId,
            stageIndex: useStageIdx,
          });
        } else {
          hangingProtocolService.setProtocol(protocolId, {
            displaySetSelectorMap,
            stageId,
            stageIndex: useStageIdx,
            restoreProtocol,
          });
          if (restoreProtocol) {
            viewportGridService.set(viewportGridState[storedHanging]);
          }
        }
        // Do this after successfully applying the update
        const { setDisplaySetSelector } = useDisplaySetSelectorStore.getState();
        setDisplaySetSelector(
          `${toUseStudyInstanceUID || hpInfo.activeStudyUID}:activeDisplaySet:0`,
          null
        );
        return true;
      } catch (e) {
        console.error(e);
        uiNotificationService.show({
          title: 'Apply Hanging Protocol',
          message: 'The hanging protocol could not be applied.',
          type: 'error',
          duration: 3000,
        });
        return false;
      }
    },

    // toggleHangingProtocol: ({ protocolId, stageIndex }: HangingProtocolParams): boolean => {

    //   uiNotificationService.show({
    //     title: 'Loading in Progress',
    //     message: 'Please ensure all images are fully loaded before using MPR or 3D view.',
    //     type: 'info',
    //     duration: 3000,
    //     position: 'top-right'
    //   });

    //   const {
    //     protocol,
    //     stageIndex: desiredStageIndex,
    //     activeStudy,
    //   } = hangingProtocolService.getActiveProtocol();
    //   const { toggleHangingProtocol, setToggleHangingProtocol } =
    //     useToggleHangingProtocolStore.getState();
    //   const storedHanging = `${activeStudy.StudyInstanceUID}:${protocolId}:${stageIndex | 0}`;
    //   if (
    //     protocol.id === protocolId &&
    //     (stageIndex === undefined || stageIndex === desiredStageIndex)
    //   ) {
    //     // Toggling off - restore to previous state
    //     const previousState = toggleHangingProtocol[storedHanging] || {
    //       protocolId: 'default',
    //     };
    //     return actions.setHangingProtocol(previousState);
    //   } else {
    //     setToggleHangingProtocol(storedHanging, {
    //       protocolId: protocol.id,
    //       stageIndex: desiredStageIndex,
    //     });
    //     return actions.setHangingProtocol({
    //       protocolId,
    //       stageIndex,
    //       reset: true,
    //     });
    //   }
    // },
    toggleHangingProtocol: async ({
      protocolId,
      stageIndex,
    }: HangingProtocolParams): Promise<boolean> => {
      const {
        protocol,
        stageIndex: desiredStageIndex,
        activeStudy,
      } = hangingProtocolService.getActiveProtocol();

      const { toggleHangingProtocol, setToggleHangingProtocol } =
        useToggleHangingProtocolStore.getState();

      const storedHanging = `${activeStudy.StudyInstanceUID}:${protocolId}:${stageIndex || 0}`;

      const isSameProtocol =
        protocol.id === protocolId &&
        (stageIndex === undefined || stageIndex === desiredStageIndex);

      if (isSameProtocol) {
        // Going back to normal view — skip notification
        const previousState = toggleHangingProtocol[storedHanging] || {
          protocolId: 'default',
        };
        return actions.setHangingProtocol(previousState);
      } else {
        // 👇 Check loading state before showing notification
        const loadingStates = studyPrefetcherService._displaySetLoadingStates;
        const anyStillLoading = [...loadingStates.values()].some(state => state?.loading === true);

        if (anyStillLoading) {
          uiNotificationService.show({
            title: 'Loading in Progress',
            message: 'Please ensure all images are fully loaded before using MPR or 3D view.',
            type: 'info',
            duration: 3000,
            position: 'top-right',
          });

          // Optional delay to let the user see the message
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        setToggleHangingProtocol(storedHanging, {
          protocolId: protocol.id,
          stageIndex: desiredStageIndex,
        });

        return actions.setHangingProtocol({
          protocolId,
          stageIndex,
          reset: true,
        });
      }
    },
    deltaStage: ({ direction }) => {
      const { protocolId, stageIndex: oldStageIndex } = hangingProtocolService.getState();
      const { protocol } = hangingProtocolService.getActiveProtocol();
      for (
        let stageIndex = oldStageIndex + direction;
        stageIndex >= 0 && stageIndex < protocol.stages.length;
        stageIndex += direction
      ) {
        if (protocol.stages[stageIndex].status !== 'disabled') {
          return actions.setHangingProtocol({
            protocolId,
            stageIndex,
          });
        }
      }
      uiNotificationService.show({
        title: 'Change Stage',
        message: 'The hanging protocol has no more applicable stages',
        type: 'info',
        duration: 3000,
      });
    },

    /**
     * Changes the viewport grid layout in terms of the MxN layout.
     */
    setViewportGridLayout: ({ numRows, numCols, isHangingProtocolLayout = false }) => {
      const { protocol } = hangingProtocolService.getActiveProtocol();
      const onLayoutChange = protocol.callbacks?.onLayoutChange;
      if (commandsManager.run(onLayoutChange, { numRows, numCols }) === false) {
        console.log('setViewportGridLayout running', onLayoutChange, numRows, numCols);
        // Don't apply the layout if the run command returns false
        return;
      }

      const completeLayout = () => {
        const state = viewportGridService.getState();
        findViewportsByPosition(state, { numRows, numCols });

        const { viewportsByPosition, initialInDisplay } = useViewportsByPositionStore.getState();

        const findOrCreateViewport = layoutFindOrCreate.bind(
          null,
          hangingProtocolService,
          isHangingProtocolLayout,
          { ...viewportsByPosition, initialInDisplay }
        );

        viewportGridService.setLayout({
          numRows,
          numCols,
          findOrCreateViewport,
          isHangingProtocolLayout,
        });
      };
      // Need to finish any work in the callback
      window.setTimeout(completeLayout, 0);
    },

    toggleOneUp() {
      const viewportGridState = viewportGridService.getState();
      const { activeViewportId, viewports, layout, isHangingProtocolLayout } = viewportGridState;
      const { displaySetInstanceUIDs, displaySetOptions, viewportOptions } =
        viewports.get(activeViewportId);

      if (layout.numCols === 1 && layout.numRows === 1) {
        // The viewer is in one-up. Check if there is a state to restore/toggle back to.
        const { toggleOneUpViewportGridStore } = useToggleOneUpViewportGridStore.getState();

        if (!toggleOneUpViewportGridStore) {
          return;
        }
        // There is a state to toggle back to. The viewport that was
        // originally toggled to one up was the former active viewport.
        const viewportIdToUpdate = toggleOneUpViewportGridStore.activeViewportId;

        // We are restoring the previous layout but taking into the account that
        // the current one up viewport might have a new displaySet dragged and dropped on it.
        // updatedViewportsViaHP below contains the viewports applicable to the HP that existed
        // prior to the toggle to one-up - including the updated viewports if a display
        // set swap were to have occurred.
        const updatedViewportsViaHP =
          displaySetInstanceUIDs.length > 1
            ? []
            : displaySetInstanceUIDs
                .map(displaySetInstanceUID =>
                  hangingProtocolService.getViewportsRequireUpdate(
                    viewportIdToUpdate,
                    displaySetInstanceUID,
                    isHangingProtocolLayout
                  )
                )
                .flat();

        // findOrCreateViewport returns either one of the updatedViewportsViaHP
        // returned from the HP service OR if there is not one from the HP service then
        // simply returns what was in the previous state for a given position in the layout.
        const findOrCreateViewport = (position: number, positionId: string) => {
          // Find the viewport for the given position prior to the toggle to one-up.
          const preOneUpViewport = Array.from(toggleOneUpViewportGridStore.viewports.values()).find(
            viewport => viewport.positionId === positionId
          );

          // Use the viewport id from before the toggle to one-up to find any updates to the viewport.
          const viewport = updatedViewportsViaHP.find(
            viewport => viewport.viewportId === preOneUpViewport.viewportId
          );

          return viewport
            ? // Use the applicable viewport from the HP updated viewports
              { viewportOptions, displaySetOptions, ...viewport }
            : // Use the previous viewport for the given position
              preOneUpViewport;
        };

        const layoutOptions = viewportGridService.getLayoutOptionsFromState(
          toggleOneUpViewportGridStore
        );

        // Restore the previous layout including the active viewport.
        viewportGridService.setLayout({
          numRows: toggleOneUpViewportGridStore.layout.numRows,
          numCols: toggleOneUpViewportGridStore.layout.numCols,
          activeViewportId: viewportIdToUpdate,
          layoutOptions,
          findOrCreateViewport,
          isHangingProtocolLayout: true,
        });

        // Reset crosshairs after restoring the layout
        setTimeout(() => {
          commandsManager.runCommand('resetCrosshairs');
        }, 0);
      } else {
        // We are not in one-up, so toggle to one up.

        // Store the current viewport grid state so we can toggle it back later.
        const { setToggleOneUpViewportGridStore } = useToggleOneUpViewportGridStore.getState();
        setToggleOneUpViewportGridStore(viewportGridState);

        // one being toggled to one up.
        const findOrCreateViewport = () => {
          return {
            displaySetInstanceUIDs,
            displaySetOptions,
            viewportOptions,
          };
        };

        // Set the layout to be 1x1/one-up.
        viewportGridService.setLayout({
          numRows: 1,
          numCols: 1,
          findOrCreateViewport,
          isHangingProtocolLayout: true,
        });
      }
    },

    /**
     * Exposes the browser history navigation used by OHIF. This command can be used to either replace or
     * push a new entry into the browser history. For example, the following will replace the current
     * browser history entry with the specified relative URL which changes the study displayed to the
     * study with study instance UID 1.2.3. Note that as a result of using `options.replace = true`, the
     * page prior to invoking this command cannot be returned to via the browser back button.
     *
     * navigateHistory({
     *   to: 'viewer?StudyInstanceUIDs=1.2.3',
     *   options: { replace: true },
     * });
     *
     * @param historyArgs - arguments for the history function;
     *                      the `to` property is the URL;
     *                      the `options.replace` is a boolean indicating if the current browser history entry
     *                      should be replaced or a new entry pushed onto the history (stack); the default value
     *                      for `replace` is false
     */
    navigateHistory(historyArgs: NavigateHistory) {
      history.navigate(historyArgs.to, historyArgs.options);
    },

    openDICOMTagViewer({ displaySetInstanceUID }: { displaySetInstanceUID?: string }) {
      const { activeViewportId, viewports } = viewportGridService.getState();
      const activeViewportSpecificData = viewports.get(activeViewportId);
      const { displaySetInstanceUIDs } = activeViewportSpecificData;

      const displaySets = displaySetService.activeDisplaySets;
      const { UIModalService } = servicesManager.services;

      const defaultDisplaySetInstanceUID = displaySetInstanceUID || displaySetInstanceUIDs[0];
      UIModalService.show({
        content: DicomTagBrowser,
        contentProps: {
          displaySets,
          displaySetInstanceUID: defaultDisplaySetInstanceUID,
        },
        title: 'DICOM Tag Browser',
        containerClassName: 'max-w-3xl',
      });
    },

    /**
     * Toggle viewport overlay (the information panel shown on the four corners
     * of the viewport)
     * @see ViewportOverlay and CustomizableViewportOverlay components
     */
    toggleOverlays: () => {
      const overlays = document.getElementsByClassName('viewport-overlay');
      for (let i = 0; i < overlays.length; i++) {
        overlays.item(i).classList.toggle('hidden');
      }
    },

    scrollActiveThumbnailIntoView: () => {
      const { activeViewportId, viewports } = viewportGridService.getState();

      const activeViewport = viewports.get(activeViewportId);
      const activeDisplaySetInstanceUID = activeViewport.displaySetInstanceUIDs[0];

      const thumbnailList = document.querySelector('#ohif-thumbnail-list');

      if (!thumbnailList) {
        return;
      }

      const thumbnailListBounds = thumbnailList.getBoundingClientRect();

      const thumbnail = document.querySelector(`#thumbnail-${activeDisplaySetInstanceUID}`);

      if (!thumbnail) {
        return;
      }

      const thumbnailBounds = thumbnail.getBoundingClientRect();

      // This only handles a vertical thumbnail list.
      if (
        thumbnailBounds.top >= thumbnailListBounds.top &&
        thumbnailBounds.top <= thumbnailListBounds.bottom
      ) {
        return;
      }

      thumbnail.scrollIntoView({ behavior: 'smooth' });
    },

    updateViewportDisplaySet: ({
      direction,
      excludeNonImageModalities,
    }: UpdateViewportDisplaySetParams) => {
      const nonImageModalities = ['SR', 'SEG', 'SM', 'RTSTRUCT', 'RTPLAN', 'RTDOSE'];

      const currentDisplaySets = [...displaySetService.activeDisplaySets];

      const { activeViewportId, viewports, isHangingProtocolLayout } =
        viewportGridService.getState();

      const { displaySetInstanceUIDs } = viewports.get(activeViewportId);

      const activeDisplaySetIndex = currentDisplaySets.findIndex(displaySet =>
        displaySetInstanceUIDs.includes(displaySet.displaySetInstanceUID)
      );

      let displaySetIndexToShow: number;

      for (
        displaySetIndexToShow = activeDisplaySetIndex + direction;
        displaySetIndexToShow > -1 && displaySetIndexToShow < currentDisplaySets.length;
        displaySetIndexToShow += direction
      ) {
        if (
          !excludeNonImageModalities ||
          !nonImageModalities.includes(currentDisplaySets[displaySetIndexToShow].Modality)
        ) {
          break;
        }
      }

      if (displaySetIndexToShow < 0 || displaySetIndexToShow >= currentDisplaySets.length) {
        return;
      }

      const { displaySetInstanceUID } = currentDisplaySets[displaySetIndexToShow];

      let updatedViewports = [];

      try {
        updatedViewports = hangingProtocolService.getViewportsRequireUpdate(
          activeViewportId,
          displaySetInstanceUID,
          isHangingProtocolLayout
        );
      } catch (error) {
        console.warn(error);
        uiNotificationService.show({
          title: 'Navigate Viewport Display Set',
          message:
            'The requested display sets could not be added to the viewport due to a mismatch in the Hanging Protocol rules.',
          type: 'info',
          duration: 3000,
        });
      }

      viewportGridService.setDisplaySetsForViewports(updatedViewports);

      setTimeout(() => actions.scrollActiveThumbnailIntoView(), 0);
    },

    deleteSelectedAnnotation: async () => {
      try {
        const { uiNotificationService, cornerstoneViewportService, viewportGridService } =
          servicesManager.services;

        const getAll = () => {
          try {
            return (
              (csToolsAnnotation as any)?.state?.getAllAnnotations?.() ||
              (csToolsAnnotation as any)?.state?.getAnnotations?.() ||
              []
            );
          } catch {
            return [];
          }
        };

        const isAnnoSelected = (a: any) =>
          !!(a?.isSelected || a?.data?.isSelected || a?.metadata?.isSelected);

        const resolveSelectedUid = () => {
          let uid = (window as any).selectedAnnotationUid as string | null;
          if (!uid) {
            const all = getAll();
            const selected = Array.isArray(all) ? all.find(isAnnoSelected) : null;
            if (selected?.annotationUID) {
              uid = selected.annotationUID;
            }
          }
          if (uid) {
            const allNow = getAll();
            const exists = Array.isArray(allNow) && allNow.some(a => a?.annotationUID === uid);
            if (!exists) {
              uid = null;
            }
          }
          return uid;
        };

        // Try immediately
        let uid = resolveSelectedUid();

        // If not available, wait a tick to allow selection events to flush, then retry
        if (!uid) {
          await new Promise(r => setTimeout(r, 100));
          uid = resolveSelectedUid();
        }

        if (!uid) {
          uiNotificationService.show({
            title: 'Delete',
            message: 'No annotation selected',
            type: 'info',
          });
          return;
        }

        (csToolsAnnotation as any).state.removeAnnotation(uid);

        const { activeViewportId } = viewportGridService.getState();
        const vp = cornerstoneViewportService.getCornerstoneViewport(activeViewportId);
        if (vp?.render) {
          vp.render();
        }
        (window as any).selectedAnnotationUid = null;
      } catch (e) {
        console.error('Delete annotation error:', e);
        const { uiNotificationService } = servicesManager.services;
        uiNotificationService.show({
          title: 'Delete',
          message: 'Failed to delete annotation',
          type: 'error',
        });
      }
    },
  };

  // Bind Delete key once
  if (!(window as any).__ohifDeleteKeyBound) {
    (window as any).__ohifDeleteKeyBound = true;
    window.addEventListener('keydown', e => {
      if (e.key === 'Delete') {
        try {
          actions.deleteSelectedAnnotation();
        } catch {}
      }
    });
  }

  const definitions = {
    multimonitor: actions.multimonitor,
    loadStudy: actions.loadStudy,
    showContextMenu: actions.showContextMenu,
    closeContextMenu: actions.closeContextMenu,
    clearMeasurements: actions.clearMeasurements,
    displayNotification: actions.displayNotification,
    setHangingProtocol: actions.setHangingProtocol,
    toggleHangingProtocol: actions.toggleHangingProtocol,
    navigateHistory: actions.navigateHistory,
    nextStage: {
      commandFn: actions.deltaStage,
      options: { direction: 1 },
    },
    previousStage: {
      commandFn: actions.deltaStage,
      options: { direction: -1 },
    },
    setViewportGridLayout: actions.setViewportGridLayout,
    toggleOneUp: actions.toggleOneUp,
    openDICOMTagViewer: actions.openDICOMTagViewer,
    updateViewportDisplaySet: actions.updateViewportDisplaySet,
    downloadStudy: actions.downloadStudy,
    downloadViewportAsImage: actions.downloadViewportAsImage,
    showPopup: actions.showPopup,
  };

  return {
    actions,
    definitions,
    defaultContext: 'DEFAULT',
  };
};

export default commandsModule;
