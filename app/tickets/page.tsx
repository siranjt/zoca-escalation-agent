import TicketsBrowser from "@/components/TicketsBrowser";
import HealthBadge from "@/components/HealthBadge";

export const metadata = {
  title: "All tickets · Zoca",
};

export default function Page() {
  return (
    <main className="min-h-screen bg-bg">
      <div className="mx-auto max-w-[1180px] px-8 py-8">
        <header className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-3 text-text">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/zoca-logo.svg" alt="Zoca" width={81} height={20} className="h-5 w-auto" style={{ color: "currentColor" }} />
          </div>
          <div className="flex items-center gap-6">
            <a href="/" className="text-sm text-muted2 hover:text-text transition-colors font-medium">Customer 360</a>
            <a href="/triage" className="text-sm text-muted2 hover:text-text transition-colors">Triage</a>
            <HealthBadge />
          </div>
        </header>

        <div className="text-center mb-10">
          <h1 className="text-4xl font-extrabold tracking-tight">All tickets</h1>
          <p className="mt-3 max-w-[640px] mx-auto text-sm text-muted2 leading-relaxed">
            Linear tickets across Finance + CX, filtered to the four escalation patterns —
            Churn, Retention Risk, Subscription Support, Paid Offboarding, and Subscription
            Cancellation. Sorted latest first.
          </p>
        </div>

        <TicketsBrowser />
      </div>
    </main>
  );
}
