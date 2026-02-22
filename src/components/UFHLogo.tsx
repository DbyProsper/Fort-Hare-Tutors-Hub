interface UFHLogoProps {
  className?: string;
}

export const UFHLogo = ({ className = 'w-8 h-8' }: UFHLogoProps) => {
  return (
    <img
      src="/ufhlogo.png"
      alt="UFH Logo"
      className={`${className} object-contain`}
    />
  );
};
