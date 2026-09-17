interface Props {
  count: number;
}

export function Header({ count }: Props) {
  return (
    <header className="popup-header">
      <h1 className="popup-title">JobLint</h1>
      <span className="job-count-badge">{count} saved</span>
    </header>
  );
}
