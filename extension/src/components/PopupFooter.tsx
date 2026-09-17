interface PopupFooterProps {
  onClipJob: () => void;
}

export function PopupFooter({ onClipJob }: PopupFooterProps) {
  return (
    <footer className="popup-footer">
      <button className="clip-btn" onClick={onClipJob}>
        + Clip Job
      </button>
    </footer>
  );
}
