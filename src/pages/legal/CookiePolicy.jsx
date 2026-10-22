import { Link } from "react-router-dom";
import { useSeoMeta } from "../../hooks/useSeoMeta";
import LegalPageLayout from "../../components/legal/LegalPageLayout";

export default function CookiePolicy() {
  useSeoMeta({
    title: "Cookie Policy",
    description: "How Glass Finance uses cookies and similar technologies.",
    path: "/cookies",
  });

  return (
    <LegalPageLayout
      title="Glass Finance — Cookie Policy"
      effectiveDate="1st of August, 2026"
      lastUpdated="22nd of October, 2026"
    >
      <p>
        This Cookie Policy explains how Glass Limited ("Glass," "we," "us," "our") uses cookies and
        similar technologies on our website and applications (the "Platform"). This Policy
        supplements our <Link to="/privacy">Privacy Policy</Link> and should be read alongside it.
        Capitalized terms not defined here have the meaning given in the{" "}
        <Link to="/terms">Terms of Service</Link>.
      </p>

      <h2>1. What Are Cookies</h2>
      <p>
        Cookies are small text files placed on your device when you visit a website or use an
        application. They allow the Platform to recognize your device, remember your preferences,
        and support essential functionality such as staying logged in. We also use similar
        technologies, including local storage, mobile SDK identifiers, and pixel tags, which are
        collectively referred to as "cookies" in this Policy unless otherwise specified.
      </p>

      <h2>2. Essential Cookies</h2>
      <p>
        Essential cookies are strictly necessary for the Platform to function, including enabling
        secure log-in, processing payments, and maintaining Platform stability. These cookies do not
        require consent because the Platform cannot operate without them, and they cannot be
        disabled through our cookie settings (though you may block them via your browser, which may
        prevent the Platform from working correctly).
      </p>

      <h2>3. Authentication Cookies</h2>
      <p>
        We use cookies to recognize you as a logged-in User across pages and sessions, so you do not
        need to re-enter your credentials on every page. These cookies are essential to Account
        security and Platform functionality.
      </p>

      <h2>4. Security Cookies</h2>
      <p>
        We use cookies to detect suspicious activity, prevent fraud, enforce our{" "}
        <Link to="/acceptable-use">Acceptable Use Policy</Link>, and protect Accounts from
        unauthorized access, including cookies that support device fingerprinting for fraud-risk
        scoring in coordination with our Payment Processor and KYC Provider.
      </p>

      <h2>5. Analytics Cookies</h2>
      <p>
        We use analytics cookies to understand how Users interact with the Platform — for example,
        which features are used most, how Users navigate between pages, and where Users encounter
        errors. This helps us improve the Platform. Analytics cookies are non-essential and are only
        set with your consent, where required by Applicable Law.
      </p>

      <h2>6. Performance Cookies</h2>
      <p>
        Performance cookies help us monitor Platform speed, stability, and error rates, allowing us
        to diagnose and resolve technical issues. Where these cookies are non-essential, they are
        only set with your consent.
      </p>

      <h2>7. Preference Cookies</h2>
      <p>
        Preference cookies remember your settings and choices, such as language, currency display,
        or notification preferences, so you do not need to reconfigure them on each visit.
      </p>

      <h2>8. Session Cookies</h2>
      <p>
        Session cookies are temporary and are deleted when you close your browser or app session. We
        use session cookies to maintain Platform state during a single visit, such as keeping you
        logged in while you navigate between pages of a payment flow.
      </p>

      <h2>9. Third-Party Cookies</h2>
      <p>
        Some cookies on the Platform are set by third parties who provide services to us, such as
        analytics providers, and, where applicable, our Payment Processor's embedded payment
        widgets. These third parties may use cookies to provide fraud detection, analytics, or
        payment functionality, subject to their own privacy and cookie policies. We do not permit
        third-party advertising cookies on the Platform.
      </p>
      <p>
        The Platform's support chatbox is provided by Crisp, a third-party chat service. Its cookies
        use the "crisp-client" prefix and keep your support conversation working across pages and
        visits. The chatbox runs in Total Privacy Mode: no chatbox cookies are set until you open
        the chatbox and begin a conversation yourself.
      </p>

      <h2>10. Managing Cookies</h2>
      <p>
        Where required by Applicable Law, we will present a cookie consent banner or settings panel
        allowing you to accept or reject non-essential cookies (analytics, performance, and
        preference cookies) when you first visit the Platform, and to change your preferences at any
        time through Platform settings.
      </p>

      <h2>11. Browser Settings</h2>
      <p>
        Most browsers allow you to block or delete cookies through their settings. Instructions vary
        by browser; please consult your browser's help documentation. Please note that blocking
        essential cookies may prevent you from logging in, making payments, or using core Platform
        features.
      </p>

      <h2>12. Consent</h2>
      <p>
        By using the Platform and, where applicable, accepting our cookie banner, you consent to our
        use of essential and (where you accept them) non-essential cookies as described in this
        Policy. You may withdraw consent to non-essential cookies at any time through Platform
        settings or your browser, without affecting the lawfulness of prior use based on consent
        already given.
      </p>

      <h2>13. Retention</h2>
      <p>
        Cookie retention periods vary by type: session cookies are deleted when you close your
        session; authentication cookies typically persist for the length of a login session or a
        limited "remember me" period; analytics and preference cookies typically persist for up to
        twelve (12) months, after which they expire or are refreshed upon renewed consent.
      </p>

      <h2>14. Future Technologies</h2>
      <p>
        As the Platform evolves, we may adopt additional tracking or personalization technologies
        (for example, in connection with future wallet, savings, or AI-powered financial insight
        features). Where such technologies involve non-essential cookies or similar tracking, we
        will update this Policy and, where required by Applicable Law, obtain your consent before
        deployment.
      </p>

      <h2>15. Changes to This Policy</h2>
      <p>
        We may update this Policy from time to time to reflect changes in the cookies and
        technologies we use. Material changes will be communicated through the Platform with an
        updated "Last Updated" date.
      </p>

      <h2>16. Contact Us</h2>
      <p>
        Glass Limited
        <br />
        Email: <a href="mailto:legal@glasspay.app">legal@glasspay.app</a>
        <br />
        Address: 1, Onyemergwu Close, Abule Egba, Lagos
      </p>
      <p>
        For more on how we handle Personal Information generally, see our{" "}
        <Link to="/privacy">Privacy Policy</Link>.
      </p>
    </LegalPageLayout>
  );
}
