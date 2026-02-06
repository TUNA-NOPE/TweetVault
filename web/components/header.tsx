import Link from "next/link";
import SearchForm from "./search-form";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link
          href="/"
          className="text-lg font-bold text-zinc-100 hover:text-white transition-colors"
        >
          TweetVault
        </Link>
        <SearchForm />
      </div>
    </header>
  );
}
