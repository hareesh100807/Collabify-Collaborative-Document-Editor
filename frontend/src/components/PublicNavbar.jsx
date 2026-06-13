import { Link, NavLink } from "react-router-dom";

const LogoIcon = () => (
  <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-500/25">
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 4.75h8.25L18 8.5v10.75H6V4.75Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M14 4.75V9h4" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M8.8 12.5h6.4M8.8 15.5h4.6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  </span>
);

const PublicNavbar = () => {
  const navClass = ({ isActive }) =>
    `rounded-full px-4 py-2 text-sm font-semibold transition ${
      isActive
        ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/25"
        : "text-slate-600 hover:bg-indigo-50 hover:text-indigo-700"
    }`;

  return (
    <header className="sticky top-0 z-30 border-b border-white/70 bg-white/80 backdrop-blur-xl">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-3">
          <LogoIcon />
          <div>
            <p className="text-lg font-bold tracking-tight text-slate-950">Collabify</p>
            <p className="hidden text-xs font-medium text-slate-500 sm:block">Collaborative document editor</p>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <NavLink to="/login" className={navClass}>
            Login
          </NavLink>
          <NavLink to="/register" className={navClass}>
            Register
          </NavLink>
        </div>
      </nav>
    </header>
  );
};

export default PublicNavbar;
