/** A drawn rule with a pressed leaf at its centre, the page's only ornament. */
export default function Fleuron({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 200 16" className={`block h-4 w-full max-w-[200px] ${className}`} fill="none" strokeLinecap="round">
      <path d="M8 8h70M122 8h70" stroke="var(--color-page-edge)" strokeWidth="1.25" />
      <circle cx="84" cy="8" r="1.4" fill="var(--color-lichen)" />
      <circle cx="116" cy="8" r="1.4" fill="var(--color-lichen)" />
      <path d="M90 8C95 2.5 105 2.5 110 8C105 13.5 95 13.5 90 8Z" fill="var(--color-lichen)" fillOpacity=".55" stroke="var(--color-moss)" strokeWidth="1" />
      <path d="M91.5 8h17" stroke="var(--color-moss)" strokeWidth=".9" />
    </svg>
  );
}
