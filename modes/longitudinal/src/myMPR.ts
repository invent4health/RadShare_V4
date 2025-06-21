import { ToolbarService } from '@ohif/core';

const { createButton } = ToolbarService;
const myMPR = [
  {
    id: 'myMPR',
    uiType: 'ohif.toolButtonList',
    props: {
      groupId: 'MPR',
      evaluate: 'evaluate.group.promoteToPrimaryIfCornerstoneToolNotActiveInTheList',
      primary: createButton({
        id: 'MPR',
        icon: 'icon-mpr',
        label: 'MPR',
        commands: {
          commandName: 'toggleHangingProtocol',
          commandOptions: {
            protocolId: 'mpr',
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
          id: 'MPR',
          icon: 'icon-mpr',
          label: 'MPR',
          commands: {
            commandName: 'toggleHangingProtocol',
            commandOptions: {
              protocolId: 'mpr',
            },
            context: 'DEFAULT',
          },
          evaluate: 'evaluate.action',
        }),
        createButton({
          id: 'Primary Axial',
          icon: 'layout-advanced-axial-primary',
          label: 'Primary Axial',
          commands: {
            commandName: 'toggleHangingProtocol',
            commandOptions: { protocolId: 'primaryAxial' },
            context: 'DEFAULT',
          },
          evaluate: 'evaluate.action',
        }),
      ],
    },
  },
];

export default myMPR;
