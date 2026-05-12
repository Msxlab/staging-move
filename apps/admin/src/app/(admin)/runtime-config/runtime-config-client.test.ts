import { afterEach, describe, expect, it, vi } from "vitest";

type RuntimeConfigClientModule = typeof import("./runtime-config-client");

const item = {
  key: "RESEND_API_KEY",
  label: "Resend API Key",
  description: "Transactional email delivery key.",
  scope: "WEB",
  category: "EMAIL",
  isSecret: true,
  requiredInProduction: true,
  configured: true,
  source: "ENV" as const,
  status: "Verified from ENV" as const,
  editable: "Restricted" as const,
  maskedValue: "re***1234",
  warning: null,
  dbOverrideIgnored: false,
  usedBy: ["web"],
  validation: "Valid",
  notes: [],
  buildTimeOnly: false,
  conflict: false,
  updatedAt: null,
  lastValidatedAt: null,
  lastValidationStatus: null,
};

const form = {
  value: "re_live_secret_value",
  note: "rotation",
  confirmPassword: "password",
  mfaCode: "123456",
  backupCode: "backup-code",
};

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  });
}

function createHookRuntime() {
  const states: unknown[] = [];
  const effectDeps: Array<unknown[] | undefined> = [];
  let stateCursor = 0;
  let effectCursor = 0;
  let changed = false;
  let scheduledEffects: Array<() => void | (() => void)> = [];

  function depsChanged(previous: unknown[] | undefined, next: unknown[] | undefined) {
    if (!next) return true;
    if (!previous) return true;
    return next.length !== previous.length || next.some((value, index) => value !== previous[index]);
  }

  return {
    beginRender() {
      stateCursor = 0;
      effectCursor = 0;
      scheduledEffects = [];
      changed = false;
    },
    useState(initial: unknown) {
      const index = stateCursor++;
      if (!(index in states)) {
        states[index] = typeof initial === "function" ? (initial as () => unknown)() : initial;
      }
      const setState = (next: unknown) => {
        const value = typeof next === "function" ? (next as (prev: unknown) => unknown)(states[index]) : next;
        if (states[index] !== value) {
          states[index] = value;
          changed = true;
        }
      };
      return [states[index], setState] as const;
    },
    useEffect(effect: () => void | (() => void), deps?: unknown[]) {
      const index = effectCursor++;
      if (depsChanged(effectDeps[index], deps)) {
        effectDeps[index] = deps;
        scheduledEffects.push(effect);
      }
    },
    useMemo<T>(factory: () => T) {
      return factory();
    },
    takeEffects() {
      return scheduledEffects;
    },
    consumeChanged() {
      const value = changed;
      changed = false;
      return value;
    },
  };
}

function textOf(node: any): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (typeof node === "object" && "props" in node) return textOf(node.props?.children);
  return "";
}

function findAll(node: any, predicate: (node: any) => boolean, out: any[] = []) {
  if (node == null || typeof node === "boolean") return out;
  if (Array.isArray(node)) {
    node.forEach((child) => findAll(child, predicate, out));
    return out;
  }
  if (typeof node === "object" && "props" in node) {
    if (predicate(node)) out.push(node);
    findAll(node.props?.children, predicate, out);
  }
  return out;
}

function findButton(tree: any, label: string) {
  const button = findAll(tree, (node) => node.type === "button" && textOf(node).includes(label))[0];
  if (!button) throw new Error(`Button not found: ${label}`);
  return button;
}

function findField(tree: any, placeholder: string) {
  const field = findAll(
    tree,
    (node) => (node.type === "input" || node.type === "textarea") && node.props?.placeholder === placeholder,
  )[0];
  if (!field) throw new Error(`Field not found: ${placeholder}`);
  return field;
}

async function createRenderedClient(fetchMock: ReturnType<typeof vi.fn>) {
  const runtime = createHookRuntime();
  vi.resetModules();
  vi.doMock("react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("react")>();
    return {
      ...actual,
      useEffect: runtime.useEffect,
      useMemo: runtime.useMemo,
      useState: runtime.useState,
    };
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("confirm", vi.fn(() => true));
  vi.stubGlobal("window", { confirm: vi.fn(() => true) });

  const mod: RuntimeConfigClientModule = await import("./runtime-config-client");
  let tree: any = null;

  async function renderUntilSettled() {
    for (let index = 0; index < 20; index++) {
      runtime.beginRender();
      tree = mod.default();
      for (const effect of runtime.takeEffects()) effect();
      await Promise.resolve();
      await Promise.resolve();
      if (!runtime.consumeChanged()) break;
    }
    return tree;
  }

  async function change(placeholder: string, value: string) {
    const field = findField(tree, placeholder);
    field.props.onChange({ target: { value } });
    await renderUntilSettled();
  }

  async function click(label: string) {
    findButton(tree, label).props.onClick();
    await renderUntilSettled();
  }

  await renderUntilSettled();
  return {
    mod,
    get tree() {
      return tree;
    },
    click,
    change,
    text() {
      return textOf(tree);
    },
    fieldValue(placeholder: string) {
      return findField(tree, placeholder).props.value;
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.doUnmock("react");
  vi.resetModules();
  vi.restoreAllMocks();
});

describe("RuntimeConfigClient step-up payload helpers", () => {
  it("sends MFA code and backup code for update", async () => {
    const mod: RuntimeConfigClientModule = await import("./runtime-config-client");
    expect(mod.buildRuntimeConfigUpdatePayload("RESEND_API_KEY", form)).toEqual({
      key: "RESEND_API_KEY",
      value: "re_live_secret_value",
      note: "rotation",
      confirmPassword: "password",
      mfaCode: "123456",
      backupCode: "backup-code",
    });
  });

  it("sends MFA code and backup code for delete", async () => {
    const mod: RuntimeConfigClientModule = await import("./runtime-config-client");
    expect(mod.buildRuntimeConfigDeletePayload("RESEND_API_KEY", form)).toEqual({
      key: "RESEND_API_KEY",
      confirmPassword: "password",
      mfaCode: "123456",
      backupCode: "backup-code",
    });
  });

  it("omits blank optional MFA fields", async () => {
    const mod: RuntimeConfigClientModule = await import("./runtime-config-client");
    expect(
      mod.buildRuntimeConfigDeletePayload("RESEND_API_KEY", {
        ...form,
        mfaCode: " ",
        backupCode: "",
      }),
    ).toEqual({
      key: "RESEND_API_KEY",
      confirmPassword: "password",
      mfaCode: undefined,
      backupCode: undefined,
    });
  });

  it("clears password, MFA code, and backup code without dropping value draft", async () => {
    const mod: RuntimeConfigClientModule = await import("./runtime-config-client");
    expect(mod.clearRuntimeConfigStepUp(form)).toEqual({
      value: "re_live_secret_value",
      note: "rotation",
      confirmPassword: "",
      mfaCode: "",
      backupCode: "",
    });
  });

  it("renders the masked display value rather than a raw secret", async () => {
    const mod: RuntimeConfigClientModule = await import("./runtime-config-client");
    expect(mod.getRuntimeConfigDisplayValue({ maskedValue: "re***1234" })).toBe("re***1234");
    expect(mod.getRuntimeConfigDisplayValue({ maskedValue: null })).toBe("Not configured");
  });
});

describe("RuntimeConfigClient rendered behavior", () => {
  it("submits step-up fields on save, shows MFA prompt, clears step-up fields, and never submits maskedValue", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(await jsonResponse({ configs: [item] }))
      .mockResolvedValueOnce(await jsonResponse({ error: "MFA required", requiresMfa: true }, 403));
    const rendered = await createRenderedClient(fetchMock);

    await rendered.click("Edit");
    await rendered.change("Paste secret value", "re_live_new_secret_value");
    await rendered.change("Rotation, override, emergency, etc.", "rotate");
    await rendered.change("Required", "correct-password");
    await rendered.change("Authenticator code", "123456");
    await rendered.change("Recovery code", "backup-code");
    await rendered.click("Save Override");

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body).toMatchObject({
      key: "RESEND_API_KEY",
      value: "re_live_new_secret_value",
      note: "rotate",
      confirmPassword: "correct-password",
      mfaCode: "123456",
      backupCode: "backup-code",
    });
    expect(body.value).not.toBe(item.maskedValue);
    expect(rendered.text()).toContain("MFA code or backup code is required for this change.");
    expect(rendered.fieldValue("Required")).toBe("");
    expect(rendered.fieldValue("Authenticator code")).toBe("");
    expect(rendered.fieldValue("Recovery code")).toBe("");
  });

  it("clears step-up fields after a successful save", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(await jsonResponse({ configs: [item] }))
      .mockResolvedValueOnce(await jsonResponse({ success: true }))
      .mockResolvedValueOnce(await jsonResponse({ configs: [item] }));
    const rendered = await createRenderedClient(fetchMock);

    await rendered.click("Edit");
    await rendered.change("Paste secret value", "re_live_new_secret_value");
    await rendered.change("Required", "correct-password");
    await rendered.change("Authenticator code", "123456");
    await rendered.change("Recovery code", "backup-code");
    await rendered.click("Save Override");
    await rendered.click("Edit");

    expect(rendered.fieldValue("Required")).toBe("");
    expect(rendered.fieldValue("Authenticator code")).toBe("");
    expect(rendered.fieldValue("Recovery code")).toBe("");
    expect(rendered.fieldValue("Paste secret value")).toBe("");
  });

  it("sends step-up fields on delete/reset", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(await jsonResponse({ configs: [item] }))
      .mockResolvedValueOnce(await jsonResponse({ success: true }))
      .mockResolvedValueOnce(await jsonResponse({ configs: [item] }));
    const rendered = await createRenderedClient(fetchMock);

    await rendered.click("Edit");
    await rendered.change("Required", "correct-password");
    await rendered.change("Authenticator code", "123456");
    await rendered.change("Recovery code", "backup-code");
    await rendered.click("Reset to ENV");

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(fetchMock.mock.calls[1][1]).toMatchObject({ method: "DELETE" });
    expect(body).toEqual({
      key: "RESEND_API_KEY",
      confirmPassword: "correct-password",
      mfaCode: "123456",
      backupCode: "backup-code",
    });
  });
});
