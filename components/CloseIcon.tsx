/** The one close / remove mark, used for every × in the app: two crossed quill strokes, each
 *  swelling in the middle and tapering at the ends like a pen mark struck through on the page. */
export default function CloseIcon({ size = 18 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 16 16" width={size} height={size} fill="currentColor" stroke="currentColor" strokeWidth={0.6} strokeLinejoin="round">
      <path d="M3.2 3.6Q6.3 9.9 12.8 12.6Q8.9 7.15 3.2 3.6Z" />
      <path d="M12.6 3.3Q6.45 6.45 3.4 12.7Q8.85 8.85 12.6 3.3Z" />
    </svg>
  );
}
