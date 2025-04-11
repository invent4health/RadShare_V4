import { Types } from '@ohif/core';

// Define sync groups as constants for reusability
const ZOOM_PAN_SYNC: Types.HangingProtocol.SyncGroup = {
  type: 'zoompan',
  id: 'zoompansync',
  source: true,
  target: true,
};

const VOI_SYNC: Types.HangingProtocol.SyncGroup = {
  type: 'voi',
  id: 'wlsync',
  source: true,
  target: true,
  options: {
    syncColormap: true,
  },
};

const frame: Types.HangingProtocol.Protocol = {
  id: '@ohif/frame',
  description: '2x2 Frame view for displaying different images from the same series',
  name: 'Sequence Image',
  icon: 'tool-stack-scroll',
  isPreset: true,
  toolGroupIds: ['default'],
  protocolMatchingRules: [],
  displaySetSelectors: {
    defaultDisplaySetId: {
      seriesMatchingRules: [
        {
          attribute: 'numImageFrames',
          constraint: {
            greaterThan: { value: 4 }, // Ensure we have at least 4 frames for 2x2
          },
          required: true,
        },
        {
          attribute: 'isDisplaySetFromUrl',
          weight: 20,
          constraint: {
            equals: true,
          },
        },
      ],
    },
  },
  defaultViewport: {
    viewportOptions: {
      viewportType: 'stack',
      toolGroupId: 'default',
      allowUnmatchedView: true,
    },
    displaySets: [
      {
        id: 'defaultDisplaySetId',
        matchedDisplaySetsIndex: -1,
      },
    ],
  },
  stages: [
    {
      name: 'frame',
      id: '2x2',
      viewportStructure: {
        layoutType: 'grid',
        properties: {
          rows: 2,
          columns: 2,
        },
      },
      viewports: [
        {
          viewportOptions: {
            viewportId: 'frame_R0_C0',
            toolGroupId: 'default',
            viewportType: 'stack', // Using stack viewport type for frame viewing
            syncGroups: [
              ZOOM_PAN_SYNC,
              VOI_SYNC,
              {
                type: 'frameview',
                id: 'frameViewSync',
                source: true,
                target: true,
                options: {
                  viewportIndex: 0, // First frame
                },
              },
            ],
          },
          displaySets: [
            {
              id: 'defaultDisplaySetId',
            },
          ],
        },
        {
          viewportOptions: {
            viewportId: 'frame_R0_C1',
            toolGroupId: 'default',
            viewportType: 'stack',
            syncGroups: [
              ZOOM_PAN_SYNC,
              VOI_SYNC,
              {
                type: 'frameview',
                id: 'frameViewSync',
                source: true,
                target: true,
                options: {
                  viewportIndex: 1, // Second frame
                },
              },
            ],
          },
          displaySets: [
            {
              id: 'defaultDisplaySetId',
            },
          ],
        },
        {
          viewportOptions: {
            viewportId: 'frame_R1_C0',
            toolGroupId: 'default',
            viewportType: 'stack',
            syncGroups: [
              ZOOM_PAN_SYNC,
              VOI_SYNC,
              {
                type: 'frameview',
                id: 'frameViewSync',
                source: true,
                target: true,
                options: {
                  viewportIndex: 2, // Third frame
                },
              },
            ],
          },
          displaySets: [
            {
              id: 'defaultDisplaySetId',
            },
          ],
        },
        {
          viewportOptions: {
            viewportId: 'frame_R1_C1',
            toolGroupId: 'default',
            viewportType: 'stack',
            syncGroups: [
              ZOOM_PAN_SYNC,
              VOI_SYNC,
              {
                type: 'frameview',
                id: 'frameViewSync',
                source: true,
                target: true,
                options: {
                  viewportIndex: 3, // Fourth frame
                },
              },
            ],
          },
          displaySets: [
            {
              id: 'defaultDisplaySetId',
            },
          ],
        },
      ],
    },
  ],
};

export { frame };
