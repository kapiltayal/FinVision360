import { PublicPageLayout } from "@/components/public-page-layout";
import { useSEO } from "@/hooks/use-seo";

const LAST_UPDATED = "January 1, 2025";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  useSEO({
    title: "Privacy Policy | FinVision360 by Tooothy LLC",
    description: "Read the FinVision360 Privacy Policy. Learn how Tooothy LLC collects, uses, and protects your personal and financial data when you use our personal finance platform.",
    canonical: "https://finvision360.com/privacy",
  });
  return (
    <PublicPageLayout>
      <div className="space-y-10">
        <div className="space-y-3">
          <h1 className="text-4xl font-bold tracking-tight">Privacy Policy</h1>
          <p className="text-muted-foreground text-sm">Last updated: {LAST_UPDATED}</p>
          <p className="text-muted-foreground leading-relaxed">
            FinVision360.com is operated by <strong>Tooothy LLC</strong>, a Northbrook, IL based company. This Privacy
            Policy explains how we collect, use, and protect your information when you use our service.
          </p>
        </div>

        <div className="h-px bg-border" />

        <Section title="1. Information We Collect">
          <p>We collect information you provide directly to us when you create an account or use our services:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li><strong>Account information:</strong> username, email address, and full name.</li>
            <li><strong>Financial data:</strong> assets, liabilities, income, expenses, retirement goals, and insurance policies you enter into the app.</li>
            <li><strong>Usage data:</strong> how you interact with the app, such as features used and pages visited.</li>
          </ul>
          <p>
            We do <strong>not</strong> collect or store bank login credentials, payment card numbers, or real-time
            financial account feeds. All financial data entered is provided manually by you.
          </p>
        </Section>

        <Section title="2. How We Use Your Information">
          <p>We use the information we collect to:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li>Provide, maintain, and improve FinVision360 services.</li>
            <li>Personalize your experience and deliver AI-generated financial insights.</li>
            <li>Respond to your comments, questions, and support requests.</li>
            <li>Send you service-related notices and updates.</li>
            <li>Monitor and analyze usage trends to improve the platform.</li>
          </ul>
        </Section>

        <Section title="3. AI Features and Third-Party Services">
          <p>
            FinVision360 uses OpenAI's API to power its AI Advisor features (debt strategy, net worth forecasting, and
            scenario analysis). When you use these features, a summary of your financial data is transmitted to OpenAI's
            servers to generate responses. This data is subject to{" "}
            <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              OpenAI's privacy policy
            </a>
            . We do not share your personally identifiable information (name, email) with OpenAI.
          </p>
        </Section>

        <Section title="4. Data Storage and Security">
          <p>
            Your data is stored in a secure PostgreSQL database. We use industry-standard security measures including
            encrypted connections (TLS/HTTPS), hashed passwords (using scrypt), and session-based authentication.
          </p>
          <p>
            While we take reasonable steps to protect your data, no method of electronic storage is 100% secure. We
            encourage you to use a strong, unique password for your FinVision360 account.
          </p>
        </Section>

        <Section title="5. Data Sharing and Disclosure">
          <p>We do not sell, trade, or rent your personal information to third parties. We may share information only in the following circumstances:</p>
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li><strong>Service providers:</strong> Third-party vendors (such as hosting and AI services) who assist in operating our platform, subject to confidentiality agreements.</li>
            <li><strong>Legal requirements:</strong> If required by law, court order, or governmental authority.</li>
            <li><strong>Business transfers:</strong> In connection with a merger, acquisition, or sale of all or a portion of Tooothy LLC's assets.</li>
          </ul>
        </Section>

        <Section title="6. Cookies and Local Storage">
          <p>
            We use session cookies to keep you logged in and maintain your preferences. We do not use third-party
            advertising or tracking cookies.
          </p>
        </Section>

        <Section title="7. Your Rights and Choices">
          <ul className="list-disc list-inside space-y-1 pl-2">
            <li><strong>Access and correction:</strong> You can view and update your account information at any time in Settings.</li>
            <li><strong>Data deletion:</strong> You may request deletion of your account and associated data by contacting us at hello@finvision360.com.</li>
            <li><strong>Opt-out:</strong> You may stop using the service at any time.</li>
          </ul>
        </Section>

        <Section title="8. Children's Privacy">
          <p>
            FinVision360 is not intended for children under the age of 13. We do not knowingly collect personal
            information from children under 13. If you believe we have inadvertently collected such information, please
            contact us immediately.
          </p>
        </Section>

        <Section title="9. Changes to This Policy">
          <p>
            We may update this Privacy Policy from time to time. We will notify you of significant changes by updating
            the "Last updated" date at the top of this page. Your continued use of the service after changes are posted
            constitutes your acceptance of the revised policy.
          </p>
        </Section>

        <Section title="10. Contact Us">
          <p>
            If you have questions about this Privacy Policy, please contact Tooothy LLC at:
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
