import Link from "next/link";

export default function NotFound() {
  return (
    <article className="py-16">
      <h1 className="font-serif text-3xl font-semibold">This page doesn&apos;t exist</h1>
      <p className="mt-3 text-lg text-muted">The link may be mistyped, or the page may have moved.</p>
      <Link href="/" className="mt-6 inline-block rounded-md bg-ink px-5 py-2.5 font-medium text-surface">Go to the overview</Link>
    </article>
  );
}
