import React from 'react';

const MoreIcon = (props: IconProps) => {
  return (
    <svg
      width="24px"
      height="24px"
      viewBox="0 -3 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      {...props}
    >
      <rect
        width="100%"
        height="100%"
        fill="none"
      />
      <text
        x="50%"
        y="50%"
        fontSize="8px"
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
        fill="currentColor"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        MORE
      </text>
    </svg>
  );
};

export default MoreIcon;
