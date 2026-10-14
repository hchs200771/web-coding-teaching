// 建立 DOM 元素的小工具（各個互動元件共用）
export function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}
