import React, { useEffect, useState, useCallback, useRef } from 'react';
import PropTypes from 'prop-types';
import { LayoutSelector as OHIFLayoutSelector, ToolbarButton, LayoutPreset } from '@ohif/ui';

function ToolbarLayoutSelectorWithServices({
  commandsManager,
  servicesManager,
  ...props
}: withAppTypes) {
  const [isDisabled, setIsDisabled] = useState(false);

  const handleMouseEnter = () => {
    setIsDisabled(false);
  };

  const onSelection = useCallback(props => {
    commandsManager.run({
      commandName: 'setViewportGridLayout',
      commandOptions: { ...props },
    });
    setIsDisabled(true);
  }, []);

  const onSelectionPreset = useCallback(props => {
    commandsManager.run({
      commandName: 'setHangingProtocol',
      commandOptions: { ...props },
    });
    setIsDisabled(true);
  }, []);

  return (
    <div onMouseEnter={handleMouseEnter}>
      <LayoutSelector
        {...props}
        onSelection={onSelection}
        onSelectionPreset={onSelectionPreset}
        servicesManager={servicesManager}
        tooltipDisabled={isDisabled}
      />
    </div>
  );
}

function LayoutSelector({
  rows = 3,
  columns = 4,
  onLayoutChange = () => {},
  className,
  onSelection,
  onSelectionPreset,
  servicesManager,
  tooltipDisabled,
  ...rest
}: withAppTypes) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const { customizationService } = servicesManager.services;

  const commonPresets = customizationService.getCustomization('layoutSelector.commonPresets');
  const advancedPresetsGenerator = customizationService.getCustomization(
    'layoutSelector.advancedPresetGenerator'
  );

  const advancedPresets = advancedPresetsGenerator({ servicesManager });

  const closeOnOutsideClick = event => {
    if (isOpen && dropdownRef.current) {
      setIsOpen(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    setTimeout(() => {
      window.addEventListener('click', closeOnOutsideClick);
    }, 0);
    return () => {
      window.removeEventListener('click', closeOnOutsideClick);
      dropdownRef.current = null;
    };
  }, [isOpen]);

  const onInteractionHandler = () => {
    setIsOpen(!isOpen);
  };
  const DropdownContent = isOpen ? OHIFLayoutSelector : null;

  return (
    <ToolbarButton
      id="Layout"
      label="Layout"
      icon="tool-layout"
      onInteraction={onInteractionHandler}
      className={className}
      rounded={rest.rounded}
      disableToolTip={tooltipDisabled}
      dropdownContent={
        DropdownContent !== null && (
          <div
            className="flex"
            ref={dropdownRef}
          >
            <div className="bg-secondary-dark flex flex-col gap-2.5 p-2">
              <div className="text-aqua-pale text-xs">Common</div>

              <div className="flex gap-4">
                {commonPresets.map((preset, index) => (
                  <LayoutPreset
                    key={index}
                    classNames="hover:bg-primary-dark group p-1 cursor-pointer"
                    icon={preset.icon}
                    commandOptions={preset.commandOptions}
                    onSelection={onSelection}
                  />
                ))}
              </div>

              <div className="h-[2px] bg-black"></div>

              {/* <div className="text-aqua-pale text-xs">Advanced</div> */}

              <div className="flex flex-col gap-2.5">
                {advancedPresets
                  .filter(preset => preset.title === 'Frame View') // or match by ID or another property
                  .map((preset, index) => (
                    <LayoutPreset
                      key={index + commonPresets.length}
                      classNames="hover:bg-primary-dark group flex gap-2 p-1 cursor-pointer"
                      icon={preset.icon}
                      title={preset.title}
                      disabled={preset.disabled}
                      commandOptions={preset.commandOptions}
                      onSelection={onSelectionPreset}
                    />
                  ))}
              </div>
            </div>

            <div className="bg-primary-dark flex flex-col gap-2.5 border-l-2 border-solid border-black p-2">
              <div className="text-aqua-pale text-xs">Custom</div>
              <DropdownContent
                rows={rows}
                columns={columns}
                onSelection={onSelection}
              />
              <p className="text-aqua-pale text-xs leading-tight">
                Hover to select <br></br>rows and columns <br></br> Click to apply
              </p>
            </div>
          </div>
        )
      }
      isActive={isOpen}
      type="toggle"
    />
  );
}

LayoutSelector.propTypes = {
  rows: PropTypes.number,
  columns: PropTypes.number,
  onLayoutChange: PropTypes.func,
  servicesManager: PropTypes.object.isRequired,
};

export default ToolbarLayoutSelectorWithServices;
