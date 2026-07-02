import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { Shield } from "lucide-react";
import "../styles/globals.css";
import { defaultSettings, getSettings } from "../shared/storage";
import type { ExtensionSettings } from "../shared/types";

function OptionsApp() {
  const [_settings, setSettings] = useState<ExtensionSettings>(defaultSettings);

  useEffect(() => {
    void getSettings().then(setSettings);
  }, []);

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-8 text-zinc-100">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-normal">BiliManager 设置</h1>
          <p className="mt-2 text-sm text-zinc-400">Demo</p>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <Panel
            icon={Shield}
            title="权限与页面注入"
            body="content script 已接入 B 站页面，当前只做握手和角标占位。后续过滤逻辑会迁移到这里。"
          />
        </section>
      </div>
    </main>
  );
}

function Panel(props: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
}) {
  const Icon = props.icon;
  return (
    <article className="rounded-md border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-bili-blue/15 text-bili-blue">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="text-base font-medium text-zinc-100">{props.title}</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-400">{props.body}</p>
    </article>
  );
}

createRoot(document.getElementById("root")!).render(<OptionsApp />);
