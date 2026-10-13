import { ArrowDown, ArrowRight, Check, ChevronRight, Minus, Sparkles } from "lucide-react";
import { Link } from "wouter";
import { PublicPageLayout } from "@/components/public-page-layout";
import { useSEO } from "@/hooks/use-seo";
import {
  pricingFeatureGroups,
  pricingFeatureLabels,
  pricingPlans,
  type FeatureValue,
  type PricingPlan,
} from "@/lib/pricing-plans";
import "./pricing-page.css";

function displayPrice(plan: PricingPlan) {
  if (plan.id === "custom") return "Based on your needs";
  return plan.price;
}

function PlanPrice({ plan }: { plan: PricingPlan }) {
  if (plan.id === "custom") {
    return <p className="pricing-custom-price">Custom pricing</p>;
  }
  return (
    <p className="pricing-price">
      <span>{plan.price}</span>
      {plan.cadence && <small>{plan.cadence}</small>}
    </p>
  );
}

function FeatureMark({ value }: { value: FeatureValue | undefined }) {
  if (typeof value === "string") {
    return <span className="pricing-feature-value">{value}</span>;
  }
  if (value) {
    return (
      <span className="pricing-check" aria-label="Included">
        <Check aria-hidden="true" />
      </span>
    );
  }
  return (
    <span className="pricing-unavailable" aria-label="Not included">
      <Minus aria-hidden="true" />
    </span>
  );
}

function PlanCard({ plan, index }: { plan: PricingPlan; index: number }) {
  return (
    <article
      className={`pricing-card ${plan.id === "plus" ? "pricing-card-featured" : ""}`}
      style={{ animationDelay: `${index * 90}ms` }}
    >
      {plan.badge && (
        <div className="pricing-popular">
          <Sparkles aria-hidden="true" />
          {plan.badge}
        </div>
      )}
      <div className="pricing-card-top">
        <div className="pricing-card-name">
          <h2>{plan.name}</h2>
          {plan.id !== "custom" && <span className="pricing-plan-index">0{index + 1}</span>}
        </div>
        <p className="pricing-plan-description">{plan.description}</p>
        <PlanPrice plan={plan} />
        {plan.id === "custom" && <p className="pricing-custom-caption">{displayPrice(plan)}</p>}
      </div>
      <div className="pricing-card-divider" />
      <p className="pricing-includes-label">
        {plan.id === "plus" || plan.id === "pro" ? "Everything in Free, including" : plan.id === "custom" ? "Built around your priorities" : "A surprisingly complete start"}
      </p>
      <ul className="pricing-highlights">
        {plan.highlights.map((featureId) => (
          <li key={featureId}>
            <span className="pricing-list-check"><Check aria-hidden="true" /></span>
            <span>
              {pricingFeatureLabels[featureId]}
              {typeof plan.features[featureId] === "string" && (
                <small>{plan.features[featureId]}</small>
              )}
            </span>
          </li>
        ))}
      </ul>
      <Link
        href="/signup"
        className={`pricing-cta pricing-cta-link ${plan.id === "plus" ? "pricing-cta-primary" : ""}`}
      >
        {plan.cta}
        <ArrowRight aria-hidden="true" />
      </Link>
      <p className="pricing-card-footnote">
        {plan.id === "custom" ? "Custom account limits and features" : plan.id === "free" ? "No payment details required" : "Monthly plan"}
      </p>
    </article>
  );
}

export default function PricingPage() {
  useSEO({
    title: "Pricing — FinVision360",
    description:
      "Compare FinVision360 monthly plans. Bring net worth, budgets, retirement, protection and your financial accounts into one connected picture.",
  });

  return (
    <PublicPageLayout width="max-w-7xl">
      <div className="pricing-page">
        <section className="pricing-hero" aria-labelledby="pricing-title">
          <div className="pricing-hero-copy">
            <div className="pricing-eyebrow"><span /> A clearer view starts here</div>
            <h1 id="pricing-title">Your whole financial life.<br /><em>One view.</em></h1>
            <p className="pricing-intro">
              Choose the level of connection that fits you. Every plan brings your financial picture into focus.
            </p>
            <a className="pricing-compare-link" href="#compare">
              Compare every feature <ArrowDown aria-hidden="true" />
            </a>
          </div>
          <div className="pricing-orbit" aria-hidden="true">
            <div className="orbit-ring orbit-ring-outer" />
            <div className="orbit-ring orbit-ring-mid" />
            <div className="orbit-ring orbit-ring-inner" />
            <span className="orbit-point orbit-point-one" />
            <span className="orbit-point orbit-point-two" />
            <span className="orbit-point orbit-point-three" />
            <div className="orbit-core">
              <span className="orbit-core-label">YOUR<br />FINANCES</span>
              <span className="orbit-core-line" />
              <span className="orbit-core-caption">connected</span>
            </div>
            <div className="orbit-note orbit-note-top"><span>01</span> TODAY</div>
            <div className="orbit-note orbit-note-bottom"><span>02</span> WHAT'S NEXT</div>
          </div>
        </section>

        <section className="pricing-plans-section" aria-label="Monthly plans">
          <div className="pricing-section-heading">
            <div>
              <span className="pricing-section-kicker">Four ways to see further</span>
              <h2>Find your financial footing.</h2>
            </div>
            <span className="pricing-monthly-note">All plans shown monthly</span>
          </div>
          <div className="pricing-cards">
            {pricingPlans.map((plan, index) => <PlanCard key={plan.id} plan={plan} index={index} />)}
          </div>
        </section>

        <section className="pricing-comparison" id="compare" aria-labelledby="comparison-title">
          <div className="pricing-section-heading comparison-heading">
            <div>
              <span className="pricing-section-kicker">No fine-print hunt</span>
              <h2 id="comparison-title">Every feature, side by side.</h2>
              <p>See exactly what comes with each way to plan.</p>
            </div>
            <span className="pricing-scroll-hint"><ChevronRight aria-hidden="true" /> Scroll to compare</span>
          </div>
          <div className="pricing-table-scroll" role="region" aria-label="Plan feature comparison" tabIndex={0}>
            <table className="pricing-table">
              <thead>
                <tr>
                  <th scope="col" className="pricing-feature-col">Included features</th>
                  {pricingPlans.map((plan) => (
                    <th scope="col" key={plan.id} className={plan.id === "plus" ? "pricing-plus-col" : ""}>
                      <span>{plan.name}</span>
                      <small>{plan.id === "custom" ? "Tailored" : plan.id === "free" ? "$0" : "Monthly"}</small>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pricingFeatureGroups.map((group) => (
                  <FeatureGroupRows key={group.title} group={group} />
                ))}
              </tbody>
            </table>
          </div>
          <p className="pricing-table-caption">
            Custom features and account limits are tailored to your needs. Plus and Pro pricing is shown as TBD.
          </p>
        </section>

        <section className="pricing-bottom-cta" aria-label="Get started">
          <div className="bottom-cta-mark" aria-hidden="true">360°</div>
          <div>
            <span className="pricing-section-kicker">Start with what you know</span>
            <h2>Clarity is a good first move.</h2>
            <p>Begin with a complete financial picture, then grow from there.</p>
          </div>
          <Link href="/signup" className="pricing-bottom-link">
            <span>Get Started <ArrowRight aria-hidden="true" /></span>
          </Link>
        </section>
      </div>
    </PublicPageLayout>
  );
}

function FeatureGroupRows({ group }: { group: (typeof pricingFeatureGroups)[number] }) {
  const features = group.features.filter((feature) => feature.compare !== false);
  if (features.length === 0) return null;

  return (
    <>
      <tr className="pricing-group-row">
        <th colSpan={pricingPlans.length + 1} scope="colgroup">{group.title}</th>
      </tr>
      {features.map((feature) => (
        <tr key={feature.id}>
          <th scope="row" className="pricing-row-label">
            <span>{feature.label}</span>
            {feature.description && <small>{feature.description}</small>}
          </th>
          {pricingPlans.map((plan) => (
            <td key={plan.id} className={plan.id === "plus" ? "pricing-plus-col" : ""}>
              <FeatureMark value={plan.features[feature.id]} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}
