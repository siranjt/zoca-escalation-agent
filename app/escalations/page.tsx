import EscalationsBrowser from "@/components/EscalationsBrowser";

export const metadata = {
  title: "Escalation History · Zoca",
};

export default function Page() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Customer Escalation History</h1>
          <p className="text-muted mt-2">
            Search by business name, entity ID (UUID), email, or Chargebee customer ID. We'll
            pull every message they appear in across App Chat, Email, Phone, Video, and SMS.
          </p>
        </div>
        <nav className="flex gap-4 text-sm text-muted whitespace-nowrap">
          <a href="/" className="hover:text-text underline-offset-4 hover:underline">
            Triage
          </a>
          <a href="/tickets" className="hover:text-text underline-offset-4 hover:underline">
            Tickets
          </a>
        </nav>
      </header>
      <EscalationsBrowser />
    </main>
  );
}
