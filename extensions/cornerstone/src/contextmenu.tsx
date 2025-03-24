import React from 'react';

const ContextMenu = ({ commands, onClose }) => {
  // Function to handle button activation
  const handleButtonClick = toolId => {
    try {
      // Activate the selected tool
      commands.run('activateToolById', { itemId: toolId });
      // Close the menu
      onClose();
      console.log(`Activated tool: ${toolId}`);
    } catch (error) {
      console.error('Error activating tool:', error.message);
    }
  };

  // List of tools
  const toolOptions = [
    'Zoom',
    'Pan',
    'Length',
    'Rotate Right',
    'Reset View',
    'MeasurementTools',
    'Bidirectional',
    'ArrowAnnotate',
    'EllipticalROI',
    'RectangleROI',
    'PlanarFreehandROI',
  ];

  return (
    <div className="context-menu w-[fit-content]">
      <ul
        style={{
          listStyle: 'none',
          padding: 0,
          margin: 0,
          width: '100px',
        }}
      >
        {toolOptions.map(toolId => (
          <li
            key={toolId}
            style={{
              padding: '5px 10px',
              borderBottom: '1px solid #eee',
            }}
          >
            <button
              onClick={() => handleButtonClick(toolId)}
              title={toolId}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                width: '100%',
                textAlign: 'left',
                cursor: 'pointer',
                color: '#FFF',
                fontSize: '10px',
              }}
            >
              {toolId}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ContextMenu;
