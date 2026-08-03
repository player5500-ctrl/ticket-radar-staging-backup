import type { HTMLAttributes, ReactNode } from "react";

export type CardProps = HTMLAttributes<HTMLElement> & {
  children: ReactNode;
};

export function Card({ children, className = "", ...props }: CardProps) {
  return (
    <article className={`tr-card ${className}`.trim()} {...props}>
      {children}
    </article>
  );
}
