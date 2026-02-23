import React from 'react';

interface UFHLogoProps {
  className?: string;
  style?: React.CSSProperties;
}

export const UFHLogo = ({ className = 'w-8 h-8', style }: UFHLogoProps) => {
  return (
    <img
      src="/ufhlogo.png"
      alt="UFH Logo"
      className={`${className} object-contain`}
      style={style}
    />
  );
};
