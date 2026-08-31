import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { SectionHead } from './SectionHead'

const FAQS = [
  {
    q: 'Is Bill2CRM compliant with Indian GST laws?',
    a: 'Yes — invoices auto-calculate CGST/SGST/IGST, pull HSN/SAC codes, and include your GSTIN, so every invoice is filing-ready.',
  },
  {
    q: 'Do I need accounting knowledge to use the bookkeeping module?',
    a: 'No. Bill2CRM posts every sale, expense and salary as a balanced double-entry automatically. You rarely need to open Bookkeeping yourself — Trial Balance, P&L and Balance Sheet stay in sync as you work elsewhere.',
  },
  {
    q: 'How does the WhatsApp payment reminder work?',
    a: 'Turn on WhatsApp in Settings → Integrations with a ready-made message template. Bill2CRM then sends automated reminders as invoices approach and pass their due date.',
  },
  {
    q: 'Can I use Bill2CRM for both a retail shop and a service agency?',
    a: 'Yes. Turn on the Industry Preset that matches your business in Settings, and Bill2CRM shows only the screens you need — POS and tables for a shop, or proposals and agreements for an agency.',
  },
  {
    q: 'How does the Private Cloud / Lifetime plan work?',
    a: 'Private Cloud gives your business a dedicated, isolated database instead of a shared one. The Lifetime plan is that same dedicated database billed once instead of monthly — own it forever, no recurring subscription.',
  },
  {
    q: 'Can my Chartered Accountant (CA) access my reports?',
    a: 'Yes. Export your books as Tally-compatible XML, or as CSV/ZIP reports, straight from Bookkeeping and hand them to your CA — no manual re-entry required.',
  },
  {
    q: 'What hardware is supported for POS and KOT printing?',
    a: '58mm and 80mm thermal receipt printers, plus barcode scanners for quick SKU search. POS also works offline with local caching and syncs automatically once you\'re back online.',
  },
  {
    q: 'What happens after the 7-day free trial ends?',
    a: 'You keep using Bill2CRM on a limited Free plan — a smaller invoice and storage allowance instead of losing access — and can upgrade any time you outgrow it.',
  },
  {
    q: 'Is my customer and business data secure?',
    a: 'Yes — role-based access control (Admin, Manager, Team Lead, Executive, Viewer), an encrypted Legal Document Vault, and full workspace ZIP backups you control at any time.',
  },
  {
    q: 'Can I import my existing customer and product list?',
    a: 'Yes — Customers and Stock both support one-click CSV import, and you can export your list back out as CSV whenever you need it.',
  },
]

export function Faq() {
  return (
    <section id="faq" className="relative border-b border-border px-5 py-20">
      <div className="mx-auto max-w-3xl">
        <SectionHead
          eyebrow="FAQ"
          title="Frequently asked questions"
          desc="Everything you need to know before you start your free trial."
        />
        <Accordion type="single" collapsible defaultValue="item-0" className="w-full">
          {FAQS.map((f, i) => (
            <AccordionItem key={f.q} value={`item-${i}`}>
              <AccordionTrigger className="text-left text-[15px] font-medium">{f.q}</AccordionTrigger>
              <AccordionContent className="text-[15px] leading-relaxed text-muted-foreground">{f.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
