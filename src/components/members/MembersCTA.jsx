import { useNavigate } from "react-router-dom";
import CTASection from "../common/CTASection";

export default function MembersCTA() {
  const navigate = useNavigate();

  function handleJoin() {
    navigate("/member/join");
  }

  return (
    <CTASection
      headline="Bring clarity to your community finances."
      subtext="Pay dues, track your history, and get receipts — all in one place."
      buttonLabel="Join A Community"
      buttonHoverVariant="lift"
      onButtonClick={handleJoin}
    />
  );
}
