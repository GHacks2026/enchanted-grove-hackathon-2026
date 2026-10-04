/** The one close / remove mark, drawn so every × in the app has the same stroke. */
export default function CloseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round">
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" />
    </svg>
  );
}
