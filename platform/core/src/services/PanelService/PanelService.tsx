import React from 'react';
import { ActivatePanelTriggers } from '../../types';
import { Subscription } from '../../types/IPubSub';
import { PubSubService } from '../_shared/pubSubServiceInterface';
import { ExtensionManager } from '../../extensions';

export const EVENTS = {
  PANELS_CHANGED: 'event::panelService:panelsChanged',
  ACTIVATE_PANEL: 'event::panelService:activatePanel',
};

type PanelData = {
  id: string;
  iconName: string;
  iconLabel: string;
  label: string;
  name: string;
  content: unknown;
};

export enum PanelPosition {
  Left = 'left',
  Right = 'right',
  Bottom = 'bottom',
}

export default class PanelService extends PubSubService {
  private _extensionManager: ExtensionManager;

  public static REGISTRATION = {
    name: 'panelService',
    create: ({ extensionManager }): PanelService => {
      return new PanelService(extensionManager);
    },
  };

  private _panelsGroups: Map<PanelPosition, PanelData[]> = new Map();

  constructor(extensionManager: ExtensionManager) {
    super(EVENTS);
    this._extensionManager = extensionManager;
  }

  public get PanelPosition(): typeof PanelPosition {
    return PanelPosition;
  }

  public getPanelStatus(panelId: string): { position: PanelPosition | null; isActive: boolean } {
    for (const [position, panels] of this._panelsGroups.entries()) {
      if (panels.some(panel => panel.id === panelId)) {
        return { position, isActive: true };
      }
    }
    return { position: null, isActive: false };
  }
  private _getPanelComponent(panelId: string) {
    const entry = this._extensionManager.getModuleEntry(panelId);

    if (!entry) {
      // Check for similar panel names
      const similarPanels = this._getSimilarPanels(panelId);

      if (similarPanels.length > 0) {
        const suggestion = `Did you mean: ${similarPanels.join(', ')}?`;
        throw new Error(
          `${panelId} is not a valid entry for an extension module. ${suggestion} Please check your configuration or make sure the extension is registered.`
        );
      } else {
        throw new Error(
          `${panelId} is not a valid entry for an extension module, please check your configuration or make sure the extension is registered.`
        );
      }
    }

    // Type guard to ensure entry has the expected structure
    if (typeof entry !== 'object' || entry === null || !('component' in entry)) {
      throw new Error(
        `Invalid entry structure for extension ${panelId}. Expected entry with component property.`
      );
    }

    const typedEntry = entry as { component: unknown };
    const content = typedEntry.component;

    return { entry: typedEntry, content };
  }

  private _getSimilarPanels(panelId: string, threshold = 0.8): string[] {
    // Ensure panelId is a string
    if (typeof panelId !== 'string') {
      return [];
    }

    // Get panel modules using the public method
    const panelModules = this._extensionManager.getModulesByType('panelModule') || [];
    const registeredPanels = panelModules.map(module => module?.id).filter(Boolean);

    const similarPanels = registeredPanels.filter(registeredPanelId => {
      // Ensure registeredPanelId is a string
      if (typeof registeredPanelId !== 'string') {
        return false;
      }
      const similarity = this._calculateSimilarity(panelId, registeredPanelId);
      return similarity >= threshold;
    });

    return similarPanels;
  }

  private _calculateSimilarity(str1: string, str2: string): number {
    // Ensure both parameters are strings
    if (typeof str1 !== 'string' || typeof str2 !== 'string') {
      return 0;
    }

    const set1 = new Set(str1.toLowerCase().split(''));
    const set2 = new Set(str2.toLowerCase().split(''));
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    return intersection.size / union.size;
  }

  public getPanelData(panelId): PanelData {
    let content, entry;
    if (Array.isArray(panelId)) {
      const panelsData = panelId.map(id => this._getPanelComponent(id));

      // use the first panel's entry for the combined panel
      entry = panelsData[0].entry;

      // stack the content of the panels in one react component
      content = (props: any) => (
        <>
          {panelsData.map(({ content: PanelContent }, index) => {
            // Type guard for PanelContent
            if (typeof PanelContent === 'function') {
              const Component = PanelContent as React.ComponentType<any>;
              return (
                <Component
                  key={index}
                  {...props}
                />
              );
            }
            return null;
          })}
        </>
      );
    } else {
      ({ content, entry } = this._getPanelComponent(panelId));
    }

    return {
      id: entry.id,
      iconName: entry.iconName,
      iconLabel: entry.iconLabel,
      label: entry.label,
      name: entry.name,
      content,
    };
  }

  public addPanel(position: PanelPosition, panelId: string, options): void {
    let panels = this._panelsGroups.get(position);

    if (!panels) {
      panels = [];
      this._panelsGroups.set(position, panels);
    }

    const panelComponent = this.getPanelData(panelId);

    panels.push(panelComponent);
    this._broadcastEvent(EVENTS.PANELS_CHANGED, { position, options });
  }

  public addPanels(position: PanelPosition, panelsIds: string[], options): void {
    if (!Array.isArray(panelsIds)) {
      throw new Error('Invalid "panelsIds" array');
    }

    panelsIds.forEach(panelId => this.addPanel(position, panelId, options));
  }

  public setPanels(panels: { [key in PanelPosition]: string[] }, options): void {
    this.reset();

    Object.keys(panels).forEach((position: PanelPosition) => {
      this.addPanels(position, panels[position], options);
    });
  }

  public getPanels(position: PanelPosition): PanelData[] {
    const panels = this._panelsGroups.get(position) ?? [];

    // Return a new array to preserve the internal state
    return [...panels];
  }

  public reset(): void {
    const affectedPositions = Array.from(this._panelsGroups.keys());

    this._panelsGroups.clear();

    affectedPositions.forEach(position =>
      this._broadcastEvent(EVENTS.PANELS_CHANGED, { position })
    );
  }

  public onModeExit(): void {
    this.reset();
  }

  /**5
   * Activates the panel with the given id. If the forceActive flag is false
   * then it is up to the component containing the panel whether to activate
   * it immediately or not. For instance, the panel might not be activated when
   * the forceActive flag is false in the case where the user might have
   * activated/displayed and then closed the panel already.
   * Note that this method simply fires a broadcast event: ActivatePanelEvent.
   * @param panelId the panel's id
   * @param forceActive optional flag indicating if the panel should be forced to be activated or not
   */
  public activatePanel(panelId: string, forceActive = false): void {
    this._broadcastEvent(EVENTS.ACTIVATE_PANEL, { panelId, forceActive });
  }

  /**
   * Adds a mapping of events (activatePanelTriggers.sourceEvents) broadcast by
   * activatePanelTrigger.sourcePubSubService that
   * when fired/broadcasted must in turn activate the panel with the given id.
   * The subscriptions created are returned such that they can be managed and unsubscribed
   * as appropriate.
   * @param panelId the id of the panel to activate
   * @param activatePanelTriggers an array of triggers
   * @param forceActive optional flag indicating if the panel should be forced to be activated or not
   * @returns an array of the subscriptions subscribed to
   */
  public addActivatePanelTriggers(
    panelId: string,
    activatePanelTriggers: ActivatePanelTriggers[],
    forceActive = false
  ): Subscription[] {
    return activatePanelTriggers
      .map(trigger =>
        trigger.sourceEvents.map(eventName =>
          trigger.sourcePubSubService.subscribe(eventName, () =>
            this.activatePanel(panelId, forceActive)
          )
        )
      )
      .flat();
  }
}
