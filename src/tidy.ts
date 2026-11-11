/**
 * Obsidian renders a source line break between two embeds as a <br>, and Live
 * Preview renders each source line as its own block. Either way, images that
 * live on separate lines can never sit side by side — so a column layout needs
 * them on one line first.
 */

/** A line that contains nothing but one or more wiki image embeds. */
const IMAGE_ONLY_LINE = /^\s*(?:!\[\[[^\]\n]+\]\]\s*)+$/;

export interface TidyResult {
	content: string;
	/** How many line breaks were removed. */
	joined: number;
}

/**
 * Merges runs of adjacent image-only lines into one line. Everything else is
 * left byte-for-byte intact, so frontmatter and prose are never touched.
 */
export function joinAdjacentImageLines(content: string): TidyResult {
	const lines = content.split('\n');
	const out: string[] = [];
	let joined = 0;
	let i = 0;

	while (i < lines.length) {
		if (!IMAGE_ONLY_LINE.test(lines[i])) {
			out.push(lines[i]);
			i += 1;
			continue;
		}

		let end = i;
		while (end + 1 < lines.length && IMAGE_ONLY_LINE.test(lines[end + 1])) end += 1;

		if (end === i) {
			out.push(lines[i]);
			i += 1;
			continue;
		}

		out.push(lines.slice(i, end + 1).map((line) => line.trim()).join(''));
		joined += end - i;
		i = end + 1;
	}

	return { content: out.join('\n'), joined };
}
