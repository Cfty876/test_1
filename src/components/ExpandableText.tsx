import { useId, useState } from 'react';

export function ExpandableText({ text, limit = 360 }: { text: string; limit?: number }) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const long = text.length > limit;
  return <div className="expandable-text"><p id={id}>{long && !expanded ? `${text.slice(0, limit).trimEnd()}…` : text}</p>{long && <button type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setExpanded((value) => !value)}>{expanded ? 'Свернуть' : 'Читать полностью'}</button>}</div>;
}
