window.config = {
  routerBasename: '/',
  // whiteLabeling: {},
  extensions: [],
  modes: [],
  customizationService: [
    {
      'viewportOverlay.topLeft': { $set: [] },
      'viewportOverlay.topRight': { $set: [] },
    },
    {
      'viewportOverlay.topLeft': {
        $push: [
          {
            id: 'PatientNameOverlay',
            inheritsFrom: 'ohif.overlayItem',
            attribute: 'PatientName',
            title: 'Patient Name',
            label: 'PN:',
            condition: ({ instance }) =>
              instance && instance.PatientName && instance.PatientName.Alphabetic,
            contentF: ({ instance, formatters: { formatPN } }) =>
              formatPN(instance.PatientName.Alphabetic) +
              ' ' +
              (instance.PatientSex ? '(' + instance.PatientSex + ')' : ''),
          },
          {
            id: 'PatientAgeOnly',
            label: 'Age:',
            attribute: 'PatientAge',
            contentF: ({ instance }) => instance?.PatientAge || '',
          },
        ],
      },
      'viewportOverlay.topRight': {
        $set: [
          {
            id: 'StudyDescription',
            attribute: 'StudyDescription',
            contentF: ({ instance }) => instance?.StudyDescription || '',
          },
          {
            id: 'SeriesDescription',
            attribute: 'SeriesDescription',
            contentF: ({ instance }) => instance?.SeriesDescription || '',
          },
          {
            id: 'PatientID',
            attribute: 'PatientID',
            contentF: ({ instance }) => instance?.PatientID || '',
          },
        ],
      },
    },
  ],
  showStudyList: true,
  // some windows systems have issues with more than 3 web workers
  maxNumberOfWebWorkers: 3,
  studyPrefetcher: {
    enabled: true,
    displaySetsCount: 25,
    maxNumPrefetchRequests: 10,
    order: 'closest',
  },
  // below flag is for performance reasons, but it might not work for all servers
  fetchClinicalInfo:
    'http://3.77.246.193/radshare-appapi/api/radshareopenapi/fetch-clinical-infoByStudyIuID',
  generateReport: 'http://3.77.246.193/api/radshareopenapi/report-gen-stream',
  getStudyInfo: 'http://35.157.184.183/radshare-appapi/api/radshareopenapi/getStudyiuidinfo',
  showWarningMessageForCrossOrigin: true,
  showPatientInfo: 'disabled',
  showCPUFallbackMessage: true,
  showLoadingIndicator: true,
  strictZSpacingForVolumeViewport: true,
  maxNumRequests: {
    interaction: 100,
    thumbnail: 75,
    // Prefetch number is dependent on the http protocol. For http 2 or
    // above, the number of requests can be go a lot higher.
    prefetch: 25,
  },
  // filterQueryParam: false,
  defaultDataSourceName: 'dicomweb',
  /* Dynamic config allows user to pass "configUrl" query string this allows to load config without recompiling application. The regex will ensure valid configuration source */
  // dangerouslyUseDynamicConfig: {
  //   enabled: true,
  //   // regex will ensure valid configuration source and default is /.*/ which matches any character. To use this, setup your own regex to choose a specific source of configuration only.
  //   // Example 1, to allow numbers and letters in an absolute or sub-path only.
  //   // regex: /(0-9A-Za-z.]+)(\/[0-9A-Za-z.]+)*/
  //   // Example 2, to restricts to either hosptial.com or othersite.com.
  //   // regex: /(https:\/\/hospital.com(\/[0-9A-Za-z.]+))|(https:\/\/othersite.com(\/[0-9A-Za-z.]+))/
  //   regex: /.*/,
  // },
  dataSources: [
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomweb',
      sourceName: 'dicomweb',
      configuration: {
        friendlyName: 'DCM4CHEE Server',
        name: 'RADSHARE',
        // wadoUriRoot: 'http://185.102.103.167:8082/dcm4chee-arc/aets/RADSHARE/wado',
        // qidoRoot: 'http://185.102.103.167:8082/dcm4chee-arc/aets/RADSHARE/rs',
        // wadoRoot: 'http://185.102.103.167:8082/dcm4chee-arc/aets/RADSHARE/rs',
        wadoUriRoot: 'https://d14fa38qiwhyfd.cloudfront.net/dicomweb',
        qidoRoot: 'https://d14fa38qiwhyfd.cloudfront.net/dicomweb',
        wadoRoot: 'https://d14fa38qiwhyfd.cloudfront.net/dicomweb',
        // wadoUriRoot: 'http://13.202.29.77:85/dcm4chee-arc/aets/RADSHAREPL2/wado',
        // qidoRoot: 'http://13.202.29.77:85/dcm4chee-arc/aets/RADSHAREPL2/rs',
        // wadoRoot: 'http://13.202.29.77:85/dcm4chee-arc/aets/RADSHAREPL2/rs',

        // wadoUriRoot: 'http://localhost:8042/wado',
        // qidoRoot: 'http://localhost:8042/dicom-web',
        // wadoRoot: 'http://localhost:8042/dicom-web',
        // wadoUriRoot: 'http://15.220.162.154:80/dcm4chee-arc/aets/DCM4CHEE/wado',
        // qidoRoot: 'http://15.220.162.154:80/dcm4chee-arc/aets/DCM4CHEE/rs',
        // wadoRoot: 'http://15.220.162.154:80/dcm4chee-arc/aets/DCM4CHEE/rs',

        // wadoUriRoot: 'http://15.220.162.154:80/dcm4chee-arc/aets/DCM4CHEE/wado',
        // qidoRoot: 'http://15.220.162.154:80/dcm4chee-arc/aets/DCM4CHEE/rs',
        // wadoRoot: 'http://15.220.162.154:80/dcm4chee-arc/aets/DCM4CHEE/rs',
        qidoSupportsIncludeField: true,
        imageRendering: 'wadors',
        enableStudyLazyLoad: true,
        thumbnailRendering: 'wadors',
        requestOptions: {
          auth: 'admin:admin',
        },
        dicomUploadEnabled: true,
        singlepart: 'pdf,video',
        // whether the data source should use retrieveBulkData to grab metadata,
        // and in case of relative path, what would it be relative to, options
        // are in the series level or study level (some servers like series some study)
        bulkDataURI: {
          enabled: true,
        },
        omitQuotationForMultipartRequest: true,
      },
    },
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomjson',
      sourceName: 'dicomjson',
      configuration: {
        friendlyName: 'dicom json',
        name: 'json',
      },
    },
    {
      namespace: '@ohif/extension-default.dataSourcesModule.dicomlocal',
      sourceName: 'dicomlocal',
      configuration: {
        friendlyName: 'dicom local',
      },
    },
  ],
  httpErrorHandler: error => {
    // This is 429 when rejected from the public idc sandbox too often.
    console.warn(error.status);

    // Could use services manager here to bring up a dialog/modal if needed.
    console.warn('test, navigate to https://ohif.org/');
  },
  // whiteLabeling: {
  //   /* Optional: Should return a React component to be rendered in the "Logo" section of the application's Top Navigation bar */
  //   createLogoComponentFn: function (React) {
  //     return React.createElement(
  //       'a',
  //       {
  //         target: '_self',
  //         rel: 'noopener noreferrer',
  //         className: 'text-purple-600 line-through',
  //         href: '/',
  //       },
  //       React.createElement('img',
  //         {
  //           src: './assets/customLogo.svg',
  //           className: 'w-8 h-8',
  //         }
  //       ))
  //   },
  // },
  hotkeys: [
    {
      commandName: 'incrementActiveViewport',
      label: 'Next Viewport',
      keys: ['right'],
    },
    {
      commandName: 'decrementActiveViewport',
      label: 'Previous Viewport',
      keys: ['left'],
    },
    { commandName: 'rotateViewportCW', label: 'Rotate Right', keys: ['r'] },
    { commandName: 'rotateViewportCCW', label: 'Rotate Left', keys: ['l'] },
    { commandName: 'invertViewport', label: 'Invert', keys: ['i'] },
    {
      commandName: 'flipViewportHorizontal',
      label: 'Flip Horizontally',
      keys: ['h'],
    },
    {
      commandName: 'flipViewportVertical',
      label: 'Flip Vertically',
      keys: ['v'],
    },
    { commandName: 'scaleUpViewport', label: 'Zoom In', keys: ['+'] },
    { commandName: 'scaleDownViewport', label: 'Zoom Out', keys: ['-'] },
    { commandName: 'fitViewportToWindow', label: 'Zoom to Fit', keys: ['='] },
    { commandName: 'resetViewport', label: 'Reset', keys: ['space'] },
    { commandName: 'nextImage', label: 'Next Image', keys: ['down'] },
    { commandName: 'previousImage', label: 'Previous Image', keys: ['up'] },
    // {
    //   commandName: 'previousViewportDisplaySet',
    //   label: 'Previous Series',
    //   keys: ['pagedown'],
    // },
    // {
    //   commandName: 'nextViewportDisplaySet',
    //   label: 'Next Series',
    //   keys: ['pageup'],
    // },
    {
      commandName: 'setToolActive',
      commandOptions: { toolName: 'Zoom' },
      label: 'Zoom',
      keys: ['z'],
    },
    // ~ Window level presets
    {
      commandName: 'windowLevelPreset1',
      label: 'W/L Preset 1',
      keys: ['1'],
    },
    {
      commandName: 'windowLevelPreset2',
      label: 'W/L Preset 2',
      keys: ['2'],
    },
    {
      commandName: 'windowLevelPreset3',
      label: 'W/L Preset 3',
      keys: ['3'],
    },
    {
      commandName: 'windowLevelPreset4',
      label: 'W/L Preset 4',
      keys: ['4'],
    },
    {
      commandName: 'windowLevelPreset5',
      label: 'W/L Preset 5',
      keys: ['5'],
    },
    {
      commandName: 'windowLevelPreset6',
      label: 'W/L Preset 6',
      keys: ['6'],
    },
    {
      commandName: 'windowLevelPreset7',
      label: 'W/L Preset 7',
      keys: ['7'],
    },
    {
      commandName: 'windowLevelPreset8',
      label: 'W/L Preset 8',
      keys: ['8'],
    },
    {
      commandName: 'windowLevelPreset9',
      label: 'W/L Preset 9',
      keys: ['9'],
    },
  ],
};
