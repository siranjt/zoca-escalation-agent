import EscalationQueue from "@/components/EscalationQueue";
import HealthBadge from "@/components/HealthBadge";

export const metadata = {
  title: "Escalation Queue · Zoca",
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
            <a href="/" className="text-sm text-muted2 hover:text-text transition-colors">Customer 360</a>
            <a href="/triage" className="text-sm text-muted2 hover:text-text transition-colors">Triage</a>
            <a href="/tickets" className="text-sm text-muted2 hover:text-text transition-colors">All tickets</a>
            <HealthBadge />
          </div>
        </header>

        <EscalationQueue />
      </div>
    </main>
  );
}
