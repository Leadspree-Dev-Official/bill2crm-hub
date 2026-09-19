export function SectionHead({
  eyebrow,
  title,
  desc,
  align = 'center',
}: {
  eyebrow?: string
  title: string
  desc?: string
  align?: 'center' | 'left'
}) {
  return (
    <div className={`mb-8 sm:mb-12 ${align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}`}>
      {eyebrow && <p className="eyebrow mb-2 sm:mb-3">{eyebrow}</p>}
      <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl lg:text-4xl">{title}</h2>
      {desc && <p className="mt-2.5 sm:mt-3 text-sm sm:text-[15px] leading-relaxed text-muted-foreground">{desc}</p>}
    </div>
  )
}
