import RotationView from "@/components/rotation/RotationView";
import { rotationAnswer } from "@/lib/rotation";
import { rotation } from "@/lib/data";

export const metadata = { title: "Sector rotation | MacroIntelligence" };

export default function RotationPage() {
  return (
    <article>
      <h1 className="max-w-3xl font-serif text-3xl leading-tight font-semibold sm:text-4xl">
        How is capital rotating across sectors in Canada and the U.S.?
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">{rotationAnswer(rotation)}</p>
      <RotationView data={rotation} />
    </article>
  );
}
