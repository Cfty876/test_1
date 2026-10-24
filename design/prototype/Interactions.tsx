import { useState, type ReactNode } from "react";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "framer-motion";
import { ChevronDown } from "lucide-react";

// Independent implementation of patterns researched in 21st's Motion Navigation Menu
// (unlumen) and Animated Project Cards (isaiahbjork). See design/DESIGN.md.
export function MotionNav({
  items,
  active,
  onChange,
  label,
}: {
  items: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
  label: string;
}) {
  const reduce = useReducedMotion();
  return (
    <LayoutGroup>
      <nav className="motion-nav" aria-label={label}>
        {items.map((item) => (
          <button
            type="button"
            key={item.id}
            aria-current={item.id === active ? "page" : undefined}
            onClick={() => onChange(item.id)}
          >
            {active === item.id && (
              <motion.span
                className="nav-selection"
                layoutId="nav-selection"
                transition={
                  reduce
                    ? { duration: 0 }
                    : { type: "spring", stiffness: 380, damping: 34 }
                }
              />
            )}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </LayoutGroup>
  );
}

export function ExpandableRow({
  id,
  title,
  subtitle,
  aside,
  children,
}: {
  id: string;
  title: string;
  subtitle: string;
  aside: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  return (
    <article className="request-row">
      <button
        type="button"
        className="request-toggle"
        aria-expanded={open}
        aria-controls={"request-" + id}
        onClick={() => setOpen(!open)}
      >
        <span className="person-avatar">
          {subtitle
            .split(" ")
            .map((s) => s[0])
            .slice(0, 2)
            .join("")}
        </span>
        <span className="request-copy">
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </span>
        <span className="request-aside">{aside}</span>
        <ChevronDown size={18} className={open ? "rotated" : ""} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={"request-" + id}
            className="request-expanded"
            initial={reduce ? false : { opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.18 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}
