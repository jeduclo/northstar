import AskView from "@/components/ask/AskView";

export const metadata = { title: "Ask the data | NorthStar" };

export default function AskPage() {
  return (
    <article>
      <h1 className="max-w-3xl font-serif text-3xl leading-tight font-semibold sm:text-4xl">
        What would you like to know about the two economies?
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">
        Ask in plain language. The assistant writes a SQL query against the dashboard&apos;s data, runs it, and shows the
        answer with the query it used.
      </p>
      <AskView />
    </article>
  );
}
