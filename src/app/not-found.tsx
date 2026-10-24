import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 text-slate-100 p-4">
      <h2 className="text-2xl font-bold mb-2">404 - Page Not Found</h2>
      <p className="text-slate-400 mb-4">The requested operations page does not exist.</p>
      <Link
        href="/"
        className="px-4 py-2 bg-sky-600 rounded-lg text-white font-medium hover:bg-sky-500 transition"
      >
        Return to Cockpit
      </Link>
    </div>
  );
}
