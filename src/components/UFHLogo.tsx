interface UFHLogoProps {
  className?: string;
}

export const UFHLogo = ({ className = 'w-6 h-6' }: UFHLogoProps) => {
  return (
    <img
      src="/ufhlogo.png"
      alt="UFH Logo"
      className={className}
    />
  );
};
