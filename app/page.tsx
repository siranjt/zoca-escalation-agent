import EscalationsBrowser from "@/components/EscalationsBrowser";
import HealthBadge from "@/components/HealthBadge";

export const metadata = {
  title: "Customer 360 · Zoca Escalation Agent",
};

export default function Page() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Zoca Escalation Agent</h1>
          <p className="text-muted mt-2">
            Search by business name, entity ID (UUID), email, or Chargebee customer ID. One
            search returns triage of their latest message, all related Linear tickets
            (Finance + CX), and the full comms timeline (App Chat / Email / Phone / Video / SMS).
          </p>
        </div>
        <nav className="flex gap-4 text-sm text-muted whitespace-nowrap">
          <a href="/triage" className="hover:text-text underline-offset-4 hover:underline">
            Triage by message
          </a>
          <a href="/tickets" className="hover:text-text underline-offset-4 hover:underline">
            All tickets
          </a>
        </nav>
      </header>
      <div className="mb-6">
        <HealthBadge />
      </div>
      <EscalationsBrowser />
    </main>
  );
}
