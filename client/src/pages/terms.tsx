import { PublicPageLayout } from "@/components/public-page-layout";
import { useSEO } from "@/hooks/use-seo";

const LAST_UPDATED = "September 23, 2026";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function TermsPage() {
  useSEO({
    title: "Terms & Conditions | FinVision360 by Tooothy LLC",
    description: "Read the FinVision360 Terms and Conditions. By using our personal finance platform, you agree to these terms set by Tooothy LLC, Northbrook, IL.",
    canonical: "https://finvision360.com/terms",
  });
  return (
    <PublicPageLayout>
      <div className="space-y-10">
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight">Terms and Conditions</h1>
          <p className="text-muted-foreground text-sm">Last updated: {LAST_UPDATED}</p>
          <p className="text-muted-foreground leading-relaxed">
            These Terms and Conditions govern your use of FinVision360.com, a product of{" "}
            <strong>Tooothy LLC</strong>, a Northbrook, IL based company ("Company," "we," "us," or "our"). By accessing
            or using our service, you agree to be bound by these terms.
          </p>
        </div>

        <div className="h-px bg-border" />

        <Section title="1. Acceptance of Terms">
          <p>
            By creating an account or using FinVision360, you confirm that you are at least 18 years old, have read and
            understood these Terms, and agree to be bound by them. If you do not agree, please do not use the service.
          </p>
        </Section>

        <Section title="2. Description of Service">
          <p>
            FinVision360 is a personal finance organization and planning platform operated by Tooothy LLC. Depending on
            availability, the service may allow you to track assets and liabilities, calculate net worth, manage income
            and expenses, create budgets and goals, plan for retirement, review insurance and estate-planning information,
            import financial information from files or connected accounts, review bank-rate information, and receive
            AI-generated financial insights.
          </p>
          <p>
            FinVision360 is currently under active development. Features may be incomplete, unavailable, inaccurate,
            changed, suspended, or removed without notice. Descriptions of features on the website are informational and
            do not guarantee that a particular feature will be available, suitable, or error-free for you.
          </p>
        </Section>

        <Section title="3. Not Financial Advice">
          <p>
            <strong>Important:</strong> FinVision360 is a financial organization and planning tool — it is{" "}
            <strong>not</strong> a licensed financial advisor, investment advisor, broker-dealer, or fiduciary.
          </p>
          <p>
            All content, calculations, projections, rates, categorizations, imported information, and AI-generated
            insights provided by FinVision360 are for informational and organizational purposes only. They do not
            constitute financial, investment, tax, accounting, legal, insurance, or other professional advice, and they
            are not a recommendation to buy, sell, hold, borrow, refinance, insure, or take any other action.
          </p>
          <p>
            You should independently verify information and calculations and consult qualified financial, tax, legal,
            insurance, or other professionals before making significant financial decisions. You are solely responsible
            for evaluating information provided by the service and for every decision or action you take.
          </p>
        </Section>

        <Section title="4. Connected Accounts and Third-Party Data">
          <p>
            If you choose to connect a financial institution through Plaid, you authorize Plaid and the applicable
            financial institution to provide account information to FinVision360. This may include account details,
            balances, and transaction information used to display connected accounts, refresh balances, track assets and
            liabilities, and support income and expense tracking. You enter your financial institution credentials
            directly into Plaid Link; FinVision360 does not receive or store those login credentials.
          </p>
          <p>
            Connected-account information and imported transactions may be delayed, incomplete, categorized incorrectly,
            or otherwise inaccurate. Financial institutions, Plaid, and other third parties control the availability and
            accuracy of the information they provide. FinVision360 does not guarantee that connected-account data,
            transaction data, balances, rates, or other third-party information is accurate, complete, current, or
            available. You are responsible for reviewing imported information and correcting or excluding it before
            relying on it.
          </p>
          <p>
            Plaid and other third-party services are independent services and may have their own terms and privacy
            policies. For information about Plaid's handling of connected-account information, see{" "}
            <a href="https://plaid.com/legal/#end-user-privacy-policy" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              Plaid's End User Privacy Policy
            </a>
            .
          </p>
        </Section>

        <Section title="5. Account Registration">
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>You must provide accurate and complete registration information.</li>
            <li>You are responsible for maintaining the confidentiality of your password.</li>
            <li>You are responsible for all activity that occurs under your account.</li>
            <li>You must notify us immediately of any unauthorized use of your account.</li>
            <li>One person or entity may not maintain more than one account.</li>
          </ul>
        </Section>

        <Section title="6. Acceptable Use">
          <p>You agree not to:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Use the service for any unlawful purpose or in violation of any applicable laws.</li>
            <li>Attempt to gain unauthorized access to any portion of the service or its infrastructure.</li>
            <li>Transmit viruses, malware, or other harmful code.</li>
            <li>Scrape, crawl, or systematically extract data from the service without our written permission.</li>
            <li>Use the service to infringe on the intellectual property rights of others.</li>
            <li>Impersonate any person or entity.</li>
          </ul>
        </Section>

        <Section title="7. Data and Privacy">
          <p>
            Your use of the service is also governed by our{" "}
            <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a>, which is incorporated
            into these Terms by reference. You are responsible for the accuracy of all financial data you enter into
            or import into the platform, and for reviewing data received from connected accounts before relying on it.
          </p>
        </Section>

        <Section title="8. Intellectual Property">
          <p>
            The FinVision360 platform, including its design, features, code, and content, is owned by Tooothy LLC and
            protected by applicable intellectual property laws. You are granted a limited, non-exclusive,
            non-transferable license to use the service for your personal, non-commercial purposes.
          </p>
          <p>
            You retain ownership of the financial data you input into the service. By using the service, you grant
            Tooothy LLC a limited license to process and display that data solely for the purpose of providing the
            service to you.
          </p>
        </Section>

        <Section title="9. Disclaimers and Accuracy">
          <p>
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR
            IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
            NON-INFRINGEMENT. TOOOTHY LLC DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR
            FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.
          </p>
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, TOOOTHY LLC AND FINVISION360 ARE NOT RESPONSIBLE FOR ANY
            INACCURACIES, ERRORS, OMISSIONS, DELAYS, OR INCOMPLETENESS IN USER-ENTERED DATA, FILE IMPORTS, CONNECTED
            ACCOUNT OR TRANSACTION DATA, BANK-RATE INFORMATION, CATEGORIZATIONS, CALCULATIONS, PROJECTIONS, OR
            AI-GENERATED CONTENT. WE ARE ALSO NOT RESPONSIBLE FOR ANY LOSS, DAMAGE, OR HARM RESULTING FROM YOUR
            RELIANCE ON OR USE OF THAT INFORMATION. YOU MUST VERIFY INFORMATION THROUGH APPROPRIATE PRIMARY SOURCES
            AND PROFESSIONAL ADVICE BEFORE ACTING ON IT.
          </p>
        </Section>

        <Section title="10. Limitation of Liability">
          <p>
            TO THE MAXIMUM EXTENT PERMITTED BY LAW, TOOOTHY LLC AND ITS OFFICERS, DIRECTORS, EMPLOYEES, AND AGENTS
            SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING
            LOSS OF PROFITS, DATA, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH YOUR USE OF THE SERVICE.
          </p>
          <p>
            OUR TOTAL LIABILITY TO YOU FOR ANY CLAIMS ARISING FROM YOUR USE OF THE SERVICE SHALL NOT EXCEED THE AMOUNT
            YOU PAID TO US, IF ANY, IN THE TWELVE MONTHS PRECEDING THE CLAIM.
          </p>
        </Section>

        <Section title="11. Termination">
          <p>
            We reserve the right to suspend or terminate your account at our sole discretion, with or without notice,
            for conduct that we believe violates these Terms or is harmful to other users, us, or third parties.
          </p>
          <p>
            You may delete your account at any time by contacting us at contactus@finvision360.com.
          </p>
        </Section>

        <Section title="12. Governing Law">
          <p>
            These Terms are governed by the laws of the State of Illinois, without regard to its conflict of law
            provisions. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the
            courts located in Cook County, Illinois.
          </p>
        </Section>

        <Section title="13. Changes to Terms">
          <p>
            We reserve the right to modify these Terms at any time. We will notify you of material changes by updating
            the "Last updated" date. Your continued use of the service after changes are posted constitutes your
            acceptance of the revised Terms.
          </p>
        </Section>

        <Section title="14. Contact">
          <p>
            For questions about these Terms, please contact Tooothy LLC at:
          </p>
          <address className="not-italic space-y-1">
            <p><strong>Tooothy LLC</strong></p>
            <p>Northbrook, Illinois</p>
            <p>
              Email:{" "}
              <a href="mailto:contactus@finvision360.com" className="underline hover:text-foreground">
                contactus@finvision360.com
              </a>
            </p>
          </address>
        </Section>
      </div>
    </PublicPageLayout>
  );
}
