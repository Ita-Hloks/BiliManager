export function Switch(props: { disabled?: boolean; enabled: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={[
        "inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 ease-out",
        props.enabled ? "bg-[var(--bm-accent)]" : "bg-[var(--bm-switch-off)]",
        props.disabled ? "opacity-50" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <span
        aria-hidden="true"
        className={[
          "block h-4 w-4 shrink-0 rounded-full bg-white shadow-sm transition-transform duration-200 ease-out",
          props.enabled ? "translate-x-4" : "translate-x-0",
        ].join(" ")}
      />
    </span>
  );
}
