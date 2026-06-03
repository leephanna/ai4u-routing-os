import CopyrightFooter from "@/components/CopyrightFooter";
import { useLocation } from "wouter";

export default function Privacy() {
  const [, navigate] = useLocation();
  return (
    <div className="min-h-screen bg-black text-white px-6 py-10 max-w-2xl mx-auto">
      <button onClick={() => navigate("/")} className="text-violet-400 font-orbitron text-xs mb-8 hover:text-violet-300">← Back</button>
      <h1 className="font-orbitron font-black text-2xl text-white mb-6">Privacy Policy</h1>
      <div className="space-y-4 text-sm text-gray-300 leading-relaxed">
        <p><strong className="text-white">Last updated: May 2026</strong></p>
        <p>AI4U, LLC ("we") operates AI4U Party Wheel. This policy explains what data we collect and how we use it.</p>
        <h2 className="text-white font-orbitron text-base mt-6">What We Collect</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Display names and avatar selections you provide when joining a game</li>
          <li>Anonymous session identifiers stored in your browser's local storage</li>
          <li>Game scores, chat messages, and game events during active sessions</li>
          <li>If you sign in with OAuth (optional): your name and email from your provider</li>
        </ul>
        <h2 className="text-white font-orbitron text-base mt-6">What We Don't Collect</h2>
        <ul className="list-disc pl-5 space-y-1">
          <li>Payment information (no purchases exist currently)</li>
          <li>Device identifiers or location data</li>
          <li>Biometric data of any kind</li>
        </ul>
        <h2 className="text-white font-orbitron text-base mt-6">How We Use Data</h2>
        <p>Data is used solely to operate the game — matching players to rooms, displaying scores, and generating replay cards. We do not sell or share your data with third parties for advertising.</p>
        <h2 className="text-white font-orbitron text-base mt-6">Data Retention</h2>
        <p>Game sessions and associated data are retained for up to 90 days. Anonymous guest sessions expire after 4 hours of inactivity.</p>
        <h2 className="text-white font-orbitron text-base mt-6">Giphy</h2>
        <p>The App uses the Giphy API to display reaction GIFs. Giphy's own privacy policy applies to GIF requests: <a href="https://support.giphy.com/hc/en-us/articles/360032872931" target="_blank" rel="noopener noreferrer" className="text-violet-400 hover:text-violet-300">giphy.com/privacy</a></p>
        <h2 className="text-white font-orbitron text-base mt-6">Contact</h2>
        <p>Privacy questions: leehanna8@gmail.com</p>
      </div>
      <CopyrightFooter />
    </div>
  );
}
