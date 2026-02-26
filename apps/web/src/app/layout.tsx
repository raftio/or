import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Orqestra",
  description: "Control Plane – Intent to Execution to Evidence to Outcome",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 text-gray-900">
        <nav className="border-b bg-white px-6 py-3">
          <div className="mx-auto flex max-w-6xl gap-6">
            <Link href="/" className="font-semibold text-gray-900">
              Orqestra
            </Link>
            <Link href="/ticket" className="text-gray-600 hover:text-gray-900">
              Ticket
            </Link>
            <Link href="/pr" className="text-gray-600 hover:text-gray-900">
              PR Intelligence
            </Link>
            <Link href="/state" className="text-gray-600 hover:text-gray-900">
              State
            </Link>
            <Link href="/outcomes" className="text-gray-600 hover:text-gray-900">
              Outcomes
            </Link>
          </div>
        </nav>
        <main className="mx-auto max-w-4xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
