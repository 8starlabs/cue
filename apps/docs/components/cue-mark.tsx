type CueMarkProps = {
  className?: string;
};

export function CueMark({ className = "" }: CueMarkProps) {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className={className} fill="none">
      <path
        d="M16 2v28M2 16h28M6.1 6.1l19.8 19.8m0-19.8L6.1 25.9"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
