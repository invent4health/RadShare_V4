import * as React from 'react';
const DottedCircle = props => (
  <svg
    width="800px"
    height="800px"
    viewBox="0 0 24 24"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    {...props}
  >
    <path
      fillRule="evenodd"
      clipRule="evenodd"
      d="M12 21C16.9699 21 21 16.9709 21 12C21 7.03005 16.9699 3 12 3C7.03005 3 3 7.03005 3 12C3 16.9709 7.03005 21 12 21Z"
      stroke="#FFF"
      strokeWidth={2}
      strokeLinecap="round"
    />
    <path
      d="M11 15L14 12L11 9"
      stroke="#FFF"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);
export default DottedCircle;
