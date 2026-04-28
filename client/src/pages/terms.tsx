import { PublicPageLayout } from "@/components/public-page-layout";

const LAST_UPDATED = "January 1, 2025";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function TermsPage() {
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
            FinVision360 is a personal finance management platform that allows you to track assets and liabilities,
            plan for retirement, manage income and expenses, and receive AI-generated financial insights. The service is
            provided for informational and organizational purposes only.
          </p>
        </Section>

        <Section title="3. Not Financial Advice">
          <p>
            <strong>Important:</strong> FinVision360 is a financial organization and planning tool — it is{" "}
            <strong>not</strong> a licensed financial advisor, investment advisor, broker-dealer, or fiduciary.
          </p>
          <p>
            All content, calculations, and AI-generated insights provided by FinVision360 are for informational
            purposes only and do not constitute financial, investment, tax, or legal advice. You should consult a
            licensed financial professional before making any significant financial decisions.
          </p>
          <p>
            Tooothy LLC and FinVision360.com are not responsible for any financial decisions made based on information
            provided by this service.
          </p>
        </Section>

        <Section title="4. Account Registration">
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>You must provide accurate and complete registration information.</li>
            <li>You are responsible for maintaining the confidentiality of your password.</li>
            <li>You are responsible for all activity that occurs under your account.</li>
            <li>You must notify us immediately of any unauthorized use of your account.</li>
            <li>One person or entity may not maintain more than one account.</li>
          </ul>
        </Section>

        <Section title="5. Acceptable Use">
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

        <Section title="6. Data and Privacy">
          <p>
            Your use of the service is also governed by our{" "}
            <a href="/privacy" className="underline hover:text-foreground">Privacy Policy</a>, which is incorporated
            into these Terms by reference. You are responsible for the accuracy of all financial data you enter into
            the platform.
          </p>
        </Section>

        <Section title="7. Intellectual Property">
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

        <Section title="8. Disclaimers">
          <p>
            THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR
            IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND
            NON-INFRINGEMENT. TOOOTHY LLC DOES NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR
            FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS.
          </p>
        </Section>

        <Section title="9. Limitation of Liability">
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

        <Section title="10. Termination">
          <p>
            We reserve the right to suspend or terminate your account at our sole discretion, with or without notice,
            for conduct that we believe violates these Terms or is harmful to other users, us, or third parties.
          </p>
          <p>
            You may delete your account at any time by contacting us at hello@finvision360.com.
          </p>
        </Section>

        <Section title="11. Governing Law">
          <p>
            These Terms are governed by the laws of the State of Illinois, without regard to its conflict of law
            provisions. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the
            courts located in Cook County, Illinois.
          </p>
        </Section>

        <Section title="12. Changes to Terms">
          <p>
            We reserve the right to modify these Terms at any time. We will notify you of material changes by updating
            the "Last updated" date. Your continued use of the service after changes are posted constitutes your
            acceptance of the revised Terms.
          </p>
        </Section>

        <Section title="13. Contact">
          <p>
            For questions about these Terms, please contact Tooothy LLC at:
          </p>
          <address className="not-italic space-y-1">
            <p><strong>Tooothy LLC</strong></p>
            <p>Northbrook, Illinois</p>
            <p>
              Email:{" "}
              <a href="mailto:hello@finvision360.com" className="underline hover:text-foreground">
                hello@finvision360.com
              </a>
            </p>
          </address>
        </Section>
      </div>
    </PublicPageLayout>
  );
}
