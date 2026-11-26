import { Plus, X } from "lucide-react";
import { useState } from "react";
import { splitRules } from "../utils";
import { Button } from "./button";

// 把底层 `|` 拼接的正则字符串编辑成可增删的规则列表，避免各面板重复处理规则格式。
export function RuleListEditor(props: {
  label?: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const rules = splitRules(props.value);

  function addRule() {
    const candidates = splitRules(draft);
    if (candidates.length === 0) return;

    for (const candidate of candidates) {
      try {
        void new RegExp(candidate, "i");
      } catch {
        setError(`正则表达式格式有误：${candidate}`);
        return;
      }
    }

    const nextRules = [...rules];
    for (const candidate of candidates) {
      if (!nextRules.includes(candidate)) {
        nextRules.push(candidate);
      }
    }
    if (nextRules.length === rules.length) {
      setError("这条规则已经加过了");
      return;
    }

    props.onChange(nextRules.join("|"));
    setDraft("");
    setError("");
  }

  function removeRule(rule: string) {
    props.onChange(rules.filter(item => item !== rule).join("|"));
  }

  const inputRow = (
    <div className="flex w-full flex-col gap-2 sm:flex-row">
      <div className="relative flex min-w-0 flex-1 items-center">
        <input
          aria-invalid={error ? true : undefined}
          aria-label={props.label ?? "过滤规则"}
          className="bm-text-input pr-8"
          placeholder={props.placeholder}
          type="text"
          value={draft}
          onChange={event => {
            setDraft(event.target.value);
            if (error) setError("");
          }}
          onKeyDown={event => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            addRule();
          }}
        />
        {draft.length > 0 && (
          <button
            aria-label="清空输入"
            className="absolute right-2 inline-flex h-5 w-5 items-center justify-center rounded text-[var(--bm-text-tertiary)] transition-colors hover:bg-[var(--bm-surface-hover)] hover:text-[var(--bm-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-bili-blue/40"
            type="button"
            onClick={() => {
              setDraft("");
              if (error) setError("");
            }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <Button
        aria-label={props.label ? `添加${props.label}` : "添加规则"}
        disabled={!draft.trim() || rules.includes(draft.trim())}
        icon={<Plus className="h-4 w-4" />}
        size="full"
        variant="primary"
        onClick={addRule}
      >
        添加
      </Button>
    </div>
  );

  return (
    <div>
      {props.label ? (
        <label className="block">
          <span className="bm-text-label mb-2 block text-sm font-medium">{props.label}</span>
          {inputRow}
        </label>
      ) : (
        inputRow
      )}
      {error && (
        <p className="mt-2 text-xs text-rose-600 dark:text-rose-300" role="alert">
          {error}
        </p>
      )}
      {rules.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {rules.map(rule => (
            <span
              key={rule}
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--bm-border)] bg-[var(--bm-surface-subtle)] px-2.5 py-1 text-xs text-[var(--bm-text-primary)] transition-colors duration-200 ease-out hover:border-[var(--bm-border-strong)]"
            >
              <span>{rule}</span>
              <Button
                aria-label={`删除规则 ${rule}`}
                className="!p-0.5"
                icon={<X className="h-3 w-3" />}
                size="sm"
                title="删除"
                variant="icon"
                onClick={() => removeRule(rule)}
              />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
