import { defaults, ToolbarService } from '@ohif/core';

const { createButton } = ToolbarService;
const { windowLevelPresets } = defaults;

// Function to create W/L preset buttons dynamically
function _createWwwcPreset(preset, title, subtitle) {
  return createButton({
    id: `Preset_${preset}`,
    icon: 'tool-window-level',
    label: title, // This will now be displayed in the menu
    commands: {
      commandName: 'setWindowLevel',
      commandOptions: { ...windowLevelPresets[preset] },
      context: 'CORNERSTONE',
    },
    evaluate: 'evaluate.action',
  });
}

// New WindowLevelPreset configuration
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
        evaluate: 'evaluate.action',
      }),
      secondary: {
        icon: 'chevron-down',
        label: 'W/L Manual',
        tooltip: 'W/L Presets',
      },
      items: [
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
