import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "./button";
import { splitRules } from "../utils";

// 把底层 `|` 拼接的正则字符串编辑成可增删的规则列表，避免各面板重复处理规则格式。
export function RuleListEditor(props: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const rules = splitRules(props.value);

  function addRule() {
    const trimmed = draft.trim();
    if (!trimmed || rules.includes(trimmed)) return;
    props.onChange([...rules, trimmed].join("|"));
    setDraft("");
  }

  function removeRule(rule: string) {
    props.onChange(rules.filter(item => item !== rule).join("|"));
  }

  return (
    <div>
      <label className="block">
        <span className="bm-text-label mb-2 block text-sm font-medium">{props.label}</span>
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <input
            className="bm-text-input"
            placeholder={props.placeholder}
            type="text"
            value={draft}
            onChange={event => setDraft(event.target.value)}
            onKeyDown={event => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              addRule();
            }}
          />
          <Button
            aria-label={`添加${props.label}`}
            disabled={!draft.trim() || rules.includes(draft.trim())}
            icon={<Plus className="h-4 w-4" />}
            onClick={addRule}
            size="full"
            variant="primary"
          >
            添加
          </Button>
        </div>
      </label>
      {rules.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {rules.map(rule => (
            <span
              key={rule}
              className="inline-flex items-center gap-1.5 rounded-md bg-sky-50 px-2 py-1 text-xs text-slate-700 transition-colors duration-200 ease-out dark:bg-bili-blue/10 dark:text-slate-200"
            >
              {rule}
              <Button
                aria-label="删除规则"
                icon={<Trash2 className="h-3 w-3" />}
                onClick={() => removeRule(rule)}
                size="sm"
                title="删除"
                variant="icon"
              />
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
