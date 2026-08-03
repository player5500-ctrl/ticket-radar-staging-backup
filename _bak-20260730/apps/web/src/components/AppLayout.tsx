import { NavLink, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";

import { Logo } from "./Logo";
import { api } from "../services/api";

function navClass({ isActive }: { isActive: boolean }) {
  return `bottom-nav__link${isActive ? " bottom-nav__link--active" : ""}`;
}

export function AppLayout() {
  const sessionQuery = useQuery({
    queryKey: ["auth-session"],
    queryFn: api.session,
    retry: false,
    staleTime: 60_000,
  });
  const isAdmin = import.meta.env.DEV || sessionQuery.data?.user.role === "admin";

  async function logout() {
    const { logoutUrl } = await api.logout();
    window.location.assign(logoutUrl);
  }

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="site-header__inner">
          <NavLink to="/" className="site-header__brand">
            <Logo />
          </NavLink>
          {isAdmin ? (
            <NavLink className="demo-pill" to="/admin">
              管理後台
            </NavLink>
          ) : null}
          {!import.meta.env.DEV && sessionQuery.data ? (
            <button className="demo-pill" type="button" onClick={() => void logout()}>
              登出
            </button>
          ) : null}
        </div>
      </header>

      <main id="main-content" className="main-content">
        <Outlet />
      </main>

      <nav className="bottom-nav" aria-label="主要導覽">
        <NavLink to="/" end className={navClass}>
          <span aria-hidden="true">⌂</span>
          首頁
        </NavLink>
        <NavLink to="/search" className={navClass}>
          <span aria-hidden="true">⌕</span>
          搜尋
        </NavLink>
        <NavLink to="/tasks" className={navClass}>
          <span aria-hidden="true">✓</span>
          任務
        </NavLink>
        <NavLink to="/records" className={navClass}>
          <span aria-hidden="true">▤</span>
          紀錄
        </NavLink>
        <span className="bottom-nav__future" aria-label="我的設定將在後續階段提供">
          <span aria-hidden="true">○</span>
          我的
        </span>
      </nav>
    </div>
  );
}
