/** The ember glyph: the app icon's flame without its dark tile (public/ember-mark.svg). */
export function EmberGlyph({ size = 24 }: { size?: number }) {
  return <img src="/ember-mark.svg" alt="" aria-hidden="true" className="mark-glyph" height={size} width={Math.round((size * 420) / 540)} />;
}

export function EmberMark({ large = false }: { large?: boolean }) {
  return (
    <span className={large ? 'mark mark-large' : 'mark'}>
      <EmberGlyph size={large ? 48 : 30} />
      ember
    </span>
  );
}
