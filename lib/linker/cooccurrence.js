export function buildCooccurrenceLinks(notes, minCooc = 2) {
    const cooc = new Map();
    for (const note of notes) {
        const tags = note.tags.slice(1); // 去掉类型标签
        for (let i = 0; i < tags.length; i++) {
            for (let j = i + 1; j < tags.length; j++) {
                if (tags[i] === tags[j])
                    continue;
                const key = [tags[i], tags[j]].sort().join('\x00');
                cooc.set(key, (cooc.get(key) || 0) + 1);
            }
        }
    }
    const links = [];
    for (const [key, weight] of cooc.entries()) {
        if (weight < minCooc)
            continue;
        const [t1, t2] = key.split('\x00');
        links.push({ source: `tag_${t1}`, target: `tag_${t2}`, type: 'cooccurrence', weight });
    }
    return links;
}
