export default function Footer() {
  return (
    <footer className="bg-white border-t border-zinc-100 pb-10 pt-8 text-center space-y-2 mt-auto">
      <p className="text-zinc-400 text-xs">
        Powered by Claude API · Real-time Analysis · iOS &amp; Android
      </p>
      <p className="text-zinc-800 text-sm font-semibold">Made by 임재준</p>
      <p className="text-zinc-400 text-xs flex items-center justify-center gap-2 flex-wrap">
        <a
          href="mailto:leemjaejun@gmail.com"
          className="hover:text-indigo-500 transition-colors"
        >
          leemjaejun@gmail.com
        </a>
        <span className="text-zinc-200">·</span>
        <a
          href="https://github.com/JJleem"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-indigo-500 transition-colors"
        >
          github.com/JJleem
        </a>
        <span className="text-zinc-200">·</span>
        <a
          href="https://molt-ten.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-indigo-500 transition-colors"
        >
          molt-ten.vercel.app
        </a>
      </p>
    </footer>
  );
}
