import SolutionSection from "../common/SolutionSection";
import {
  RecurringIcon,
  OutstandingIcon,
  HistoryIcon,
  ContributionIcon,
} from "../common/SolutionIcons";

// Copy, icons and artwork follow the Figma "organizations" solution frame.
//
// illustration: { publicId, width, left, w, h }
//   width  – pixel width of the uploaded PNG (drives the srcSet)
//   left/w/h – the artwork's box in Figma px on a 592-wide card (bottom-anchored)
// Upload the PNGs from /solution-assets as glass/solution/<publicId tail>.
const features = [
  {
    Icon: RecurringIcon,
    title: "Set Up Recurring Payment Plans",
    desc: ["Set up recurring dues and let Glass handle", "scheduled collections."],
    illustration: {
      publicId: "glass/solution/org-recurring-plans",
      width: 686,
      left: 129,
      w: 343,
      h: 223,
    },
  },
  {
    Icon: OutstandingIcon,
    title: "Stay on Top of Outstanding Payments",
    desc: [
      "Easily identify unpaid contributions and follow up",
      "with members who still need to pay.",
    ],
    illustration: {
      publicId: "glass/solution/org-outstanding",
      width: 971,
      left: 64,
      w: 485.5,
      h: 232,
    },
  },
  {
    Icon: HistoryIcon,
    title: "Track Each Member Payment History",
    desc: ["Review individual member payments and total", "collections per plan."],
    illustration: {
      publicId: "glass/solution/org-payment-history",
      width: 982,
      left: 48,
      w: 491,
      h: 225,
    },
  },
  {
    Icon: ContributionIcon,
    title: "Built for Every Contribution",
    desc: ["Create recurring plans for regular dues or one-", "time plans for any specific need."],
    illustration: {
      publicId: "glass/solution/org-contribution-types",
      width: 980,
      left: 49,
      w: 490,
      h: 225,
    },
  },
];

export default function OurSolution() {
  return (
    <SolutionSection
      variant="orgs"
      headline="Built-In Transparency for Every Transaction"
      subtext="Centralize payments, records, and visibility in one shared system, so your team stops chasing and starts leading."
      subtextMaxWidth="640px"
      features={features}
    />
  );
}
