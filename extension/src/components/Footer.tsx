interface Props {
  onClip: () => void;
}

export function Footer({ onClip }: Props) {
  return (
    <footer className="pt-1">
      <button
        onClick={onClip}
        className="w-full py-2 px-3 rounded-lg bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-xs transition-colors cursor-pointer"
      >
        + Clip Job
      </button>
    </footer>
  );
}
