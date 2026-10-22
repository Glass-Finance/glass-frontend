import { useNavigate } from "react-router-dom";
import HowItWorksSection from "../howItWorks/HowItWorksSection";

const steps = [
  {
    num: "01",
    label: "Get Invited",
    desc: "Receive an invite link from your admin via WhatsApp or SMS. One tap and you're in.",
    badge: "Instant Access",
    img: { publicId: "glass/work/member-get-invited", width: 1440, aspect: "563 / 303" },
    stepIcon: { publicId: "glass/icon/step-1", width: 80 },
  },
  {
    num: "02",
    label: "Create Account",
    desc: "Sign up in under 60 seconds. Email only — no long forms, no waiting.",
    badge: "No Long Forms",
    img: { publicId: "glass/work/member-create-account", width: 1440, aspect: "567 / 303" },
    stepIcon: { publicId: "glass/icon/step-2", width: 80 },
  },
  {
    num: "03",
    label: "Set Up Payment",
    desc: "Add your card, bank, or USSD once. Glass stores it securely — never re-enter it.",
    badge: "Set Your Dues Structure",
    img: { publicId: "glass/work/member-set-up-payment", width: 1440, aspect: "563 / 303" },
    stepIcon: { publicId: "glass/icon/step-3", width: 80 },
  },
];

export default function MembersHowItWorks() {
  const navigate = useNavigate();

  function handleJoin() {
    navigate("/member/join");
  }

  return <HowItWorksSection steps={steps} onCtaClick={handleJoin} />;
}
