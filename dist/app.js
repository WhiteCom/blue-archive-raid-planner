"use strict";

const students = new Map(window.raidStudents.map(student => [student.id, student]));
const collator = new Intl.Collator("ko");
const sortedStudents = [...students.values()].sort((a, b) => collator.compare(a.name, b.name));
const aliases = new Map([[10045, "수시노"], [20027, "수로코"]]);
const genericTargets = new Map([
  ["none", { name: "지정 없음", symbol: "–" }],
  ["enemy", { name: "보스 / 적", symbol: "◎" }],
  ["all", { name: "아군 전체", symbol: "▦" }],
  ["self", { name: "자신", symbol: "•" }],
  ["area", { name: "지점 / 범위", symbol: "◇" }],
]);
const storageKey = "raid-planner:1";

const byId = id => document.getElementById(id);

function element(tag, className, label) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (label !== undefined) node.textContent = label;
  return node;
}

function clone(plan) {
  return { roster: [...plan.roster], steps: plan.steps.map(step => ({ ...step })) };
}

function examplePlan() {
  return {
    roster: [10045, 20027, 20041, 10000, 20039, 13006],
    steps: [
      { actor: 10045, target: "none" },
      { actor: 20027, target: "enemy" },
      { actor: 20041, target: 10000 },
      { actor: 10000, target: "enemy" },
      { actor: 20039, target: 10000 },
    ],
  };
}

function readPlan(value) {
  if (!Array.isArray(value?.roster) || value.roster.length !== 6 || !Array.isArray(value.steps)) return null;
  const roster = value.roster.map(id => students.has(id) ? id : null);
  const occupied = new Set(roster.filter(id => id !== null));
  if (occupied.size !== roster.filter(id => id !== null).length) return null;
  const steps = value.steps.map(step => ({
    actor: occupied.has(step?.actor) ? step.actor : null,
    target: occupied.has(step?.target) || genericTargets.has(step?.target) ? step.target : null,
  }));
  return { roster, steps };
}

function isReady(plan) {
  return plan.roster.every(Boolean) && plan.steps.length > 0 && plan.steps.every(step => step.actor && step.target !== null);
}

function readState() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey));
    const draft = readPlan(saved?.draft);
    const applied = readPlan(saved?.applied);
    if (draft && applied && isReady(applied)) {
      const cursor = Number.isInteger(saved.cursor) ? Math.max(0, Math.min(applied.steps.length, saved.cursor)) : 0;
      return { draft, applied, cursor };
    }
  } catch {
    // A blocked or invalid store should not prevent using the planner.
  }
  return { draft: examplePlan(), applied: examplePlan(), cursor: 0 };
}

let { draft, applied, cursor } = readState();
let pickerSlot = null;
let pickerTrigger = null;

function save() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ draft, applied, cursor }));
  } catch {
    // The planner remains usable when browser storage is unavailable.
  }
}

function portrait(student, size = "") {
  const symbol = student?.symbol ?? (student ? [...student.name].slice(0, 1).join("") : "+");
  const imageBox = element("span", "portrait " + size + (student?.id ? "" : " placeholder"), symbol);
  imageBox.setAttribute("aria-hidden", "true");
  if (student?.id) {
    const image = document.createElement("img");
    image.src = "portraits/" + student.id + ".webp";
    image.alt = "";
    image.decoding = "async";
    if (size === "small") image.loading = "lazy";
    image.addEventListener("error", () => image.remove(), { once: true });
    imageBox.append(image);
  }
  return imageBox;
}

function renderRoster() {
  const slots = draft.roster.map((id, index) => {
    const student = students.get(id);
    const button = element("button", student ? "slot" : "slot empty");
    button.type = "button";
    button.setAttribute("aria-label", (index + 1) + "번 자리, " + (student?.name ?? "학생 선택"));
    button.setAttribute("aria-haspopup", "dialog");
    button.title = student?.name ?? "학생 선택";
    button.append(element("span", "slot-number", index + 1), portrait(student), element("span", "slot-name", student?.name ?? "학생 선택"));
    button.addEventListener("click", () => openPicker(index, button));
    return button;
  });
  byId("roster").replaceChildren(...slots);
  byId("roster-count").textContent = draft.roster.filter(Boolean).length + " / 6명";
}

function normalize(text) {
  return text.toLowerCase().replace(/[\s_()（）·-]+/g, "");
}

function renderPicker() {
  const query = normalize(byId("search").value);
  const results = sortedStudents.filter(student => {
    const names = [student.name, (student.family ?? "") + student.name, student.path ?? "", aliases.get(student.id) ?? ""];
    return names.some(name => normalize(name).includes(query));
  });
  const choices = results.map(student => {
    const occupied = draft.roster.indexOf(student.id);
    const button = element("button", "student-choice");
    button.type = "button";
    button.disabled = occupied !== -1 && occupied !== pickerSlot;
    const details = element("span", "", student.name);
    if (occupied !== -1) details.append(element("small", "", (occupied + 1) + "번에 편성됨"));
    button.append(portrait(student, "small"), details);
    button.addEventListener("click", () => chooseStudent(student.id));
    return button;
  });
  byId("student-results").replaceChildren(...(choices.length ? choices : [element("p", "no-results", "검색 결과가 없습니다.")]));
  byId("student-results").scrollTop = 0;
  byId("search-status").textContent = results.length + "명 검색됨";
}

function openPicker(index, trigger) {
  pickerSlot = index;
  pickerTrigger = trigger;
  byId("picker-slot").textContent = (index + 1) + "번 자리에 배치할 학생";
  byId("clear-slot").disabled = draft.roster[index] === null;
  byId("search").value = "";
  renderPicker();
  byId("student-picker").showModal();
  byId("search").focus();
}

function chooseStudent(id) {
  const previous = draft.roster[pickerSlot];
  if (previous !== id) {
    draft.roster[pickerSlot] = id;
    if (previous !== null) {
      for (const step of draft.steps) {
        if (step.actor === previous) step.actor = null;
        if (step.target === previous) step.target = null;
      }
    }
    renderRoster();
    renderEditor();
    pickerTrigger = byId("roster").children[pickerSlot];
    draftChanged();
  }
  byId("student-picker").close();
}

function studentOptions() {
  return draft.roster.flatMap((id, index) => id === null ? [] : [[id, (index + 1) + ". " + students.get(id).name]]);
}

function editSelect(label, value, options, placeholder) {
  const select = document.createElement("select");
  select.setAttribute("aria-label", label);
  select.append(new Option(placeholder, ""));
  for (const [id, name] of options) select.add(new Option(name, id));
  select.value = value ?? "";
  return select;
}

function actionButton(label, symbol, disabled, onClick, className = "") {
  const button = element("button", className, symbol);
  button.type = "button";
  button.disabled = disabled;
  button.title = label;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", onClick);
  return button;
}

function renderEditor() {
  const options = studentOptions();
  const targetOptions = [
    ...options,
    ...[...genericTargets].map(([id, target]) => [id, target.name]),
  ];
  const rows = draft.steps.map((step, index) => {
    const row = element("li", "edit-row");
    const stepLabel = (index + 1) + "단계";
    const actor = editSelect(stepLabel + " 사용 학생", step.actor, options, "학생 선택");
    const target = editSelect(stepLabel + " 스킬 대상", step.target, targetOptions, "대상 선택");
    actor.addEventListener("change", () => {
      step.actor = actor.value ? Number(actor.value) : null;
      actor.removeAttribute("aria-invalid");
      draftChanged();
    });
    target.addEventListener("change", () => {
      step.target = genericTargets.has(target.value) ? target.value : Number(target.value) || null;
      target.removeAttribute("aria-invalid");
      draftChanged();
    });
    const controls = element("span", "row-controls");
    controls.append(
      actionButton(stepLabel + " 위로 이동", "↑", index === 0, () => moveStep(index, -1)),
      actionButton(stepLabel + " 아래로 이동", "↓", index === draft.steps.length - 1, () => moveStep(index, 1)),
      actionButton(stepLabel + " 삭제", "×", false, () => removeStep(index), "remove"),
    );
    const arrow = element("span", "arrow", "→");
    arrow.setAttribute("aria-hidden", "true");
    row.append(element("span", "edit-number", index + 1), actor, arrow, target, controls);
    return row;
  });
  byId("steps").replaceChildren(...(rows.length ? rows : [element("li", "empty-sequence", "단계를 추가해 스킬 순서를 만드세요.")]));
}

function moveStep(index, direction) {
  const destination = index + direction;
  [draft.steps[index], draft.steps[destination]] = [draft.steps[destination], draft.steps[index]];
  renderEditor();
  const row = byId("steps").children[destination];
  const button = row.querySelectorAll("button")[direction < 0 ? 0 : 1];
  (button.disabled ? row.querySelector("select") : button).focus();
  draftChanged();
}

function removeStep(index) {
  draft.steps.splice(index, 1);
  renderEditor();
  const row = byId("steps").children[Math.min(index, draft.steps.length - 1)];
  (row?.querySelector("select") ?? byId("add")).focus();
  draftChanged();
}

function draftChanged(message) {
  const ready = JSON.stringify(draft) === JSON.stringify(applied);
  formStatus(message ?? (ready ? "" : "변경한 편성과 순서를 적용하려면 OK를 누르세요."));
  save();
}

function formStatus(message, error = false) {
  const node = byId("form-status");
  node.textContent = message;
  node.classList.toggle("error", error);
}

function arrow() {
  const arrow = element("span", "arrow", "→");
  arrow.setAttribute("aria-hidden", "true");
  return arrow;
}

function token(student, isTarget = false) {
  const token = element("span", isTarget ? "student-token target-token" : "student-token");
  const details = element("span");
  details.append(element("strong", "", student.name));
  if (!isTarget) details.append(element("small", "", student.ex));
  token.title = student.name;
  token.append(portrait(student, isTarget ? "small" : ""), details);
  return token;
}

function targetInfo(step) {
  return step.target === "self" ? { ...students.get(step.actor), name: "자신" } :
    students.get(step.target) ?? genericTargets.get(step.target);
}

function renderSequence() {
  const summary = [];
  const rows = applied.steps.map((step, index) => {
    const actor = students.get(step.actor);
    const target = targetInfo(step);
    const studentTarget = students.get(step.target);
    if (index > 0) summary.push(arrow());
    summary.push(element("span", "", actor.name + (studentTarget ? "(" + studentTarget.name + ")" : "")));

    const row = element("li");
    const button = element("button", "sequence-row");
    button.type = "button";
    button.setAttribute("aria-label", (index + 1) + "단계, " + actor.name + " " + actor.ex + ", 대상 " + target.name);
    button.append(element("span", "sequence-number", index + 1), token(actor), arrow(), token(target, true));
    button.addEventListener("click", () => goTo(index));
    row.append(button);
    return row;
  });
  byId("summary").replaceChildren(...summary);
  byId("sequence").replaceChildren(...rows);
  renderCursor();
}

function renderCursor() {
  const length = applied.steps.length;
  const done = cursor === length;
  for (const [index, row] of [...byId("sequence").children].entries()) {
    const current = index === cursor;
    row.firstElementChild.classList.toggle("current", current);
    if (current) row.firstElementChild.setAttribute("aria-current", "step");
    else row.firstElementChild.removeAttribute("aria-current");
  }
  byId("progress").textContent = done ? "연습 완료" : (cursor + 1) + " / " + length + " 단계";
  byId("previous").disabled = cursor === 0;
  byId("restart").disabled = cursor === 0;
  byId("next").disabled = done;
  byId("next").textContent = cursor >= length - 1 ? "완료" : "다음 단계";
  const step = applied.steps[cursor];
  byId("sequence-status").textContent = done ? "모든 스킬 단계를 완료했습니다." :
    (cursor + 1) + "단계, " + students.get(step.actor).name + ", 대상 " + targetInfo(step).name;
}

function goTo(index) {
  cursor = Math.max(0, Math.min(applied.steps.length, index));
  renderCursor();
  save();
}

byId("search").addEventListener("input", renderPicker);
byId("search").addEventListener("keydown", event => {
  if (event.key !== "Enter" || event.isComposing) return;
  const choices = byId("student-results").querySelectorAll("button:not(:disabled)");
  if (choices.length === 1) choices[0].click();
  else choices[0]?.focus();
});
byId("close-picker").addEventListener("click", () => byId("student-picker").close());
byId("clear-slot").addEventListener("click", () => chooseStudent(null));
byId("student-picker").addEventListener("close", () => pickerTrigger?.focus());
byId("add").addEventListener("click", () => {
  draft.steps.push({ actor: null, target: "none" });
  renderEditor();
  byId("steps").lastElementChild.querySelector("select").focus();
  draftChanged();
});
byId("example").addEventListener("click", () => {
  draft = examplePlan();
  renderRoster();
  renderEditor();
  draftChanged("예제 편성과 순서를 불러왔습니다. OK를 누르면 1단계부터 시작합니다.");
});

byId("editor").addEventListener("submit", event => {
  event.preventDefault();
  const emptySlot = draft.roster.indexOf(null);
  if (emptySlot !== -1) {
    formStatus((emptySlot + 1) + "번 자리에 학생을 편성해 주세요.", true);
    byId("roster").children[emptySlot].focus();
    return;
  }
  if (!draft.steps.length) {
    formStatus("스킬 단계를 하나 이상 추가해 주세요.", true);
    byId("add").focus();
    return;
  }
  const invalid = draft.steps.findIndex(step => step.actor === null || step.target === null);
  if (invalid !== -1) {
    const missingActor = draft.steps[invalid].actor === null;
    formStatus((invalid + 1) + "단계의 " + (missingActor ? "사용 학생" : "스킬 대상") + "을 선택해 주세요.", true);
    const select = byId("steps").children[invalid].querySelectorAll("select")[missingActor ? 0 : 1];
    select.setAttribute("aria-invalid", "true");
    select.focus();
    return;
  }
  applied = clone(draft);
  cursor = 0;
  renderSequence();
  save();
  formStatus("적용했습니다. 스킬 진행에서 1단계부터 시작합니다.");
  if (matchMedia("(max-width: 820px)").matches) {
    byId("sequence-title").parentElement.scrollIntoView({ block: "start" });
  }
});
byId("previous").addEventListener("click", () => goTo(cursor - 1));
byId("next").addEventListener("click", () => goTo(cursor + 1));
byId("restart").addEventListener("click", () => goTo(0));

renderRoster();
renderEditor();
renderSequence();
if (JSON.stringify(draft) !== JSON.stringify(applied)) draftChanged();
