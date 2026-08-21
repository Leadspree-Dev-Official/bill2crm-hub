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
    <div className={`mb-12 ${align === 'center' ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}`}>
      {eyebrow && (
        <span className="mb-3 inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-indigo-600">
          {eyebrow}
        </span>
      )}
      <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{title}</h2>
      {desc && <p className="mt-3 text-lg text-slate-500">{desc}</p>}
    </div>
  )
}
