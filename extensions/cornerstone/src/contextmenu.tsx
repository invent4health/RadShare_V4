import React from 'react';


const ContextMenu = ({ commands, onClose, other }) => {
  // Function to handle button activation
  const handleButtonClick = (toolId) => {
    try {
      let runWarning = false;

      // Ensure commands exist before calling run
      if (commands?.run) {
        const result = commands.run('activateToolById', { itemId: toolId });

        // Check if result contains a warning
        if (result && result.warning) {
          runWarning = true;
        }
      }

      // If we got a warning, call other.recordInteraction
      if (runWarning && other?.recordInteraction) {
        other.recordInteraction(toolId);
      }

      // Close the menu
      onClose();

      console.log(`Activated tool: ${toolId}, Warning: ${runWarning}`);
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
          padding: '5px',
          margin: 0,
          width: '120px', // Adjusted width for better readability
        }}
      >
        {toolOptions.map((toolId) => (
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
