import React, { useEffect, useState } from 'react';

import ViewportImageScrollbar from './ViewportImageScrollbar';
import CustomizableViewportOverlay from './CustomizableViewportOverlay';
import ViewportOrientationMarkers from './ViewportOrientationMarkers';
import ViewportImageSliceLoadingIndicator from './ViewportImageSliceLoadingIndicator';
import { annotation as csToolsAnnotation } from '@cornerstonejs/tools';

function CornerstoneOverlays(props: withAppTypes) {
  const { viewportId, element, scrollbarHeight, servicesManager } = props;
  const { cornerstoneViewportService, measurementService } = servicesManager.services;
  const [imageSliceData, setImageSliceData] = useState({
    imageIndex: 0,
    numberOfSlices: 0,
  });
  const [viewportData, setViewportData] = useState(null);

  useEffect(() => {
    const { unsubscribe } = cornerstoneViewportService.subscribe(
      cornerstoneViewportService.EVENTS.VIEWPORT_DATA_CHANGED,
      props => {
        if (props.viewportId !== viewportId) {
          return;
        }

        setViewportData(props.viewportData);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [viewportId]);

  // Keep track of latest/selected measurement UID via OHIF measurementService
  useEffect(() => {
    if (!measurementService) {
      return;
    }

    const setFromMeasurement = (evt: any) => {
      try {
        const m = evt?.detail?.measurement || evt?.measurement || evt;
        const uid = m?.uid || m?.annotationUID || m?.id;
        if (uid) {
          (window as any).selectedAnnotationUid = uid;
        }
      } catch {
        // ignore
      }
    };

    const subs: Array<() => void> = [];

    const EVENTS = measurementService.EVENTS || {};
    const trySub = (name: string) => {
      const eventName = (EVENTS as any)[name];
      if (eventName) {
        const { unsubscribe } = measurementService.subscribe(eventName, setFromMeasurement);
        subs.push(unsubscribe);
      }
    };

    trySub('MEASUREMENT_SELECTED');
    trySub('SELECTION_CHANGED');
    trySub('MEASUREMENT_ADDED');

    return () => {
      subs.forEach(u => {
        try {
          u();
        } catch {
          // ignore
        }
      });
    };
  }, [measurementService]);

  const markSelected = (uid: string | null) => {
    if (!uid) {
      return;
    }
    try {
      if ((csToolsAnnotation as any)?.state?.setAnnotationSelected) {
        (csToolsAnnotation as any).state.setAnnotationSelected(uid, true);
      } else if ((csToolsAnnotation as any)?.state?.getAnnotations) {
        const list = (csToolsAnnotation as any).state.getAnnotations() || [];
        for (const a of list) {
          if (a?.annotationUID === uid) {
            if (a.data) {
              a.data.isSelected = true;
            }
          } else if (a?.data) {
            a.data.isSelected = false;
          }
        }
      }
    } catch {
      // ignore
    }
  };

  const findUidOnNode = (node: HTMLElement | null) => {
    if (!node) {
      return null;
    }
    return (
      node.getAttribute('data-annotation-uid') ||
      node.getAttribute('data-annotationuid') ||
      node.getAttribute('data-annotation') ||
      node.getAttribute('data-uid') ||
      null
    );
  };

  // Robust selection: capture clicks anywhere in document and find closest annotation element
  useEffect(() => {
    const selectFromEvent = (evt: Event) => {
      const target = evt.target as HTMLElement | null;
      if (!target) {
        return;
      }
      let node: HTMLElement | null = target;
      let found: string | null = null;
      while (node && node !== document.body) {
        const maybe = findUidOnNode(node);
        if (maybe) {
          found = maybe;
          break;
        }
        node = node.parentElement as HTMLElement | null;
      }
      if (!found) {
        (window as any).selectedAnnotationUid = null;
        return;
      }
      (window as any).selectedAnnotationUid = found;
      markSelected(found);
    };

    document.addEventListener('pointerdown', selectFromEvent, true);
    return () => {
      document.removeEventListener('pointerdown', selectFromEvent, true);
    };
  }, []);

  // Fallback: also listen on element itself
  useEffect(() => {
    if (!element) {
      return;
    }
    const handler = (evt: Event) => {
      const target = evt.target as HTMLElement | null;
      if (!target) {
        return;
      }
      const hit = target.closest(
        '[data-annotation-uid], [data-annotationuid], [data-annotation], [data-uid]'
      ) as HTMLElement | null;
      if (!hit) {
        (window as any).selectedAnnotationUid = null;
        return;
      }
      const uid = findUidOnNode(hit);
      (window as any).selectedAnnotationUid = uid;
      markSelected(uid);
    };
    element.addEventListener('click', handler, true);
    return () => {
      element.removeEventListener('click', handler, true);
    };
  }, [element]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Delete') {
        return;
      }
      const uid = (window as any).selectedAnnotationUid;
      if (!uid) {
        return;
      }
      const { commandsManager } = servicesManager;
      try {
        commandsManager?.runCommand?.('deleteSelectedAnnotation');
      } catch {
        // ignore
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [servicesManager]);

  if (!element) {
    return null;
  }

  if (viewportData) {
    const viewportInfo = cornerstoneViewportService.getViewportInfo(viewportId);

    if (viewportInfo?.viewportOptions?.customViewportProps?.hideOverlays) {
      return null;
    }
  }

  return (
    <div className="noselect">
      <ViewportImageScrollbar
        viewportId={viewportId}
        viewportData={viewportData}
        element={element}
        imageSliceData={imageSliceData}
        setImageSliceData={setImageSliceData}
        scrollbarHeight={scrollbarHeight}
        servicesManager={servicesManager}
      />

      <CustomizableViewportOverlay
        imageSliceData={imageSliceData}
        viewportData={viewportData}
        viewportId={viewportId}
        servicesManager={servicesManager}
        element={element}
      />

      <ViewportImageSliceLoadingIndicator
        viewportData={viewportData}
        element={element}
      />

      <ViewportOrientationMarkers
        imageSliceData={imageSliceData}
        element={element}
        viewportData={viewportData}
        servicesManager={servicesManager}
        viewportId={viewportId}
      />
    </div>
  );
}

export default CornerstoneOverlays;
