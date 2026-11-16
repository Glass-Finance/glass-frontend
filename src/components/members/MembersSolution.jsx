import SolutionSection from "../common/SolutionSection";
import { ClickPayIcon, BellIcon, ReceiptIcon } from "../common/SolutionIcons";

// Copy, icons and artwork follow the Figma "members" solution frame.
// See OurSolution.jsx for the illustration field contract.
const features = [
  {
    Icon: ClickPayIcon,
    title: "Make Payments With Ease",
    desc: ["Pay your dues in seconds from any device.", "No more manual transfers."],
    illustration: {
      publicId: "glass/solution/member-pay",
      width: 705,
      left: 99.5,
      w: 352.5,
      h: 205.5,
    },
  },
  {
    Icon: BellIcon,
    title: "Never Miss A Due Date",
    desc: ["Get reminders via SMS, WhatsApp, and Email so you", "never miss a deadline."],
    illustration: {
      publicId: "glass/solution/member-reminders",
      width: 784,
      left: 98.5,
      w: 392,
      h: 208.5,
    },
  },
  {
    Icon: ReceiptIcon,
    title: "Easy Access To Your Payment History",
    desc: "Easily Track Past Payments.",
    illustration: {
      publicId: "glass/solution/member-history",
      width: 704,
      left: 156,
      w: 352,
      h: 211.5,
    },
  },
  {
    Icon: ReceiptIcon,
    title: "Generate Instant Proof",
    desc: "Download official receipts immediately after paying.",
    illustration: {
      publicId: "glass/solution/member-receipt",
      width: 432,
      left: 172,
      w: 216,
      h: 237.5,
    },
  },
];

export default function MembersSolution() {
  return (
    <SolutionSection
      variant="members"
      headline="Everything You Need to Pay with Confidence"
      subtext="One tap to pay, instant receipts, and a full history — so you never have to dig through chats again."
      subtextMaxWidth="600px"
      features={features}
    />
  );
}
