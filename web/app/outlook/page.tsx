import OutlookView from "@/components/outlook/OutlookView";
import { causal, forecasts, outlookAnswer, radarScores } from "@/lib/outlook";
import { fmtRefreshed } from "@/lib/format";

export const metadata = { title: "Outlook & scenarios | NorthStar" };

export default function OutlookPage() {
  return (
    <article>
      <h1 className="max-w-3xl font-serif text-3xl leading-tight font-semibold sm:text-4xl">
        What comes next, and how would a rate shock ripple through sectors?
      </h1>
      <p className="mt-3 max-w-2xl text-lg text-muted">{outlookAnswer()}</p>
      <p className="mt-2 text-xs text-muted">
        Models last run {fmtRefreshed(forecasts.generated_at)} ET ({forecasts.model}, DoubleML).
      </p>
      <OutlookView forecasts={forecasts} causal={causal} radar={radarScores()} />
    </article>
  );
}
