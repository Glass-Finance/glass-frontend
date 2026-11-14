import SolutionSection from "../common/SolutionSection";

const features = [
  {
    icon: { publicId: "glass/icon/frame-payment", width: 100 },
    title: "Automate Recurring Payments",
    desc: "Members link their cards once, and dues are deducted automatically.",
    illustration: { publicId: "glass/solution/automate", width: 800, aspect: "475 / 241" },
  },
  {
    icon: { publicId: "glass/icon/frame-reminder", width: 100 },
    title: "Auto-recover failed payments",
    desc: "When a payment fails, Glass retries securely and sends gentle SMS reminders",
    illustration: { publicId: "glass/solution/recover", width: 800, aspect: "475 / 241" },
  },
  {
    icon: { publicId: "glass/icon/frame-receipt", width: 100 },
    title: "Generate Instant Proof",
    desc: "Auto-issued receipts and reconciled transaction logs.",
    illustration: { publicId: "glass/solution/proof", width: 800, aspect: "476 / 242" },
  },
  {
    icon: { publicId: "glass/icon/frame-flexible", width: 100 },
    title: "Monitor Payments in Real Time",
    desc: "See who has paid, who hasn't, and your total balance instantly",
    illustration: { publicId: "glass/solution/monitor", width: 800, aspect: "475 / 241" },
  },
];

export default function OurSolution() {
  return (
    <SolutionSection
      headline="Built-In Transparency for Every Transaction"
      subtext="Centralize payments, records, and visibility in one shared system, so your team stops chasing and starts leading."
      subtextMaxWidth="640px"
      features={features}
      wide
    />
  );
}
