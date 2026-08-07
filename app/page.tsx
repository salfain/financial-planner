import { FinanceApp } from "./FinanceApp";

export default function Home() {
  return <>
    <script
      dangerouslySetInnerHTML={{
        __html: `if (new URLSearchParams(location.search).get("demo") === "1") { window.__FINANCE_DEMO__ = true; }`,
      }}
    />
    <FinanceApp />
  </>;
}
