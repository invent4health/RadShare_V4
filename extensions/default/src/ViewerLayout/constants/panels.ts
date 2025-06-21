const urlParams = new URLSearchParams(window.location.search);
const isMultiMonitor = urlParams.has('multimonitor');

const expandedInsideBorderSize = 0;
const collapsedInsideBorderSize = 4;
const collapsedOutsideBorderSize = 4;
const collapsedWidth = 25;

const rightPanelInitialExpandedWidth = isMultiMonitor ? 282 : 600;
const leftPanelInitialExpandedWidth = 282;

const panelGroupDefinition = {
  groupId: 'viewerLayoutResizablePanelGroup',
  shared: {
    expandedInsideBorderSize,
    collapsedInsideBorderSize,
    collapsedOutsideBorderSize,
    collapsedWidth,
  },
  left: {
    panelId: 'viewerLayoutResizableLeftPanel',
    initialExpandedWidth: leftPanelInitialExpandedWidth,
    minimumExpandedOffsetWidth: 145 + expandedInsideBorderSize,
    initialExpandedOffsetWidth: leftPanelInitialExpandedWidth + expandedInsideBorderSize,
    collapsedOffsetWidth: collapsedWidth + collapsedInsideBorderSize + collapsedOutsideBorderSize,
  },
  right: {
    panelId: 'viewerLayoutResizableRightPanel',
    initialExpandedWidth: rightPanelInitialExpandedWidth,
    minimumExpandedOffsetWidth: rightPanelInitialExpandedWidth + expandedInsideBorderSize,
    initialExpandedOffsetWidth: rightPanelInitialExpandedWidth + expandedInsideBorderSize,
    collapsedOffsetWidth: collapsedWidth + collapsedInsideBorderSize + collapsedOutsideBorderSize,
  },
};

export { panelGroupDefinition };
