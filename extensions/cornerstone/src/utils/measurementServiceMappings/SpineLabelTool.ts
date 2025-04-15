import { addTool, AnnotationTool } from '@cornerstonejs/tools';
import { utilities } from '@cornerstonejs/core';
import { getDisplayUnit } from './utils';
import getSOPInstanceAttributes from './utils/getSOPInstanceAttributes';
import { utils } from '@ohif/core';

// Extend Cornerstone's AnnotationTool for custom behavior
class SpineLabelTool extends AnnotationTool {
  static toolName = 'SpineLabel';

  constructor() {
    super({
      name: SpineLabelTool.toolName,
      supportedInteractionTypes: ['Mouse', 'Touch'],
    });
  }

  // Handle annotation addition
  addNewMeasurement(evt) {
    const eventData = evt.detail;
    const { element } = eventData;
    const { x, y } = eventData.currentPoints.canvas;

    const annotation = {
      invalidated: true,
      highlighted: true,
      metadata: {
        toolName: SpineLabelTool.toolName,
        referencedImageId: element.dataset.referencedImageId,
        FrameOfReferenceUID: utilities.getFrameOfReferenceUID(element),
      },
      data: {
        label: '',
        handles: {
          points: [[x, y, 0]], // Canvas coordinates, will be mapped to world
        },
      },
    };

    return annotation;
  }
}

const spineLabelTool = {
  name: SpineLabelTool.toolName,
  toAnnotation: measurement => {},

  /**
   * Maps cornerstone annotation to OHIF measurement format
   */
  toMeasurement: (
    csToolsEventDetail,
    displaySetService,
    cornerstoneViewportService,
    getValueTypeFromToolType,
    customizationService
  ) => {
    const { annotation } = csToolsEventDetail;
    const { metadata, data, annotationUID } = annotation;

    if (!metadata || !data) {
      console.warn('SpineLabel tool: Missing metadata or data');
      return null;
    }

    const { toolName, referencedImageId, FrameOfReferenceUID } = metadata;

    // Verify tool support
    if (toolName !== SpineLabelTool.toolName) {
      throw new Error('Tool not supported');
    }

    const { SOPInstanceUID, SeriesInstanceUID, StudyInstanceUID } = getSOPInstanceAttributes(
      referencedImageId,
      displaySetService,
      annotation
    );

    // Get display set
    const displaySet = SOPInstanceUID
      ? displaySetService.getDisplaySetForSOPInstanceUID(SOPInstanceUID, SeriesInstanceUID)
      : displaySetService.getDisplaySetsForSeries(SeriesInstanceUID)[0];

    if (!displaySet) {
      console.warn('SpineLabel tool: No display set found');
      return null;
    }

    const { points } = data.handles;
    const worldPoints = utilities.transformCanvasToWorld(points, referencedImageId);

    // Generate spine label based on world position
    const spineLabel = generateSpineLabel(worldPoints[0], displaySet, cornerstoneViewportService);

    const mappedAnnotations = getMappedAnnotations(
      annotation,
      displaySet,
      spineLabel,
      displaySetService
    );

    const displayText = getDisplayText(mappedAnnotations, displaySet, customizationService);
    const getReport = () =>
      _getReport(mappedAnnotations, worldPoints, FrameOfReferenceUID, spineLabel);

    return {
      uid: annotationUID,
      SOPInstanceUID,
      FrameOfReferenceUID,
      points: worldPoints,
      metadata,
      isLocked: false,
      isVisible: true,
      referenceSeriesUID: SeriesInstanceUID,
      referenceStudyUID: StudyInstanceUID,
      referencedImageId,
      frameNumber: mappedAnnotations?.[0]?.frameNumber || 1,
      toolName,
      displaySetInstanceUID: displaySet.displaySetInstanceUID,
      label: spineLabel,
      displayText,
      data: { label: spineLabel },
      type: getValueTypeFromToolType(toolName),
      getReport,
    };
  },

  /**
   * Synchronizes annotations across viewports
   */
  synchronize: (syncData, cornerstoneViewportService, hangingProtocolService) => {
    const { annotation, sourceViewportId, targetViewportIds } = syncData;
    const { metadata, data } = annotation;
    const { FrameOfReferenceUID } = metadata;
    const { points } = data.handles;

    targetViewportIds.forEach(targetViewportId => {
      const targetViewport = cornerstoneViewportService.getViewport(targetViewportId);
      if (targetViewport.FrameOfReferenceUID === FrameOfReferenceUID) {
        const mappedPoints = utilities.transformWorldToViewport(
          points,
          sourceViewportId,
          targetViewportId
        );

        const newAnnotation = {
          ...annotation,
          metadata: {
            ...metadata,
            referencedImageId: targetViewport.referencedImageId,
          },
          data: {
            ...data,
            handles: { points: mappedPoints },
          },
        };

        cornerstoneViewportService.addAnnotation(targetViewportId, newAnnotation);
      }
    });

    // Update hanging protocol to reflect synchronized annotations
    hangingProtocolService.updateViewports();
  },
};

/**
 * Generate spine label based on world position and DICOM metadata
 */
function generateSpineLabel(worldPoint, displaySet, cornerstoneViewportService) {
  const instance = displaySet.instances[0];
  const imagePositionPatient = instance?.ImagePositionPatient || [0, 0, 0];
  const zCoord = worldPoint[2] - imagePositionPatient[2];

  // Define vertebral ranges (adjust based on anatomical data or calibration)
  const vertebralLevels = [
    { label: 'C1', zMax: 50 },
    { label: 'C2', zMax: 70 },
    { label: 'C3', zMax: 90 },
    { label: 'T1', zMax: 150 },
    { label: 'T12', zMax: 300 },
    { label: 'L1', zMax: 350 },
    { label: 'L5', zMax: 450 },
  ];

  for (const level of vertebralLevels) {
    if (zCoord <= level.zMax) {
      return level.label;
    }
  }
  return 'Unknown';
}

/**
 * Map annotations to measurement format
 */
function getMappedAnnotations(annotation, displaySet, spineLabel, displaySetService) {
  const { metadata } = annotation;
  const { referencedImageId } = metadata;

  const { SOPInstanceUID, SeriesInstanceUID, frameNumber } = getSOPInstanceAttributes(
    referencedImageId,
    displaySetService,
    annotation
  );

  return [
    {
      SeriesInstanceUID,
      SOPInstanceUID,
      SeriesNumber: displaySet.SeriesNumber,
      frameNumber: frameNumber || 1,
      unit: 'label',
      value: spineLabel,
    },
  ];
}

/**
 * Generate report data
 */
function _getReport(mappedAnnotations, points, FrameOfReferenceUID, spineLabel) {
  const columns = ['AnnotationType', 'SpineLabel', 'FrameOfReferenceUID', 'Points'];
  const values = [
    'SpineLabel',
    spineLabel,
    FrameOfReferenceUID,
    points.map(p => p.join(' ')).join(';'),
  ];

  return { columns, values };
}

/**
 * Generate display text
 */
function getDisplayText(mappedAnnotations, displaySet, customizationService) {
  const displayText = { primary: [], secondary: [] };

  if (!mappedAnnotations.length) {
    return displayText;
  }

  const { value, SeriesNumber, SOPInstanceUID, frameNumber } = mappedAnnotations[0];
  const instance = displaySet.instances.find(image => image.SOPInstanceUID === SOPInstanceUID);

  const instanceText = instance?.InstanceNumber ? ` I: ${instance.InstanceNumber}` : '';
  const frameText = displaySet.isMultiFrame ? ` F: ${frameNumber}` : '';

  displayText.primary.push(value);
  displayText.secondary.push(`S: ${SeriesNumber}${instanceText}${frameText}`);

  return displayText;
}

// Register the tool with Cornerstone
addTool(SpineLabelTool);

export default spineLabelTool;
