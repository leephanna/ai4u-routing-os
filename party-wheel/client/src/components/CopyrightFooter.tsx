export default function CopyrightFooter({ className = "" }: { className?: string }) {
  return (
    <footer className={`text-center text-[9px] font-orbitron text-gray-700 py-2 ${className}`}>
      <span>© AI4U, LLC ·{" "}
        <a
          href="https://AI4Utech.com"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-gray-500 transition-colors"
        >
          AI4Utech.com
        </a>
        {" "}· Lee Hanna
      </span>
      {" · "}
      <a href="/terms" className="hover:text-gray-500 transition-colors">Terms</a>
      {" · "}
      <a href="/privacy" className="hover:text-gray-500 transition-colors">Privacy</a>
      {" · 18+ Only"}
    </footer>
  );
}
