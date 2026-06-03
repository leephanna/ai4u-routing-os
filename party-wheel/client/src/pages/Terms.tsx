import CopyrightFooter from "@/components/CopyrightFooter";
import { useLocation } from "wouter";

export default function Terms() {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-screen bg-black text-white px-6 py-10 max-w-2xl mx-auto">
      <button onClick={() => navigate("/")} className="text-violet-400 font-orbitron text-xs mb-8 hover:text-violet-300">← Back</button>
      <h1 className="font-orbitron font-black text-2xl text-white mb-6">Terms of Service</h1>
      <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
        <p><strong className="text-white">Last updated: May 2026</strong></p>
        <p>AI4U Party Wheel ("the App") is operated by AI4U, LLC ("we," "us," or "our"). By accessing or using the App, you agree to these Terms.</p>
        <h2 className="text-white font-orbitron text-base mt-6">1. Age Requirement</h2>
        <p>You must be 18 years of age or older to use this App. By using the App, you confirm you meet this requirement.</p>
        <h2 className="text-white font-orbitron text-base mt-6">2. Content</h2>
        <p>The App may contain adult humor, suggestive content, and strong language depending on the intensity setting chosen by the room host. Content is AI-generated and may occasionally be unexpected. We are not responsible for AI-generated content that does not meet your expectations.</p>
        <h2 className="text-white font-orbitron text-base mt-6">3. User Conduct</h2>
        <p>You agree not to use the App to harass, bully, or harm other players. You agree not to attempt to circumvent game rules, cheat, or exploit technical vulnerabilities.</p>
        <h2 className="text-white font-orbitron text-base mt-6">4. Intellectual Property</h2>
        <p>All App content, branding, and code are owned by AI4U, LLC. "AI4U Party Wheel" and "Glitch After Dark" are trademarks of AI4U, LLC.</p>
        <h2 className="text-white font-orbitron text-base mt-6">5. Disclaimer</h2>
        <p>The App is provided "as is" without warranty of any kind. We are not liable for any damages arising from your use of the App.</p>
        <h2 className="text-white font-orbitron text-base mt-6">6. Contact</h2>
        <p>Questions? Email: leehanna8@gmail.com</p>
      </div>
      <CopyrightFooter />
    </div>
  );
}
