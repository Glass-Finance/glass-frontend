import { useNavigate } from "react-router-dom";
import { goToApp } from "../../utils/deviceRedirect";
import HowItWorksSection from "../howItWorks/HowItWorksSection";

const steps = [
  {
    num: "01",
    label: "Create Your Community",
    desc: "Set up your organisation in minutes — no paperwork, no bank visits.",
    badge: "Set Up With Few Clicks",
    img: { publicId: "glass/work/org-create-community", width: 1440, aspect: "563 / 303" },
    stepIcon: { publicId: "glass/icon/step-1", width: 80 },
  },
  {
    num: "02",
    label: "Add Members",
    desc: "Invite by phone or email, or bulk-import your roster via CSV instantly.",
    badge: "Upload CSV For Bulk Addition",
    img: { publicId: "glass/work/org-add-members", width: 1440, aspect: "563 / 303" },
    stepIcon: { publicId: "glass/icon/step-2", width: 80 },
  },
  {
    num: "03",
    label: "Set Payment Schedule",
    desc: "Define dues, set deadlines — monthly, yearly, or custom. Glass reconciles everything.",
    badge: "Set Your Dues Structure",
    img: { publicId: "glass/work/org-set-payment-schedule", width: 1440, aspect: "563 / 303" },
    stepIcon: { publicId: "glass/icon/step-3", width: 80 },
  },
  {
    num: "04",
    label: "Go Live!",
    desc: "Activate your community. Payments run automatically, receipts sent instantly.",
    badge: "Activate Your Community",
    img: { publicId: "glass/work/org-go-live", width: 1440, aspect: "563 / 303" },
    stepIcon: { publicId: "glass/icon/step-4", width: 80 },
  },
];

export default function GetStarted() {
  const navigate = useNavigate();
  return (
    <HowItWorksSection
      steps={steps}
      onCtaClick={() => goToApp("/sign-up", navigate)}
      ctaLabel="Get Started Free"
      desktopLayout="grid"
    />
  );
}
