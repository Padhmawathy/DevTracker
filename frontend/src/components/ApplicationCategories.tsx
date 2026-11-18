
import { useEffect, useState, type FormEvent } from "react";
import { FolderKanban, Plus, Save, Trash2 } from "lucide-react";

import {
  getAppCategories,
  updateAppCategories,
  type AppCategory,
  type AppCategoryRule,
} from "../services/api";

const CATEGORY_OPTIONS: { value: AppCategory; label: string }[] = [
  { value: "development", label: "Development" },
  { value: "research", label: "Research" },
  { value: "testing", label: "Testing" },
  { value: "design", label: "Design" },
  { value: "communication", label: "Communication" },
  { value: "meetings", label: "Meetings" },
  { value: "personal", label: "Personal" },
  { value: "other", label: "Other" },
];

const inputStyle =
  "ui-input";

export default function ApplicationCategories() {
  const [rules, setRules] = useState<AppCategoryRule[]>([]);
  const [newApp, setNewApp] = useState("");
  const [newCategory, setNewCategory] =
    useState<AppCategory>("development");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      try {
        const response = await getAppCategories();

        if (!cancelled) {
          setRules(response.rules);
        }
      } catch {
        if (!cancelled) {
          setError("Unable to load application categories.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCategories();

    return () => {
      cancelled = true;
    };
  }, []);

  function updateRule(
    index: number,
    changes: Partial<AppCategoryRule>
  ) {
    setRules((current) =>
      current.map((rule, i) =>
        i === index ? { ...rule, ...changes } : rule
      )
    );

    setSuccess("");
    setError("");
  }

  function addRule() {
    const appName = newApp.trim();

    if (!appName || appName.length > 120) {
      setError("Enter an application name (1–120 characters).");
      return;
    }

    const exists = rules.some(
      (rule) =>
        rule.app_name.trim().toLowerCase() ===
        appName.toLowerCase()
    );

    if (exists) {
      setError("This application already has a category.");
      return;
    }

    setRules((current) => [
      ...current,
      { app_name: appName, category: newCategory },
    ]);

    setNewApp("");
    setError("");
    setSuccess("");
  }

  function removeRule(index: number) {
    setRules((current) =>
      current.filter((_, i) => i !== index)
    );

    setError("");
    setSuccess("");
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading || saving) return;

    const normalizedRules = rules.map((rule) => ({
      app_name: rule.app_name.trim(),
      category: rule.category,
    }));

    const names = normalizedRules.map((rule) =>
      rule.app_name.toLowerCase()
    );

    if (
      normalizedRules.some(
        (rule) =>
          rule.app_name.length < 1 ||
          rule.app_name.length > 120
      )
    ) {
      setError("Application names must contain 1–120 characters.");
      return;
    }

    if (new Set(names).size !== names.length) {
      setError("Duplicate application names are not allowed.");
      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const response = await updateAppCategories(normalizedRules);

      setRules(response.rules);
      setSuccess("Application categories saved successfully.");
    } catch {
      setError(
        "Unable to save categories. Your changes are still in the editor."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSave}
      className="ui-card overflow-hidden"
    >
      <div className="flex items-center gap-3 border-b border-[var(--dx-border)] px-5 py-4">
        <FolderKanban size={19} className="text-[var(--dx-accent-text)]" />

        <div>
          <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-[var(--dx-heading)]">
            Application Categories
          </h2>

          <p className="mt-1 text-[11px] text-[var(--dx-muted)]">
            Organize applications according to your own workflow.
          </p>
        </div>
      </div>

      <div className="space-y-5 p-5">
        {loading ? (
          <p className="text-sm text-[var(--dx-muted)]">
            Loading application categories...
          </p>
        ) : (
          <>
            {rules.length === 0 ? (
              <p className="text-sm text-[var(--dx-muted)]">
                No application categories configured yet.
              </p>
            ) : (
              <div className="space-y-3">
                {rules.map((rule, index) => (
                  <div
                    key={index}
                    className="flex flex-wrap items-center gap-3"
                  >
                    <input
                      type="text"
                      aria-label={`Application name ${index + 1}`}
                      maxLength={120}
                      value={rule.app_name}
                      onChange={(event) =>
                        updateRule(index, {
                          app_name: event.target.value,
                        })
                      }
                      className={`${inputStyle} min-w-0 flex-1 basis-40`}
                    />

                    <select
                      aria-label={`Category for ${rule.app_name}`}
                      value={rule.category}
                      onChange={(event) =>
                        updateRule(index, {
                          category: event.target.value as AppCategory,
                        })
                      }
                      className={`${inputStyle} flex-1 basis-36`}
                    >
                      {CATEGORY_OPTIONS.map((option) => (
                        <option
                          key={option.value}
                          value={option.value}
                        >
                          {option.label}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      aria-label={`Remove ${rule.app_name}`}
                      title={`Remove ${rule.app_name}`}
                      onClick={() => removeRule(index)}
                      className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--dx-danger)] hover:bg-[var(--ui-fill)]"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-3 border-t border-[var(--dx-border)] pt-5">
              <h3 className="text-[13px] font-medium text-[var(--dx-heading)]">
                Add application
              </h3>

              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  aria-label="New application name"
                  maxLength={120}
                  value={newApp}
                  onChange={(event) => setNewApp(event.target.value)}
                  placeholder="e.g. Visual Studio Code"
                  className={`${inputStyle} min-w-0 flex-1 basis-40`}
                />

                <select
                  aria-label="New application category"
                  value={newCategory}
                  onChange={(event) =>
                    setNewCategory(event.target.value as AppCategory)
                  }
                  className={`${inputStyle} flex-1 basis-36`}
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={addRule}
                  className="ui-btn h-[38px] px-4 text-[var(--dx-accent-text)]"
                >
                  <Plus size={17} />
                  Add
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={saving}
              className="ui-btn-primary flex items-center gap-2 px-5 py-2.5"
            >
              <Save size={17} />
              {saving ? "Saving..." : "Save Categories"}
            </button>
          </>
        )}

        {success && (
          <p role="status" className="text-sm text-[var(--dx-accent-text)]">
            {success}
          </p>
        )}

        {error && (
          <p role="alert" className="text-sm text-[var(--dx-danger)]">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
