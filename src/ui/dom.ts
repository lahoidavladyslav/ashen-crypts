type Child = Node | string;

interface Props {
  class?: string;
  text?: string;
  style?: string;
  onclick?: () => void;
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  if (props.class) element.className = props.class;
  if (props.text !== undefined) element.textContent = props.text;
  if (props.style) element.setAttribute("style", props.style);
  if (props.onclick) element.addEventListener("click", props.onclick);
  for (const child of children) element.append(child);
  return element;
}

export function toast(message: string): void {
  const element = h("div", { class: "toast", text: message });
  document.body.append(element);
  setTimeout(() => element.remove(), 2600);
}

export function floatText(x: number, y: number, text: string): void {
  const element = h("div", { class: "float", text });
  element.style.left = `${x - 20}px`;
  element.style.top = `${y - 20}px`;
  document.body.append(element);
  setTimeout(() => element.remove(), 800);
}

export function modal(title: string, lines: Child[], buttonText: string): void {
  const close = (): void => overlay.remove();
  const box = h(
    "div",
    { class: "box" },
    h("h2", { text: title }),
    ...lines,
    h("button", { class: "primary", text: buttonText, onclick: close }),
  );
  const overlay = h("div", { class: "modal" }, box);
  document.body.append(overlay);
}
