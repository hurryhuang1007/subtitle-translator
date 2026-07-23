/**
 * 保护 ASS 覆盖标签，避免翻译时破坏 {\i1} / {\an8} 等。
 * 使用私有区占位符，降低被翻译引擎改写的概率。
 */
export function protectAssTags(text: string) {
  const tags: string[] = [];
  const protectedText = text.replace(/\{[^}]*\}/g, match => {
    const index = tags.length;
    tags.push(match);
    return `\uE000${index}\uE001`;
  });

  return { protectedText, tags };
}

export function restoreAssTags(text: string, tags: string[]) {
  return text.replace(/\uE000(\d+)\uE001/g, (_match, indexText: string) => {
    const index = Number(indexText);
    return tags[index] ?? '';
  });
}
