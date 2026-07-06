export function Switch(props: { disabled?: boolean; enabled: boolean }) {
  return (
    <span
      className={[
        "inline-flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition-colors duration-300 ease-out",
        props.disabled && props.enabled
          ? "bg-sky-700/70"
          : props.enabled
            ? "bg-sky-500"
            : "bg-slate-300",
      ].join(" ")}
    >
      <span
        className={[
          "block h-4 w-4 shrink-0 rounded-full bg-white transition-transform duration-300 ease-out shadow-sm",
          props.disabled ? "opacity-85" : "",
          props.enabled ? "translate-x-4" : "translate-x-0",
        ].join(" ")}
      />
    </span>
  );
}
