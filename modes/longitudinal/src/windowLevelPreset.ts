import { defaults, ToolbarService } from '@ohif/core';

const { createButton } = ToolbarService;
const { windowLevelPresets } = defaults;

// Function to create W/L preset buttons dynamically
function _createWwwcPreset(preset, title, subtitle) {
  return createButton({
    id: `Preset_${preset}`,
    icon: 'tool-window-level',
    label: title,
    commands: {
      commandName: 'setWindowLevel',
      commandOptions: { ...windowLevelPresets[preset] },
      context: 'CORNERSTONE',
    },
    evaluate: 'evaluate.action',
  });
}

// Updated WindowLevelPreset configuration with Auto option and evaluate
const WindowLevelPreset = [
  {
    id: 'WindowLevelPreset',
    uiType: 'ohif.toolButtonList',
    props: {
      groupId: 'WindowLevelPreset',
      evaluate: 'evaluate.group.promoteToPrimaryIfCornerstoneToolNotActiveInTheList',
      primary: createButton({
        id: 'WindowLevelPreset',
        icon: 'tool-window-level',
        label: 'Window Level',
        commands: {
          commandName: 'setToolActive',
          commandOptions: { toolName: 'WindowLevelPreset' },
          context: 'CORNERSTONE',
        },
        evaluate: [
          'evaluate.cornerstoneTool',
          {
            name: 'evaluate.viewport.supported',
            unsupportedViewportTypes: ['wholeSlide'],
          },
        ], // Added evaluate block here
      }),
      secondary: {
        icon: 'chevron-down',
        label: 'W/L Manual',
        tooltip: 'W/L Presets',
      },
      items: [
        createButton({
          id: 'Preset_Auto',
          icon: 'tool-window-level',
          label: 'Auto',
          commands: 'resetViewport',
          evaluate: 'evaluate.action',
        }),
        _createWwwcPreset(1, 'Soft Tissue', '400 / 40'),
        _createWwwcPreset(2, 'Lung', '1500 / -600'),
        _createWwwcPreset(3, 'Liver', '150 / 90'),
        _createWwwcPreset(4, 'Bone', '2500 / 480'),
        _createWwwcPreset(5, 'Brain', '80 / 40'),
      ],
    },
  },
];

export default WindowLevelPreset;
