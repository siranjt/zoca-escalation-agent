import EscalationsBrowser from "@/components/EscalationsBrowser";

export const metadata = {
  title: "Escalation History · Zoca",
};

export default function Page() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Customer 360</h1>
          <p className="text-muted mt-2">
            Search by business name, entity ID (UUID), email, or Chargebee customer ID. One
            search returns triage of their latest message, all related Linear tickets
            (Finance + CX), and the full comms timeline (App Chat / Email / Phone / Video / SMS).
          </p>
        </div>
        <nav className="flex gap-4 text-sm text-muted whitespace-nowrap">
          <a href="/" className="hover:text-text underline-offset-4 hover:underline">
            Triage by message
          </a>
          <a href="/tickets" className="hover:text-text underline-offset-4 hover:underline">
            All tickets
          </a>
        </nav>
      </header>
      <EscalationsBrowser />
    </main>
  );
}
