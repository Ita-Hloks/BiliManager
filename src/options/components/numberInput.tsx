import { ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { clamp } from "../utils";
import { Button } from "./button";

export type NumberInputProps = {
  value: number;
  min: number;
  max: number;
  step?: number;
  integer?: boolean;
  disabled?: boolean;
  ariaLabel?: string;
  className?: string;
  onCommit: (value: number) => void;
};

// 允许用户在输入过程中清空和编辑草稿，只在失焦或回车时校验、夹断并提交数值。
export function NumberInput(props: NumberInputProps) {
  const [draft, setDraft] = useState(() => props.value.toString());
  const [isFocused, setIsFocused] = useState(false);

  const displayValue = isFocused ? draft : props.value.toString();

  function commitDraft() {
    const trimmed = draft.trim();
    if (trimmed === "") {
      setDraft(props.value.toString());
      return;
    }

    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      setDraft(props.value.toString());
      return;
    }

    const clamped = clamp(parsed, props.min, props.max);
    const next = props.integer ? Math.round(clamped) : clamped;
    setDraft(next.toString());
    if (next !== props.value) {
      props.onCommit(next);
    }
  }

  return (
    <input
      aria-label={props.ariaLabel}
      className={["bm-number-input", props.className].filter(Boolean).join(" ")}
      disabled={props.disabled}
      inputMode={props.integer ? "numeric" : "decimal"}
      max={props.max}
      min={props.min}
      step={props.step}
      type="number"
      value={displayValue}
      onBlur={() => {
        commitDraft();
        setIsFocused(false);
      }}
      onChange={event => setDraft(event.target.value)}
      onFocus={() => {
        setDraft(props.value.toString());
        setIsFocused(true);
      }}
      onKeyDown={event => {
        if (event.key === "Enter") {
          event.preventDefault();
          commitDraft();
        } else if (event.key === "Escape") {
          setDraft(props.value.toString());
          event.currentTarget.blur();
        }
      }}
    />
  );
}

export type NumberFieldProps = NumberInputProps & {
  suffix?: string;
  widthClassName?: string;
  onStepUp?: () => void;
  onStepDown?: () => void;
  stepUpLabel?: string;
  stepDownLabel?: string;
};

/**
 * 组合数字输入框：统一承载单位后缀与可选微调步进按钮。
 */
export function NumberField({
  suffix,
  widthClassName = "w-32",
  onStepUp,
  onStepDown,
  stepUpLabel,
  stepDownLabel,
  ariaLabel,
  className,
  disabled,
  ...rest
}: NumberFieldProps) {
  return (
    <div className={["bm-number-input-group", widthClassName].join(" ")}>
      <NumberInput
        ariaLabel={ariaLabel}
        className={["bm-number-input-field", className].filter(Boolean).join(" ")}
        disabled={disabled}
        {...rest}
      />
      {suffix && <span className="bm-number-suffix">{suffix}</span>}
      {(onStepUp || onStepDown) && (
        <div className="flex w-7 shrink-0 flex-col divide-y divide-[var(--bm-divider)] border-l border-[var(--bm-border)] bg-[var(--bm-surface-subtle)]">
          <Button
            aria-label={stepUpLabel ?? "增加"}
            disabled={disabled}
            icon={<ChevronUp className="h-3 w-3" />}
            size="sm"
            variant="numberStep"
            onClick={onStepUp}
          />
          <Button
            aria-label={stepDownLabel ?? "减少"}
            disabled={disabled}
            icon={<ChevronDown className="h-3 w-3" />}
            size="sm"
            variant="numberStep"
            onClick={onStepDown}
          />
        </div>
      )}
    </div>
  );
}
