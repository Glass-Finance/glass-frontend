import { Link } from "react-router-dom";
import CloudImage from "../common/CloudImage";

export default function LegalPageLayout({ title, effectiveDate, lastUpdated, children }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 no-underline">
            <CloudImage
              publicId="glass/Glass"
              alt="Glass"
              width={48}
              objectFit="contain"
              className="w-6 h-6"
            />
            <span className="font-bold text-lg text-gray-900">Glass</span>
          </Link>
          <Link
            to="/"
            className="text-xs font-medium text-gray-500 hover:text-gray-900 no-underline transition-colors"
          >
            ← Back to glasspay.app
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{title}</h1>
        <p className="text-xs text-gray-500 mb-10">
          Effective Date: {effectiveDate} &nbsp;·&nbsp; Last Updated: {lastUpdated}
        </p>
        <div className="legal-prose">{children}</div>
      </main>

      <footer className="border-t border-gray-100">
        <div className="max-w-3xl mx-auto px-6 py-8 text-center">
          <p className="text-xs text-gray-400">
            Copyright © {new Date().getFullYear()} Glass Limited
          </p>
        </div>
      </footer>
    </div>
  );
}
