export default function Home() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Orqestra</h1>
      <p className="text-gray-600">
        Control Plane for the flow: Intent → Execution → Evidence → Outcome →
        Feedback.
      </p>
      <ul className="list-inside list-disc space-y-2 text-gray-700">
        <li>
          <a href="/ticket" className="text-blue-600 hover:underline">
            Ticket
          </a>{" "}
          – View context, bundles, evidence status; build bundle from ticket.
        </li>
        <li>
          <a href="/pr" className="text-blue-600 hover:underline">
            PR Intelligence
          </a>{" "}
          – Summary, risk flags, evidence validation for a PR.
        </li>
        <li>
          <a href="/state" className="text-blue-600 hover:underline">
            State
          </a>{" "}
          – View flow state per ticket; emit events.
        </li>
        <li>
          <a href="/outcomes" className="text-blue-600 hover:underline">
            Outcomes
          </a>{" "}
          – View outcome records by release or ticket.
        </li>
      </ul>
    </div>
  );
}
