import Link from "next/link";

export default function Home() {
  return (
    <main className="p-8 font-outfit">
      <h1 className="text-2xl font-bold">Orqestra</h1>
      <p className="mt-2">Control Plane – intent to execution to evidence to outcome.</p>
      <p className="mt-4">
        <Link href="/login" className="text-blue-600 hover:underline dark:text-blue-400">
          Sign in
        </Link>
      </p>
    </main>
  );
}
