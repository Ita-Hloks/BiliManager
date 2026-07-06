import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import type { ThemePalette } from "../theme";
import { splitRules } from "../utils";

// 把底层 `|` 拼接的正则字符串编辑成可增删的规则列表，避免各面板重复处理规则格式。
export function RuleListEditor(props: {
  label: string;
  palette: ThemePalette;
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
        <span className={`mb-2 block text-sm font-medium ${props.palette.label}`}>
          {props.label}
        </span>
        <div className="flex w-full flex-col gap-2 sm:flex-row">
          <input
            className={props.palette.textInput}
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
          <button
            aria-label={`添加${props.label}`}
            className={props.palette.addButton}
            disabled={!draft.trim() || rules.includes(draft.trim())}
            onClick={addRule}
            type="button"
          >
            <Plus className="h-4 w-4" />
            添加
          </button>
        </div>
      </label>
      {rules.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {rules.map(rule => (
            <span key={rule} className={props.palette.ruleChip}>
              {rule}
              <button
                className={props.palette.ruleDeleteButton}
                onClick={() => removeRule(rule)}
                title="删除"
                type="button"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
