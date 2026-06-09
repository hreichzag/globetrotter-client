import type { ReactNode } from 'react';

export function InfoCard(props: { children: ReactNode; title: string }) {
  return (
    <section className="info-card">
      <h2>{props.title}</h2>
      {props.children}
    </section>
  );
}
