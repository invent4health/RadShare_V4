import React from 'react';

import { Toolbox } from '@ohif/ui-next';
import PanelSegmentation from './panels/PanelSegmentation';
import ActiveViewportWindowLevel from './components/ActiveViewportWindowLevel';
import PanelMeasurement from './panels/PanelMeasurement'
import PanelReport from './panels/PanelReport';

const getPanelModule = ({ commandsManager, servicesManager, extensionManager }: withAppTypes) => {
  const wrappedPanelSegmentation = ({ configuration }) => {
    return (
      <PanelSegmentation
        commandsManager={commandsManager}
        servicesManager={servicesManager}
        extensionManager={extensionManager}
        configuration={{
          ...configuration,
        }}
      />
    );
  };

  const wrappedPanelSegmentationNoHeader = ({ configuration }) => {
    return (
      <PanelSegmentation
        commandsManager={commandsManager}
        servicesManager={servicesManager}
        extensionManager={extensionManager}
        configuration={{
          ...configuration,
        }}
      />
    );
  };

  const wrappedPanelSegmentationWithTools = ({ configuration }) => {
    return (
      <>
        <Toolbox
          commandsManager={commandsManager}
          servicesManager={servicesManager}
          extensionManager={extensionManager}
          buttonSectionId="segmentationToolbox"
          title="Segmentation Tools"
          configuration={{
            ...configuration,
          }}
        />
        <PanelSegmentation
          commandsManager={commandsManager}
          servicesManager={servicesManager}
          extensionManager={extensionManager}
          configuration={{
            ...configuration,
          }}
        />
      </>
    );
  };

  const wrappedPanelMeasurement = ({ configuration }) => {
    return (
      <PanelMeasurement
        commandsManager={commandsManager}
        servicesManager={servicesManager}
        extensionManager={extensionManager}
        configuration={{
          ...configuration,
        }}
      />
    );
  };
  const wrappedPanelReport = ({ configuration }) => {
    return (
      <PanelReport
        commandsManager={commandsManager}
        servicesManager={servicesManager}
        extensionManager={extensionManager}
        configuration={configuration}
      />
    );
  };

  return [
    {
      name: 'activeViewportWindowLevel',
      component: () => {
        return <ActiveViewportWindowLevel servicesManager={servicesManager} />;
      },
    },
    {
      name: 'panelMeasurement',
      iconName: 'tab-linear',
      iconLabel: 'Measure',
      label: 'Measurement',
      component: wrappedPanelMeasurement,
    },
    {
      name: 'PanelReport',
      iconName: 'report',
      iconLabel: 'Report',
      label: 'Report',
      component: wrappedPanelReport,
    },
    {
      name: 'panelSegmentation',
      iconName: 'tab-segmentation',
      iconLabel: 'Segmentation',
      label: 'Segmentation',
      component: wrappedPanelSegmentation,
    },
    {
      name: 'panelSegmentationNoHeader',
      iconName: 'tab-segmentation',
      iconLabel: 'Segmentation',
      label: 'Segmentation',
      component: wrappedPanelSegmentationNoHeader,
    },
    {
      name: 'panelSegmentationWithTools',
      iconName: 'tab-segmentation',
      iconLabel: 'Segmentation',
      label: 'Segmentation',
      component: wrappedPanelSegmentationWithTools,
    },
  ];
};

export default getPanelModule;
