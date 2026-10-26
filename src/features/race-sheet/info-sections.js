// Blocs facultatifs d’une fiche : nutrition, rappels, infos pratiques, sources, plan personnel.

import { el } from "../../ui/dom.js";
import { formatDateRange } from "../../ui/format.js";

/** Paragraphe « **Titre :** texte ». */
export function leadParagraph(lead, text) {
  return el("p", {}, [el("strong", { text: `${lead} :` }), ` ${text}`]);
}

function renderRules(title, items) {
  return el("section", { className: "section" }, [
    el("h2", { text: title }),
    el(
      "div",
      { className: "rules" },
      items.map(item =>
        el("div", { className: "rule" }, [
          el("b", { text: item.title }),
          el("p", { text: item.text })
        ])
      )
    )
  ]);
}

export function renderNutrition(nutrition) {
  const overview = el("div", { className: "fuel-overview" }, [
    el("strong", { text: nutrition.headline })
  ]);
  for (const detail of nutrition.details || []) {
    overview.append(
      typeof detail === "string"
        ? el("p", { text: detail })
        : leadParagraph(detail.lead, detail.text)
    );
  }
  return el("section", { className: "section fuel-section" }, [
    el("h2", { text: nutrition.title }),
    overview
  ]);
}

export function renderReminders(reminders) {
  return renderRules(reminders.title, reminders.items);
}

export function renderPracticalInfo(info) {
  return renderRules(info.title || "Infos pratiques", info.items);
}

export function renderSources(sources, verifiedAt) {
  const section = el("section", { className: "section" }, [
    el("h2", { text: "Sources" }),
    el(
      "ul",
      { className: "race-sources" },
      sources.map(source =>
        el("li", {}, [
          el("a", {
            text: source.label,
            attrs: { href: source.url, target: "_blank", rel: "noopener noreferrer" }
          })
        ])
      )
    )
  ]);
  if (verifiedAt) {
    section.append(
      el("p", { className: "sub", text: `Vérifié le ${formatDateRange(verifiedAt)}.` })
    );
  }
  return section;
}

/** Indique si le plan personnel est chargé, ou pourquoi il ne l’est pas. */
export function renderPersonalPlanStatus(plan, storageError = null) {
  if (!plan && !storageError) return null;
  return el(
    "aside",
    { className: "personal-plan-tools", attrs: { "aria-label": "État du plan personnel" } },
    [
      el("p", {
        className: "sub personal-plan-status",
        text: plan
          ? "Plan personnel enregistré sur cet appareil."
          : "Le plan personnel ne peut pas être chargé depuis le stockage local de cet appareil.",
        attrs: { role: "status", "aria-live": "polite" }
      })
    ]
  );
}
