import React from 'react';
import type { IconProps } from '../types';

export const NextIcon = (props: IconProps) => {
  return (
    <svg
      width="24px"
      height="24px"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      fill="currentColor"
      {...props}
    >
      <rect width="100%" height="100%" fill="none" />
      <text
        x="50%"
        y="40%"
        fontSize="7.5"
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
        fill="currentColor"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        NEXT
      </text>
      <text
        x="50%"
        y="75%"
        fontSize="7.5"
        fontFamily="Arial, sans-serif"
        fontWeight="bold"
        fill="currentColor"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        STUDY
      </text>
    </svg>
  );
};

export default NextIcon;
