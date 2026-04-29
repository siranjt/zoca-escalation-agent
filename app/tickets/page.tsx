import TicketsBrowser from "@/components/TicketsBrowser";

export const metadata = {
  title: "Finance Tickets · Zoca",
};

export default function Page() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Finance Tickets</h1>
          <p className="text-muted mt-2">
            Linear tickets across the Finance and Customer Success teams filtered to the four
            escalation patterns — Churn, Retention Risk, Subscription Support, and Paid
            Offboarding. Sorted latest first.
          </p>
        </div>
        <nav className="flex gap-4 text-sm text-muted">
          <a href="/" className="hover:text-text underline-offset-4 hover:underline">Triage</a>
          <a href="/escalations" className="hover:text-text underline-offset-4 hover:underline">History</a>
        </nav>
      </header>
      <TicketsBrowser />
    </main>
  );
}
