export default function BrandMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="36"
      height="36"
      viewBox="0 0 36 36"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 26V13.5C8 8.8 11.8 5 16.5 5H22M8 18h9.5a6.5 6.5 0 0 0 0-13M18 18l10 13M8 26c0 3-2 5-5 5"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="9" r="3.5" stroke="currentColor" strokeWidth="2.3" />
      <path
        d="M27 13l5 3-5 3h-5"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="26.5" cy="14.5" r="1" fill="currentColor" />
    </svg>
  );
}
