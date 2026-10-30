import s from './Logo.module.css';

export function Logo({ large = false, tagline = 'FargePop' }: { large?: boolean; tagline?: string }) {
  return (
    <span className={`${s.logo} ${large ? s.large : ''}`}>
      <span className={s.lea}>LeaLand</span>
      <span className={s.pop} aria-hidden>
        {tagline.split('').map((ch, i) => (
          <span key={i} style={{ color: `var(--ll-${['pink', 'sun', 'mint', 'sky', 'violet'][i % 5]})` }}>
            {ch}
          </span>
        ))}
      </span>
      <span className="ll-visually-hidden">{tagline}</span>
    </span>
  );
}
