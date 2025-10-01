import i18n from 'i18next';
import { id } from './id';
import initToolGroups from './initToolGroups';
import toolbarButtons from './toolbarButtons';
import moreTools from './moreTools';
import imgMode from './imgMode';
import DMPR from './DMPR';
import myMPR from './myMPR';
import WindowLevelPreset from './windowLevelPreset';
import './styles/downloadButton.css';

// Allow this mode by excluding non-imaging modalities such as SR, SEG
// Also, SM is not a simple imaging modalities, so exclude it.
const NON_IMAGE_MODALITIES = ['ECG', 'SEG', 'RTSTRUCT', 'RTPLAN', 'PR'];

const ohif = {
  layout: '@ohif/extension-default.layoutTemplateModule.viewerLayout',
  sopClassHandler: '@ohif/extension-default.sopClassHandlerModule.stack',
  thumbnailList: '@ohif/extension-default.panelModule.seriesList',
  wsiSopClassHandler:
    '@ohif/extension-cornerstone.sopClassHandlerModule.DicomMicroscopySopClassHandler',
};

const cornerstone = {
  measurements: '@ohif/extension-cornerstone.panelModule.panelMeasurement',
  segmentation: '@ohif/extension-cornerstone.panelModule.panelSegmentation',
  report: '@ohif/extension-cornerstone.panelModule.PanelReport',
};

const tracked = {
  measurements: '@ohif/extension-measurement-tracking.panelModule.trackedMeasurements',
  thumbnailList: '@ohif/extension-measurement-tracking.panelModule.seriesList',
  viewport: '@ohif/extension-measurement-tracking.viewportModule.cornerstone-tracked',
};

const dicomsr = {
  sopClassHandler: '@ohif/extension-cornerstone-dicom-sr.sopClassHandlerModule.dicom-sr',
  sopClassHandler3D: '@ohif/extension-cornerstone-dicom-sr.sopClassHandlerModule.dicom-sr-3d',
  viewport: '@ohif/extension-cornerstone-dicom-sr.viewportModule.dicom-sr',
};

const dicomvideo = {
  sopClassHandler: '@ohif/extension-dicom-video.sopClassHandlerModule.dicom-video',
  viewport: '@ohif/extension-dicom-video.viewportModule.dicom-video',
};

const dicompdf = {
  sopClassHandler: '@ohif/extension-dicom-pdf.sopClassHandlerModule.dicom-pdf',
  viewport: '@ohif/extension-dicom-pdf.viewportModule.dicom-pdf',
};

const dicomSeg = {
  sopClassHandler: '@ohif/extension-cornerstone-dicom-seg.sopClassHandlerModule.dicom-seg',
  viewport: '@ohif/extension-cornerstone-dicom-seg.viewportModule.dicom-seg',
};

const dicomPmap = {
  sopClassHandler: '@ohif/extension-cornerstone-dicom-pmap.sopClassHandlerModule.dicom-pmap',
  viewport: '@ohif/extension-cornerstone-dicom-pmap.viewportModule.dicom-pmap',
};

const dicomRT = {
  viewport: '@ohif/extension-cornerstone-dicom-rt.viewportModule.dicom-rt',
  sopClassHandler: '@ohif/extension-cornerstone-dicom-rt.sopClassHandlerModule.dicom-rt',
};

const extensionDependencies = {
  // Can derive the versions at least process.env.from npm_package_version
  '@ohif/extension-default': '^3.0.0',
  '@ohif/extension-cornerstone': '^3.0.0',
  '@ohif/extension-measurement-tracking': '^3.0.0',
  '@ohif/extension-cornerstone-dicom-sr': '^3.0.0',
  '@ohif/extension-cornerstone-dicom-seg': '^3.0.0',
  '@ohif/extension-cornerstone-dicom-pmap': '^3.0.0',
  '@ohif/extension-cornerstone-dicom-rt': '^3.0.0',
  '@ohif/extension-dicom-pdf': '^3.0.1',
  '@ohif/extension-dicom-video': '^3.0.1',
};
function modeFactory({ modeConfiguration }) {
  let _activatePanelTriggersSubscriptions = [];

  const beforeUnloadHandler = event => {
    const isSaved = JSON.parse(localStorage.getItem('isSaved'));
    const isEdited = JSON.parse(localStorage.getItem('isEdited'));

    if (isEdited && !isSaved) {
      localStorage.setItem('isSaved', JSON.stringify(false));
      localStorage.setItem('isEdited', JSON.stringify(false));

      event.preventDefault();
      event.returnValue = '';
    }
  };

  // Function to check if multimonitor is specified in the URL

  const isMobile =
    /android|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(
      navigator.userAgent.toLowerCase()
    ) || /[?&]mobile\b/i.test(window.location.href);

  const isMultimonitor = () => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.has('multimonitor');
  };

  return {
    id,
    routeName: 'viewer',
    displayName: i18n.t('Modes:Basic Viewer'),
    onModeEnter: function ({ servicesManager, extensionManager, commandsManager }) {
      const { measurementService, toolbarService, toolGroupService } = servicesManager.services;

      measurementService.clearMeasurements();
      initToolGroups(extensionManager, toolGroupService, commandsManager);

      toolbarService.addButtons([
        ...toolbarButtons,
        ...moreTools,
        ...imgMode,
        ...DMPR,
        ...myMPR,
        ...WindowLevelPreset,
      ]);

      const primaryButtonsFull = [
        'Zoom',
        'Pan',
        'WindowLevel',
        'WindowLevelPreset',
        'MoreTools',
        'StackScroll',
        'MeasurementTools',
        'TrackballRotate',
        // 'Capture',
        'Layout',
        'Crosshairs',
        'Advanced-Magnify',
        'Reset View',
        // 'Rotate Right',
        // 'Flip Horizontal',
        // 'Angle',
        'Magnify',
        'Next Case',
        'ImgMode',
        'myMPR',
        'DMPR',
        'DownloadStudyNew',
        'DownloadViewportImage',
        'ShowPopupButton',
      ];

      const primaryButtonsCompact = [
        'Zoom',
        'Pan',
        'WindowLevel',
        'Pan',
        'Layout',
        'StackScroll',
        'DownloadStudyNew',
        'DownloadViewportImage',
      ];

      toolbarService.createButtonSection(
        'primary',
        isMobile ? primaryButtonsCompact : primaryButtonsFull
      );

      // toolbarService.createButtonSection('primary', [
      //   'Zoom',
      //   'Pan',
      //   'WindowLevel',
      //   'WindowLevelPreset',
      //   'MoreTools',
      //   'StackScroll',
      //   'MeasurementTools',
      //   'TrackballRotate',
      //   'Capture',
      //   'Layout',
      //   'Crosshairs',
      //   'Advanced-Magnify',
      //   'Reset View',
      //   'Rotate Right',
      //   'Flip Horizontal',
      //   'Angle',
      //   'Magnify',
      //   'Next Case',
      //   'ImgMode',
      // ]);

      window.addEventListener('beforeunload', beforeUnloadHandler);
    },

    onModeExit: ({ servicesManager }) => {
      const {
        toolGroupService,
        syncGroupService,
        segmentationService,
        cornerstoneViewportService,
        uiDialogService,
        uiModalService,
      } = servicesManager.services;

      _activatePanelTriggersSubscriptions.forEach(sub => sub.unsubscribe());
      _activatePanelTriggersSubscriptions = [];

      uiDialogService.hideAll();
      uiModalService.hide();
      toolGroupService.destroy();
      syncGroupService.destroy();
      segmentationService.destroy();
      cornerstoneViewportService.destroy();
      window.removeEventListener('beforeunload', beforeUnloadHandler);
    },
    validationTags: {
      study: [],
      series: [],
    },
    isValidMode: function ({ modalities }) {
      const modalities_list = modalities.split('\\');
      return {
        valid: !!modalities_list.filter(modality => NON_IMAGE_MODALITIES.indexOf(modality) === -1)
          .length,
        description:
          'The mode does not support studies that ONLY include the following modalities: SM, ECG, SEG, RTSTRUCT',
      };
    },
    routes: [
      {
        path: 'longitudinal',
        layoutTemplate: () => {
          // Default right panels
          const defaultRightPanels = [
            cornerstone.report,
            cornerstone.segmentation,
            tracked.measurements,
          ];

          // Conditionally add tracked.thumbnailList to rightPanels if multimonitor is true
          const rightPanels = isMultimonitor()
            ? [tracked.thumbnailList, ...defaultRightPanels]
            : defaultRightPanels;

          return {
            id: ohif.layout,
            props: {
              leftPanels: [tracked.thumbnailList], // Original left panel configuration
              leftPanelResizable: true,
              rightPanels: rightPanels, // Dynamically adjusted right panels
              rightPanelClosed: !isMultimonitor(),
              rightPanelResizable: true,
              viewports: [
                {
                  namespace: tracked.viewport,
                  displaySetsToDisplay: [
                    ohif.sopClassHandler,
                    dicomvideo.sopClassHandler,
                    dicomsr.sopClassHandler3D,
                    ohif.wsiSopClassHandler,
                  ],
                },
                {
                  namespace: dicomsr.viewport,
                  displaySetsToDisplay: [dicomsr.sopClassHandler],
                },
                {
                  namespace: dicompdf.viewport,
                  displaySetsToDisplay: [dicompdf.sopClassHandler],
                },
                {
                  namespace: dicomSeg.viewport,
                  displaySetsToDisplay: [dicomSeg.sopClassHandler],
                },
                {
                  namespace: dicomPmap.viewport,
                  displaySetsToDisplay: [dicomPmap.sopClassHandler],
                },
                {
                  namespace: dicomRT.viewport,
                  displaySetsToDisplay: [dicomRT.sopClassHandler],
                },
              ],
            },
          };
        },
      },
    ],
    extensions: extensionDependencies,
    hangingProtocol: 'default',
    sopClassHandlers: [
      dicomvideo.sopClassHandler,
      dicomSeg.sopClassHandler,
      dicomPmap.sopClassHandler,
      ohif.sopClassHandler,
      ohif.wsiSopClassHandler,
      dicompdf.sopClassHandler,
      dicomsr.sopClassHandler3D,
      dicomsr.sopClassHandler,
      dicomRT.sopClassHandler,
    ],
    ...modeConfiguration,
  };
}

const mode = {
  id,
  modeFactory,
  extensionDependencies,
};

export default mode;
export { initToolGroups, moreTools, toolbarButtons, imgMode, DMPR, myMPR, WindowLevelPreset };
