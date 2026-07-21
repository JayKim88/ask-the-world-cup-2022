import { QueryContainer } from "./components/QueryContainer";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center bg-zinc-50 px-4 py-12 dark:bg-black sm:py-20">
      <QueryContainer />
    </main>
  );
}
