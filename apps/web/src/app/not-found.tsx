import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-24 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <Link href="/" className="text-primary underline">
        Go home
      </Link>
    </main>
  );
}
