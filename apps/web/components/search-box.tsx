'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState } from 'react';

export function SearchBox({ placeholder = 'Search problems…' }: { placeholder?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get('q') ?? '');

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const next = new URLSearchParams(params.toString());
        if (value.trim()) next.set('q', value.trim());
        else next.delete('q');
        router.push(`${pathname}?${next.toString()}`, { scroll: false });
      }}
      className="flex items-center border border-line bg-panel-raised"
    >
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder={placeholder}
        aria-label="Search problems"
        className="mono w-full bg-transparent px-3 py-2 text-[12px] text-ink outline-none placeholder:text-ink-dim"
      />
      <button
        type="submit"
        className="mono border-l border-line px-3 py-2 text-[10px] uppercase tracking-[0.1em] text-ink-dim hover:text-signal"
      >
        Search
      </button>
    </form>
  );
}
