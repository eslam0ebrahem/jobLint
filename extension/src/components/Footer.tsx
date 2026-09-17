interface Props {
  onClip: () => void;
}

export function Footer({ onClip }: Props) {
  return (
    <footer className="popup-footer">
      <button className="clip-btn" onClick={onClip}>
        + Clip Job
      </button>
    </footer>
  );
}
