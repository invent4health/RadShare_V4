import { ToolbarService } from '@ohif/core';

const { createButton } = ToolbarService;
const DMPR = [
  {
    id: 'DMPR',
    uiType: 'ohif.toolButtonList',
    props: {
      groupId: 'DMPR',
      evaluate: 'evaluate.group.promoteToPrimaryIfCornerstoneToolNotActiveInTheList',
      primary: createButton({
        id: '3DMPR',
        icon: 'layout-advanced-3d-four-up',
        label: '3D',
        commands: {
          commandName: 'toggleHangingProtocol',
          commandOptions: {
            protocolId: 'fourUp',
          },
          context: 'DEFAULT',
        },
        evaluate: 'evaluate.action',
      }),
      secondary: {
        icon: 'chevron-down',
        label: '',
        tooltip: 'Select Mode',
      },
      items: [
        createButton({
          id: '3DMPR',
          icon: 'layout-advanced-3d-four-up',
          label: '3D',
          commands: {
            commandName: 'toggleHangingProtocol',
            commandOptions: {
              protocolId: 'fourUp',
            },
            context: 'DEFAULT',
          },
          evaluate: 'evaluate.action',
        }),
        createButton({
          id: 'MAIN 3D',
          icon: 'layout-advanced-3d-main',
          label: 'MAIN 3D',
          commands: {
            commandName: 'toggleHangingProtocol',
            commandOptions: { protocolId: 'main3D' },
            context: 'DEFAULT',
          },
          evaluate: 'evaluate.action',
        }),
        createButton({
          id: 'ONLY 3D',
          icon: 'layout-advanced-3d-only',
          label: 'ONLY 3D',
          commands: {
            commandName: 'toggleHangingProtocol',
            commandOptions: { protocolId: 'only3D' },
            context: 'DEFAULT',
          },
          evaluate: 'evaluate.action',
        }),
        createButton({
          id: '3D PRIMARY',
          icon: 'layout-advanced-3d-primary',
          label: '3D PRIMARY',
          commands: {
            commandName: 'toggleHangingProtocol',
            commandOptions: { protocolId: 'primary3D' },
            context: 'Cornerstone',
          },
          evaluate: 'evaluate.action',
        }),
      ],
    },
  },
];

export default DMPR;
