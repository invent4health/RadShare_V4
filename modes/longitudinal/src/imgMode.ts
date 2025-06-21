import { ToolbarService } from '@ohif/core';
import IconWithText from 'platform/ui-next/src/components/Icons/Sources/DottedCircle';

const { createButton } = ToolbarService;

const imgMode = [
  {
    id: 'ImgMode',
    uiType: 'ohif.toolButtonList',
    props: {
      groupId: 'ImgMode',
      evaluate: 'evaluate.group.promoteToPrimaryIfCornerstoneToolNotActiveInTheList',
      primary: createButton({
        id: 'Mode',
        icon: 'DottedCircle',
        label: 'Mode',
        commands: {
          commandName: 'imgMode',
          commandOptions: { mode: 'MINIP' },
          context: 'CORNERSTONE',
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
          id: 'MIP',
          icon: 'DottedCircle',
          label: 'MIP',
          commands: {
            commandName: 'imgMode',
            commandOptions: { mode: 'MIP' },
            context: 'CORNERSTONE',
          },
          evaluate: 'evaluate.action',
        }),
        createButton({
          id: 'AVGIP',
          icon: 'DottedCircle',
          label: 'AVGIP',
          commands: {
            commandName: 'imgMode',
            commandOptions: { mode: 'AVGIP' },
            context: 'CORNERSTONE',
          },
          evaluate: 'evaluate.action',
        }),
        createButton({
          id: 'MINIP',
          icon: 'DottedCircle',
          label: 'MINIP',
          commands: {
            commandName: 'imgMode',
            commandOptions: { mode: 'MINIP' },
            context: 'CORNERSTONE',
          },
          evaluate: 'evaluate.action',
        }),
      ],

    },
  },
];

export default imgMode;
