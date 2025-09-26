import React from 'react';
import type { IconProps } from '../types';

export const Print = (props: IconProps) => (
  <svg
    width="24px"
    height="24px"
    viewBox="0 0 24 24"
    {...props}
  >
    <g
      id="icon-print"
      stroke="currentColor"
      strokeWidth="1.5"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* Printer body */}
      <rect
        x="4"
        y="6"
        width="16"
        height="8"
        rx="1"
      />

      {/* Paper coming out */}
      <path d="M6,6 L6,4 C6,3.44771525 6.44771525,3 7,3 L17,3 C17.5522847,3 18,3.44771525 18,4 L18,6" />

      {/* Paper output tray */}
      <rect
        x="5"
        y="16"
        width="14"
        height="2"
        rx="0.5"
      />

      {/* Paper with folded corner */}
      <path d="M8,6 L8,4 L10,4 L10,6" />

      {/* Control panel details */}
      <circle
        cx="8"
        cy="9"
        r="0.5"
      />
      <circle
        cx="10"
        cy="9"
        r="0.5"
      />
      <circle
        cx="12"
        cy="9"
        r="0.5"
      />
    </g>
  </svg>
);

export default Print;
