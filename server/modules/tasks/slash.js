// `/task Title words @user due:YYYY-MM-DD`
export function parseTaskCommand(text) {
  const m = /^\/task(?:\s+([\s\S]*))?$/i.exec(text.trim());
  if (!m) return null;
  let rest = m[1] || '';

  let dueDate;
  rest = rest.replace(/\bdue:(\d{4}-\d{2}-\d{2})\b/i, (_, d) => {
    // due at end of that day, local server time
    const date = new Date(`${d}T23:59:00`);
    if (!Number.isNaN(date.getTime())) dueDate = date;
    return '';
  });

  const mentions = [];
  rest = rest.replace(/@([\w.\-]+)/g, (_, handle) => {
    mentions.push(handle.toLowerCase());
    return '';
  });

  return { title: rest.replace(/\s+/g, ' ').trim(), mentions, dueDate };
}

// A handle matches the email local-part, the name without spaces, or the first name.
export function resolveMentions(handles, users) {
  const ids = new Set();
  for (const h of handles) {
    const user = users.find((u) => {
      const name = u.name.toLowerCase();
      return (
        u.email.split('@')[0].toLowerCase() === h ||
        name.replace(/\s+/g, '') === h ||
        name.split(/\s+/)[0] === h ||
        name.replace(/\s+/g, '.') === h
      );
    });
    if (user) ids.add(String(user._id));
  }
  return [...ids];
}
