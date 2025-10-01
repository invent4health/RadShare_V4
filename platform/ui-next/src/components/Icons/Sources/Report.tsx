import React from 'react';
import type { IconProps } from '../types';

export const Report = (props: IconProps) => (
  <svg
    width="28"
    height="28"
    viewBox="0 0 32 32"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect
      x="0"
      y="0"
      width="32"
      height="32"
      fill="#000000"
    />

    <rect
      x="6"
      y="4"
      width="20"
      height="24"
      rx="2"
      fill="#FFFFFF"
      stroke="#FFFFFF"
      strokeWidth="2"
    />

    <line
      x1="8"
      y1="8"
      x2="24"
      y2="8"
      stroke="#000000"
      strokeWidth="1"
    />
    <line
      x1="8"
      y1="12"
      x2="24"
      y2="12"
      stroke="#000000"
      strokeWidth="1"
    />
    <line
      x1="8"
      y1="16"
      x2="18"
      y2="16"
      stroke="#000000"
      strokeWidth="1"
    />

    <path
      d="M24 2 L28 6 L24 10"
      fill="none"
      stroke="#FFFFFF"
      strokeWidth="1"
    />
  </svg>
);

export default Report;
