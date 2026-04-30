import EscalationsBrowser from "@/components/EscalationsBrowser";
import HealthBadge from "@/components/HealthBadge";

export const metadata = {
  title: "Customer 360 · Zoca Escalation Agent",
};

export default function Page() {
  return (
    <main className="min-h-screen hero-bg">
      <div className="mx-auto max-w-[1180px] px-6 py-6">
        {/* Top nav */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <span className="font-black text-[22px] tracking-[-0.04em] leading-none">
              ZOC<span className="inline-block scale-x-[-1]">Q</span>
            </span>
            <span className="text-muted text-sm">·  Customer 360</span>
          </div>
          <div className="flex items-center gap-5">
            <a href="/triage" className="text-sm text-muted2 hover:text-text">Triage</a>
            <a href="/tickets" className="text-sm text-muted2 hover:text-text">All tickets</a>
            <HealthBadge />
          </div>
        </header>

        <EscalationsBrowser />
      </div>
    </main>
  );
}
