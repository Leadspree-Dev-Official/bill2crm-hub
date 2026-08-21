export function GridBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 -z-10"
      style={{
        backgroundImage:
          'linear-gradient(to right, rgba(15,23,42,0.05) 1px, transparent 1px),' +
          'linear-gradient(to bottom, rgba(15,23,42,0.05) 1px, transparent 1px)',
        backgroundSize: '44px 44px',
        maskImage: 'radial-gradient(ellipse 70% 60% at 50% 0%, black 40%, transparent 100%)',
        WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 0%, black 40%, transparent 100%)',
      }}
    />
  )
}
