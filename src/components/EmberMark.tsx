export function EmberMark({ large = false }: { large?: boolean }) {
  return (
    <span className={large ? 'mark mark-large' : 'mark'}>
      <span className="mark-dot" aria-hidden="true" />
      ember
    </span>
  );
}
